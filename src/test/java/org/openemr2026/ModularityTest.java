package org.openemr2026;

import org.junit.jupiter.api.Test;
import org.springframework.modulith.core.ApplicationModules;

final class ModularityTest {

    @Test
    void applicationModulesRespectDeclaredBoundaries() {
        ApplicationModules.of(Openemr2026Application.class).verify();
    }
}

