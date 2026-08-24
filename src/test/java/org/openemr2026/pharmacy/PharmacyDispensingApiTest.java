package org.openemr2026.pharmacy;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.PharmacyDispensingPrepareRequestWire;
import org.openemr2026.contracts.PharmacyDispensingTransitionRequestWire;
import org.openemr2026.contracts.PharmacyDispensingWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class PharmacyDispensingApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";
    private static final String COLLABORATOR = "018f0000-0000-7000-8000-00000000aa06";
    private static final String COLLABORATOR_ROLE = "018f0000-0000-7000-8000-00000000aa07";

    @Autowired
    private PharmacyDispensingService dispensings;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity dispenser() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private ClinicalIdentity verifier() {
        return new ClinicalIdentity(tenant, UUID.fromString(COLLABORATOR), List.of(UUID.fromString(COLLABORATOR_ROLE)));
    }

    private Context seedContext() {
        UUID patientId = UUID.randomUUID();
        UUID encounterId = UUID.randomUUID();
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (cast(:tenant as uuid), :patient, '合成药房患者', 'F', :birth, 'ACTIVE')
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1988, 12, 12)).update();
        jdbc.sql("""
                insert into encounter(tenant_id, encounter_id, patient_id, organization_id, facility_id,
                  encounter_type, status, started_at, source_system, source_key)
                values (cast(:tenant as uuid), :encounter, :patient, cast(:organization as uuid),
                  cast(:facility as uuid), 'OUTPATIENT', 'IN_PROGRESS', now(), 'SYNTHETIC-PHARMACY', :source_key)
                """).param("tenant", TENANT).param("encounter", encounterId).param("patient", patientId)
                .param("organization", ORGANIZATION).param("facility", FACILITY)
                .param("source_key", UUID.randomUUID().toString()).update();
        return new Context(patientId, encounterId);
    }

    private PharmacyDispensingWire prepare(Context context) {
        return dispensings.prepare(dispenser(), "pharm-" + UUID.randomUUID(),
                new PharmacyDispensingPrepareRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), "DRUG-SYN-1", "BATCH-" + UUID.randomUUID().toString().substring(0, 8),
                        10.0, "片", Instant.now()));
    }

    private PharmacyDispensingWire transition(
            ClinicalIdentity actor, Context context, PharmacyDispensingWire dispensing, String transition) {
        return dispensings.transition(actor, "pharm-t-" + UUID.randomUUID(), dispensing.dispensingId(),
                new PharmacyDispensingTransitionRequestWire(organization, facility, context.patientId(),
                        context.encounterId(), dispensing.rowVersion(),
                        PharmacyDispensingTransitionRequestWire.TransitionValue.valueOf(transition)));
    }

    @Test
    void givenDispensing_whenPreparingVerifyingAndDispensing_thenLifecycleRecorded() {
        Context context = seedContext();
        PharmacyDispensingWire prepared = prepare(context);
        assertThat(prepared.status()).isEqualTo(PharmacyDispensingWire.StatusValue.PREPARED);
        assertThat(prepared.dispensedBy()).isEqualTo(UUID.fromString(USER));
        assertThat(prepared.verifiedBy()).isNull();

        PharmacyDispensingWire verified = transition(verifier(), context, prepared, "VERIFY");
        assertThat(verified.status()).isEqualTo(PharmacyDispensingWire.StatusValue.VERIFIED);
        assertThat(verified.verifiedBy()).isEqualTo(UUID.fromString(COLLABORATOR));
        assertThat(verified.verifiedAt()).isNotNull();

        PharmacyDispensingWire dispensed = transition(verifier(), context, verified, "DISPENSE");
        assertThat(dispensed.status()).isEqualTo(PharmacyDispensingWire.StatusValue.DISPENSED);
        assertThat(dispensed.dispensedAt()).isNotNull();

        List<PharmacyDispensingWire> listed = dispensings.listDispensings(dispenser(), context.patientId());
        assertThat(listed).extracting(PharmacyDispensingWire::dispensingId).contains(prepared.dispensingId());
    }

    @Test
    void givenSameUser_whenVerifying_thenRejected() {
        Context context = seedContext();
        PharmacyDispensingWire prepared = prepare(context);
        assertThatThrownBy(() -> transition(dispenser(), context, prepared, "VERIFY"))
                .isInstanceOf(PharmacyDispensingException.class)
                .satisfies(e -> assertThat(((PharmacyDispensingException) e).code())
                        .isEqualTo("PHARMACY_SELF_VERIFICATION_FORBIDDEN"));
    }

    @Test
    void givenInvalidTransition_whenDispensingBeforeVerify_thenRejected() {
        Context context = seedContext();
        PharmacyDispensingWire prepared = prepare(context);
        assertThatThrownBy(() -> transition(verifier(), context, prepared, "DISPENSE"))
                .isInstanceOf(PharmacyDispensingException.class)
                .satisfies(e -> assertThat(((PharmacyDispensingException) e).code())
                        .isEqualTo("PHARMACY_DISPENSING_STATE_INVALID"));
    }

    @Test
    void givenDispensingIdentity_whenTampered_thenDatabaseRejectsMutation() {
        Context context = seedContext();
        PharmacyDispensingWire prepared = prepare(context);
        assertThatThrownBy(() -> jdbc.sql("""
                update pharmacy_dispensing set batch_number = '篡改'
                where tenant_id = cast(:tenant as uuid) and dispensing_id = :dispensing
                """).param("tenant", TENANT).param("dispensing", prepared.dispensingId()).update())
                .isInstanceOf(DataAccessException.class);
    }

    private record Context(UUID patientId, UUID encounterId) {}
}
