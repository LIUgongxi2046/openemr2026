package org.openemr2026.outpatient;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.OutpatientFollowupCompleteRequestWire;
import org.openemr2026.contracts.OutpatientFollowupCreateRequestWire;
import org.openemr2026.contracts.OutpatientFollowupWire;
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
final class OutpatientFollowupController {
    private final ClinicalCommandSecurity security;
    private final OutpatientFollowupService followups;

    OutpatientFollowupController(ClinicalCommandSecurity security, OutpatientFollowupService followups) {
        this.security = security;
        this.followups = followups;
    }

    @GetMapping("/outpatient-followups")
    ResponseEntity<List<OutpatientFollowupWire>> list(
            HttpServletRequest request,
            @RequestParam("patient_id") UUID patientId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(followups.list(identity, patientId));
    }

    @PostMapping("/outpatient-followups")
    ResponseEntity<OutpatientFollowupWire> create(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody OutpatientFollowupCreateRequestWire command,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(
                request, organizationId, facilityId, command.patientId(), command.encounterId());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(followups.create(identity, idempotencyKey, command));
    }

    @PostMapping("/outpatient-followups/{followup_id}/completions")
    ResponseEntity<OutpatientFollowupWire> complete(
            HttpServletRequest request,
            @PathVariable("followup_id") UUID followupId,
            @RequestBody OutpatientFollowupCompleteRequestWire command,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientId,
            @RequestHeader("X-Encounter-Context") UUID encounterId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, encounterId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(followups.complete(identity, followupId, command));
    }
}
