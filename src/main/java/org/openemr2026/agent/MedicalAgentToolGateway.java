package org.openemr2026.agent;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
final class MedicalAgentToolGateway {

    private static final Map<String, ToolDefinition> TOOLS = Map.of(
            "RECORDS", new ToolDefinition("CLINICAL_DOCUMENT_READ", "当前就诊文书版本读取"),
            "ORDERS", new ToolDefinition("CLINICAL_ORDER_READ", "当前就诊医嘱读取"),
            "RESULTS", new ToolDefinition("CLINICAL_RESULT_READ", "当前就诊结果读取"),
            "TASKS", new ToolDefinition("CLINICAL_TASK_READ", "当前就诊任务读取"),
            "ATTACHMENTS", new ToolDefinition("CLINICAL_ATTACHMENT_READ", "当前就诊附件元数据读取"));

    private final JdbcClient jdbc;
    private final ObjectMapper objectMapper;

    MedicalAgentToolGateway(JdbcClient jdbc, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
    }

    List<ToolResult> execute(
            UUID tenantId, UUID runId, UUID childRunId, UUID leaseId, UUID patientId, UUID encounterId,
            String authorizationWatermark, Set<String> scopes) {
        List<ToolResult> results = new ArrayList<>();
        for (String scope : List.of("RECORDS", "ORDERS", "RESULTS", "TASKS", "ATTACHMENTS")) {
            if (scopes.contains(scope)) {
                results.add(executeOne(tenantId, runId, childRunId, leaseId, patientId, encounterId,
                        authorizationWatermark, TOOLS.get(scope)));
            }
        }
        return List.copyOf(results);
    }

    private ToolResult executeOne(
            UUID tenantId, UUID runId, UUID childRunId, UUID leaseId, UUID patientId, UUID encounterId,
            String watermark, ToolDefinition definition) {
        ensureLease(tenantId, leaseId, patientId, encounterId, watermark);
        String version = jdbc.sql("""
                select tool_version from tool_registry
                where tenant_id = :tenant and tool_code = :code and status = 'ACTIVE'
                order by updated_at desc, tool_registry_id desc limit 1
                """).param("tenant", tenantId).param("code", definition.code())
                .query(String.class).optional().orElseThrow(() -> new AgentRunException(
                        "MEDICAL_AGENT_TOOL_DISABLED", 409,
                        "The required scoped clinical tool is not active: " + definition.code()));
        UUID invocationId = UUID.randomUUID();
        String inputHash = sha256(tenantId + "|" + patientId + "|" + encounterId + "|" + definition.code()
                + "|" + watermark);
        long started = System.nanoTime();
        try {
            List<Map<String, Object>> items = read(definition.code(), tenantId, patientId, encounterId);
            List<Map<String, Object>> references = references(definition.code(), items, watermark);
            long durationMs = elapsedMillis(started);
            String resultHash = sha256(json(items));
            record(tenantId, invocationId, runId, childRunId, definition.code(), version, watermark,
                    inputHash, resultHash, items.size(), "SUCCEEDED", durationMs, null);
            return new ToolResult(invocationId, definition.code(), version, definition.displayName(),
                    items, references, durationMs);
        } catch (AgentRunException failure) {
            record(tenantId, invocationId, runId, childRunId, definition.code(), version, watermark,
                    inputHash, null, 0, "FAILED", elapsedMillis(started), failure.code());
            throw failure;
        } catch (RuntimeException failure) {
            record(tenantId, invocationId, runId, childRunId, definition.code(), version, watermark,
                    inputHash, null, 0, "FAILED", elapsedMillis(started), "MEDICAL_AGENT_TOOL_FAILED");
            throw new AgentRunException("MEDICAL_AGENT_TOOL_FAILED", 503,
                    "The scoped clinical tool failed: " + definition.code());
        }
    }

    private void ensureLease(UUID tenantId, UUID leaseId, UUID patientId, UUID encounterId, String watermark) {
        long valid = jdbc.sql("""
                select count(*) from context_lease
                where tenant_id = :tenant and lease_id = :lease and patient_id = :patient
                  and encounter_id = :encounter and authorization_watermark = :watermark
                  and revoked_at is null and expires_at > now()
                """).param("tenant", tenantId).param("lease", leaseId).param("patient", patientId)
                .param("encounter", encounterId).param("watermark", watermark).query(Long.class).single();
        if (valid != 1) {
            throw new AgentRunException("CONTEXT_NOT_PERMITTED", 403,
                    "The medical-agent context lease expired before tool execution");
        }
    }

    private List<Map<String, Object>> read(String code, UUID tenantId, UUID patientId, UUID encounterId) {
        return switch (code) {
            case "CLINICAL_DOCUMENT_READ" -> documents(tenantId, patientId, encounterId);
            case "CLINICAL_ORDER_READ" -> orders(tenantId, patientId, encounterId);
            case "CLINICAL_RESULT_READ" -> results(tenantId, patientId, encounterId);
            case "CLINICAL_TASK_READ" -> tasks(tenantId, patientId, encounterId);
            case "CLINICAL_ATTACHMENT_READ" -> attachments(tenantId, patientId, encounterId);
            default -> throw new AgentRunException("MEDICAL_AGENT_TOOL_NOT_ALLOWED", 403,
                    "The requested tool is not in the medical-agent allowlist");
        };
    }

    private List<Map<String, Object>> documents(UUID tenantId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select document.document_id, version.document_version_id, document.document_type_code,
                  version.status, version.version_no, version.sections::text, version.content_hash,
                  version.created_at
                from clinical_document document
                join clinical_document_version version on version.tenant_id = document.tenant_id
                  and version.document_id = document.document_id
                  and version.document_version_id = document.current_version_id
                where document.tenant_id = :tenant and document.patient_id = :patient
                  and document.encounter_id = :encounter and document.status <> 'VOID'
                order by document.updated_at desc, document.document_id limit 12
                """).param("tenant", tenantId).param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> item(
                        "source_type", "DOCUMENT_VERSION",
                        "source_id", rs.getObject("document_version_id", UUID.class),
                        "document_id", rs.getObject("document_id", UUID.class),
                        "document_type", rs.getString("document_type_code"),
                        "status", rs.getString("status"),
                        "version", rs.getInt("version_no"),
                        "sections", map(rs.getString("sections")),
                        "content_hash", rs.getString("content_hash"),
                        "recorded_at", rs.getObject("created_at", OffsetDateTime.class))).list();
    }

    private List<Map<String, Object>> orders(UUID tenantId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select orders.order_id, orders.status, orders.order_scope, orders.clinical_indication,
                  item.order_item_id, item.item_type, item.catalog_code, item.display_name,
                  item.requested_quantity, item.quantity_unit, item.instructions, item.item_state,
                  item.row_version, item.updated_at
                from clinical_order orders
                join clinical_order_item item on item.tenant_id = orders.tenant_id and item.order_id = orders.order_id
                where orders.tenant_id = :tenant and orders.patient_id = :patient
                  and orders.encounter_id = :encounter
                order by item.updated_at desc, item.order_item_id limit 20
                """).param("tenant", tenantId).param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> item(
                        "source_type", "ORDER_ITEM",
                        "source_id", rs.getObject("order_item_id", UUID.class),
                        "order_id", rs.getObject("order_id", UUID.class),
                        "order_status", rs.getString("status"),
                        "order_scope", rs.getString("order_scope"),
                        "clinical_indication", rs.getString("clinical_indication"),
                        "item_type", rs.getString("item_type"),
                        "catalog_code", rs.getString("catalog_code"),
                        "display_name", rs.getString("display_name"),
                        "quantity", rs.getBigDecimal("requested_quantity"),
                        "unit", rs.getString("quantity_unit"),
                        "instructions", rs.getString("instructions"),
                        "state", rs.getString("item_state"),
                        "version", rs.getLong("row_version"),
                        "recorded_at", rs.getObject("updated_at", OffsetDateTime.class))).list();
    }

    private List<Map<String, Object>> results(UUID tenantId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select result.result_id, version.result_version_id, result.report_type, result.source_system,
                  version.version_no, version.report_status, version.conclusion, version.reported_at,
                  version.change_type, version.correction_reason,
                  exists(select 1 from critical_value_case critical
                    where critical.tenant_id = result.tenant_id and critical.result_id = result.result_id
                      and critical.state <> 'DISPOSED') as open_critical
                from clinical_result result
                join clinical_result_version version on version.tenant_id = result.tenant_id
                  and version.result_id = result.result_id and version.result_version_id = result.current_version_id
                where result.tenant_id = :tenant and result.patient_id = :patient
                  and result.encounter_id = :encounter
                order by version.reported_at desc, result.result_id limit 20
                """).param("tenant", tenantId).param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> item(
                        "source_type", "RESULT_VERSION",
                        "source_id", rs.getObject("result_version_id", UUID.class),
                        "result_id", rs.getObject("result_id", UUID.class),
                        "report_type", rs.getString("report_type"),
                        "source_system", rs.getString("source_system"),
                        "version", rs.getLong("version_no"),
                        "report_status", rs.getString("report_status"),
                        "conclusion", rs.getString("conclusion"),
                        "open_critical", rs.getBoolean("open_critical"),
                        "change_type", rs.getString("change_type"),
                        "correction_reason", rs.getString("correction_reason"),
                        "recorded_at", rs.getObject("reported_at", OffsetDateTime.class))).list();
    }

    private List<Map<String, Object>> tasks(UUID tenantId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select task_id, source_type, task_type, title, risk_level, state, business_state,
                  due_at, source_route, row_version, updated_at
                from clinical_task where tenant_id = :tenant and patient_id = :patient
                  and encounter_id = :encounter and state not in ('WITHDRAWN', 'EXPIRED')
                order by case risk_level when 'CRITICAL' then 0 when 'HIGH' then 1 else 2 end,
                  due_at nulls last, updated_at desc, task_id limit 20
                """).param("tenant", tenantId).param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> item(
                        "source_type", "CLINICAL_TASK",
                        "source_id", rs.getObject("task_id", UUID.class),
                        "task_type", rs.getString("task_type"),
                        "origin", rs.getString("source_type"),
                        "title", rs.getString("title"),
                        "risk_level", rs.getString("risk_level"),
                        "state", rs.getString("state"),
                        "business_state", rs.getString("business_state"),
                        "due_at", rs.getObject("due_at", OffsetDateTime.class),
                        "source_route", rs.getString("source_route"),
                        "version", rs.getLong("row_version"),
                        "recorded_at", rs.getObject("updated_at", OffsetDateTime.class))).list();
    }

    private List<Map<String, Object>> attachments(UUID tenantId, UUID patientId, UUID encounterId) {
        return jdbc.sql("""
                select attachment_id, document_id, document_version_id, original_filename, media_type,
                  byte_size, content_hash, created_at
                from clinical_document_attachment
                where tenant_id = :tenant and patient_id = :patient and encounter_id = :encounter
                  and storage_status = 'AVAILABLE' and malware_scan_status = 'PASSED'
                order by created_at desc, attachment_id limit 12
                """).param("tenant", tenantId).param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> item(
                        "source_type", "ATTACHMENT",
                        "source_id", rs.getObject("attachment_id", UUID.class),
                        "document_id", rs.getObject("document_id", UUID.class),
                        "document_version_id", rs.getObject("document_version_id", UUID.class),
                        "filename", rs.getString("original_filename"),
                        "media_type", rs.getString("media_type"),
                        "byte_size", rs.getLong("byte_size"),
                        "content_hash", rs.getString("content_hash"),
                        "recorded_at", rs.getObject("created_at", OffsetDateTime.class))).list();
    }

    private List<Map<String, Object>> references(String toolCode, List<Map<String, Object>> items, String watermark) {
        return items.stream().map(item -> Map.<String, Object>of(
                "source_type", String.valueOf(item.get("source_type")),
                "source_id", item.get("source_id"),
                "source_version", String.valueOf(item.getOrDefault("version", item.getOrDefault("content_hash", "1"))),
                "tool_code", toolCode,
                "authorization_watermark", watermark)).toList();
    }

    private void record(UUID tenantId, UUID invocationId, UUID runId, UUID childRunId,
            String toolCode, String toolVersion, String watermark, String inputHash, String resultHash,
            int itemCount, String outcome, long durationMs, String errorCode) {
        jdbc.sql("""
                insert into medical_agent_tool_invocation(
                  tenant_id, invocation_id, root_run_id, child_run_id, tool_code, tool_version,
                  authorization_watermark, input_hash, result_hash, item_count, outcome,
                  duration_ms, error_code, completed_at)
                values (:tenant, :invocation, :root, :child, :tool, :version,
                  :watermark, :input_hash, :result_hash, :items, :outcome,
                  :duration, :error, now())
                """).param("tenant", tenantId).param("invocation", invocationId).param("root", runId)
                .param("child", childRunId).param("tool", toolCode).param("version", toolVersion)
                .param("watermark", watermark).param("input_hash", inputHash).param("result_hash", resultHash)
                .param("items", itemCount).param("outcome", outcome).param("duration", durationMs)
                .param("error", errorCode).update();
    }

    private Map<String, Object> map(String json) {
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> value = objectMapper.convertValue(objectMapper.readTree(json), Map.class);
            return value;
        } catch (Exception invalid) {
            throw new AgentRunException("MEDICAL_AGENT_TOOL_RESULT_INVALID", 500,
                    "A clinical document contains invalid structured content");
        }
    }

    private String json(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception invalid) {
            throw new IllegalStateException("Medical-agent tool result cannot be serialized", invalid);
        }
    }

    private static Map<String, Object> item(Object... entries) {
        Map<String, Object> result = new LinkedHashMap<>();
        for (int index = 0; index < entries.length; index += 2) {
            Object value = entries[index + 1];
            if (value != null) result.put(String.valueOf(entries[index]), value);
        }
        return Map.copyOf(result);
    }

    private static long elapsedMillis(long started) {
        return Math.max(0, (System.nanoTime() - started) / 1_000_000);
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    record ToolResult(UUID invocationId, String toolCode, String toolVersion, String displayName,
            List<Map<String, Object>> items, List<Map<String, Object>> sourceReferences, long durationMs) {}

    private record ToolDefinition(String code, String displayName) {}
}
