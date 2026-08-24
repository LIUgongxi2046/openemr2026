package org.openemr2026.patient;

import static org.assertj.core.api.Assertions.assertThatIllegalArgumentException;

import java.time.LocalDate;
import java.util.UUID;
import org.junit.jupiter.api.Test;

final class PatientRecordTest {

    @Test
    void givenABlankDisplayName_whenCreatingAPatientRecord_thenItIsRejected() {
        assertThatIllegalArgumentException().isThrownBy(() -> new PatientRecord(
                UUID.randomUUID(), UUID.randomUUID(), " ", "F", LocalDate.of(1990, 1, 1), 1));
    }
}

