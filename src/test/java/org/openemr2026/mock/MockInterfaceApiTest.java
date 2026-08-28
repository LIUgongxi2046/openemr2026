package org.openemr2026.mock;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openemr2026.contracts.MockInterfaceWire;
import org.openemr2026.contracts.MockInvocationResultWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class MockInterfaceApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private MockInterfaceService mocks;

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(UUID.fromString(TENANT), UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenRegistry_whenListing_thenAllSyntheticInterfacesAvailable() {
        List<MockInterfaceWire> interfaces = mocks.list();
        assertThat(interfaces).extracting(MockInterfaceWire::code)
                .contains("LIS_RESULTS", "PACS_IMAGES", "HIS_INSURANCE", "CA_TIMESTAMP",
                        "HIE_DOCUMENT_EXCHANGE", "MODEL_PROVIDER", "DEVICE_GATEWAY", "DICTATION_ASR");
    }

    @Test
    void givenKnownInterface_whenInvoking_thenDeterministicSyntheticResponse() {
        Map<String, Object> input = Map.of("patient_id", "P1", "simulation_scenario", "SUCCESS");
        MockInvocationResultWire result = mocks.invoke("LIS_RESULTS", input);
        MockInvocationResultWire replay = mocks.invoke("LIS_RESULTS", input);
        assertThat(result.mockInterfaceCode()).isEqualTo("LIS_RESULTS");
        assertThat(result.payload()).containsKey("results");
        assertThat(result.payload()).containsKey("critical_values");
        assertThat(result.scenario()).isEqualTo(MockInvocationResultWire.ScenarioValue.SUCCESS);
        assertThat(result.requestId()).isEqualTo(replay.requestId());
        assertThat(result.producedAt()).isEqualTo(replay.producedAt());
        assertThat(result.payload()).isEqualTo(replay.payload());
        assertThat(result.notice()).contains("合成");
    }

    @Test
    void givenRegionalExchange_whenInvoking_thenPendingReceiptDoesNotFakeCompletion() {
        MockInvocationResultWire result = mocks.invoke("HIE_DOCUMENT_EXCHANGE", Map.of(
                "document_id", "CDA-21018", "content_hash", "sha256:test"));

        assertThat(result.payload())
                .containsEntry("receipt_status", "PENDING_ACK")
                .containsEntry("shared_at", null);
        assertThat(result.payload().get("clinical_impact")).asString().contains("不影响院内病历签署");
    }

    @Test
    void givenDegradedOrUnavailableScenario_whenInvoking_thenFailureStateIsExplicit() {
        MockInvocationResultWire degraded = mocks.invoke(
                "MODEL_PROVIDER", Map.of("simulation_scenario", "DEGRADED"));
        assertThat(degraded.scenario()).isEqualTo(MockInvocationResultWire.ScenarioValue.DEGRADED);
        assertThat(degraded.payload()).containsKey("_simulation");

        assertThatThrownBy(() -> mocks.invoke(
                "MODEL_PROVIDER", Map.of("simulation_scenario", "UNAVAILABLE")))
                .isInstanceOf(MockInterfaceException.class)
                .satisfies(e -> assertThat(((MockInterfaceException) e).code())
                        .isEqualTo("MOCK_DEPENDENCY_UNAVAILABLE"));
    }

    @Test
    void givenUnknownInterface_whenInvoking_thenRejected() {
        assertThatThrownBy(() -> mocks.invoke("NOT_EXIST", Map.of()))
                .isInstanceOf(MockInterfaceException.class)
                .satisfies(e -> assertThat(((MockInterfaceException) e).code()).isEqualTo("MOCK_INTERFACE_UNKNOWN"));
    }
}
