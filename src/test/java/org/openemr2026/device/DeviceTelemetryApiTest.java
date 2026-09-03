package org.openemr2026.device;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openemr2026.contracts.DeviceObservationWire;
import org.openemr2026.contracts.DeviceStatusWire;
import org.openemr2026.contracts.DeviceTelemetryCollectRequestWire;
import org.openemr2026.contracts.DeviceTelemetryCollectResultWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
@Transactional
final class DeviceTelemetryApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private DeviceTelemetryService telemetry;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenActiveDevice_whenCollecting_thenObservationsAndStatusPersisted() {
        DeviceTelemetryCollectResultWire result = telemetry.collect(identity(), "collect-" + UUID.randomUUID(),
                new DeviceTelemetryCollectRequestWire(organization, facility, "card-monitor-01",
                        DeviceTelemetryCollectRequestWire.SimulationScenarioValue.SUCCESS, 24));

        assertThat(result.observations()).hasSize(24);
        assertThat(result.observations()).allMatch(observation ->
                observation.deviceCode().equals("card-monitor-01"));
        assertThat(result.status().deviceCode()).isEqualTo("card-monitor-01");
        assertThat(result.status().onlineStatus()).isEqualTo(DeviceStatusWire.OnlineStatusValue.ONLINE);
    }

    @Test
    void givenCollectedTelemetry_whenListingObservations_thenFilteredByDevice() {
        telemetry.collect(identity(), "collect-" + UUID.randomUUID(),
                new DeviceTelemetryCollectRequestWire(organization, facility, "icu-vent-07",
                        DeviceTelemetryCollectRequestWire.SimulationScenarioValue.DEGRADED, 12));

        List<DeviceObservationWire> observations = telemetry.listObservations(identity(), "icu-vent-07");
        assertThat(observations).isNotEmpty();
        assertThat(observations).allMatch(observation -> observation.deviceCode().equals("icu-vent-07"));

        List<DeviceStatusWire> statuses = telemetry.listStatuses(identity(), "icu-vent-07");
        assertThat(statuses).hasSize(1);
        assertThat(statuses.get(0).onlineStatus()).isEqualTo(DeviceStatusWire.OnlineStatusValue.DEGRADED);
    }

    @Test
    void givenUnknownDevice_whenCollecting_thenRejected() {
        assertThatThrownBy(() -> telemetry.collect(identity(), "collect-" + UUID.randomUUID(),
                new DeviceTelemetryCollectRequestWire(organization, facility, "not-a-device", null, null)))
                .isInstanceOf(DeviceException.class)
                .hasMessageContaining("设备不存在");
    }
}
