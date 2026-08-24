package org.openemr2026.organization;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.organization.WorkforceAdministrationService.AccountDeactivateRequest;
import org.openemr2026.organization.WorkforceAdministrationService.RoleEndRequest;
import org.openemr2026.organization.WorkforceAdministrationService.WorkforceIdentityWire;
import org.openemr2026.organization.WorkforceAdministrationService.WorkforceOnboardingRequest;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/admin/workforce")
final class WorkforceAdministrationController {

    private final ClinicalCommandSecurity security;
    private final WorkforceAdministrationService workforce;

    WorkforceAdministrationController(ClinicalCommandSecurity security, WorkforceAdministrationService workforce) {
        this.security = security;
        this.workforce = workforce;
    }

    @GetMapping
    List<WorkforceIdentityWire> list(HttpServletRequest request) {
        return workforce.list(security.authenticate(request));
    }

    @PostMapping
    ResponseEntity<WorkforceIdentityWire> onboard(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody WorkforceOnboardingRequest body) {
        ClinicalIdentity identity = security.authenticate(request);
        return ResponseEntity.status(201).body(workforce.onboard(identity, idempotencyKey, body));
    }

    @PostMapping("/accounts/{userId}/deactivate")
    WorkforceIdentityWire deactivateAccount(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @PathVariable UUID userId,
            @RequestBody AccountDeactivateRequest body) {
        return workforce.disableAccount(security.authenticate(request), idempotencyKey, userId, body);
    }

    @PostMapping("/role-assignments/{roleAssignmentId}/end")
    WorkforceIdentityWire endRole(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @PathVariable UUID roleAssignmentId,
            @RequestBody RoleEndRequest body) {
        return workforce.endRole(security.authenticate(request), idempotencyKey, roleAssignmentId, body);
    }
}
