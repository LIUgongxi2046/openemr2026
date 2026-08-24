package org.openemr2026;

import java.time.Instant;

public record SystemReadiness(
        String product,
        String component,
        String version,
        String status,
        Instant checkedAt) {

    public static SystemReadiness ready(String version) {
        return new SystemReadiness(
                "openemr2026",
                "clinical-core",
                version,
                "READY",
                Instant.now());
    }
}

