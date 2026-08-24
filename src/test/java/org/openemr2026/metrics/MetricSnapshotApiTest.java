package org.openemr2026.metrics;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openemr2026.contracts.MetricSnapshotRecordRequestWire;
import org.openemr2026.contracts.MetricSnapshotWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class MetricSnapshotApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private MetricSnapshotService metrics;

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(UUID.fromString(TENANT), UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenMetric_whenRecordingAndListing_thenSnapshotRecorded() {
        String type = "DATA_CENTER";
        MetricSnapshotWire recorded = metrics.record(identity(), new MetricSnapshotRecordRequestWire(
                type, "在院患者数", 1234.0, "人", null, null));
        assertThat(recorded.metricType()).isEqualTo(type);
        assertThat(recorded.status()).isEqualTo(MetricSnapshotWire.StatusValue.DRAFT);

        List<MetricSnapshotWire> listed = metrics.list(identity(), type);
        assertThat(listed).extracting(MetricSnapshotWire::snapshotId).contains(recorded.snapshotId());
    }
}
