package org.openemr2026.reminder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ClinicalReminderAcknowledgeRequestWire;
import org.openemr2026.contracts.ClinicalReminderCreateRequestWire;
import org.openemr2026.contracts.ClinicalReminderSilenceRequestWire;
import org.openemr2026.contracts.ClinicalReminderWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class ClinicalReminderApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private ClinicalReminderService reminders;

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
                values (cast(:tenant as uuid), :patient, '合成提醒患者', 'U', :birth, 'ACTIVE')
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1978, 9, 9)).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (cast(:tenant as uuid), :encounter, :patient, cast(:organization as uuid),
                  cast(:facility as uuid), 'OUTPATIENT', 'IN_PROGRESS', now(), 'SYNTHETIC-REM', :source_key)
                """).param("tenant", TENANT).param("encounter", encounterId).param("patient", patientId)
                .param("organization", ORGANIZATION).param("facility", FACILITY)
                .param("source_key", UUID.randomUUID().toString()).update();
        return new Context(patientId, encounterId);
    }

    @Test
    void givenActiveEncounter_whenCreatingAndAcknowledgingReminder_thenLifecycleRecorded() {
        Context context = seedContext();
        ClinicalReminderWire created = reminders.create(identity(), "rem-" + UUID.randomUUID(),
                new ClinicalReminderCreateRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), ClinicalReminderCreateRequestWire.ReminderTypeValue.CRITICAL_VALUE,
                        "危急值未处置，请尽快查看", ClinicalReminderCreateRequestWire.SeverityValue.CRITICAL, null));
        assertThat(created.status()).isEqualTo(ClinicalReminderWire.StatusValue.PENDING);
        assertThat(created.severity()).isEqualTo(ClinicalReminderWire.SeverityValue.CRITICAL);

        ClinicalReminderWire acknowledged = reminders.acknowledge(identity(), "ack-" + UUID.randomUUID(),
                created.reminderId(), new ClinicalReminderAcknowledgeRequestWire(
                        organization, facility, context.patientId(), context.encounterId(), created.rowVersion()));
        assertThat(acknowledged.status()).isEqualTo(ClinicalReminderWire.StatusValue.ACKNOWLEDGED);
        assertThat(acknowledged.acknowledgedAt()).isNotNull();

        List<ClinicalReminderWire> listed = reminders.list(
                identity(), organization, facility, context.patientId(), context.encounterId());
        assertThat(listed).extracting(ClinicalReminderWire::reminderId).contains(created.reminderId());
    }

    @Test
    void givenPendingReminder_whenSilenced_thenStatusSilenced() {
        Context context = seedContext();
        ClinicalReminderWire created = reminders.create(identity(), "rem-" + UUID.randomUUID(),
                new ClinicalReminderCreateRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), ClinicalReminderCreateRequestWire.ReminderTypeValue.OVERDUE_TASK,
                        "有任务已超时", ClinicalReminderCreateRequestWire.SeverityValue.WARNING, null));
        ClinicalReminderWire silenced = reminders.silence(identity(), "sil-" + UUID.randomUUID(),
                created.reminderId(), new ClinicalReminderSilenceRequestWire(
                        organization, facility, context.patientId(), context.encounterId(), created.rowVersion()));
        assertThat(silenced.status()).isEqualTo(ClinicalReminderWire.StatusValue.SILENCED);
        assertThat(silenced.silencedAt()).isNotNull();
    }

    @Test
    void givenReminderContent_whenTampered_thenDatabaseRejectsMutation() {
        Context context = seedContext();
        ClinicalReminderWire created = reminders.create(identity(), "rem-" + UUID.randomUUID(),
                new ClinicalReminderCreateRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), ClinicalReminderCreateRequestWire.ReminderTypeValue.OTHER,
                        "随访提醒", ClinicalReminderCreateRequestWire.SeverityValue.INFO, null));
        assertThatThrownBy(() -> jdbc.sql("""
                update clinical_reminder set message = 'TAMPERED'
                where tenant_id = cast(:tenant as uuid) and reminder_id = :reminder
                """).param("tenant", TENANT).param("reminder", created.reminderId()).update())
                .isInstanceOf(DataAccessException.class);
    }

    private record Context(UUID patientId, UUID encounterId) {}
}
