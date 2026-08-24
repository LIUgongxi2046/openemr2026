package org.openemr2026.research;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ResearchCohortMemberComputeRequestWire;
import org.openemr2026.contracts.ResearchCohortMemberWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class ResearchCohortMemberApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private ResearchCohortMemberService members;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private UUID seedCohort(String status) {
        UUID cohortId = UUID.randomUUID();
        jdbc.sql("""
                insert into research_cohort(
                  tenant_id, research_cohort_id, cohort_code, cohort_name, inclusion_criteria, exclusion_criteria, status)
                values (cast(:tenant as uuid), :cohort, :code, '队列', '年龄 >= 18', '妊娠', :status)
                """).param("tenant", TENANT).param("cohort", cohortId)
                .param("code", "COH-" + UUID.randomUUID().toString().substring(0, 8)).param("status", status).update();
        return cohortId;
    }

    private UUID seedPatient(String status) {
        UUID patientId = UUID.randomUUID();
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (cast(:tenant as uuid), :patient, '合成队列成员患者', 'M', :birth, :status)
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1970, 1, 1)).param("status", status).update();
        return patientId;
    }

    private ResearchCohortMemberWire compute(UUID cohortId, UUID patientId) {
        return members.compute(identity(), "member-" + UUID.randomUUID(),
                new ResearchCohortMemberComputeRequestWire(organization, facility, cohortId, patientId, Instant.now()));
    }

    @Test
    void givenActiveCohortAndPatient_whenComputing_thenMember() {
        UUID cohortId = seedCohort("ACTIVE");
        UUID patientId = seedPatient("ACTIVE");
        ResearchCohortMemberWire member = compute(cohortId, patientId);
        assertThat(member.patientId()).isEqualTo(patientId);
        assertThat(member.computedBy()).isEqualTo(UUID.fromString(USER));

        List<ResearchCohortMemberWire> listed = members.list(identity(), cohortId);
        assertThat(listed).extracting(ResearchCohortMemberWire::cohortMemberId)
                .contains(member.cohortMemberId());
    }

    @Test
    void givenDuplicateMember_whenComputing_thenRejected() {
        UUID cohortId = seedCohort("ACTIVE");
        UUID patientId = seedPatient("ACTIVE");
        compute(cohortId, patientId);
        assertThatThrownBy(() -> compute(cohortId, patientId))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void givenInactiveCohort_whenComputing_thenRejected() {
        UUID cohortId = seedCohort("INACTIVE");
        UUID patientId = seedPatient("ACTIVE");
        assertThatThrownBy(() -> compute(cohortId, patientId))
                .isInstanceOf(ResearchCohortMemberException.class)
                .satisfies(e -> assertThat(((ResearchCohortMemberException) e).code())
                        .isEqualTo("RESEARCH_COHORT_INACTIVE"));
    }

    @Test
    void givenInactivePatient_whenComputing_thenRejected() {
        UUID cohortId = seedCohort("ACTIVE");
        UUID patientId = seedPatient("DECEASED");
        assertThatThrownBy(() -> compute(cohortId, patientId))
                .isInstanceOf(ResearchCohortMemberException.class)
                .satisfies(e -> assertThat(((ResearchCohortMemberException) e).code())
                        .isEqualTo("PATIENT_INACTIVE"));
    }

    @Test
    void givenMember_whenTampered_thenDatabaseRejectsMutation() {
        UUID cohortId = seedCohort("ACTIVE");
        UUID patientId = seedPatient("ACTIVE");
        ResearchCohortMemberWire member = compute(cohortId, patientId);
        assertThatThrownBy(() -> jdbc.sql("""
                update research_cohort_member set patient_id = cast(:other as uuid)
                where tenant_id = cast(:tenant as uuid) and cohort_member_id = :member
                """).param("tenant", TENANT).param("member", member.cohortMemberId())
                .param("other", UUID.randomUUID()).update())
                .isInstanceOf(DataAccessException.class);
    }
}
