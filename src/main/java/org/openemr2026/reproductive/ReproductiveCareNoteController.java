package org.openemr2026.reproductive;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ReproductiveCareNoteCreateRequestWire;
import org.openemr2026.contracts.ReproductiveCareNoteWire;
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
final class ReproductiveCareNoteController {
    private final ClinicalCommandSecurity security;
    private final ReproductiveCareNoteService notes;

    ReproductiveCareNoteController(ClinicalCommandSecurity security, ReproductiveCareNoteService notes) {
        this.security = security;
        this.notes = notes;
    }

    @GetMapping("/reproductive-care-notes")
    ResponseEntity<List<ReproductiveCareNoteWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientContextId) {
        if (!patientId.equals(patientContextId)) throw ReproductiveCareNoteService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(notes.listNotes(identity, patientId));
    }

    @PostMapping("/reproductive-care-notes")
    ResponseEntity<ReproductiveCareNoteWire> create(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ReproductiveCareNoteCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), command.encounterId());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(notes.create(identity, idempotencyKey, command));
    }
}
