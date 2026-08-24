package org.openemr2026.surgery;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.SurgicalProcedureScheduleRequestWire;
import org.openemr2026.contracts.SurgicalProcedureTransitionRequestWire;
import org.openemr2026.contracts.SurgicalProcedureWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class SurgicalProcedureService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    SurgicalProcedureService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    SurgicalProcedureWire schedule(
            ClinicalIdentity identity, String idempotencyKey, SurgicalProcedureScheduleRequestWire request) {
        String procedureName = requireText(request.procedureName(), 2, "procedure_name");
        if (request.bodySite() == null || request.laterality() == null || request.surgeonId() == null
                || request.anesthesiologistId() == null || request.scheduledAt() == null) {
            throw invalid("body_site, laterality, surgeon_id, anesthesiologist_id and scheduled_at are required");
        }
        boolean paired = request.bodySite() == SurgicalProcedureScheduleRequestWire.BodySiteValue.UPPER_EXTREMITY
                || request.bodySite() == SurgicalProcedureScheduleRequestWire.BodySiteValue.LOWER_EXTREMITY;
        if (paired && request.laterality() == SurgicalProcedureScheduleRequestWire.LateralityValue.NONE) {
            throw invalid("laterality is required for paired body sites");
        }
        if (request.surgeonId().equals(request.anesthesiologistId())) {
            throw invalid("surgeon and anesthesiologist must be different people");
        }
        requireActiveEncounter(identity.tenantId(), request.patientId(), request.encounterId(), request.facilityId());
        return transactions.execute(status -> {
            beginCommand(identity, "SURGICAL_PROCEDURE_SCHEDULE", idempotencyKey,
                    sha256(request.patientId() + "|" + request.encounterId() + "|" + procedureName
                            + "|" + request.bodySite() + "|" + request.laterality() + "|" + request.surgeonId()
                            + "|" + request.anesthesiologistId()));
            UUID procedureId = UUID.randomUUID();
            jdbc.sql("""
                    insert into surgical_procedure(
                      tenant_id, surgical_procedure_id, patient_id, encounter_id, facility_id,
                      procedure_name, body_site, laterality, surgeon_id, anesthesiologist_id,
                      status, scheduled_at)
                    values (:tenant, :procedure, :patient, :encounter, :facility,
                      :name, :body_site, :laterality, :surgeon, :anesthesiologist, 'SCHEDULED', :scheduled_at)
                    """).param("tenant", identity.tenantId()).param("procedure", procedureId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId()).param("name", procedureName)
                    .param("body_site", request.bodySite().name()).param("laterality", request.laterality().name())
                    .param("surgeon", request.surgeonId()).param("anesthesiologist", request.anesthesiologistId())
                    .param("scheduled_at", request.scheduledAt().atOffset(ZoneOffset.UTC)).update();
            appendEvidence(identity, request.patientId(), procedureId, 1,
                    "SURGICAL_PROCEDURE_SCHEDULED", "SurgicalProcedureScheduled");
            completeCommand(identity, "SURGICAL_PROCEDURE_SCHEDULE", idempotencyKey, procedureId);
            return procedure(identity.tenantId(), procedureId, request.patientId());
        });
    }

    SurgicalProcedureWire transition(
            ClinicalIdentity identity, String idempotencyKey, UUID procedureId,
            SurgicalProcedureTransitionRequestWire request) {
        if (request.transition() == null) {
            throw invalid("transition is required");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "SURGICAL_PROCEDURE_TRANSITION", idempotencyKey,
                    sha256(procedureId + "|" + request.expectedRowVersion() + "|" + request.transition()));
            ProcedureHead current = jdbc.sql("""
                    select status, row_version from surgical_procedure
                    where tenant_id = :tenant and surgical_procedure_id = :procedure
                      and patient_id = :patient and encounter_id = :encounter and facility_id = :facility
                      for update
                    """).param("tenant", identity.tenantId()).param("procedure", procedureId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId())
                    .query((rs, row) -> new ProcedureHead(rs.getString("status"), rs.getLong("row_version")))
                    .optional().orElseThrow(SurgicalProcedureService::contextDenied);
            if (request.expectedRowVersion() == null || current.rowVersion() != request.expectedRowVersion()) {
                throw new SurgicalProcedureException(
                        "SURGICAL_PROCEDURE_VERSION_CONFLICT", 409, "The procedure changed; reload before retrying");
            }
            if (request.transition() == SurgicalProcedureTransitionRequestWire.TransitionValue.TIME_OUT) {
                if (!"SCHEDULED".equals(current.status())) {
                    throw stateInvalid();
                }
                jdbc.sql("""
                        update surgical_procedure set status = 'TIME_OUT_COMPLETED', time_out_at = now(),
                          row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and surgical_procedure_id = :procedure and row_version = :expected
                        """).param("tenant", identity.tenantId()).param("procedure", procedureId)
                        .param("expected", current.rowVersion()).update();
            } else {
                if (!"TIME_OUT_COMPLETED".equals(current.status())) {
                    throw stateInvalid();
                }
                jdbc.sql("""
                        update surgical_procedure set status = 'COMPLETED', completed_at = now(),
                          row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and surgical_procedure_id = :procedure and row_version = :expected
                        """).param("tenant", identity.tenantId()).param("procedure", procedureId)
                        .param("expected", current.rowVersion()).update();
            }
            appendEvidence(identity, request.patientId(), procedureId, current.rowVersion() + 1,
                    "SURGICAL_PROCEDURE_" + request.transition(), "SurgicalProcedure" + request.transition());
            completeCommand(identity, "SURGICAL_PROCEDURE_TRANSITION", idempotencyKey, procedureId);
            return procedure(identity.tenantId(), procedureId, request.patientId());
        });
    }

    List<SurgicalProcedureWire> listProcedures(ClinicalIdentity identity, UUID patientId) {
        return jdbc.sql("""
                select surgical_procedure_id from surgical_procedure
                where tenant_id = :tenant and patient_id = :patient
                order by scheduled_at desc, surgical_procedure_id desc limit 100
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .query(UUID.class).list().stream()
                .map(id -> procedure(identity.tenantId(), id, patientId)).toList();
    }

    private SurgicalProcedureWire procedure(UUID tenantId, UUID procedureId, UUID patientId) {
        return jdbc.sql("""
                select surgical_procedure_id, patient_id, encounter_id, facility_id, procedure_name,
                  body_site, laterality, surgeon_id, anesthesiologist_id, status,
                  scheduled_at, time_out_at, completed_at, row_version
                from surgical_procedure
                where tenant_id = :tenant and surgical_procedure_id = :procedure and patient_id = :patient
                """).param("tenant", tenantId).param("procedure", procedureId).param("patient", patientId)
                .query((rs, row) -> new SurgicalProcedureWire(
                        rs.getObject("surgical_procedure_id", UUID.class), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class), rs.getObject("facility_id", UUID.class),
                        rs.getString("procedure_name"),
                        SurgicalProcedureWire.BodySiteValue.valueOf(rs.getString("body_site")),
                        SurgicalProcedureWire.LateralityValue.valueOf(rs.getString("laterality")),
                        rs.getObject("surgeon_id", UUID.class), rs.getObject("anesthesiologist_id", UUID.class),
                        SurgicalProcedureWire.StatusValue.valueOf(rs.getString("status")),
                        rs.getObject("scheduled_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("time_out_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("time_out_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("completed_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("completed_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("row_version")))
                .optional().orElseThrow(SurgicalProcedureService::contextDenied);
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
            throw new SurgicalProcedureException("INVALID_IDEMPOTENCY_KEY", 400,
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
            throw new SurgicalProcedureException("IDEMPOTENCY_REPLAY", 409, "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID procedureId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", procedureId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID procedureId, long version,
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
                + procedureId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'SURGICAL_PROCEDURE', :resource,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", procedureId)
                .param("patient_hash", sha256(identity.tenantId() + "|" + patientId))
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'SURGICAL_PROCEDURE', :aggregate, :version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", procedureId).param("version", version).param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " must be at least " + minLength + " characters");
        }
        return value.trim();
    }

    private static SurgicalProcedureException invalid(String message) {
        return new SurgicalProcedureException("SURGICAL_PROCEDURE_REQUEST_INVALID", 400, message);
    }

    private static SurgicalProcedureException stateInvalid() {
        return new SurgicalProcedureException("SURGICAL_PROCEDURE_STATE_INVALID", 409,
                "The surgical procedure is not in a state that accepts this transition");
    }

    static SurgicalProcedureException contextDenied() {
        return new SurgicalProcedureException("CONTEXT_NOT_PERMITTED", 403,
                "The requested surgical procedure context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record ProcedureHead(String status, long rowVersion) {}
}
