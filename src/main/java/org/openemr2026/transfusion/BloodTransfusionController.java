package org.openemr2026.transfusion;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.BloodTransfusionReactionRequestWire;
import org.openemr2026.contracts.BloodTransfusionRecordRequestWire;
import org.openemr2026.contracts.BloodTransfusionWire;
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
final class BloodTransfusionController {
    private final ClinicalCommandSecurity security;
    private final BloodTransfusionService transfusions;

    BloodTransfusionController(ClinicalCommandSecurity security, BloodTransfusionService transfusions) {
        this.security = security;
        this.transfusions = transfusions;
    }

    @GetMapping("/blood-transfusions")
    ResponseEntity<List<BloodTransfusionWire>> list(
            HttpServletRequest request,
            @RequestParam("encounter_id") UUID encounterId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId,
            @RequestHeader("X-Patient-Context") UUID patientId,
            @RequestHeader("X-Encounter-Context") UUID encounterContextId) {
        if (!encounterId.equals(encounterContextId)) throw BloodTransfusionService.contextDenied();
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, patientId, encounterId);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(transfusions.listTransfusions(identity, organizationId, facilityId, patientId, encounterId));
    }

    @PostMapping("/blood-transfusions")
    ResponseEntity<BloodTransfusionWire> record(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BloodTransfusionRecordRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), command.encounterId());
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(transfusions.recordTransfusion(identity, idempotencyKey, command));
    }

    @PostMapping("/blood-transfusions/{transfusion_id}/reactions")
    ResponseEntity<BloodTransfusionWire> recordReaction(
            HttpServletRequest request,
            @PathVariable("transfusion_id") UUID transfusionId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody BloodTransfusionReactionRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), command.patientId(), command.encounterId());
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(transfusions.recordReaction(identity, idempotencyKey, transfusionId, command));
    }
}
