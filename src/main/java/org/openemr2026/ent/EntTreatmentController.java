package org.openemr2026.ent;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.EntTreatmentCreateRequestWire;
import org.openemr2026.contracts.EntTreatmentWire;
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
final class EntTreatmentController {
    private final ClinicalCommandSecurity security;
    private final EntTreatmentService notes;

    EntTreatmentController(ClinicalCommandSecurity security, EntTreatmentService notes) {
        this.security = security;
        this.notes = notes;
    }

    @GetMapping("/ent-treatment-records")
    ResponseEntity<List<EntTreatmentWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientContextId) {
        if (!patientId.equals(patientContextId)) throw EntTreatmentService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(notes.listNotes(identity, patientId));
    }

    @PostMapping("/ent-treatment-records")
    ResponseEntity<EntTreatmentWire> create(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody EntTreatmentCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), command.encounterId());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(notes.create(identity, idempotencyKey, command));
    }
}
