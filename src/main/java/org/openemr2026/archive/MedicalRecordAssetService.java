package org.openemr2026.archive;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.time.temporal.ChronoUnit;
import java.util.Base64;
import java.util.HexFormat;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.openemr2026.contracts.MedicalRecordAssetActionRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetBorrowRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetBorrowUpdateRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetDistributionCreateRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetDistributionDeliveryRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetDistributionPackageWire;
import org.openemr2026.contracts.MedicalRecordAssetIngestRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetIntegrityCheckRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetIntegrityEventWire;
import org.openemr2026.contracts.MedicalRecordAssetRegisterRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetRetireRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetReturnRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetUpdateRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.stereotype.Service;
import org.springframework.transaction.support.TransactionTemplate;
import tools.jackson.databind.ObjectMapper;

@Service
final class MedicalRecordAssetService {
    private final JdbcClient jdbc;
    private final TransactionTemplate transactions;
    private final ArchiveObjectStorage storage;
    private final ArchiveOcrEngine ocr;
    private final ObjectMapper mapper;

    MedicalRecordAssetService(
            JdbcClient jdbc, TransactionTemplate transactions, ArchiveObjectStorage storage,
            ArchiveOcrEngine ocr, ObjectMapper mapper) {
        this.jdbc = jdbc;
        this.transactions = transactions;
        this.storage = storage;
        this.ocr = ocr;
        this.mapper = mapper;
    }

    MedicalRecordAssetWire register(
            ClinicalIdentity identity, String idempotencyKey, MedicalRecordAssetRegisterRequestWire request) {
        if (request.patientId() == null || request.assetType() == null) {
            throw invalid("patient_id and asset_type are required");
        }
        String location = requireText(request.location(), 2, "location");
        String contentHash = requireHash(request.contentHash());
        String displayName = optionalText(request.displayName(), "病案资产", 2, "display_name");
        String mediaType = optionalText(request.mediaType(), "application/octet-stream", 3, "media_type");
        int pageCount = request.pageCount() == null ? 1 : requireRange(request.pageCount(), 1, 100000, "page_count");
        String sourceSystem = optionalText(request.sourceSystem(), "openemr2026", 2, "source_system");
        String cdaStatus = request.cdaStatus() == null ? "NOT_APPLICABLE" : request.cdaStatus().name();
        String scanStatus = request.scanStatus() == null
                ? (request.assetType() == MedicalRecordAssetRegisterRequestWire.AssetTypeValue.SCAN
                        ? "CAPTURED" : "NOT_APPLICABLE")
                : request.scanStatus().name();
        String preservationStatus = request.preservationStatus() == null
                ? "NOT_SCHEDULED" : request.preservationStatus().name();
        int retentionYears = request.retentionYears() == null
                ? 15 : requireRange(request.retentionYears(), 1, 100, "retention_years");
        requireScanStatus(request.assetType().name(), scanStatus);
        if (!"NOT_SCHEDULED".equals(preservationStatus) && !"SCHEDULED".equals(preservationStatus)) {
            throw invalid("a new asset can only be NOT_SCHEDULED or SCHEDULED for preservation");
        }
        requirePatient(identity.tenantId(), request.patientId());
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_REGISTER", idempotencyKey,
                    sha256(request.patientId() + "|" + request.assetType() + "|" + contentHash));
            UUID assetId = UUID.randomUUID();
            jdbc.sql("""
                    insert into medical_record_asset(
                      tenant_id, medical_record_asset_id, patient_id, encounter_id, asset_type,
                      location, content_hash, status, display_name, media_type, page_count,
                      source_system, custody_location, cda_status, scan_status,
                      preservation_status, retention_years)
                    values (:tenant, :asset, :patient, :encounter, :asset_type,
                      :location, :hash, 'ARCHIVED', :display_name, :media_type, :page_count,
                      :source_system, :location, :cda_status, :scan_status,
                      :preservation_status, :retention_years)
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("patient", request.patientId()).param("encounter", request.encounterId())
                    .param("asset_type", request.assetType().name()).param("location", location)
                    .param("hash", contentHash).param("display_name", displayName)
                    .param("media_type", mediaType).param("page_count", pageCount)
                    .param("source_system", sourceSystem).param("cda_status", cdaStatus)
                    .param("scan_status", scanStatus).param("preservation_status", preservationStatus)
                    .param("retention_years", retentionYears).update();
            appendEvidence(identity, request.patientId(), assetId, "MEDICAL_RECORD_ASSET_REGISTERED",
                    "MedicalRecordAssetRegistered");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_REGISTER", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    MedicalRecordAssetWire ingest(
            ClinicalIdentity identity, String idempotencyKey, MedicalRecordAssetIngestRequestWire request) {
        if (request == null || request.patientId() == null || request.assetType() == null) {
            throw invalid("patient_id and asset_type are required");
        }
        String location = requireText(request.location(), 2, "location");
        String displayName = requireText(request.displayName(), 2, "display_name");
        String filename = safeFilename(request.originalFilename());
        String mediaType = requireMediaType(request.mediaType());
        int pageCount = requireRange(request.pageCount(), 1, 100000, "page_count");
        String sourceSystem = requireText(request.sourceSystem(), 2, "source_system");
        int retentionYears = requireRange(request.retentionYears(), 1, 100, "retention_years");
        byte[] content = decodeContent(request.contentBase64());
        validateMagic(mediaType, content);
        rejectKnownMalware(content);
        String contentHash = sha256(content);
        String scanStatus = request.assetType() == MedicalRecordAssetIngestRequestWire.AssetTypeValue.SCAN
                ? "CAPTURED" : "NOT_APPLICABLE";
        String cdaStatus = request.cdaStatus() == null ? "NOT_APPLICABLE" : request.cdaStatus().name();
        requirePatient(identity.tenantId(), request.patientId());
        UUID assetId = UUID.randomUUID();
        String storageKey = identity.tenantId() + "/medical-record-assets/" + assetId
                + "/original/" + contentHash + "-" + filename;
        try {
            return transactions.execute(status -> {
                beginCommand(identity, "MEDICAL_RECORD_ASSET_INGEST", idempotencyKey,
                        sha256(request.patientId() + "|" + request.assetType() + "|" + filename + "|" + contentHash));
                storage.putImmutable(storageKey, content);
                jdbc.sql("""
                        insert into medical_record_asset(
                          tenant_id, medical_record_asset_id, patient_id, encounter_id, asset_type,
                          location, content_hash, status, display_name, media_type, page_count,
                          source_system, custody_location, cda_status, scan_status,
                          preservation_status, retention_years, original_filename, byte_size,
                          storage_key, storage_status, malware_scan_status)
                        values (:tenant, :asset, :patient, :encounter, :asset_type,
                          :location, :hash, 'ARCHIVED', :display_name, :media_type, :page_count,
                          :source_system, :location, :cda_status, :scan_status,
                          'NOT_SCHEDULED', :retention_years, :filename, :byte_size,
                          :storage_key, 'AVAILABLE', 'PASSED')
                        """).param("tenant", identity.tenantId()).param("asset", assetId)
                        .param("patient", request.patientId()).param("encounter", request.encounterId())
                        .param("asset_type", request.assetType().name()).param("location", location)
                        .param("hash", contentHash).param("display_name", displayName)
                        .param("media_type", mediaType).param("page_count", pageCount)
                        .param("source_system", sourceSystem).param("cda_status", cdaStatus)
                        .param("scan_status", scanStatus).param("retention_years", retentionYears)
                        .param("filename", filename).param("byte_size", (long) content.length)
                        .param("storage_key", storageKey).update();
                appendEvidence(identity, request.patientId(), assetId, "MEDICAL_RECORD_ASSET_INGESTED",
                        "MedicalRecordAssetIngested");
                completeCommand(identity, "MEDICAL_RECORD_ASSET_INGEST", idempotencyKey, assetId);
                return asset(identity.tenantId(), assetId);
            });
        } catch (RuntimeException failure) {
            storage.deleteUnsealedBestEffort(storageKey);
            throw failure;
        }
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
            if (!"VERIFIED".equals(head.integrityStatus())) {
                throw new MedicalRecordAssetException(
                        "MEDICAL_RECORD_ASSET_INTEGRITY_REQUIRED", 409,
                        "An asset must pass integrity verification before it can be borrowed");
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

    MedicalRecordAssetWire updateBorrow(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetBorrowUpdateRequestWire request) {
        if (request.dueAt() == null || !request.dueAt().isAfter(Instant.now())) {
            throw invalid("due_at must be in the future");
        }
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_BORROW_UPDATE", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion() + "|" + request.dueAt()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if (!"BORROWED".equals(head.status())) throw stateInvalid("Only an active borrow can be edited");
            jdbc.sql("""
                    update medical_record_asset set due_at = :due,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("due", request.dueAt().atOffset(ZoneOffset.UTC))
                    .param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_BORROW_UPDATED",
                    "MedicalRecordAssetBorrowUpdated");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_BORROW_UPDATE", idempotencyKey, assetId);
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

    MedicalRecordAssetWire update(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetUpdateRequestWire request) {
        String displayName = requireText(request.displayName(), 2, "display_name");
        String mediaType = requireText(request.mediaType(), 3, "media_type");
        int pageCount = requireRange(request.pageCount(), 1, 100000, "page_count");
        String sourceSystem = requireText(request.sourceSystem(), 2, "source_system");
        String custodyLocation = requireText(request.custodyLocation(), 2, "custody_location");
        int retentionYears = requireRange(request.retentionYears(), 1, 100, "retention_years");
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_UPDATE", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion() + "|" + displayName + "|" + custodyLocation));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if ("RETIRED".equals(head.status())) {
                throw stateInvalid("A retired asset cannot be edited");
            }
            requireScanStatus(head.assetType(), request.scanStatus().name());
            requireScanTransition(head.scanStatus(), request.scanStatus().name());
            requirePreservationTransition(
                    head.preservationStatus(), request.preservationStatus().name(), head.integrityStatus());
            boolean sealing = "SEALED".equals(request.preservationStatus().name())
                    && !"SEALED".equals(head.preservationStatus());
            Instant retainUntil = sealing ? Instant.now().plus((long) retentionYears * 365, ChronoUnit.DAYS) : null;
            if (sealing) {
                if (!"AVAILABLE".equals(head.storageStatus()) || head.storageKey() == null) {
                    throw stateInvalid("Stored immutable content is required before WORM sealing");
                }
                storage.seal(head.storageKey(), retainUntil);
            }
            jdbc.sql("""
                    update medical_record_asset
                    set display_name = :display_name, media_type = :media_type, page_count = :page_count,
                      source_system = :source_system, custody_location = :custody_location,
                      cda_status = :cda_status, scan_status = :scan_status,
                      preservation_status = :preservation_status, retention_years = :retention_years,
                      storage_status = case when :sealing then 'SEALED' else storage_status end,
                      object_lock_status = case when :sealing then 'LOCKED' else object_lock_status end,
                      worm_retain_until = case when :sealing then :retain_until else worm_retain_until end,
                      row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("display_name", displayName).param("media_type", mediaType)
                    .param("page_count", pageCount).param("source_system", sourceSystem)
                    .param("custody_location", custodyLocation).param("cda_status", request.cdaStatus().name())
                    .param("scan_status", request.scanStatus().name())
                    .param("preservation_status", request.preservationStatus().name())
                    .param("retention_years", retentionYears).param("sealing", sealing)
                    .param("retain_until", retainUntil == null ? null : retainUntil.atOffset(ZoneOffset.UTC))
                    .param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_UPDATED",
                    "MedicalRecordAssetUpdated");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_UPDATE", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    MedicalRecordAssetWire retire(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetRetireRequestWire request) {
        String reason = requireText(request.reason(), 4, "reason");
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_RETIRE", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion() + "|" + reason));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if (!"ARCHIVED".equals(head.status())) {
                throw stateInvalid("Only an in-library asset can be retired");
            }
            if ("SEALED".equals(head.preservationStatus()) || "VERIFIED".equals(head.preservationStatus())) {
                throw stateInvalid("Long-term preserved evidence cannot be retired; create a correction asset instead");
            }
            jdbc.sql("""
                    update medical_record_asset
                    set status = 'RETIRED', retired_by = :actor, retired_at = now(),
                      retirement_reason = :reason, row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("tenant", identity.tenantId()).param("asset", assetId)
                    .param("actor", identity.userId()).param("reason", reason)
                    .param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_RETIRED",
                    "MedicalRecordAssetRetired");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_RETIRE", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    MedicalRecordAssetIntegrityEventWire verifyIntegrity(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetIntegrityCheckRequestWire request) {
        String observedHash = requireHash(request.observedHash()).toLowerCase();
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_VERIFY", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion() + "|" + observedHash));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if ("RETIRED".equals(head.status())) throw stateInvalid("A retired asset cannot be re-verified");
            UUID eventId = recordIntegrity(identity, assetId, head, observedHash);
            completeCommand(identity, "MEDICAL_RECORD_ASSET_VERIFY", idempotencyKey, eventId);
            return integrityEvent(identity.tenantId(), eventId);
        });
    }

    MedicalRecordAssetIntegrityEventWire verifyStoredContent(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetActionRequestWire request) {
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_STORAGE_VERIFY", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if ("RETIRED".equals(head.status())) throw stateInvalid("A retired asset cannot be re-verified");
            if (head.storageKey() == null || "MISSING".equals(head.storageStatus())) {
                throw stateInvalid("Stored immutable content is required for server-side verification");
            }
            String observedHash = sha256(storage.read(head.storageKey()));
            UUID eventId = recordIntegrity(identity, assetId, head, observedHash);
            completeCommand(identity, "MEDICAL_RECORD_ASSET_STORAGE_VERIFY", idempotencyKey, eventId);
            return integrityEvent(identity.tenantId(), eventId);
        });
    }

    MedicalRecordAssetWire runOcr(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetActionRequestWire request) {
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_OCR", idempotencyKey,
                    sha256(assetId + "|" + request.expectedRowVersion()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            requireVersion(head, request.expectedRowVersion());
            if (!"SCAN".equals(head.assetType()) || !"CAPTURED".equals(head.scanStatus())) {
                throw stateInvalid("Only a captured scan can enter OCR review");
            }
            if (head.storageKey() == null || "MISSING".equals(head.storageStatus())) {
                throw stateInvalid("Stored scan content is required before OCR");
            }
            byte[] content = storage.read(head.storageKey());
            ArchiveOcrEngine.OcrResult result = ocr.extract(content, head.mediaType(), head.originalFilename());
            jdbc.sql("""
                    update medical_record_asset set ocr_status = 'COMPLETED', ocr_text = :ocr_text,
                      ocr_confidence = :confidence, ocr_engine = :engine, ocr_completed_at = now(),
                      scan_status = 'OCR_REVIEWED', row_version = row_version + 1, updated_at = now()
                    where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                    """).param("ocr_text", result.text()).param("confidence", result.confidence())
                    .param("engine", result.engine()).param("tenant", identity.tenantId())
                    .param("asset", assetId).param("expected", head.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_OCR_COMPLETED",
                    "MedicalRecordAssetOcrCompleted");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_OCR", idempotencyKey, assetId);
            return asset(identity.tenantId(), assetId);
        });
    }

    AssetBinary content(ClinicalIdentity identity, UUID patientId, UUID assetId) {
        AssetHead head = lockAsset(identity.tenantId(), assetId);
        requireAssetPatient(head, patientId);
        if (head.storageKey() == null || "MISSING".equals(head.storageStatus())) {
            throw stateInvalid("This catalogue entry has no stored binary content");
        }
        byte[] content = storage.read(head.storageKey());
        String observed = sha256(content);
        if (!observed.equals(head.contentHash())) {
            throw new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_STORAGE_INTEGRITY_FAILED", 409,
                    "Stored content no longer matches the immutable catalogue hash");
        }
        return new AssetBinary(content, head.mediaType(), head.originalFilename(), observed);
    }

    MedicalRecordAssetDistributionPackageWire createDistribution(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId,
            MedicalRecordAssetDistributionCreateRequestWire request) {
        String purpose = requireText(request.purpose(), 2, "purpose");
        String recipient = requireText(request.recipientName(), 2, "recipient_name");
        if (request.expiresAt() == null || !request.expiresAt().isAfter(Instant.now())
                || request.expiresAt().isAfter(Instant.now().plus(30, ChronoUnit.DAYS))) {
            throw invalid("expires_at must be within the next 30 days");
        }
        UUID packageId = UUID.randomUUID();
        String storageKey = identity.tenantId() + "/medical-record-assets/" + assetId
                + "/distributions/" + packageId + ".zip";
        try {
            return transactions.execute(status -> {
                beginCommand(identity, "MEDICAL_RECORD_ASSET_DISTRIBUTION_CREATE", idempotencyKey,
                        sha256(assetId + "|" + request.expectedRowVersion() + "|" + purpose + "|" + recipient));
                AssetHead head = lockAsset(identity.tenantId(), assetId);
                requireAssetPatient(head, request.patientId());
                requireVersion(head, request.expectedRowVersion());
                if (!"ARCHIVED".equals(head.status()) || !"VERIFIED".equals(head.integrityStatus())) {
                    throw stateInvalid("Only an in-library, integrity-verified asset can be copied or distributed");
                }
                if (head.storageKey() == null || "MISSING".equals(head.storageStatus())) {
                    throw stateInvalid("Stored immutable content is required for distribution");
                }
                byte[] original = storage.read(head.storageKey());
                if (!sha256(original).equals(head.contentHash())) {
                    throw stateInvalid("Stored asset failed integrity verification before distribution");
                }
                String watermark = "OpenEMR2026 | " + recipient + " | " + purpose + " | "
                        + packageId + " | expires " + request.expiresAt();
                byte[] archive = distributionZip(packageId, assetId, head, original, watermark, request.expiresAt());
                String packageHash = sha256(archive);
                storage.putImmutable(storageKey, archive);
                jdbc.sql("""
                        insert into medical_record_asset_distribution_package(
                          tenant_id, distribution_package_id, medical_record_asset_id, patient_id,
                          purpose, recipient_name, watermark_text, original_filename, byte_size,
                          content_hash, storage_key, status, expires_at, created_by)
                        values (:tenant,:package,:asset,:patient,:purpose,:recipient,:watermark,:filename,
                          :byte_size,:hash,:storage_key,'READY',:expires_at,:actor)
                        """).param("tenant", identity.tenantId()).param("package", packageId)
                        .param("asset", assetId).param("patient", head.patientId()).param("purpose", purpose)
                        .param("recipient", recipient).param("watermark", watermark)
                        .param("filename", safeFilename(head.originalFilename()) + ".distribution.zip")
                        .param("byte_size", (long) archive.length).param("hash", packageHash)
                        .param("storage_key", storageKey).param("expires_at", request.expiresAt().atOffset(ZoneOffset.UTC))
                        .param("actor", identity.userId()).update();
                jdbc.sql("""
                        update medical_record_asset set row_version = row_version + 1, updated_at = now()
                        where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                        """).param("tenant", identity.tenantId()).param("asset", assetId)
                        .param("expected", head.rowVersion()).update();
                appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_DISTRIBUTION_CREATED",
                        "MedicalRecordAssetDistributionCreated");
                completeCommand(identity, "MEDICAL_RECORD_ASSET_DISTRIBUTION_CREATE", idempotencyKey, packageId);
                return distribution(identity.tenantId(), packageId);
            });
        } catch (RuntimeException failure) {
            storage.deleteUnsealedBestEffort(storageKey);
            throw failure;
        }
    }

    List<MedicalRecordAssetDistributionPackageWire> listDistributions(
            ClinicalIdentity identity, UUID patientId, UUID assetId) {
        AssetHead head = lockAsset(identity.tenantId(), assetId);
        requireAssetPatient(head, patientId);
        return jdbc.sql("""
                select distribution_package_id from medical_record_asset_distribution_package
                where tenant_id = :tenant and medical_record_asset_id = :asset
                order by created_at desc, distribution_package_id desc limit 100
                """).param("tenant", identity.tenantId()).param("asset", assetId)
                .query(UUID.class).list().stream().map(id -> distribution(identity.tenantId(), id)).toList();
    }

    MedicalRecordAssetDistributionPackageWire deliverDistribution(
            ClinicalIdentity identity, String idempotencyKey, UUID assetId, UUID packageId,
            MedicalRecordAssetDistributionDeliveryRequestWire request) {
        return transactions.execute(status -> {
            beginCommand(identity, "MEDICAL_RECORD_ASSET_DISTRIBUTION_DELIVER", idempotencyKey,
                    sha256(assetId + "|" + packageId + "|" + request.expectedRowVersion()));
            AssetHead head = lockAsset(identity.tenantId(), assetId);
            requireAssetPatient(head, request.patientId());
            DistributionHead distribution = lockDistribution(identity.tenantId(), assetId, packageId);
            if (distribution.rowVersion() != request.expectedRowVersion()) throw versionConflict();
            if (!"READY".equals(distribution.status())) throw stateInvalid("Only a ready package can be delivered");
            if (!distribution.expiresAt().isAfter(Instant.now())) throw stateInvalid("Distribution package expired");
            jdbc.sql("""
                    update medical_record_asset_distribution_package
                    set status = 'DELIVERED', delivered_by = :actor, delivered_at = now(),
                      row_version = row_version + 1
                    where tenant_id = :tenant and distribution_package_id = :package and row_version = :expected
                    """).param("actor", identity.userId()).param("tenant", identity.tenantId())
                    .param("package", packageId).param("expected", distribution.rowVersion()).update();
            appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_DISTRIBUTION_DELIVERED",
                    "MedicalRecordAssetDistributionDelivered");
            completeCommand(identity, "MEDICAL_RECORD_ASSET_DISTRIBUTION_DELIVER", idempotencyKey, packageId);
            return distribution(identity.tenantId(), packageId);
        });
    }

    DistributionBinary distributionContent(
            ClinicalIdentity identity, UUID patientId, UUID assetId, UUID packageId) {
        AssetHead head = lockAsset(identity.tenantId(), assetId);
        requireAssetPatient(head, patientId);
        DistributionHead distribution = lockDistribution(identity.tenantId(), assetId, packageId);
        if (!distribution.expiresAt().isAfter(Instant.now())) throw stateInvalid("Distribution package expired");
        byte[] content = storage.read(distribution.storageKey());
        String observed = sha256(content);
        if (!observed.equals(distribution.contentHash())) {
            throw new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_DISTRIBUTION_INTEGRITY_FAILED", 409,
                    "Distribution package no longer matches its immutable hash");
        }
        return new DistributionBinary(content, distribution.originalFilename(), observed);
    }

    List<MedicalRecordAssetIntegrityEventWire> listIntegrityEvents(
            ClinicalIdentity identity, UUID patientId, UUID assetId) {
        AssetHead head = lockAsset(identity.tenantId(), assetId);
        requireAssetPatient(head, patientId);
        return jdbc.sql("""
                select integrity_event_id from medical_record_asset_integrity_event
                where tenant_id = :tenant and medical_record_asset_id = :asset
                order by verified_at desc, integrity_event_id desc limit 100
                """).param("tenant", identity.tenantId()).param("asset", assetId)
                .query(UUID.class).list().stream().map(id -> integrityEvent(identity.tenantId(), id)).toList();
    }

    private MedicalRecordAssetWire asset(UUID tenantId, UUID assetId) {
        return jdbc.sql("""
                select medical_record_asset_id, patient_id, encounter_id, asset_type, location, content_hash,
                  status, display_name, media_type, page_count, source_system, custody_location,
                  integrity_status, cda_status, scan_status, preservation_status, retention_years,
                  original_filename, byte_size, storage_status, malware_scan_status,
                  ocr_status, ocr_text, ocr_confidence, ocr_engine, ocr_completed_at,
                  object_lock_status, worm_retain_until,
                  last_verified_at, retired_by, retired_at, retirement_reason, created_at,
                  borrowed_by, borrowed_at, due_at, row_version
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
                        rs.getString("display_name"),
                        rs.getString("media_type"),
                        rs.getInt("page_count"),
                        rs.getString("source_system"),
                        rs.getString("custody_location"),
                        MedicalRecordAssetWire.IntegrityStatusValue.valueOf(rs.getString("integrity_status")),
                        MedicalRecordAssetWire.CdaStatusValue.valueOf(rs.getString("cda_status")),
                        MedicalRecordAssetWire.ScanStatusValue.valueOf(rs.getString("scan_status")),
                        MedicalRecordAssetWire.PreservationStatusValue.valueOf(rs.getString("preservation_status")),
                        rs.getInt("retention_years"),
                        rs.getString("original_filename"),
                        rs.getObject("byte_size", Long.class),
                        MedicalRecordAssetWire.StorageStatusValue.valueOf(rs.getString("storage_status")),
                        MedicalRecordAssetWire.MalwareScanStatusValue.valueOf(rs.getString("malware_scan_status")),
                        MedicalRecordAssetWire.OcrStatusValue.valueOf(rs.getString("ocr_status")),
                        rs.getString("ocr_text"),
                        rs.getBigDecimal("ocr_confidence") == null
                                ? null : rs.getBigDecimal("ocr_confidence").doubleValue(),
                        rs.getString("ocr_engine"),
                        instant(rs.getObject("ocr_completed_at", OffsetDateTime.class)),
                        MedicalRecordAssetWire.ObjectLockStatusValue.valueOf(rs.getString("object_lock_status")),
                        instant(rs.getObject("worm_retain_until", OffsetDateTime.class)),
                        instant(rs.getObject("last_verified_at", OffsetDateTime.class)),
                        rs.getObject("retired_by", UUID.class),
                        instant(rs.getObject("retired_at", OffsetDateTime.class)),
                        rs.getString("retirement_reason"),
                        instant(rs.getObject("created_at", OffsetDateTime.class)),
                        rs.getObject("borrowed_by", UUID.class),
                        instant(rs.getObject("borrowed_at", OffsetDateTime.class)),
                        instant(rs.getObject("due_at", OffsetDateTime.class)),
                        rs.getLong("row_version")))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private MedicalRecordAssetDistributionPackageWire distribution(UUID tenantId, UUID packageId) {
        return jdbc.sql("""
                select distribution_package_id, medical_record_asset_id, patient_id, purpose,
                  recipient_name, watermark_text, original_filename, media_type, byte_size,
                  content_hash, status, expires_at, created_by, created_at, delivered_by,
                  delivered_at, row_version
                from medical_record_asset_distribution_package
                where tenant_id = :tenant and distribution_package_id = :package
                """).param("tenant", tenantId).param("package", packageId)
                .query((rs, row) -> new MedicalRecordAssetDistributionPackageWire(
                        rs.getObject("distribution_package_id", UUID.class),
                        rs.getObject("medical_record_asset_id", UUID.class),
                        rs.getObject("patient_id", UUID.class), rs.getString("purpose"),
                        rs.getString("recipient_name"), rs.getString("watermark_text"),
                        rs.getString("original_filename"), rs.getString("media_type"),
                        rs.getLong("byte_size"), rs.getString("content_hash"),
                        MedicalRecordAssetDistributionPackageWire.StatusValue.valueOf(rs.getString("status")),
                        instant(rs.getObject("expires_at", OffsetDateTime.class)),
                        rs.getObject("created_by", UUID.class), instant(rs.getObject("created_at", OffsetDateTime.class)),
                        rs.getObject("delivered_by", UUID.class),
                        instant(rs.getObject("delivered_at", OffsetDateTime.class)), rs.getLong("row_version")))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private MedicalRecordAssetIntegrityEventWire integrityEvent(UUID tenantId, UUID eventId) {
        return jdbc.sql("""
                select integrity_event_id, medical_record_asset_id, expected_hash, observed_hash,
                  result, verified_by, verified_at
                from medical_record_asset_integrity_event
                where tenant_id = :tenant and integrity_event_id = :event
                """).param("tenant", tenantId).param("event", eventId)
                .query((rs, row) -> new MedicalRecordAssetIntegrityEventWire(
                        rs.getObject("integrity_event_id", UUID.class),
                        rs.getObject("medical_record_asset_id", UUID.class),
                        rs.getString("expected_hash"), rs.getString("observed_hash"),
                        MedicalRecordAssetIntegrityEventWire.ResultValue.valueOf(rs.getString("result")),
                        rs.getObject("verified_by", UUID.class),
                        instant(rs.getObject("verified_at", OffsetDateTime.class))))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private UUID recordIntegrity(
            ClinicalIdentity identity, UUID assetId, AssetHead head, String observedHash) {
        String result = head.contentHash().equalsIgnoreCase(observedHash) ? "VERIFIED" : "FAILED";
        UUID eventId = UUID.randomUUID();
        jdbc.sql("""
                insert into medical_record_asset_integrity_event(
                  tenant_id, integrity_event_id, medical_record_asset_id, expected_hash,
                  observed_hash, result, verified_by)
                values (:tenant, :event, :asset, :expected_hash, :observed_hash, :result, :actor)
                """).param("tenant", identity.tenantId()).param("event", eventId).param("asset", assetId)
                .param("expected_hash", head.contentHash()).param("observed_hash", observedHash)
                .param("result", result).param("actor", identity.userId()).update();
        jdbc.sql("""
                update medical_record_asset
                set integrity_status = :result, last_verified_at = now(),
                  preservation_status = case
                    when :result = 'VERIFIED' and preservation_status = 'SEALED' then 'VERIFIED'
                    else preservation_status end,
                  row_version = row_version + 1, updated_at = now()
                where tenant_id = :tenant and medical_record_asset_id = :asset and row_version = :expected
                """).param("result", result).param("tenant", identity.tenantId()).param("asset", assetId)
                .param("expected", head.rowVersion()).update();
        appendEvidence(identity, head.patientId(), assetId, "MEDICAL_RECORD_ASSET_INTEGRITY_" + result,
                "MedicalRecordAssetIntegrity" + result);
        return eventId;
    }

    private AssetHead lockAsset(UUID tenantId, UUID assetId) {
        return jdbc.sql("""
                select patient_id, asset_type, status, content_hash, integrity_status,
                  scan_status, preservation_status, storage_key, storage_status,
                  media_type, original_filename, row_version
                from medical_record_asset
                where tenant_id = :tenant and medical_record_asset_id = :asset for update
                """).param("tenant", tenantId).param("asset", assetId)
                .query((rs, row) -> new AssetHead(
                        rs.getObject("patient_id", UUID.class), rs.getString("asset_type"), rs.getString("status"),
                        rs.getString("content_hash"), rs.getString("integrity_status"),
                        rs.getString("scan_status"), rs.getString("preservation_status"),
                        rs.getString("storage_key"), rs.getString("storage_status"),
                        rs.getString("media_type"), rs.getString("original_filename"), rs.getLong("row_version")))
                .optional().orElseThrow(MedicalRecordAssetService::contextDenied);
    }

    private DistributionHead lockDistribution(UUID tenantId, UUID assetId, UUID packageId) {
        return jdbc.sql("""
                select status, expires_at, storage_key, original_filename, content_hash, row_version
                from medical_record_asset_distribution_package
                where tenant_id = :tenant and medical_record_asset_id = :asset
                  and distribution_package_id = :package for update
                """).param("tenant", tenantId).param("asset", assetId).param("package", packageId)
                .query((rs, row) -> new DistributionHead(rs.getString("status"),
                        instant(rs.getObject("expires_at", OffsetDateTime.class)), rs.getString("storage_key"),
                        rs.getString("original_filename"), rs.getString("content_hash"), rs.getLong("row_version")))
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
        long aggregateVersion = jdbc.sql("""
                select row_version from medical_record_asset
                where tenant_id = :tenant and medical_record_asset_id = :asset
                """).param("tenant", identity.tenantId()).param("asset", assetId)
                .query(Long.class).single();
        jdbc.sql("""
                insert into outbox_event(
                  tenant_id, event_id, aggregate_type, aggregate_id, aggregate_version,
                  event_type, schema_version, payload)
                values (:tenant, :event, 'MEDICAL_RECORD_ASSET', :aggregate, :aggregate_version, :event_type, 1,
                  jsonb_build_object('resource_id', :aggregate))
                """).param("tenant", identity.tenantId()).param("event", UUID.randomUUID())
                .param("aggregate", assetId).param("aggregate_version", aggregateVersion)
                .param("event_type", eventType).update();
    }

    private static String requireText(String value, int minLength, String field) {
        if (value == null || value.trim().length() < minLength) {
            throw invalid(field + " must be at least " + minLength + " characters");
        }
        return value.trim();
    }

    private static String requireHash(String value) {
        if (value == null || !value.trim().matches("[0-9a-fA-F]{64}")) {
            throw invalid("content_hash must be exactly 64 hexadecimal characters");
        }
        return value.trim();
    }

    private static String optionalText(String value, String fallback, int minLength, String field) {
        return value == null || value.isBlank() ? fallback : requireText(value, minLength, field);
    }

    private static int requireRange(Integer value, int minimum, int maximum, String field) {
        if (value == null || value < minimum || value > maximum) {
            throw invalid(field + " must be between " + minimum + " and " + maximum);
        }
        return value;
    }

    private static String requireMediaType(String value) {
        String mediaType = requireText(value, 3, "media_type").toLowerCase();
        if (!Set.of("application/pdf", "image/jpeg", "image/png", "text/plain", "application/xml")
                .contains(mediaType)) {
            throw invalid("media_type is not allowed for medical record asset ingestion");
        }
        return mediaType;
    }

    private static String safeFilename(String value) {
        String filename = requireText(value, 1, "original_filename").replace('\\', '/');
        filename = filename.substring(filename.lastIndexOf('/') + 1).trim();
        if (filename.isEmpty() || filename.length() > 255 || filename.equals(".") || filename.equals("..")) {
            throw invalid("original_filename is invalid");
        }
        return filename.replaceAll("[^\\p{L}\\p{N}._() -]", "_");
    }

    private static byte[] decodeContent(String value) {
        if (value == null || value.isBlank()) throw invalid("content_base64 is required");
        try {
            byte[] content = Base64.getDecoder().decode(value);
            if (content.length < 1 || content.length > 50 * 1024 * 1024) {
                throw invalid("asset content must be between 1 byte and 50 MiB");
            }
            return content;
        } catch (IllegalArgumentException malformed) {
            throw invalid("content_base64 is not valid base64");
        }
    }

    private static void rejectKnownMalware(byte[] content) {
        String probe = new String(content, 0, Math.min(content.length, 512), StandardCharsets.US_ASCII);
        if (probe.contains("EICAR-STANDARD-ANTIVIRUS-TEST-FILE")) {
            throw new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_MALWARE_REJECTED", 422,
                    "Asset content was rejected by malware scanning");
        }
    }

    private static void validateMagic(String mediaType, byte[] content) {
        boolean valid = switch (mediaType) {
            case "application/pdf" -> startsWith(content, "%PDF-".getBytes(StandardCharsets.US_ASCII));
            case "image/png" -> startsWith(content, new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a});
            case "image/jpeg" -> content.length >= 3 && (content[0] & 0xff) == 0xff
                    && (content[1] & 0xff) == 0xd8 && (content[2] & 0xff) == 0xff;
            case "application/xml" -> new String(content, 0, Math.min(content.length, 256), StandardCharsets.UTF_8)
                    .stripLeading().startsWith("<");
            case "text/plain" -> !new String(content, StandardCharsets.UTF_8).contains("\u0000");
            default -> false;
        };
        if (!valid) throw new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_MEDIA_MISMATCH", 422,
                "Asset bytes do not match the declared media type");
    }

    private static boolean startsWith(byte[] value, byte[] prefix) {
        if (value.length < prefix.length) return false;
        for (int index = 0; index < prefix.length; index += 1) {
            if (value[index] != prefix[index]) return false;
        }
        return true;
    }

    private byte[] distributionZip(
            UUID packageId, UUID assetId, AssetHead head, byte[] original,
            String watermark, Instant expiresAt) {
        try {
            ByteArrayOutputStream bytes = new ByteArrayOutputStream();
            try (ZipOutputStream zip = new ZipOutputStream(bytes, StandardCharsets.UTF_8)) {
                ZipEntry originalEntry = new ZipEntry("original/" + safeFilename(head.originalFilename()));
                originalEntry.setTime(0);
                zip.putNextEntry(originalEntry);
                zip.write(original);
                zip.closeEntry();
                byte[] manifest = mapper.writeValueAsBytes(Map.of(
                        "schema", "openemr2026.medical-record-asset.distribution.v1",
                        "distribution_package_id", packageId.toString(),
                        "medical_record_asset_id", assetId.toString(),
                        "original_sha256", head.contentHash(),
                        "watermark", watermark,
                        "expires_at", expiresAt.toString()));
                ZipEntry manifestEntry = new ZipEntry("manifest.json");
                manifestEntry.setTime(0);
                zip.putNextEntry(manifestEntry);
                zip.write(manifest);
                zip.closeEntry();
            }
            return bytes.toByteArray();
        } catch (IOException failure) {
            throw new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_DISTRIBUTION_BUILD_FAILED", 503,
                    "Distribution package could not be built");
        }
    }

    private static void requireVersion(AssetHead head, Long expectedRowVersion) {
        if (expectedRowVersion == null || head.rowVersion() != expectedRowVersion) throw versionConflict();
    }

    private static void requireScanStatus(String assetType, String scanStatus) {
        if ("SCAN".equals(assetType) && "NOT_APPLICABLE".equals(scanStatus)) {
            throw invalid("scan_status is required for scanned assets");
        }
        if (!"SCAN".equals(assetType) && !"NOT_APPLICABLE".equals(scanStatus)) {
            throw invalid("scan_status must be NOT_APPLICABLE for non-scan assets");
        }
    }

    private static void requireScanTransition(String from, String to) {
        if (from.equals(to) || "NOT_APPLICABLE".equals(from)) return;
        boolean valid = ("CAPTURED".equals(from) && "OCR_REVIEWED".equals(to))
                || ("OCR_REVIEWED".equals(from) && "INDEXED".equals(to));
        if (!valid) throw stateInvalid("Invalid scan workflow transition");
    }

    private static void requirePreservationTransition(String from, String to, String integrityStatus) {
        if (from.equals(to)) return;
        boolean valid = ("NOT_SCHEDULED".equals(from) && "SCHEDULED".equals(to))
                || ("SCHEDULED".equals(from) && ("NOT_SCHEDULED".equals(to) || "SEALED".equals(to)));
        if (!valid) throw stateInvalid("Invalid preservation workflow transition");
        if ("SEALED".equals(to) && !"VERIFIED".equals(integrityStatus)) {
            throw stateInvalid("Integrity verification is required before long-term sealing");
        }
    }

    private static MedicalRecordAssetException invalid(String message) {
        return new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_REQUEST_INVALID", 400, message);
    }

    private static MedicalRecordAssetException versionConflict() {
        return new MedicalRecordAssetException(
                "MEDICAL_RECORD_ASSET_VERSION_CONFLICT", 409, "The asset changed; reload before retrying");
    }

    private static MedicalRecordAssetException stateInvalid(String message) {
        return new MedicalRecordAssetException("MEDICAL_RECORD_ASSET_STATE_INVALID", 409, message);
    }

    static MedicalRecordAssetException contextDenied() {
        return new MedicalRecordAssetException(
                "CONTEXT_NOT_PERMITTED", 403, "The requested medical record asset context is not permitted");
    }

    private record AssetHead(
            UUID patientId, String assetType, String status, String contentHash, String integrityStatus,
            String scanStatus, String preservationStatus, String storageKey, String storageStatus,
            String mediaType, String originalFilename, long rowVersion) {}

    private record DistributionHead(
            String status, Instant expiresAt, String storageKey, String originalFilename,
            String contentHash, long rowVersion) {}

    record AssetBinary(byte[] content, String mediaType, String filename, String contentHash) {}
    record DistributionBinary(byte[] content, String filename, String contentHash) {}

    private static Instant instant(OffsetDateTime value) {
        return value == null ? null : value.toInstant();
    }

    private static String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }

    private static String sha256(byte[] value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(value));
        } catch (NoSuchAlgorithmException impossible) {
            throw new IllegalStateException(impossible);
        }
    }
}
