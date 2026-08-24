package org.openemr2026.emergency;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.EmergencyTriageAssessmentCreateRequestWire;
import org.openemr2026.contracts.EmergencyTriageAssessmentWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class EmergencyTriageApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private EmergencyTriageService assessments;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private Context seedContext() {
        UUID patientId = UUID.randomUUID();
        UUID encounterId = UUID.randomUUID();
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (cast(:tenant as uuid), :patient, '合成急诊患者', 'M', :birth, 'ACTIVE')
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1990, 6, 6)).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (cast(:tenant as uuid), :encounter, :patient, cast(:organization as uuid),
                  cast(:facility as uuid), 'EMERGENCY', 'ARRIVED', now(), 'SYNTHETIC-EMERGENCY', :source_key)
                """).param("tenant", TENANT).param("encounter", encounterId).param("patient", patientId)
                .param("organization", ORGANIZATION).param("facility", FACILITY)
                .param("source_key", UUID.randomUUID().toString()).update();
        return new Context(patientId, encounterId);
    }

    private EmergencyTriageAssessmentCreateRequestWire command(
            Context context, String level, String complaint, boolean immediate) {
        return new EmergencyTriageAssessmentCreateRequestWire(organization, facility, context.patientId(),
                context.encounterId(),
                EmergencyTriageAssessmentCreateRequestWire.TriageLevelValue.valueOf(level),
                complaint, Instant.now(), immediate);
    }

    @Test
    void givenPatient_whenCreatingAndListingAssessment_thenLifecycleRecorded() {
        Context context = seedContext();
        EmergencyTriageAssessmentWire created = assessments.createAssessment(identity(), "triage-" + UUID.randomUUID(),
                command(context, "LEVEL_2", "胸痛伴出汗", false));
        assertThat(created.triageLevel()).isEqualTo(EmergencyTriageAssessmentWire.TriageLevelValue.LEVEL_2);
        assertThat(created.chiefComplaint()).isEqualTo("胸痛伴出汗");
        assertThat(created.immediateActionRequired()).isFalse();
        assertThat(created.status()).isEqualTo(EmergencyTriageAssessmentWire.StatusValue.ACTIVE);

        List<EmergencyTriageAssessmentWire> listed = assessments.listAssessments(identity(), context.patientId());
        assertThat(listed).extracting(EmergencyTriageAssessmentWire::triageAssessmentId)
                .contains(created.triageAssessmentId());
    }

    @Test
    void givenLevel1WithoutImmediateAction_whenCreating_thenRejected() {
        Context context = seedContext();
        assertThatThrownBy(() -> assessments.createAssessment(identity(), "triage-" + UUID.randomUUID(),
                command(context, "LEVEL_1", "心跳呼吸骤停", false)))
                .isInstanceOf(EmergencyTriageException.class)
                .satisfies(e -> assertThat(((EmergencyTriageException) e).code())
                        .isEqualTo("EMERGENCY_TRIAGE_REQUEST_INVALID"));
    }

    @Test
    void givenLevel1WithImmediateAction_whenCreating_thenAccepted() {
        Context context = seedContext();
        EmergencyTriageAssessmentWire created = assessments.createAssessment(identity(), "triage-" + UUID.randomUUID(),
                command(context, "LEVEL_1", "心跳呼吸骤停", true));
        assertThat(created.triageLevel()).isEqualTo(EmergencyTriageAssessmentWire.TriageLevelValue.LEVEL_1);
        assertThat(created.immediateActionRequired()).isTrue();
    }

    @Test
    void givenAssessmentIdentity_whenTampered_thenDatabaseRejectsMutation() {
        Context context = seedContext();
        EmergencyTriageAssessmentWire created = assessments.createAssessment(identity(), "triage-" + UUID.randomUUID(),
                command(context, "LEVEL_3", "腹痛", false));
        assertThatThrownBy(() -> jdbc.sql("""
                update emergency_triage_assessment set triage_level = 'LEVEL_1'
                where tenant_id = cast(:tenant as uuid) and triage_assessment_id = :assessment
                """).param("tenant", TENANT).param("assessment", created.triageAssessmentId()).update())
                .isInstanceOf(DataAccessException.class);
    }

    private record Context(UUID patientId, UUID encounterId) {}
}
