package org.openemr2026.executioncenter;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import org.openemr2026.contracts.SpecialtyExecutionCaseCreateRequestWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseEventWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseTransitionRequestWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseUpdateRequestWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
final class SpecialtyExecutionCaseService {
    private static final Map<String, List<String>> REQUIRED_READY_FIELDS = Map.of(
            "PATHOLOGY", List.of("patient_identifier_one", "patient_identifier_two", "patient_verification_method",
                    "accession_number", "specimen_type", "specimen_site", "fixative"),
            "THERAPY", List.of("patient_identifier_one", "patient_identifier_two", "patient_verification_method",
                    "therapy_code", "course_number", "session_number", "verification_method"),
            "ANESTHESIA", List.of("patient_identifier_one", "patient_identifier_two", "patient_verification_method",
                    "surgical_procedure_id", "asa_class", "anesthesia_method", "fasting_confirmed", "consent_confirmed"),
            "DEVICE_MONITORING", List.of("patient_identifier_one", "patient_identifier_two", "patient_verification_method",
                    "device_id", "device_type", "binding_verified", "clock_offset_seconds", "alarm_policy",
                    "monitoring_parameters"));

    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;

    SpecialtyExecutionCaseService(JdbcClient jdbc, TransactionTemplate transactions, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
    }

    List<SpecialtyExecutionCaseWire> list(
            ClinicalIdentity identity, UUID facilityId, UUID patientId, UUID encounterId, String domain) {
        requireEncounter(identity, facilityId, patientId, encounterId);
        String normalized = specialtyDomain(domain);
        return jdbc.sql("""
                select specialty_execution_case_id from specialty_execution_case
                where tenant_id = :tenant and facility_id = :facility and patient_id = :patient
                  and encounter_id = :encounter and domain = :domain
                order by updated_at desc, specialty_execution_case_id desc
                """).param("tenant", identity.tenantId()).param("facility", facilityId)
                .param("patient", patientId).param("encounter", encounterId).param("domain", normalized)
                .query(UUID.class).list().stream().map(id -> get(identity, facilityId, patientId, encounterId, id)).toList();
    }

    SpecialtyExecutionCaseWire get(
            ClinicalIdentity identity, UUID facilityId, UUID patientId, UUID encounterId, UUID caseId) {
        requireEncounter(identity, facilityId, patientId, encounterId);
        return jdbc.sql("""
                select specialty_execution_case_id, business_number, domain, patient_id, encounter_id,
                  facility_id, title, priority, status, planned_at, payload::text, created_by,
                  last_actor_user_id, row_version, created_at, updated_at
                from specialty_execution_case
                where tenant_id = :tenant and specialty_execution_case_id = :case
                  and facility_id = :facility and patient_id = :patient and encounter_id = :encounter
                """).param("tenant", identity.tenantId()).param("case", caseId).param("facility", facilityId)
                .param("patient", patientId).param("encounter", encounterId)
                .query((rs, row) -> new SpecialtyExecutionCaseWire(
                        rs.getObject("specialty_execution_case_id", UUID.class), rs.getString("business_number"),
                        SpecialtyExecutionCaseWire.DomainValue.valueOf(rs.getString("domain")),
                        rs.getObject("patient_id", UUID.class), rs.getObject("encounter_id", UUID.class),
                        rs.getObject("facility_id", UUID.class), rs.getString("title"),
                        SpecialtyExecutionCaseWire.PriorityValue.valueOf(rs.getString("priority")),
                        SpecialtyExecutionCaseWire.StatusValue.valueOf(rs.getString("status")),
                        instant(rs.getObject("planned_at", OffsetDateTime.class)), payload(rs.getString("payload")),
                        rs.getObject("created_by", UUID.class), rs.getObject("last_actor_user_id", UUID.class),
                        rs.getLong("row_version"), instant(rs.getObject("created_at", OffsetDateTime.class)),
                        instant(rs.getObject("updated_at", OffsetDateTime.class)), events(identity, caseId)))
                .optional().orElseThrow(SpecialtyExecutionCaseService::contextDenied);
    }

    SpecialtyExecutionCaseWire create(
            ClinicalIdentity identity, String idempotencyKey, SpecialtyExecutionCaseCreateRequestWire request) {
        String domain = specialtyDomain(request.domain().name());
        validateDraft(request.title(), request.payload());
        requireEncounter(identity, request.facilityId(), request.patientId(), request.encounterId());
        return transactions.execute(status -> {
            UUID caseId = UUID.randomUUID();
            beginCommand(identity, "SPECIALTY_EXECUTION_CREATE", idempotencyKey,
                    sha256(domain + "|" + request.patientId() + "|" + request.encounterId() + "|" + request.title()));
            String businessNumber = businessNumber(domain, caseId);
            jdbc.sql("""
                    insert into specialty_execution_case(
                      tenant_id, specialty_execution_case_id, business_number, domain, patient_id,
                      encounter_id, facility_id, title, priority, status, planned_at, payload,
                      created_by, last_actor_user_id)
                    values (:tenant, :case, :number, :domain, :patient, :encounter, :facility,
                      :title, :priority, 'DRAFT', :planned, cast(:payload as jsonb), :actor, :actor)
                    """).param("tenant", identity.tenantId()).param("case", caseId).param("number", businessNumber)
                    .param("domain", domain).param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId()).param("title", request.title().trim())
                    .param("priority", request.priority().name()).param("planned", offset(request.plannedAt()))
                    .param("payload", json(request.payload())).param("actor", identity.userId()).update();
            appendEvent(identity, caseId, "CREATED", null, "DRAFT", "创建专业执行病例", request.payload(), 1L);
            completeCommand(identity, "SPECIALTY_EXECUTION_CREATE", idempotencyKey, caseId, 201);
            return get(identity, request.facilityId(), request.patientId(), request.encounterId(), caseId);
        });
    }

    SpecialtyExecutionCaseWire update(
            ClinicalIdentity identity, UUID caseId, String idempotencyKey, SpecialtyExecutionCaseUpdateRequestWire request) {
        validateDraft(request.title(), request.payload());
        requireEncounter(identity, request.facilityId(), request.patientId(), request.encounterId());
        return transactions.execute(status -> {
            SpecialtyExecutionCaseWire current = get(identity, request.facilityId(), request.patientId(), request.encounterId(), caseId);
            if (current.status() != SpecialtyExecutionCaseWire.StatusValue.DRAFT) {
                throw new ExecutionWorklistException("SPECIALTY_CASE_NOT_EDITABLE", 409, "只有草稿状态可编辑；运行中记录请追加事件");
            }
            beginCommand(identity, "SPECIALTY_EXECUTION_UPDATE", idempotencyKey,
                    sha256(caseId + "|" + request.expectedRowVersion() + "|" + request.title() + "|" + json(request.payload())));
            int updated = jdbc.sql("""
                    update specialty_execution_case set title = :title, priority = :priority,
                      planned_at = :planned, payload = cast(:payload as jsonb), last_actor_user_id = :actor,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and specialty_execution_case_id = :case
                      and row_version = :expected and status = 'DRAFT'
                    """).param("title", request.title().trim()).param("priority", request.priority().name())
                    .param("planned", offset(request.plannedAt())).param("payload", json(request.payload()))
                    .param("actor", identity.userId()).param("tenant", identity.tenantId()).param("case", caseId)
                    .param("expected", request.expectedRowVersion()).update();
            if (updated != 1) throw versionConflict();
            appendEvent(identity, caseId, "UPDATED", "DRAFT", "DRAFT", "更新执行病例草稿",
                    request.payload(), request.expectedRowVersion() + 1);
            completeCommand(identity, "SPECIALTY_EXECUTION_UPDATE", idempotencyKey, caseId, 200);
            return get(identity, request.facilityId(), request.patientId(), request.encounterId(), caseId);
        });
    }

    SpecialtyExecutionCaseWire transition(
            ClinicalIdentity identity, UUID caseId, String idempotencyKey,
            SpecialtyExecutionCaseTransitionRequestWire request) {
        requireEncounter(identity, request.facilityId(), request.patientId(), request.encounterId());
        return transactions.execute(status -> {
            SpecialtyExecutionCaseWire current = get(identity, request.facilityId(), request.patientId(), request.encounterId(), caseId);
            Transition transition = transition(current.status().name(), request.action().name());
            if ("READY".equals(transition.toStatus())) validateReady(current.domain().name(), current.payload());
            if ("COMPLETED".equals(transition.toStatus())
                    && List.of("PATHOLOGY", "ANESTHESIA").contains(current.domain().name())
                    && identity.userId().equals(current.createdBy())) {
                throw new ExecutionWorklistException("INDEPENDENT_REVIEW_REQUIRED", 409,
                        "病理诊断或麻醉记录必须由不同于创建人的授权人员复核完成");
            }
            beginCommand(identity, "SPECIALTY_EXECUTION_TRANSITION", idempotencyKey,
                    sha256(caseId + "|" + request.expectedRowVersion() + "|" + request.action() + "|" + request.note()));
            int updated = jdbc.sql("""
                    update specialty_execution_case set status = :next, last_actor_user_id = :actor,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and specialty_execution_case_id = :case
                      and status = :current and row_version = :expected
                    """).param("next", transition.toStatus()).param("actor", identity.userId())
                    .param("tenant", identity.tenantId()).param("case", caseId)
                    .param("current", current.status().name()).param("expected", request.expectedRowVersion()).update();
            if (updated != 1) throw versionConflict();
            appendEvent(identity, caseId, transition.eventType(), current.status().name(), transition.toStatus(),
                    request.note().trim(), current.payload(), request.expectedRowVersion() + 1);
            completeCommand(identity, "SPECIALTY_EXECUTION_TRANSITION", idempotencyKey, caseId, 200);
            return get(identity, request.facilityId(), request.patientId(), request.encounterId(), caseId);
        });
    }

    private List<SpecialtyExecutionCaseEventWire> events(ClinicalIdentity identity, UUID caseId) {
        return jdbc.sql("""
                select specialty_execution_event_id, event_type, from_status, to_status, note,
                  snapshot::text, actor_user_id, occurred_at
                from specialty_execution_case_event
                where tenant_id = :tenant and specialty_execution_case_id = :case
                order by occurred_at, specialty_execution_event_id
                """).param("tenant", identity.tenantId()).param("case", caseId)
                .query((rs, row) -> new SpecialtyExecutionCaseEventWire(
                        rs.getObject("specialty_execution_event_id", UUID.class),
                        SpecialtyExecutionCaseEventWire.EventTypeValue.valueOf(rs.getString("event_type")),
                        rs.getString("from_status"), rs.getString("to_status"), rs.getString("note"),
                        payload(rs.getString("snapshot")), rs.getObject("actor_user_id", UUID.class),
                        instant(rs.getObject("occurred_at", OffsetDateTime.class)))).list();
    }

    private void appendEvent(ClinicalIdentity identity, UUID caseId, String type, String from, String to,
            String note, Map<String, Object> payload, long version) {
        jdbc.sql("""
                insert into specialty_execution_case_event(
                  tenant_id, specialty_execution_event_id, specialty_execution_case_id, event_type,
                  from_status, to_status, note, snapshot, actor_user_id)
                values (:tenant, :event, :case, :type, :from, :to, :note,
                  jsonb_build_object('payload', cast(:payload as jsonb), 'row_version', :version), :actor)
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID()).param("case", caseId)
                .param("type", type).param("from", from).param("to", to).param("note", note)
                .param("payload", json(payload)).param("version", version).param("actor", identity.userId()).update();
        jdbc.sql("""
                insert into outbox_event(tenant_id, event_id, aggregate_type, aggregate_id,
                  aggregate_version, event_type, schema_version, payload)
                values (:tenant, :event, 'SPECIALTY_EXECUTION_CASE', :case, :version,
                  :type, 1, jsonb_build_object('to_status', :to))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("case", caseId).param("version", version).param("type", type).param("to", to).update();
    }

    private void requireEncounter(ClinicalIdentity identity, UUID facilityId, UUID patientId, UUID encounterId) {
        long count = jdbc.sql("""
                select count(*) from encounter where tenant_id = :tenant and facility_id = :facility
                  and patient_id = :patient and encounter_id = :encounter and status <> 'CANCELLED'
                """).param("tenant", identity.tenantId()).param("facility", facilityId)
                .param("patient", patientId).param("encounter", encounterId).query(Long.class).single();
        if (count != 1) throw contextDenied();
    }

    private static void validateDraft(String title, Map<String, Object> payload) {
        if (title == null || title.trim().length() < 2 || title.length() > 256 || payload == null) {
            throw new ExecutionWorklistException("SPECIALTY_CASE_INVALID", 400, "标题和结构化业务内容不能为空");
        }
    }

    private static void validateReady(String domain, Map<String, Object> payload) {
        List<String> missing = REQUIRED_READY_FIELDS.get(domain).stream()
                .filter(key -> payload.get(key) == null || Objects.toString(payload.get(key), "").isBlank()).toList();
        if (!missing.isEmpty()) {
            throw new ExecutionWorklistException("SPECIALTY_CASE_REQUIRED_FIELDS_MISSING", 422,
                    "进入执行前缺少中国医院生产必填项：" + String.join("、", missing));
        }
        if (Objects.equals(payload.get("patient_identifier_one"), payload.get("patient_identifier_two"))) {
            throw new ExecutionWorklistException("PATIENT_TWO_IDENTIFIER_CHECK_FAILED", 422,
                    "患者双标识必须来自两种不同标识");
        }
        if ("ANESTHESIA".equals(domain)
                && (!Boolean.TRUE.equals(payload.get("fasting_confirmed"))
                || !Boolean.TRUE.equals(payload.get("consent_confirmed")))) {
            throw new ExecutionWorklistException("ANESTHESIA_PREOPERATIVE_VERIFICATION_FAILED", 422,
                    "麻醉就绪前必须明确完成禁食禁饮和麻醉知情同意核验");
        }
        if ("DEVICE_MONITORING".equals(domain)) {
            if (!Boolean.TRUE.equals(payload.get("binding_verified"))) {
                throw new ExecutionWorklistException("DEVICE_PATIENT_BINDING_NOT_VERIFIED", 422,
                        "设备监测启用前必须完成患者双标识与设备身份复核");
            }
            double clockOffset;
            try {
                clockOffset = Double.parseDouble(Objects.toString(payload.get("clock_offset_seconds")));
            } catch (NumberFormatException invalid) {
                throw new ExecutionWorklistException("DEVICE_CLOCK_OFFSET_INVALID", 422,
                        "设备时钟偏移必须是可校验的数值");
            }
            if (!Double.isFinite(clockOffset) || Math.abs(clockOffset) > 30) {
                throw new ExecutionWorklistException("DEVICE_CLOCK_NOT_SYNCHRONIZED", 422,
                        "设备时钟偏移超过 30 秒，已阻断启用以避免临床时间线错序");
            }
        }
    }

    private static Transition transition(String current, String action) {
        if ("CANCEL".equals(action) && List.of("DRAFT", "READY", "IN_PROGRESS", "PENDING_REVIEW").contains(current))
            return new Transition("CANCELLED", "CANCELLED");
        return switch (current + ":" + action) {
            case "DRAFT:MARK_READY" -> new Transition("READY", "READY");
            case "READY:START" -> new Transition("IN_PROGRESS", "STARTED");
            case "IN_PROGRESS:REQUEST_REVIEW" -> new Transition("PENDING_REVIEW", "REVIEW_REQUESTED");
            case "PENDING_REVIEW:COMPLETE" -> new Transition("COMPLETED", "COMPLETED");
            default -> throw new ExecutionWorklistException("SPECIALTY_CASE_TRANSITION_INVALID", 409,
                    "当前状态不允许该操作");
        };
    }

    private static String specialtyDomain(String domain) {
        return switch (domain) {
            case "PATHOLOGY", "THERAPY", "ANESTHESIA", "DEVICE_MONITORING" -> domain;
            default -> throw new ExecutionWorklistException("SPECIALTY_DOMAIN_INVALID", 400, "该专业未启用执行病例状态机");
        };
    }

    private static String businessNumber(String domain, UUID id) {
        String prefix = switch (domain) { case "PATHOLOGY" -> "BL"; case "THERAPY" -> "ZL";
            case "ANESTHESIA" -> "MZ"; default -> "SB"; };
        return prefix + DateTimeFormatter.ofPattern("yyyyMMddHHmmss").withZone(ZoneOffset.ofHours(8))
                .format(java.time.Instant.now()) + id.toString().substring(0, 6).toUpperCase();
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String hash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new ExecutionWorklistException("INVALID_IDEMPOTENCY_KEY", 400, "必须提供有效的幂等键");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(tenant_id, command_scope, idempotency_key,
                  request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", hash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) throw new ExecutionWorklistException("IDEMPOTENCY_REPLAY", 409, "该业务命令已经提交");
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID resource, int status) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = :status,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("status", status).param("resource", resource).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    @SuppressWarnings("unchecked")
    private Map<String, Object> payload(String value) {
        try { return objectMapper.convertValue(objectMapper.readTree(value), Map.class); }
        catch (Exception invalid) { throw new ExecutionWorklistException("SPECIALTY_PAYLOAD_INVALID", 500, "存储的专业执行数据无效"); }
    }

    private String json(Map<String, Object> value) {
        try { return objectMapper.writeValueAsString(value == null ? Map.of() : value); }
        catch (Exception invalid) { throw new ExecutionWorklistException("SPECIALTY_PAYLOAD_INVALID", 400, "专业执行数据不可序列化"); }
    }

    private static String sha256(String value) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(value.getBytes(StandardCharsets.UTF_8));
            StringBuilder result = new StringBuilder();
            for (byte item : digest) result.append(String.format("%02x", item));
            return result.toString();
        } catch (Exception impossible) { throw new IllegalStateException(impossible); }
    }

    private static OffsetDateTime offset(java.time.Instant value) { return value == null ? null : value.atOffset(ZoneOffset.UTC); }
    private static java.time.Instant instant(OffsetDateTime value) { return value == null ? null : value.toInstant(); }
    private static ExecutionWorklistException contextDenied() { return new ExecutionWorklistException("RESOURCE_NOT_FOUND_OR_DENIED", 404, "未找到资源或当前上下文无权访问"); }
    private static ExecutionWorklistException versionConflict() { return new ExecutionWorklistException("SPECIALTY_CASE_VERSION_CONFLICT", 409, "记录已被其他用户更新，请刷新后重试"); }
    private record Transition(String toStatus, String eventType) {}
}
