package org.openemr2026.infection;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.InfectionMonitoringEventReportRequestWire;
import org.openemr2026.contracts.InfectionMonitoringEventResolveRequestWire;
import org.openemr2026.contracts.InfectionMonitoringEventWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class InfectionEventService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    InfectionEventService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    InfectionMonitoringEventWire report(
            ClinicalIdentity identity, String idempotencyKey,
            InfectionMonitoringEventReportRequestWire request) {
        if (request.infectionType() == null || request.reportedAt() == null) {
            throw invalid("infection_type and reported_at are required");
        }
        requireActiveEncounter(identity.tenantId(), request.patientId(), request.encounterId(), request.facilityId());
        return transactions.execute(status -> {
            beginCommand(identity, "INFECTION_EVENT_REPORT", idempotencyKey,
                    sha256(request.patientId() + "|" + request.encounterId() + "|" + request.infectionType()
                            + "|" + request.reportedAt()));
            UUID eventId = UUID.randomUUID();
            jdbc.sql("""
                    insert into infection_monitoring_event(
                      tenant_id, infection_event_id, patient_id, encounter_id, facility_id,
                      infection_type, organism_code, reported_at, status)
                    values (:tenant, :event, :patient, :encounter, :facility,
                      :infection_type, :organism, :reported_at, 'REPORTED')
                    """).param("tenant", identity.tenantId()).param("event", eventId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId()).param("infection_type", request.infectionType().name())
                    .param("organism", blankToNull(request.organismCode()))
                    .param("reported_at", request.reportedAt().atOffset(ZoneOffset.UTC)).update();
            appendEvidence(identity, request.patientId(), eventId, 1,
                    "INFECTION_EVENT_REPORTED", "InfectionEventReported");
            completeCommand(identity, "INFECTION_EVENT_REPORT", idempotencyKey, eventId);
            return event(identity.tenantId(), eventId, request.patientId());
        });
    }

    InfectionMonitoringEventWire resolve(
            ClinicalIdentity identity, String idempotencyKey, UUID eventId,
            InfectionMonitoringEventResolveRequestWire request) {
        if (request.resolution() == null) {
            throw invalid("resolution is required");
        }
        String conclusion = requireText(request.conclusion(), 2, "conclusion");
        return transactions.execute(status -> {
            beginCommand(identity, "INFECTION_EVENT_RESOLVE", idempotencyKey,
                    sha256(eventId + "|" + request.expectedRowVersion() + "|" + request.resolution() + "|" + conclusion));
            EventHead current = jdbc.sql("""
                    select status, row_version from infection_monitoring_event
                    where tenant_id = :tenant and infection_event_id = :event
                      and patient_id = :patient and encounter_id = :encounter and facility_id = :facility
                      for update
                    """).param("tenant", identity.tenantId()).param("event", eventId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId())
                    .query((rs, row) -> new EventHead(rs.getString("status"), rs.getLong("row_version")))
                    .optional().orElseThrow(InfectionEventService::contextDenied);
            if (request.expectedRowVersion() == null || current.rowVersion() != request.expectedRowVersion()) {
                throw new InfectionEventException(
                        "INFECTION_EVENT_VERSION_CONFLICT", 409, "The infection event changed; reload before retrying");
            }
            if (!"REPORTED".equals(current.status())) {
                throw new InfectionEventException(
                        "INFECTION_EVENT_STATE_INVALID", 409, "Only a reported clue can be resolved");
            }
            String targetStatus = request.resolution()
                    == InfectionMonitoringEventResolveRequestWire.ResolutionValue.CONFIRM ? "CONFIRMED" : "REFUTED";
            jdbc.sql("""
                    update infection_monitoring_event set status = :status, conclusion = :conclusion,
                      resolved_at = now(), row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and infection_event_id = :event and row_version = :expected
                    """).param("status", targetStatus).param("conclusion", conclusion)
                    .param("tenant", identity.tenantId()).param("event", eventId)
                    .param("expected", current.rowVersion()).update();
            appendEvidence(identity, request.patientId(), eventId, current.rowVersion() + 1,
                    "INFECTION_EVENT_" + targetStatus, "InfectionEvent" + targetStatus);
            completeCommand(identity, "INFECTION_EVENT_RESOLVE", idempotencyKey, eventId);
            return event(identity.tenantId(), eventId, request.patientId());
        });
    }

    List<InfectionMonitoringEventWire> listEvents(ClinicalIdentity identity, UUID patientId) {
        return jdbc.sql("""
                select infection_event_id from infection_monitoring_event
                where tenant_id = :tenant and patient_id = :patient
                order by reported_at desc, infection_event_id desc limit 100
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .query(UUID.class).list().stream()
                .map(id -> event(identity.tenantId(), id, patientId)).toList();
    }

    private InfectionMonitoringEventWire event(UUID tenantId, UUID eventId, UUID patientId) {
        return jdbc.sql("""
                select infection_event_id, patient_id, encounter_id, facility_id, infection_type,
                  organism_code, reported_at, status, conclusion, resolved_at, row_version
                from infection_monitoring_event
                where tenant_id = :tenant and infection_event_id = :event and patient_id = :patient
                """).param("tenant", tenantId).param("event", eventId).param("patient", patientId)
                .query((rs, row) -> new InfectionMonitoringEventWire(
                        rs.getObject("infection_event_id", UUID.class), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class), rs.getObject("facility_id", UUID.class),
                        InfectionMonitoringEventWire.InfectionTypeValue.valueOf(rs.getString("infection_type")),
                        rs.getString("organism_code"),
                        rs.getObject("reported_at", OffsetDateTime.class).toInstant(),
                        InfectionMonitoringEventWire.StatusValue.valueOf(rs.getString("status")),
                        rs.getString("conclusion"),
                        rs.getObject("resolved_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("resolved_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("row_version")))
                .optional().orElseThrow(InfectionEventService::contextDenied);
    }

    private void requireActiveEncounter(UUID tenantId, UUID patientId, UUID encounterId, UUID facilityId) {
        long count = jdbc.sql("""
                select count(*) from encounter
                where tenant_id = :tenant and encounter_id = :encounter and patient_id = :patient
                  and facility_id = :facility and status in ('ARRIVED', 'IN_PROGRESS', 'SUSPENDED')
                """).param("tenant", tenantId).param("encounter", encounterId).param("patient", patientId)
                .param("facility", facilityId).query(Long.class).single();
        if (count != 1) throw contextDenied();
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new InfectionEventException("INVALID_IDEMPOTENCY_KEY", 400,
                    "A valid Idempotency-Key is required");
        }
        int inserted = jdbc.sql("""
                insert into idempotency_record(
                  tenant_id, command_scope, idempotency_key, request_hash, state, trace_id, expires_at)
                values (:tenant, :scope, :key, :hash, 'IN_PROGRESS', :trace, now() + interval '24 hours')
                on conflict (tenant_id, command_scope, idempotency_key) do nothing
                """).param("tenant", identity.tenantId()).param("scope", scope).param("key", key)
                .param("hash", requestHash).param("trace", UUID.randomUUID().toString()).update();
        if (inserted != 1) {
            throw new InfectionEventException("IDEMPOTENCY_REPLAY", 409, "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID eventId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", eventId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID eventId, long version,
            String action, String eventType) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + eventId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'INFECTION_EVENT', :resource,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", eventId)
                .param("patient_hash", sha256(identity.tenantId() + "|" + patientId))
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'INFECTION_EVENT', :aggregate, :version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", eventId).param("version", version).param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " must be at least " + minLength + " characters");
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    private static InfectionEventException invalid(String message) {
        return new InfectionEventException("INFECTION_EVENT_REQUEST_INVALID", 400, message);
    }

    static InfectionEventException contextDenied() {
        return new InfectionEventException("CONTEXT_NOT_PERMITTED", 403,
                "The requested infection event context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record EventHead(String status, long rowVersion) {}
}
