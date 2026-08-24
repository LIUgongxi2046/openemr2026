package org.openemr2026.pharmacy;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.PharmacyDispensingPrepareRequestWire;
import org.openemr2026.contracts.PharmacyDispensingTransitionRequestWire;
import org.openemr2026.contracts.PharmacyDispensingWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class PharmacyDispensingService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    PharmacyDispensingService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    PharmacyDispensingWire prepare(
            ClinicalIdentity identity, String idempotencyKey, PharmacyDispensingPrepareRequestWire request) {
        String drug = requireText(request.drugCode(), 2, "drug_code");
        String batch = requireText(request.batchNumber(), 2, "batch_number");
        String unit = requireText(request.quantityUnit(), 1, "quantity_unit");
        if (request.quantity() == null || request.quantity() <= 0) {
            throw invalid("quantity must be positive");
        }
        if (request.preparedAt() == null) {
            throw invalid("prepared_at is required");
        }
        requireActiveEncounter(identity.tenantId(), request.patientId(), request.encounterId(), request.facilityId());
        return transactions.execute(status -> {
            beginCommand(identity, "PHARMACY_DISPENSING_PREPARE", idempotencyKey,
                    sha256(request.patientId() + "|" + request.encounterId() + "|" + drug + "|" + batch
                            + "|" + request.quantity() + "|" + request.preparedAt()));
            UUID dispensingId = UUID.randomUUID();
            jdbc.sql("""
                    insert into pharmacy_dispensing(
                      tenant_id, dispensing_id, patient_id, encounter_id, facility_id,
                      drug_code, batch_number, quantity, quantity_unit, dispensed_by,
                      status, prepared_at)
                    values (:tenant, :dispensing, :patient, :encounter, :facility,
                      :drug, :batch, :quantity, :unit, :dispensed_by, 'PREPARED', :prepared_at)
                    """).param("tenant", identity.tenantId()).param("dispensing", dispensingId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId()).param("drug", drug).param("batch", batch)
                    .param("quantity", BigDecimal.valueOf(request.quantity())).param("unit", unit)
                    .param("dispensed_by", identity.userId())
                    .param("prepared_at", request.preparedAt().atOffset(ZoneOffset.UTC)).update();
            appendEvidence(identity, request.patientId(), dispensingId, 1,
                    "PHARMACY_DISPENSING_PREPARED", "PharmacyDispensingPrepared");
            completeCommand(identity, "PHARMACY_DISPENSING_PREPARE", idempotencyKey, dispensingId);
            return dispensing(identity.tenantId(), dispensingId, request.patientId());
        });
    }

    PharmacyDispensingWire transition(
            ClinicalIdentity identity, String idempotencyKey, UUID dispensingId,
            PharmacyDispensingTransitionRequestWire request) {
        if (request.transition() == null) {
            throw invalid("transition is required");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "PHARMACY_DISPENSING_TRANSITION", idempotencyKey,
                    sha256(dispensingId + "|" + request.expectedRowVersion() + "|" + request.transition()));
            DispensingHead current = jdbc.sql("""
                    select status, dispensed_by, row_version from pharmacy_dispensing
                    where tenant_id = :tenant and dispensing_id = :dispensing
                      and patient_id = :patient and encounter_id = :encounter and facility_id = :facility
                      for update
                    """).param("tenant", identity.tenantId()).param("dispensing", dispensingId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("facility", request.facilityId())
                    .query((rs, row) -> new DispensingHead(
                            rs.getString("status"), rs.getObject("dispensed_by", UUID.class),
                            rs.getLong("row_version")))
                    .optional().orElseThrow(PharmacyDispensingService::contextDenied);
            if (request.expectedRowVersion() == null || current.rowVersion() != request.expectedRowVersion()) {
                throw new PharmacyDispensingException(
                        "PHARMACY_DISPENSING_VERSION_CONFLICT", 409, "The dispensing changed; reload before retrying");
            }
            if (request.transition() == PharmacyDispensingTransitionRequestWire.TransitionValue.VERIFY) {
                if (!"PREPARED".equals(current.status())) {
                    throw stateInvalid();
                }
                if (identity.userId().equals(current.dispensedBy())) {
                    throw new PharmacyDispensingException(
                            "PHARMACY_SELF_VERIFICATION_FORBIDDEN", 403,
                            "The same user cannot prepare and verify the dispensing");
                }
                jdbc.sql("""
                        update pharmacy_dispensing set status = 'VERIFIED', verified_by = :verified_by,
                          verified_at = now(), row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and dispensing_id = :dispensing and row_version = :expected
                        """).param("verified_by", identity.userId()).param("tenant", identity.tenantId())
                        .param("dispensing", dispensingId).param("expected", current.rowVersion()).update();
            } else {
                if (!"VERIFIED".equals(current.status())) {
                    throw stateInvalid();
                }
                jdbc.sql("""
                        update pharmacy_dispensing set status = 'DISPENSED', dispensed_at = now(),
                          row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and dispensing_id = :dispensing and row_version = :expected
                        """).param("tenant", identity.tenantId()).param("dispensing", dispensingId)
                        .param("expected", current.rowVersion()).update();
            }
            appendEvidence(identity, request.patientId(), dispensingId, current.rowVersion() + 1,
                    "PHARMACY_DISPENSING_" + request.transition(), "PharmacyDispensing" + request.transition());
            completeCommand(identity, "PHARMACY_DISPENSING_TRANSITION", idempotencyKey, dispensingId);
            return dispensing(identity.tenantId(), dispensingId, request.patientId());
        });
    }

    List<PharmacyDispensingWire> listDispensings(ClinicalIdentity identity, UUID patientId) {
        return jdbc.sql("""
                select dispensing_id from pharmacy_dispensing
                where tenant_id = :tenant and patient_id = :patient
                order by prepared_at desc, dispensing_id desc limit 100
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .query(UUID.class).list().stream()
                .map(id -> dispensing(identity.tenantId(), id, patientId)).toList();
    }

    private PharmacyDispensingWire dispensing(UUID tenantId, UUID dispensingId, UUID patientId) {
        return jdbc.sql("""
                select dispensing_id, patient_id, encounter_id, facility_id, drug_code, batch_number,
                  quantity, quantity_unit, dispensed_by, verified_by, status,
                  prepared_at, verified_at, dispensed_at, row_version
                from pharmacy_dispensing
                where tenant_id = :tenant and dispensing_id = :dispensing and patient_id = :patient
                """).param("tenant", tenantId).param("dispensing", dispensingId).param("patient", patientId)
                .query((rs, row) -> new PharmacyDispensingWire(
                        rs.getObject("dispensing_id", UUID.class), rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class), rs.getObject("facility_id", UUID.class),
                        rs.getString("drug_code"), rs.getString("batch_number"),
                        rs.getBigDecimal("quantity").doubleValue(), rs.getString("quantity_unit"),
                        rs.getObject("dispensed_by", UUID.class), rs.getObject("verified_by", UUID.class),
                        PharmacyDispensingWire.StatusValue.valueOf(rs.getString("status")),
                        rs.getObject("prepared_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("verified_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("verified_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("dispensed_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("dispensed_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("row_version")))
                .optional().orElseThrow(PharmacyDispensingService::contextDenied);
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
            throw new PharmacyDispensingException("INVALID_IDEMPOTENCY_KEY", 400,
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
            throw new PharmacyDispensingException("IDEMPOTENCY_REPLAY", 409, "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID dispensingId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", dispensingId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID dispensingId, long version,
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
                + dispensingId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'PHARMACY_DISPENSING', :resource,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", dispensingId)
                .param("patient_hash", sha256(identity.tenantId() + "|" + patientId))
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'PHARMACY_DISPENSING', :aggregate, :version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", dispensingId).param("version", version).param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " must be at least " + minLength + " characters");
        }
        return value.trim();
    }

    private static PharmacyDispensingException invalid(String message) {
        return new PharmacyDispensingException("PHARMACY_DISPENSING_REQUEST_INVALID", 400, message);
    }

    private static PharmacyDispensingException stateInvalid() {
        return new PharmacyDispensingException("PHARMACY_DISPENSING_STATE_INVALID", 409,
                "The pharmacy dispensing is not in a state that accepts this transition");
    }

    static PharmacyDispensingException contextDenied() {
        return new PharmacyDispensingException("CONTEXT_NOT_PERMITTED", 403,
                "The requested pharmacy dispensing context is not permitted");
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private record DispensingHead(String status, UUID dispensedBy, long rowVersion) {}
}
