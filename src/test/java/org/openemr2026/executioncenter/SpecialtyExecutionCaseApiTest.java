package org.openemr2026.executioncenter;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.openemr2026.contracts.SpecialtyExecutionCaseCreateRequestWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseTransitionRequestWire;
import org.openemr2026.contracts.SpecialtyExecutionCaseWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class SpecialtyExecutionCaseApiTest {
    private static final UUID TENANT = UUID.fromString("018f0000-0000-7000-8000-00000000aa01");
    private static final UUID ORGANIZATION = UUID.fromString("018f0000-0000-7000-8000-00000000aa02");
    private static final UUID FACILITY = UUID.fromString("018f0000-0000-7000-8000-00000000aa03");
    private static final UUID USER = UUID.fromString("018f0000-0000-7000-8000-00000000aa04");
    private static final UUID ROLE = UUID.fromString("018f0000-0000-7000-8000-00000000aa05");
    private static final UUID REVIEWER = UUID.fromString("018f0000-0000-7000-8000-00000000aa06");
    private static final UUID REVIEWER_ROLE = UUID.fromString("018f0000-0000-7000-8000-00000000aa07");
    private static final UUID PATIENT = UUID.fromString("018f0000-0000-7000-8000-000000000001");
    private static final UUID ENCOUNTER = UUID.fromString("018f0000-0000-7000-8000-000000000101");

    @Autowired SpecialtyExecutionCaseService cases;
    @Autowired ExecutionWorklistService worklists;
    @Autowired JdbcClient jdbc;

    private ClinicalIdentity author() { return new ClinicalIdentity(TENANT, USER, List.of(ROLE)); }
    private ClinicalIdentity reviewer() { return new ClinicalIdentity(TENANT, REVIEWER, List.of(REVIEWER_ROLE)); }

    @Test
    void pathologyLifecycleRequiresTwoIdentifiersAndIndependentCompletionAndKeepsImmutableEvents() {
        SpecialtyExecutionCaseWire draft = cases.create(author(), "path-create-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseCreateRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseCreateRequestWire.DomainValue.PATHOLOGY,
                        "左肺上叶切除标本病理", SpecialtyExecutionCaseCreateRequestWire.PriorityValue.URGENT,
                        null, readyPathologyPayload()));
        assertThat(draft.status()).isEqualTo(SpecialtyExecutionCaseWire.StatusValue.DRAFT);
        assertThat(draft.businessNumber()).startsWith("BL");

        SpecialtyExecutionCaseWire ready = transition(author(), draft, "MARK_READY");
        SpecialtyExecutionCaseWire started = transition(author(), ready, "START");
        SpecialtyExecutionCaseWire review = transition(author(), started, "REQUEST_REVIEW");

        assertThatThrownBy(() -> transition(author(), review, "COMPLETE"))
                .isInstanceOf(ExecutionWorklistException.class)
                .satisfies(error -> assertThat(((ExecutionWorklistException) error).code())
                        .isEqualTo("INDEPENDENT_REVIEW_REQUIRED"));

        SpecialtyExecutionCaseWire completed = transition(reviewer(), review, "COMPLETE");
        assertThat(completed.status()).isEqualTo(SpecialtyExecutionCaseWire.StatusValue.COMPLETED);
        assertThat(completed.events()).extracting(event -> event.eventType().name())
                .containsExactly("CREATED", "READY", "STARTED", "REVIEW_REQUESTED", "COMPLETED");
        assertThat(worklists.list(author(), ORGANIZATION, FACILITY, "PATHOLOGY"))
                .extracting(ExecutionWorklistItem::patientId).contains(PATIENT);

        UUID eventId = completed.events().getFirst().specialtyExecutionEventId();
        assertThatThrownBy(() -> jdbc.sql("""
                update specialty_execution_case_event set note = '篡改'
                where tenant_id = :tenant and specialty_execution_event_id = :event
                """).param("tenant", TENANT).param("event", eventId).update())
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void markReadyRejectsMissingOrDuplicatedPatientIdentifiers() {
        Map<String, Object> invalid = readyPathologyPayload();
        invalid.put("patient_identifier_two", invalid.get("patient_identifier_one"));
        SpecialtyExecutionCaseWire draft = cases.create(author(), "path-invalid-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseCreateRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseCreateRequestWire.DomainValue.PATHOLOGY,
                        "双标识失败病例", SpecialtyExecutionCaseCreateRequestWire.PriorityValue.ROUTINE,
                        null, invalid));
        assertThatThrownBy(() -> transition(author(), draft, "MARK_READY"))
                .isInstanceOf(ExecutionWorklistException.class)
                .satisfies(error -> assertThat(((ExecutionWorklistException) error).code())
                        .isEqualTo("PATIENT_TWO_IDENTIFIER_CHECK_FAILED"));
    }

    @Test
    void deviceMonitoringFailsClosedForUnverifiedBindingAndClockDrift() {
        Map<String, Object> payload = new java.util.LinkedHashMap<>(Map.of(
                "patient_identifier_one", "ZY202608310001",
                "patient_identifier_two", "WB-ICU-0001",
                "patient_verification_method", "住院号+腕带扫码",
                "device_id", "ICU-MON-01",
                "device_type", "床旁监护仪",
                "binding_verified", false,
                "clock_offset_seconds", 2,
                "alarm_policy", "ICU-ADULT-v3",
                "monitoring_parameters", "HR/SpO2/NIBP，1秒采样"));
        SpecialtyExecutionCaseWire draft = cases.create(author(), "device-create-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseCreateRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseCreateRequestWire.DomainValue.DEVICE_MONITORING,
                        "ICU床旁监护绑定", SpecialtyExecutionCaseCreateRequestWire.PriorityValue.URGENT,
                        null, payload));
        assertThatThrownBy(() -> transition(author(), draft, "MARK_READY"))
                .isInstanceOf(ExecutionWorklistException.class)
                .satisfies(error -> assertThat(((ExecutionWorklistException) error).code())
                        .isEqualTo("DEVICE_PATIENT_BINDING_NOT_VERIFIED"));

        payload.put("binding_verified", true);
        payload.put("clock_offset_seconds", 45);
        SpecialtyExecutionCaseWire drifted = cases.create(author(), "device-create-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseCreateRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseCreateRequestWire.DomainValue.DEVICE_MONITORING,
                        "ICU监护时钟偏移", SpecialtyExecutionCaseCreateRequestWire.PriorityValue.URGENT,
                        null, payload));
        assertThatThrownBy(() -> transition(author(), drifted, "MARK_READY"))
                .isInstanceOf(ExecutionWorklistException.class)
                .satisfies(error -> assertThat(((ExecutionWorklistException) error).code())
                        .isEqualTo("DEVICE_CLOCK_NOT_SYNCHRONIZED"));
    }

    @Test
    void anesthesiaFailsClosedWhenFastingOrConsentIsNotConfirmed() {
        Map<String, Object> payload = new java.util.LinkedHashMap<>(Map.of(
                "patient_identifier_one", "ZY202608310002",
                "patient_identifier_two", "WB-OR-0002",
                "patient_verification_method", "住院号+腕带扫码",
                "surgical_procedure_id", "SS202608310002",
                "asa_class", "ASA II",
                "anesthesia_method", "全身麻醉",
                "fasting_confirmed", false,
                "consent_confirmed", true));
        SpecialtyExecutionCaseWire draft = cases.create(author(), "anesthesia-create-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseCreateRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseCreateRequestWire.DomainValue.ANESTHESIA,
                        "术前麻醉核查", SpecialtyExecutionCaseCreateRequestWire.PriorityValue.ROUTINE,
                        null, payload));

        assertThatThrownBy(() -> transition(author(), draft, "MARK_READY"))
                .isInstanceOf(ExecutionWorklistException.class)
                .satisfies(error -> assertThat(((ExecutionWorklistException) error).code())
                        .isEqualTo("ANESTHESIA_PREOPERATIVE_VERIFICATION_FAILED"));
    }

    private SpecialtyExecutionCaseWire transition(ClinicalIdentity identity, SpecialtyExecutionCaseWire item, String action) {
        return cases.transition(identity, item.specialtyExecutionCaseId(), "path-transition-" + UUID.randomUUID(),
                new SpecialtyExecutionCaseTransitionRequestWire(
                        ORGANIZATION, FACILITY, PATIENT, ENCOUNTER,
                        SpecialtyExecutionCaseTransitionRequestWire.ActionValue.valueOf(action),
                        item.rowVersion(), "测试状态迁移并保留业务证据"));
    }

    private Map<String, Object> readyPathologyPayload() {
        return new java.util.LinkedHashMap<>(Map.of(
                "patient_identifier_one", "MZ202608310001",
                "patient_identifier_two", "1978-04-16",
                "patient_verification_method", "门诊号加出生日期",
                "accession_number", "BL202608310001",
                "specimen_type", "手术切除标本",
                "specimen_site", "左肺上叶",
                "fixative", "10%中性福尔马林固定12小时"));
    }
}
