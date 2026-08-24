package org.openemr2026.mock;

import jakarta.servlet.http.HttpServletRequest;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.MockInterfaceWire;
import org.openemr2026.contracts.MockInvocationResultWire;
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
final class MockInterfaceController {
    private final ClinicalCommandSecurity security;
    private final MockInterfaceService mocks;

    MockInterfaceController(ClinicalCommandSecurity security, MockInterfaceService mocks) {
        this.security = security;
        this.mocks = mocks;
    }

    @GetMapping("/mock-interfaces")
    ResponseEntity<List<MockInterfaceWire>> list(
            HttpServletRequest request,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(mocks.list());
    }

    @PostMapping("/mock-interfaces/{code}/invoke")
    ResponseEntity<MockInvocationResultWire> invoke(
            HttpServletRequest request,
            @PathVariable("code") String code,
            @RequestBody Map<String, Object> payload,
            @RequestHeader("X-Organization-Context") UUID organizationId,
            @RequestHeader("X-Facility-Context") UUID facilityId) {
        ClinicalIdentity identity = security.authorize(request, organizationId, facilityId, null, null);
        return ResponseEntity.ok().cacheControl(CacheControl.noStore())
                .body(mocks.invoke(code, payload == null ? Map.of() : payload));
    }
}
