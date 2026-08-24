package org.openemr2026.security;

import jakarta.servlet.http.HttpServletRequest;
import java.util.Arrays;
import java.util.List;
import java.util.UUID;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Component;

@Component
@Profile("dev-synthetic")
final class DevOidcClinicalIdentityProvider implements ClinicalIdentityProvider {

    private static final String DEVELOPMENT_TOKEN = "Bearer dev-synthetic-token";

    @Override
    public ClinicalIdentity current(HttpServletRequest request) {
        if (!DEVELOPMENT_TOKEN.equals(request.getHeader("Authorization"))) {
            throw new ClinicalAccessDeniedException("AUTHENTICATION_REQUIRED", "A valid clinical identity is required");
        }
        try {
            UUID tenantId = UUID.fromString(requiredHeader(request, "X-OpenEMR-Tenant-Id"));
            UUID userId = UUID.fromString(requiredHeader(request, "X-OpenEMR-User-Id"));
            List<UUID> roles = Arrays.stream(requiredHeader(request, "X-OpenEMR-Role-Assignment-Ids").split(","))
                    .map(String::trim)
                    .filter(value -> !value.isEmpty())
                    .map(UUID::fromString)
                    .toList();
            return new ClinicalIdentity(tenantId, userId, roles);
        } catch (IllegalArgumentException invalidIdentity) {
            throw new ClinicalAccessDeniedException("AUTHENTICATION_REQUIRED", "A valid clinical identity is required");
        }
    }

    private static String requiredHeader(HttpServletRequest request, String name) {
        String value = request.getHeader(name);
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Missing identity header");
        }
        return value;
    }
}
