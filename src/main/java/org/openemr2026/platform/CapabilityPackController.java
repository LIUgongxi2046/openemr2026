package org.openemr2026.platform;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.CapabilityPackDeactivateRequestWire;
import org.openemr2026.contracts.CapabilityPackDefineRequestWire;
import org.openemr2026.contracts.CapabilityPackWire;
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
final class CapabilityPackController {
    private final ClinicalCommandSecurity security;
    private final CapabilityPackService packs;

    CapabilityPackController(ClinicalCommandSecurity security, CapabilityPackService packs) {
        this.security = security;
        this.packs = packs;
    }

    @GetMapping("/capability-packs")
    ResponseEntity<List<CapabilityPackWire>> list(
            HttpServletRequest request,
            @RequestParam(value = "status", required = false) String status,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(packs.listPacks(identity, status));
    }

    @PostMapping("/capability-packs")
    ResponseEntity<CapabilityPackWire> define(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody CapabilityPackDefineRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(packs.define(identity, idempotencyKey, command));
    }

    @PostMapping("/capability-packs/{capability_pack_id}/deactivations")
    ResponseEntity<CapabilityPackWire> deactivate(
            HttpServletRequest request,
            @PathVariable("capability_pack_id") UUID capabilityPackId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody CapabilityPackDeactivateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(packs.deactivate(identity, idempotencyKey, capabilityPackId, command));
    }
}
