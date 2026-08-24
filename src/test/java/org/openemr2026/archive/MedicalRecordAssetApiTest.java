package org.openemr2026.archive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.MedicalRecordAssetBorrowRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetRegisterRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetReturnRequestWire;
import org.openemr2026.contracts.MedicalRecordAssetWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class MedicalRecordAssetApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";
    private static final String CONTENT_HASH = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

    @Autowired
    private MedicalRecordAssetService assets;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private UUID seedPatient() {
        UUID patientId = UUID.randomUUID();
        jdbc.sql("""
                insert into patient(tenant_id, patient_id, display_name, sex_code, birth_date, status)
                values (cast(:tenant as uuid), :patient, '合成病案患者', 'F', :birth, 'ACTIVE')
                """).param("tenant", TENANT).param("patient", patientId)
                .param("birth", LocalDate.of(1960, 7, 7)).update();
        return patientId;
    }

    private MedicalRecordAssetWire register(UUID patientId) {
        return assets.register(identity(), "asset-" + UUID.randomUUID(),
                new MedicalRecordAssetRegisterRequestWire(organization, facility, patientId, null,
                        MedicalRecordAssetRegisterRequestWire.AssetTypeValue.PAPER, "档案库房-3-2", CONTENT_HASH));
    }

    private MedicalRecordAssetWire borrow(UUID patientId, UUID assetId, long expectedRowVersion, Instant dueAt) {
        return assets.borrow(identity(), "borrow-" + UUID.randomUUID(), assetId,
                new MedicalRecordAssetBorrowRequestWire(organization, facility, patientId, expectedRowVersion, dueAt));
    }

    private MedicalRecordAssetWire returnAsset(UUID patientId, UUID assetId, long expectedRowVersion) {
        return assets.returnAsset(identity(), "return-" + UUID.randomUUID(), assetId,
                new MedicalRecordAssetReturnRequestWire(organization, facility, patientId, expectedRowVersion));
    }

    @Test
    void givenAsset_whenRegisteringAndListing_thenArchived() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        assertThat(registered.status()).isEqualTo(MedicalRecordAssetWire.StatusValue.ARCHIVED);
        assertThat(registered.contentHash()).isEqualTo(CONTENT_HASH);

        List<MedicalRecordAssetWire> listed = assets.listAssets(identity(), patientId);
        assertThat(listed).extracting(MedicalRecordAssetWire::medicalRecordAssetId)
                .contains(registered.medicalRecordAssetId());
    }

    @Test
    void givenArchivedAsset_whenBorrowing_thenBorrowed() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        MedicalRecordAssetWire borrowed = borrow(patientId, registered.medicalRecordAssetId(), 1L,
                Instant.now().plus(7, ChronoUnit.DAYS));
        assertThat(borrowed.status()).isEqualTo(MedicalRecordAssetWire.StatusValue.BORROWED);
        assertThat(borrowed.borrowedBy()).isEqualTo(UUID.fromString(USER));
        assertThat(borrowed.dueAt()).isNotNull();
    }

    @Test
    void givenBorrowedAsset_whenReturning_thenArchived() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        MedicalRecordAssetWire borrowed = borrow(patientId, registered.medicalRecordAssetId(), 1L,
                Instant.now().plus(7, ChronoUnit.DAYS));
        MedicalRecordAssetWire returned = returnAsset(patientId, registered.medicalRecordAssetId(), borrowed.rowVersion());
        assertThat(returned.status()).isEqualTo(MedicalRecordAssetWire.StatusValue.ARCHIVED);
        assertThat(returned.borrowedBy()).isNull();
    }

    @Test
    void givenBorrowedAsset_whenBorrowingAgain_thenRejected() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        MedicalRecordAssetWire borrowed = borrow(patientId, registered.medicalRecordAssetId(), 1L,
                Instant.now().plus(7, ChronoUnit.DAYS));
        assertThatThrownBy(() -> borrow(patientId, registered.medicalRecordAssetId(), borrowed.rowVersion(),
                Instant.now().plus(8, ChronoUnit.DAYS)))
                .isInstanceOf(MedicalRecordAssetException.class)
                .satisfies(e -> assertThat(((MedicalRecordAssetException) e).code())
                        .isEqualTo("MEDICAL_RECORD_ASSET_STATE_INVALID"));
    }

    @Test
    void givenStaleVersion_whenBorrowing_thenRejected() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        assertThatThrownBy(() -> borrow(patientId, registered.medicalRecordAssetId(), 99L,
                Instant.now().plus(7, ChronoUnit.DAYS)))
                .isInstanceOf(MedicalRecordAssetException.class)
                .satisfies(e -> assertThat(((MedicalRecordAssetException) e).code())
                        .isEqualTo("MEDICAL_RECORD_ASSET_VERSION_CONFLICT"));
    }

    @Test
    void givenPastDueAt_whenBorrowing_thenRejected() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        assertThatThrownBy(() -> borrow(patientId, registered.medicalRecordAssetId(), 1L,
                Instant.now().minus(1, ChronoUnit.DAYS)))
                .isInstanceOf(MedicalRecordAssetException.class)
                .satisfies(e -> assertThat(((MedicalRecordAssetException) e).code())
                        .isEqualTo("MEDICAL_RECORD_ASSET_REQUEST_INVALID"));
    }

    @Test
    void givenAssetIdentity_whenTampered_thenDatabaseRejectsMutation() {
        UUID patientId = seedPatient();
        MedicalRecordAssetWire registered = register(patientId);
        assertThatThrownBy(() -> jdbc.sql("""
                update medical_record_asset set content_hash = 'ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
                where tenant_id = cast(:tenant as uuid) and medical_record_asset_id = :asset
                """).param("tenant", TENANT).param("asset", registered.medicalRecordAssetId()).update())
                .isInstanceOf(DataAccessException.class);
    }
}
