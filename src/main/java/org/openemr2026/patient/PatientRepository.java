package org.openemr2026.patient;

import java.util.Optional;
import java.util.UUID;

public interface PatientRepository {

    Optional<PatientRecord> findById(UUID tenantId, UUID patientId);
}

