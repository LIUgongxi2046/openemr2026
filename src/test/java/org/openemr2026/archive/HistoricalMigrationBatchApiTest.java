package org.openemr2026.archive;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.time.Instant;
import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.HistoricalMigrationBatchReconcileRequestWire;
import org.openemr2026.contracts.HistoricalMigrationBatchRollbackRequestWire;
import org.openemr2026.contracts.HistoricalMigrationBatchStartRequestWire;
import org.openemr2026.contracts.HistoricalMigrationBatchSwitchRequestWire;
import org.openemr2026.contracts.HistoricalMigrationBatchWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class HistoricalMigrationBatchApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private HistoricalMigrationBatchService batches;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private HistoricalMigrationBatchWire start(String source) {
        return batches.start(identity(), "start-" + UUID.randomUUID(),
                new HistoricalMigrationBatchStartRequestWire(organization, facility, source, 100, Instant.now()));
    }

    private HistoricalMigrationBatchWire reconcile(UUID batchId, int mismatchCount, long expectedRowVersion) {
        return batches.reconcile(identity(), "reconcile-" + UUID.randomUUID(), batchId,
                new HistoricalMigrationBatchReconcileRequestWire(organization, facility, mismatchCount, expectedRowVersion));
    }

    private HistoricalMigrationBatchWire switchBatch(UUID batchId, long expectedRowVersion) {
        return batches.switchBatch(identity(), "switch-" + UUID.randomUUID(), batchId,
                new HistoricalMigrationBatchSwitchRequestWire(organization, facility, expectedRowVersion));
    }

    private HistoricalMigrationBatchWire rollback(UUID batchId, long expectedRowVersion) {
        return batches.rollback(identity(), "rollback-" + UUID.randomUUID(), batchId,
                new HistoricalMigrationBatchRollbackRequestWire(organization, facility, expectedRowVersion));
    }

    @Test
    void givenBatch_whenStarting_thenTrial() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        assertThat(batch.batchStatus()).isEqualTo(HistoricalMigrationBatchWire.BatchStatusValue.TRIAL);
        assertThat(batch.mismatchCount()).isZero();
    }

    @Test
    void givenTrialBatch_whenReconciling_thenReconciled() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        HistoricalMigrationBatchWire reconciled = reconcile(batch.batchId(), 0, 1L);
        assertThat(reconciled.batchStatus()).isEqualTo(HistoricalMigrationBatchWire.BatchStatusValue.RECONCILED);
        assertThat(reconciled.completedAt()).isNotNull();
    }

    @Test
    void givenReconciledBatch_whenSwitching_thenSwitched() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        HistoricalMigrationBatchWire reconciled = reconcile(batch.batchId(), 0, 1L);
        HistoricalMigrationBatchWire switched = switchBatch(batch.batchId(), reconciled.rowVersion());
        assertThat(switched.batchStatus()).isEqualTo(HistoricalMigrationBatchWire.BatchStatusValue.SWITCHED);
    }

    @Test
    void givenReconciledWithMismatch_whenSwitching_thenRejected() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        HistoricalMigrationBatchWire reconciled = reconcile(batch.batchId(), 1, 1L);
        assertThatThrownBy(() -> switchBatch(batch.batchId(), reconciled.rowVersion()))
                .isInstanceOf(HistoricalMigrationBatchException.class)
                .satisfies(e -> assertThat(((HistoricalMigrationBatchException) e).code())
                        .isEqualTo("HISTORICAL_MIGRATION_MISMATCH"));
    }

    @Test
    void givenReconciledBatch_whenRollingBack_thenRolledBack() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        HistoricalMigrationBatchWire reconciled = reconcile(batch.batchId(), 1, 1L);
        HistoricalMigrationBatchWire rolledBack = rollback(batch.batchId(), reconciled.rowVersion());
        assertThat(rolledBack.batchStatus()).isEqualTo(HistoricalMigrationBatchWire.BatchStatusValue.ROLLED_BACK);
    }

    @Test
    void givenStaleVersion_whenReconciling_thenRejected() {
        HistoricalMigrationBatchWire batch = start("HIS-" + UUID.randomUUID().toString().substring(0, 8));
        assertThatThrownBy(() -> reconcile(batch.batchId(), 0, 99L))
                .isInstanceOf(HistoricalMigrationBatchException.class)
                .satisfies(e -> assertThat(((HistoricalMigrationBatchException) e).code())
                        .isEqualTo("HISTORICAL_MIGRATION_VERSION_CONFLICT"));
    }
}
