package org.openemr2026.archive;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.HexFormat;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.MedicalRecordAssetBorrowRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetRegisterRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetReturnRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;

@Service
final class MedicalRecordAssetService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;

    MedicalRecordAssetService(JdbcClient jdbc, TransactionTemplate transactions) {
        this.jdbc = jdbc;
        this.transactions = transactions;
    }

    MedicalRecordAssetWire register(
            ClinicalIdentity identity, String idempotencyKey, MedicalRecordAssetRegisterRequestWire request) {
        if (request.patientId() == null || request.assetType() == null) {
            throw invalid("patient_id and asset_type are required");
        }
        String location = requireText(request.location(), 2, "location");
        String contentHash = requireHash(request.contentHash());
        requirePatient(identity.tenantId(), request.patientId());
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_REGISTER", idempotencyKey,
                    sha256(request.patientId() + "|" + request.assetType() + "|" + contentHash));
            UUID assetId = UUID.randomUUID();
            jdbc.sql("""
                    insert into medical_record_asset(
                      tenant_id, medical_record_asset_id, patient_id, encounter_id, asset_type,
                      location, content_hash, status)
                    values (:tenant, :asset, :patient, :encounter, :asset_type,
                      :location, :hash, 'ARCHIVED')
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("asset_type", request.assetType().name()).param("location", location)
                    .param("hash", contentHash).update();
            appendEvidence(identity, request.patientId(), assetId, "MEDICAL_RECORD_ASSET_REGISTERED",
                    "MedicalRecordAssetRegistered");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_REGISTER", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    MedicalRecordAssetWire borrow(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetBorrowRequestWire request) {
        if (request.dueAt() == null) {
            throw invalid("due_at is required");
        }
        if (!request.dueAt().isAfter(Instant.now())) {
            throw invalid("due_at must be in the future");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_BORROW", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            if (request.expectedRowVersion() == null || head.rowVersion() != request.expectedRowVersion()) {
                throw versionConflict();
            }
            if (!"ARCHIVED".equals(head.status())) {
                throw new MedicalRecordAssetException(
                        "MEDICAL_RECORD_ASSET_STATE_INVALID", 409, "Only an archived asset can be borrowed");
            }
            jdbc.sql("""
                    update medical_record_asset
                    set status = 'BORROWED', borrowed_by = :borrower, borrowed_at = now(), due_at = :due,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("borrower", identity.userId())
                    .param("due", request.dueAt().atOffset(ZoneOffset.UTC))
                    .param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_BORROWED",
                    "MedicalRecordAssetBorrowed");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_BORROW", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    MedicalRecordAssetWire returnAsset(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetReturnRequestWire request) {
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_RETURN", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            if (request.expectedRowVersion() == null || head.rowVersion() != request.expectedRowVersion()) {
                throw versionConflict();
            }
            if (!"BORROWED".equals(head.status())) {
                throw new MedicalRecordAssetException(
                        "MEDICAL_RECORD_ASSET_STATE_INVALID", 409, "Only a borrowed asset can be returned");
            }
            jdbc.sql("""
                    update medical_record_asset
                    set status = 'ARCHIVED', borrowed_by = null, borrowed_at = null, due_at = null,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_RETURNED",
                    "MedicalRecordAssetReturned");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_RETURN", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    List<MedicalRecordAssetWire> listAssets(ClinicalIdentity identity, UUID patientId) {
        return jdbc.sql("""
                select medical_record_asset_id from medical_record_asset
                where tenant_id = :tenant and patient_id = :patient
                order by created_at desc, medical_record_asset_id desc limit 100
                """).param("tenant", identity.tenantId()).param("patient", patientId)
                .query(UUID.class).list().stream()
                .map(id -> asset(identity.tenantId(), id)).toList();
    }

    private MedicalRecordAssetWire asset(UUID tenantId, UUID assetId) {
        return jdbc.sql("""
                select medical_record_asset_id, patient_id, encounter_id, asset_type, location, content_hash,
                  status, borrowed_by, borrowed_at, due_at, row_version
                from medical_record_asset
                where tenant_id = :tenant and medical_record_asset_id = :asset
                """).param("tenant", tenantId).param("asset", assetId)
                .query((rs, row) -> new MedicalRecordAssetWire(
                        rs.getObject("medical_record_asset_id", UUID.class),
                        rs.getObject("patient_id", UUID.class),
                        rs.getObject("encounter_id", UUID.class),
                        MedicalRecordAssetWire.AssetTypeValue.valueOf(rs.getString("asset_type")),
                        rs.getString("location"),
                        rs.getString("content_hash"),
                        MedicalRecordAssetWire.StatusValue.valueOf(rs.getString("status")),
                        rs.getObject("borrowed_by", UUID.class),
                        rs.getObject("borrowed_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("borrowed_at", OffsetDateTime.class).toInstant(),
                        rs.getObject("due_at", OffsetDateTime.class) == null
                                ? null : rs.getObject("due_at", OffsetDateTime.class).toInstant(),
                        rs.getLong("row_version")))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private AssetHead lockAsset(UUID tenantId, UUID assetId) {
        return jdbc.sql("""
                select patient_id, status, row_version from medical_record_asset
                where tenant_id = :tenant and medical_record_asset_id = :asset for update
                """).param("tenant", tenantId).param("asset", assetId)
                .query((rs, row) -> new AssetHead(
                        rs.getObject("patient_id", UUID.class), rs.getString("status"), rs.getLong("row_version")))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private void requireAssetPatient(AssetHead head, UUID patientId) {
        if (!head.patientId().equals(patientId)) throw contextDenied();
    }

    private void requirePatient(UUID tenantId, UUID patientId) {
        long count = jdbc.sql("""
                select count(*) from patient where tenant_id = :tenant and patient_id = :patient
                """).param("tenant", tenantId).param("patient", patientId).query(Long.class).single();
        if (count != 1) throw contextDenied();
    }

    private void beginCommand(ClinicalIdentity identity, String scope, String key, String requestHash) {
        if (key == null || key.isBlank() || key.length() > 128) {
            throw new MedicalRecordAssetException("INVALID_IDEMPOTENCY_KEY", 400,
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
            throw new MedicalRecordAssetException("IDEMPOTENCY_REPLAY", 409,
                    "This command key was already used");
        }
    }

    private void completeCommand(ClinicalIdentity identity, String scope, String key, UUID assetId) {
        jdbc.sql("""
                update idempotency_record set state = 'SUCCEEDED', response_status = 200,
                  response_ref = jsonb_build_object('resource_id', :resource)
                where tenant_id = :tenant and command_scope = :scope and idempotency_key = :key
                """).param("resource", assetId).param("tenant", identity.tenantId())
                .param("scope", scope).param("key", key).update();
    }

    private void appendEvidence(
            ClinicalIdentity identity, UUID patientId, UUID assetId, String action, String eventType) {
        jdbc.sql("select tenant_id from tenant where tenant_id = :tenant for update")
                .param("tenant", identity.tenantId()).query(UUID.class).single();
        String previousHash = jdbc.sql("""
                select event_hash from audit_event where tenant_id = :tenant
                order by occurred_at desc, audit_event_id desc limit 1
                """).param("tenant", identity.tenantId()).query(String.class).optional().orElse(null);
        UUID auditId = UUID.randomUUID();
        String trace = UUID.randomUUID().toString();
        String eventHash = sha256(identity.tenantId() + "|" + auditId + "|" + action + "|"
                + assetId + "|" + trace + "|" + (previousHash == null ? "GENESIS" : previousHash));
        jdbc.sql("""
                insert into audit_event(
                  tenant_id, audit_event_id, occurred_at, actor_user_id, action_code,
                  resource_type, resource_id, patient_ref_hash, trace_id, previous_hash, event_hash)
                values (:tenant, :audit, now(), :actor, :action, 'MEDICAL_RECORD_ASSET', :resource,
                  :patient_hash, :trace, :previous, :event_hash)
                """).param("tenant", identity.tenantId()).param("audit", auditId)
                .param("actor", identity.userId()).param("action", action).param("resource", assetId)
                .param("patient_hash", sha256(identity.tenantId() + "|" + patientId))
                .param("trace", trace).param("previous", previousHash).param("event_hash", eventHash).update();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'MEDICAL_RECORD_ASSET', :aggregate, 1, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", assetId).param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " must be at least " + minLength + " characters");
        }
        return value.trim();
    }

    private static String requireHash(String value) {
        if (value == null || value.trim().length() != 64) {
            throw invalid("content_hash must be exactly 64 characters");
        }
        return value.trim();
    }

    private static MedicalRecordAssetException invalid(String message) {
        return new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_REQUEST_INVALID", 400, message);
    }

    private static MedicalRecordAssetException versionConflict() {
        return new MedicalRecordAssetException(
                "MEDICAL_RECORD_ASSET_VERSION_CONFLICT", 409, "The asset changed; reload before retrying");
    }

    static MedicalRecordAssetException contextDenied() {
        return new MedicalRecordAssetException(
                "CONTEXT_NOT_PERMITTED", 403, "The requested medical record asset context is not permitted");
    }

    private record AssetHead(UUID patientId, String status, long rowVersion) {}

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
