package org.openemr2026.assistant;

import jakarta.servlet.http.HttpServletRequest;
import java.util.UUID;
import org.openemr2026.security.ClinicalCommandSecurity;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
final class ClinicalAssistantController {
    private final ClinicalCommandSecurity security;
    private final ClinicalAssistantService assistant;

    ClinicalAssistantController(ClinicalCommandSecurity security, ClinicalAssistantService assistant) {
        this.security = security;
        this.assistant = assistant;
    }

    @GetMapping(value = "/assistant/stream", produces = MediaType.TEXT_EVENT_STREAM_VALUE)
    ResponseEntity<String> stream(
            HttpServletRequest request,
            @RequestParam("message") String message,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(assistant.stream(message));
    }
}
