package org.openemr2026.agent;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.AgentDependencyDeclareRequestWire;
import org.openemr2026.contracts.AgentDependencyWire;
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
final class AgentDependencyController {
    private final ClinicalCommandSecurity security;
    private final AgentDependencyService dependencies;

    AgentDependencyController(ClinicalCommandSecurity security, AgentDependencyService dependencies) {
        this.security = security;
        this.dependencies = dependencies;
    }

    @GetMapping("/agent-dependencies")
    ResponseEntity<List<AgentDependencyWire>> list(
            HttpServletRequest request,
            @RequestParam("agent_registry_id") UUID agentRegistryId,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(dependencies.listDependencies(identity, agentRegistryId));
    }

    @PostMapping("/agent-dependencies")
    ResponseEntity<AgentDependencyWire> declare(
            HttpServletRequest request,
            @RequestHeader("Idempotency-Key") String idempotencyKey,
            @RequestBody AgentDependencyDeclareRequestWire command) {
        ClinicalIdentity identity = security.authorize(
                request, command.organizationId(), command.facilityId(), null, null);
        return ResponseEntity.status(201).cacheControl(CacheControl.noStore())
                .body(dependencies.declare(identity, idempotencyKey, command));
    }
}
