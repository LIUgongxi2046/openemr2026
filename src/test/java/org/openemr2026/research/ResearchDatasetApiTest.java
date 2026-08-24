package org.openemr2026.research;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ResearchDatasetRequestApproveRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestCreateRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestDestroyRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestExportRequestWire;
import org.openemr2026.contracts.ResearchDatasetRequestWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class ResearchDatasetApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private ResearchDatasetService research;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenRequest_whenApprovingExportingAndDestroying_thenFullLifecycleRecorded() {
        ResearchDatasetRequestWire created = research.create(identity(), "rd-" + UUID.randomUUID(),
                new ResearchDatasetRequestCreateRequestWire(organization, facility,
                        "高血压队列研究", "纳入近一年门诊高血压患者，导出脱敏诊疗指标"));
        assertThat(created.status()).isEqualTo(ResearchDatasetRequestWire.StatusValue.REQUESTED);

        ResearchDatasetRequestWire approved = research.approve(identity(), "appr-" + UUID.randomUUID(),
                created.requestId(), new ResearchDatasetRequestApproveRequestWire(
                        organization, facility, created.rowVersion()));
        assertThat(approved.status()).isEqualTo(ResearchDatasetRequestWire.StatusValue.APPROVED);
        assertThat(approved.approvedAt()).isNotNull();

        ResearchDatasetRequestWire exported = research.export(identity(), "exp-" + UUID.randomUUID(),
                created.requestId(), new ResearchDatasetRequestExportRequestWire(
                        organization, facility, approved.rowVersion(), "WATERMARK-研究用脱敏"));
        assertThat(exported.status()).isEqualTo(ResearchDatasetRequestWire.StatusValue.EXPORTED);
        assertThat(exported.exportWatermark()).contains("WATERMARK");

        ResearchDatasetRequestWire destroyed = research.destroy(identity(), "destroy-" + UUID.randomUUID(),
                created.requestId(), new ResearchDatasetRequestDestroyRequestWire(
                        organization, facility, exported.rowVersion()));
        assertThat(destroyed.status()).isEqualTo(ResearchDatasetRequestWire.StatusValue.DESTROYED);
        assertThat(destroyed.destroyedAt()).isNotNull();

        List<ResearchDatasetRequestWire> listed = research.list(identity());
        assertThat(listed).extracting(ResearchDatasetRequestWire::requestId).contains(created.requestId());
    }

    @Test
    void givenRequestedDataset_whenExportedWithoutApproval_thenStateInvalid() {
        ResearchDatasetRequestWire created = research.create(identity(), "rd-" + UUID.randomUUID(),
                new ResearchDatasetRequestCreateRequestWire(organization, facility,
                        "队列研究", "导出脱敏指标"));
        assertThatThrownBy(() -> research.export(identity(), "exp-" + UUID.randomUUID(),
                created.requestId(), new ResearchDatasetRequestExportRequestWire(
                        organization, facility, created.rowVersion(), "WM")))
                .isInstanceOf(ResearchDatasetException.class)
                .satisfies(e -> assertThat(((ResearchDatasetException) e).code())
                        .isEqualTo("RESEARCH_DATASET_STATE_INVALID"));
    }

    @Test
    void givenDatasetPurpose_whenTampered_thenDatabaseRejectsMutation() {
        ResearchDatasetRequestWire created = research.create(identity(), "rd-" + UUID.randomUUID(),
                new ResearchDatasetRequestCreateRequestWire(organization, facility, "研究目的", "研究范围描述"));
        assertThatThrownBy(() -> jdbc.sql("""
                update research_dataset_request set purpose = 'TAMPERED'
                where tenant_id = cast(:tenant as uuid) and request_id = :request
                """).param("tenant", TENANT).param("request", created.requestId()).update())
                .isInstanceOf(org.springframework.dao.DataAccessException.class);
    }
}
