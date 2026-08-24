package org.openemr2026.research;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ResearchDatasetRequestApproveRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestCreateRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestDestroyRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestExportRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestWire;
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
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class ResearchDatasetController {
    private final ClinicalCommandSecurity security;
    private final ResearchDatasetService research;

    ResearchDatasetController(ClinicalCommandSecurity security, ResearchDatasetService research) {
        this.security = security;
        this.research = research;
    }

    @GetMapping("/research-dataset-requests")
    ResponseEntity<List<ResearchDatasetRequestWire>> list(
            HttpServletRequest request,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(research.list(identity));
    }

    @PostMapping("/research-dataset-requests")
    ResponseEntity<ResearchDatasetRequestWire> create(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ResearchDatasetRequestCreateRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(research.create(identity, idempotencyKey, command));
    }

    @PostMapping("/research-dataset-requests/{request_id}/approvals")
    ResponseEntity<ResearchDatasetRequestWire> approve(
            HttpServletRequest request,
            @PathVariable("request_id") UUID requestId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ResearchDatasetRequestApproveRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(research.approve(identity, idempotencyKey, requestId, command));
    }

    @PostMapping("/research-dataset-requests/{request_id}/exports")
    ResponseEntity<ResearchDatasetRequestWire> export(
            HttpServletRequest request,
            @PathVariable("request_id") UUID requestId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ResearchDatasetRequestExportRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(research.export(identity, idempotencyKey, requestId, command));
    }

    @PostMapping("/research-dataset-requests/{request_id}/destructions")
    ResponseEntity<ResearchDatasetRequestWire> destroy(
            HttpServletRequest request,
            @PathVariable("request_id") UUID requestId,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody ResearchDatasetRequestDestroyRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(research.destroy(identity, idempotencyKey, requestId, command));
    }
}
