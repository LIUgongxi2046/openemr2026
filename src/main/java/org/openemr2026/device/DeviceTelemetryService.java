package org.openemr2026.device;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.DeviceObservationWire;
import org.openemr2026.contracts.DeviceStatusWire;
import org.openemr2026.contracts.DeviceTelemetryCollectRequestWire;
import org.openemr2026.contracts.DeviceTelemetryCollectResultWire;
import org.openemr2026.contracts.MockInvocationResultWire;
import org.openemr2026.mock.MockInterfaceService;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
final class DeviceTelemetryService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ObjectMapper objectMapper;
    private final MockInterfaceService mocks;

    DeviceTelemetryService(
            JdbcClient jdbc, TransactionTemplate transactions, ObjectMapper objectMapper,
            MockInterfaceService mocks) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.objectMapper = objectMapper;
        this.mocks = mocks;
    }

    List<DeviceObservationWire> listObservations(ClinicalIdentity identity, String deviceCode) {
        StringBuilder sql = new StringBuilder("""
                select observation_id from device_observation where tenant_id = :tenant
                """);
        if (deviceCode != null && !deviceCode.isBlank()) sql.append(" and device_code = :device");
        sql.append(" order by observed_at desc, observation_id desc limit 500");
        JdbcClient.StatementSpec spec = jdbc.sql(sql.toString()).param("tenant", identity.tenantId());
        if (deviceCode != null && !deviceCode.isBlank()) spec = spec.param("device", deviceCode.trim());
        List<UUID> ids = spec.query(UUID.class).list();
        return ids.stream().map(id -> observation(identity.tenantId(), id)).toList();
    }

    List<DeviceStatusWire> listStatuses(ClinicalIdentity identity, String deviceCode) {
        StringBuilder sql = new StringBuilder("""
                select device_code from device_status where tenant_id = :tenant
                """);
        if (deviceCode != null && !deviceCode.isBlank()) sql.append(" and device_code = :device");
        sql.append(" order by device_code limit 500");
        JdbcClient.StatementSpec spec = jdbc.sql(sql.toString()).param("tenant", identity.tenantId());
        if (deviceCode != null && !deviceCode.isBlank()) spec = spec.param("device", deviceCode.trim());
        List<String> codes = spec.query(String.class).list();
        return codes.stream().map(code -> status(identity.tenantId(), code)).toList();
    }

    DeviceTelemetryCollectResultWire collect(
            ClinicalIdentity identity, String idempotencyKey, DeviceTelemetryCollectRequestWire request) {
        String deviceCode = requireText(request.deviceCode(), 2, "device_code");
        requireActiveDevice(identity.tenantId(), deviceCode);
        String scenario = request.simulationScenario() == null ? "SUCCESS" : request.simulationScenario().name();
        int recordCount = request.recordCount() == null ? 36 : request.recordCount();
        if (recordCount < 12 || recordCount > 200) {
            throw invalid("record_count must be between 12 and 200");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "DEVICE_TELEMETRY_COLLECT", idempotencyKey, sha256(deviceCode + "|" + scenario));
            Map<String, Object> payload = new java.util.LinkedHashMap<>();
            payload.put("simulation_scenario", scenario);
            payload.put("record_count", recordCount);
            payload.put("device_id", deviceCode);
            MockInvocationResultWire generated = mocks.invoke("DEVICE_GATEWAY", payload);
            List<Map<String, Object>> records = businessRecords(generated.payload());
            List<DeviceObservationWire> observations = new ArrayList<>(records.size());
            for (Map<String, Object> record : records) {
                UUID observationId = UUID.randomUUID();
                jdbc.sql("""
                        insert into device_observation(
                          tenant_id, observation_id, device_code, trace_id, metric, metric_value,
                          metric_unit, quality, alarm_level, observed_at)
                        values (:tenant, :observation, :device, :trace, :metric, :value,
                          :unit, :quality, :alarm, :observed)
                        """).param("tenant", identity.tenantId()).param("observation", observationId)
                        .param("device", deviceCode).param("trace", generated.requestId().toString())
                        .param("metric", text(record, "metric")).param("value", doubleValue(record))
                        .param("unit", text(record, "unit")).param("quality", text(record, "quality", "VERIFIED"))
                        .param("alarm", text(record, "alarm_level", "NONE"))
                        .param("observed", instantValue(record, "observed_at", generated.producedAt()).atOffset(ZoneOffset.UTC)).update();
                appendEvidence(identity, observationId, "DEVICE_OBSERVATION_RECORDED", "DeviceObservationRecorded");
                observations.add(observation(identity.tenantId(), observationId));
            }
            DeviceStatusWire deviceStatus = recomputeStatus(identity, deviceCode, scenario, records, generated.producedAt());
            completeCommand(identity, "DEVICE_TELEMETRY_COLLECT", idempotencyKey, deviceCode);
            return new DeviceTelemetryCollectResultWire(observations, deviceStatus);
        });
    }

    private DeviceStatusWire recomputeStatus(
            ClinicalIdentity identity, String deviceCode, String scenario,
            List<Map<String, Object>> records, Instant fallback) {
        Instant latest = records.stream()
                .map(record -> instantValue(record, "observed_at", fallback))
                .max(Comparator.naturalOrder()).orElse(fallback);
        Map<String, Object> newest = records.stream()
                .max(Comparator.comparing(record -> instantValue(record, "observed_at", fallback))).orElse(Map.of());
        int clockOffset = Math.max(Math.abs(intValue(newest, "device_clock_offset_seconds")),
                records.stream().mapToInt(record -> Math.abs(intValue(record, "device_clock_offset_seconds"))).max().orElse(0));
        String calibration = text(newest, "calibration_status", "VALID");
        String alarm = records.stream().map(record -> text(record, "alarm_level", "NONE"))
                .reduce("NONE", DeviceTelemetryService::maxAlarm);
        String online = "DEGRADED".equals(scenario) ? "DEGRADED" : "ONLINE";
        boolean exists = jdbc.sql("select 1 from device_status where tenant_id = :tenant and device_code = :device")
                .param("tenant", identity.tenantId()).param("device", deviceCode)
                .query(Integer.class).optional().isPresent();
        if (exists) {
            jdbc.sql("""
                    update device_status
                    set online_status = :online, clock_offset_seconds = :clock, last_observed_at = :observed,
                        calibration_status = :calibration, alarm_state = :alarm, row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and device_code = :device
                    """).param("online", online).param("clock", clockOffset)
                    .param("observed", latest.atOffset(ZoneOffset.UTC))
                    .param("calibration", calibration).param("alarm", alarm)
                    .param("tenant", identity.tenantId()).param("device", deviceCode).update();
        } else {
            jdbc.sql("""
                    insert into device_status(
                      tenant_id, device_code, online_status, clock_offset_seconds,
                      last_observed_at, calibration_status, alarm_state)
                    values (:tenant, :device, :online, :clock, :observed, :calibration, :alarm)
                    """).param("tenant", identity.tenantId()).param("device", deviceCode)
                    .param("online", online).param("clock", clockOffset)
                    .param("observed", latest.atOffset(ZoneOffset.UTC))
                    .param("calibration", calibration).param("alarm", alarm).update();
        }
        return status(identity.tenantId(), deviceCode);
    }

    private static String maxAlarm(String left, String right) {
        return rank(left) >= rank(right) ? left : right;
    }

    private static int rank(String value) {
        return switch (value) {
            case "HIGH" -> 3;
            case "MEDIUM" -> 2;
            default -> 1;
        };
    }

    private void requireActiveDevice(UUID tenantId, String deviceCode) {
        boolean active = jdbc.sql("""
                select 1 from device
                where tenant_id = :tenant and device_code = :device and status = 'ACTIVE'
                """).param("tenant", tenantId).param("device", deviceCode)
                .query(Integer.class).optional().isPresent();
        if (!active) {
            throw new DeviceException("DEVICE_NOT_ACTIVE", 409, "设备不存在或未处于 ACTIVE 状态");
        }
    }

    private DeviceObservationWire observation(UUID tenantId, UUID observationId) {
        return jdbc.sql("""
                select observation_id, device_code, trace_id, metric, metric_value, metric_unit,
                  quality, alarm_level, observed_at, row_version, created_at
                from device_observation where tenant_id = :tenant and observation_id = :observation
                """).param("tenant", tenantId).param("observation", observationId)
                .query((rs, row) -> new DeviceObservationWire(
                        rs.getObject("observation_id", UUID.class), rs.getString("device_code"),
                        rs.getString("trace_id"), rs.getString("metric"),
                        rs.getBigDecimal("metric_value").doubleValue(), rs.getString("metric_unit"),
                        DeviceObservationWire.QualityValue.valueOf(rs.getString("quality")),
                        DeviceObservationWire.AlarmLevelValue.valueOf(rs.getString("alarm_level")),
                        rs.getObject("observed_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("row_version"),
                        rs.getObject("created_at", OffsetDateTime.class).toInstant()))
                .optional().orElseThrow(DeviceTelemetryService::contextDenied);
    }

    private DeviceStatusWire status(UUID tenantId, String deviceCode) {
        return jdbc.sql("""
                select device_code, online_status, clock_offset_seconds, bound_patient_id,
                  last_observed_at, calibration_status, alarm_state, row_version, updated_at
                from device_status where tenant_id = :tenant and device_code = :device
                """).param("tenant", tenantId).param("device", deviceCode)
                .query((rs, row) -> new DeviceStatusWire(
                        rs.getString("device_code"),
                        DeviceStatusWire.OnlineStatusValue.valueOf(rs.getString("online_status")),
                        rs.getInt("clock_offset_seconds"),
                        rs.getObject("bound_patient_id", UUID.class),
                        rs.getObject("last_observed_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("last_observed_at", OffsetDateTime.class).toInstant(),
                        DeviceStatusWire.CalibrationStatusValue.valueOf(rs.getString("calibration_status")),
                        DeviceStatusWire.AlarmStateValue.valueOf(rs.getString("alarm_state")),
                        rs.getLong("row_version"),
                        rs.getObject("updated_at", OffsetDateTime.class).toInstant()))
                .optional().orElseThrow(DeviceTelemetryService::contextDenied);
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> businessRecords(Map<String, Object> payload) {
        Object records = payload.get("business_records");
        if (!(records instanceof List<?> list)) {
            throw new DeviceException("DEVICE_MOCK_PAYLOAD_INVALID", 502, "设备网关未返回业务记录");
        }
        List<Map<String, Object>> result = new ArrayList<>(list.size());
        for (Object item : list) {
            if (item instanceof Map<?, ?> map) result.add((Map<String, Object>) map);
        }
        return result;
    }

    private String text(Map<String, Object> record, String key, String fallback) {
        Object value = record.get(key);
        return value == null || String.valueOf(value).isBlank() ? fallback : String.valueOf(value);
    }

    private String text(Map<String, Object> record, String key) {
        return text(record, key, "");
    }

    private double doubleValue(Map<String, Object> record) {
        Object value = record.get("value");
        return value instanceof Number number ? number.doubleValue() : 0d;
    }

    private int intValue(Map<String, Object> record, String key) {
        Object value = record.get(key);
        return value instanceof Number number ? number.intValue() : 0;
    }

    private Instant instantValue(Map<String, Object> record, String key, Instant fallback) {
        String value = text(record, key);
        if (value.isEmpty()) return fallback;
        try {
            return Instant.parse(value);
        } catch (RuntimeException invalid) {
            return fallback;
        }
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw invalid("A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", requestHash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new DeviceException("IDEMPOTENCY_REPLAY", 409, "该命令键已使用");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, Object resource) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', cast(:resource as text))
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", String.valueOf(resource)).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(ClinicalIdentity identity, UUID observationId, String action, String eventType) {
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + observationId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'DEVICE_OBSERVATION', :resource,
                  :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", observationId)
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'DEVICE_OBSERVATION', :aggregate, 1, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", observationId).param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " is required");
        }
        return value.trim();
    }

    private static DeviceException invalid(String message) {
        return new DeviceException("DEVICE_REQUEST_INVALID", 400, message);
    }

    static DeviceException contextDenied() {
        return new DeviceException("CONTEXT_NOT_PERMITTED", 403, "请求的设备上下文不允许访问");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
