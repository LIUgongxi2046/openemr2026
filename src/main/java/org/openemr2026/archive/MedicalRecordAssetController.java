package org.openemr2026.archive;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.MedicalRecordAssetBorrowRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetRegisterRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetReturnRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetWire;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class MedicalRecordAssetController {
    private final ClinicalCommandSecurity security;
    private final MedicalRecordAssetService assets;

    MedicalRecordAssetController(ClinicalCommandSecurity security, MedicalRecordAssetService assets) {
        this.security = security;
        this.assets = assets;
    }

    @GetMapping("/medical-record-assets")
    ResponseEntity<List<MedicalRecordAssetWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientContextId) {
        if (!patientId.equals(patientContextId)) throw MedicalRecordAssetService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(assets.listAssets(identity, patientId));
    }

    @PostMapping("/medical-record-assets")
    ResponseEntity<MedicalRecordAssetWire> register(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody MedicalRecordAssetRegisterRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(assets.register(identity, idempotencyKey, command));
    }

    @PostMapping("/medical-record-assets/{asset_id}/borrows")
    ResponseEntity<MedicalRecordAssetWire> borrow(
            HttpServletRequest request,
            @PathVariable("asset_id") UUID assetId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody MedicalRecordAssetBorrowRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(assets.borrow(identity, idempotencyKey, assetId, command));
    }

    @PostMapping("/medical-record-assets/{asset_id}/returns")
    ResponseEntity<MedicalRecordAssetWire> returnAsset(
            HttpServletRequest request,
            @PathVariable("asset_id") UUID assetId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody MedicalRecordAssetReturnRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(assets.returnAsset(identity, idempotencyKey, assetId, command));
    }
}
