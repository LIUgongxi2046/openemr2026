package org.openemr2026.ophthalmology;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.OphthalmologyPreopVerificationCreateRequestWire;
import org.openemr2026.contracts.OphthalmologyPreopVerificationWire;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class OphthalmologyPreopVerificationController {
    private final ClinicalCommandSecurity security;
    private final OphthalmologyPreopVerificationService verifications;

    OphthalmologyPreopVerificationController(
            ClinicalCommandSecurity security, OphthalmologyPreopVerificationService verifications) {
        this.security = security;
        this.verifications = verifications;
    }

    @GetMapping("/ophthalmology-preop-verifications")
    ResponseEntity<List<OphthalmologyPreopVerificationWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientContextId) {
        if (!patientId.equals(patientContextId)) throw OphthalmologyPreopVerificationService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(verifications.listRecords(identity, patientId));
    }

    @PostMapping("/ophthalmology-preop-verifications")
    ResponseEntity<OphthalmologyPreopVerificationWire> record(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OphthalmologyPreopVerificationCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), command.encounterId());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(verifications.record(identity, idempotencyKey, command));
    }
}
