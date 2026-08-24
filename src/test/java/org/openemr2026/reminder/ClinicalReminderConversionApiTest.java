package org.openemr2026.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ClinicalReminderConversionCreateRequestWire;
import org.openemr2026.contracts.ClinicalReminderConversionWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class ClinicalReminderConversionApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private ClinicalReminderConversionService conversions;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private Context seedContext(String reminderStatus) {
        UUID patientId = UUID.randomUUID();
        UUID encounterId = UUID.randomUUID();
        UUID reminderId = UUID.randomUUID();
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (cast(:tenant as uuid), :patient, '合成提醒转任务患者', 'F', :birth, 'ACTIVE')
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1977, 7, 7)).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (cast(:tenant as uuid), :encounter, :patient, cast(:organization as uuid),
                  cast(:facility as uuid), 'OUTPATIENT', 'IN_PROGRESS', now(), 'SYNTHETIC-REMCONV', :source_key)
                """).param("tenant", TENANT).param("encounter", encounterId).param("patient", patientId)
                .param("organization", ORGANIZATION).param("facility", FACILITY)
                .param("source_key", UUID.randomUUID().toString()).update();
        jdbc.sql("""
                insert into clinical_reminder(
                  tenant_id, reminder_id, patient_id, encounter_id, facility_id,
                  reminder_type, message, severity, status)
                values (cast(:tenant as uuid), :reminder, :patient, :encounter, cast(:facility as uuid),
                  'OVERDUE_TASK', '过期任务待处理提醒', 'WARNING', :status)
                """).param("tenant", TENANT).param("reminder", reminderId).param("patient", patientId)
                .param("encounter", encounterId).param("facility", FACILITY).param("status", reminderStatus).update();
        return new Context(patientId, encounterId, reminderId);
    }

    private ClinicalReminderConversionWire convert(Context context) {
        return conversions.convert(identity(), "conv-" + UUID.randomUUID(),
                new ClinicalReminderConversionCreateRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), context.reminderId(), Instant.now()));
    }

    @Test
    void givenPendingReminder_whenConverting_thenTaskCreated() {
        Context context = seedContext("PENDING");
        ClinicalReminderConversionWire converted = convert(context);
        assertThat(converted.reminderId()).isEqualTo(context.reminderId());
        assertThat(converted.convertedBy()).isEqualTo(UUID.fromString(USER));

        String taskSourceType = jdbc.sql("""
                select source_type from clinical_task where tenant_id = cast(:tenant as uuid)
                  and task_id = :task
                """).param("tenant", TENANT).param("task", converted.clinicalTaskId())
                .query(String.class).single();
        assertThat(taskSourceType).isEqualTo("REMINDER");

        List<ClinicalReminderConversionWire> listed = conversions.list(identity(), context.reminderId());
        assertThat(listed).extracting(ClinicalReminderConversionWire::conversionId)
                .contains(converted.conversionId());
    }

    @Test
    void givenDuplicateConversion_whenConverting_thenRejected() {
        Context context = seedContext("PENDING");
        convert(context);
        assertThatThrownBy(() -> convert(context))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void givenAcknowledgedReminder_whenConverting_thenRejected() {
        Context context = seedContext("ACKNOWLEDGED");
        assertThatThrownBy(() -> convert(context))
                .isInstanceOf(ClinicalReminderConversionException.class)
                .satisfies(e -> assertThat(((ClinicalReminderConversionException) e).code())
                        .isEqualTo("REMINDER_NOT_PENDING"));
    }

    @Test
    void givenConversion_whenTampered_thenDatabaseRejectsMutation() {
        Context context = seedContext("PENDING");
        ClinicalReminderConversionWire converted = convert(context);
        assertThatThrownBy(() -> jdbc.sql("""
                update clinical_reminder_conversion set clinical_task_id = cast(:other as uuid)
                where tenant_id = cast(:tenant as uuid) and conversion_id = :conversion
                """).param("tenant", TENANT).param("conversion", converted.conversionId())
                .param("other", UUID.randomUUID()).update())
                .isInstanceOf(DataAccessException.class);
    }

    private record Context(UUID patientId, UUID encounterId, UUID reminderId) {}
}
