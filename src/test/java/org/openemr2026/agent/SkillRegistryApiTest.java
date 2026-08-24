package org.openemr2026.agent;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.SkillRegistryDeactivateRequestWire;
import org.openemr2026.contracts.SkillRegistryRegisterRequestWire;
import org.openemr2026.contracts.SkillRegistryWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class SkillRegistryApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private SkillRegistryService skills;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private SkillRegistryWire register(String skillCode) {
        return skills.register(identity(), "skill-" + UUID.randomUUID(),
                new SkillRegistryRegisterRequestWire(organization, facility, skillCode,
                        "临床摘要技能", "v1"));
    }

    @Test
    void givenSkill_whenRegisteringAndListing_thenActiveSkillRecorded() {
        String skillCode = "SKILL-" + UUID.randomUUID().toString().substring(0, 8);
        SkillRegistryWire registered = register(skillCode);
        assertThat(registered.status()).isEqualTo(SkillRegistryWire.StatusValue.ACTIVE);
        assertThat(registered.skillCode()).isEqualTo(skillCode);

        List<SkillRegistryWire> listed = skills.listSkills(identity(), "ACTIVE");
        assertThat(listed).extracting(SkillRegistryWire::skillRegistryId).contains(registered.skillRegistryId());
    }

    @Test
    void givenActiveSkill_whenDeactivating_thenInactive() {
        String skillCode = "SKILL-" + UUID.randomUUID().toString().substring(0, 8);
        SkillRegistryWire registered = register(skillCode);
        SkillRegistryWire deactivated = skills.deactivate(identity(), "deact-" + UUID.randomUUID(),
                registered.skillRegistryId(), new SkillRegistryDeactivateRequestWire(organization, facility));
        assertThat(deactivated.status()).isEqualTo(SkillRegistryWire.StatusValue.INACTIVE);
    }

    @Test
    void givenSkillIdentity_whenTampered_thenDatabaseRejectsMutation() {
        String skillCode = "SKILL-" + UUID.randomUUID().toString().substring(0, 8);
        SkillRegistryWire registered = register(skillCode);
        assertThatThrownBy(() -> jdbc.sql("""
                update skill_registry set skill_code = 'TAMPERED'
                where tenant_id = cast(:tenant as uuid) and skill_registry_id = :registry
                """).param("tenant", TENANT).param("registry", registered.skillRegistryId()).update())
                .isInstanceOf(DataAccessException.class);
    }
}
