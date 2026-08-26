package org.openemr2026.model;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.UUID;
import org.openemr2026.contracts.ModelDeploymentDeactivateRequestWire;
import org.openemr2026.contracts.ModelDeploymentRegisterRequestWire;
import org.openemr2026.contracts.ModelDeploymentUpdateRequestWire;
import org.openemr2026.contracts.ModelDeploymentWire;
import org.openemr2026.security.ClinicalIdentity;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.simple.JdbcClient;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
@Transactional
final class ModelDeploymentApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String ORGANIZATION = "018f0000-0000-7000-8000-00000000aa02";
    private static final String FACILITY = "018f0000-0000-7000-8000-00000000aa03";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";

    @Autowired
    private ModelDeploymentService models;

    @Autowired
    private JdbcClient jdbc;

    private final UUID tenant = UUID.fromString(TENANT);
    private final UUID organization = UUID.fromString(ORGANIZATION);
    private final UUID facility = UUID.fromString(FACILITY);

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(tenant, UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    @Test
    void givenModel_whenRegisteringListingAndDeactivating_thenLifecycleRecorded() {
        String modelCode = "MODEL-" + UUID.randomUUID();
        ModelDeploymentWire registered = models.register(identity(), "model-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, modelCode,
                        "LOCAL-INFER", "本地推理模型", ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.ON_PREM_ONLY,
                        null, null));
        assertThat(registered.status()).isEqualTo(ModelDeploymentWire.StatusValue.ACTIVE);
        assertThat(registered.residencyPolicy()).isEqualTo(ModelDeploymentWire.ResidencyPolicyValue.ON_PREM_ONLY);

        List<ModelDeploymentWire> listed = models.list(identity());
        assertThat(listed).extracting(ModelDeploymentWire::modelCode).contains(modelCode);

        ModelDeploymentWire deactivated = models.deactivate(identity(), "deact-" + UUID.randomUUID(),
                registered.modelDeploymentId(), new ModelDeploymentDeactivateRequestWire(
                        organization, facility, registered.rowVersion()));
        assertThat(deactivated.status()).isEqualTo(ModelDeploymentWire.StatusValue.INACTIVE);
    }

    @Test
    void givenDuplicateModelCode_whenRegistering_thenConstraintConflict() {
        String modelCode = "MODEL-" + UUID.randomUUID();
        models.register(identity(), "model-" + UUID.randomUUID(), new ModelDeploymentRegisterRequestWire(
                organization, facility, modelCode, "PROV-A", "模型A",
                ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.ON_PREM_ONLY, null, null));
        assertThatThrownBy(() -> models.register(identity(), "model-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, modelCode, "PROV-B", "模型B",
                        ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.ON_PREM_ONLY, null, null)))
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void givenModelCode_whenTampered_thenDatabaseRejectsMutation() {
        String modelCode = "MODEL-" + UUID.randomUUID();
        ModelDeploymentWire registered = models.register(identity(), "model-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, modelCode, "PROV-A", "模型A",
                        ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.ON_PREM_ONLY, null, null));
        assertThatThrownBy(() -> jdbc.sql("""
                update model_deployment set model_code = 'TAMPERED'
                where tenant_id = cast(:tenant as uuid) and model_deployment_id = :deployment
                """).param("tenant", TENANT).param("deployment", registered.modelDeploymentId()).update())
                .isInstanceOf(DataAccessException.class);
    }

    @Test
    void givenApiConfiguration_whenRegistering_thenOnlyAMaskedCredentialHintIsReturned() {
        ModelDeploymentWire registered = models.register(identity(), "model-api-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, "deepseek-chat", "DEEPSEEK",
                        "DeepSeek 医疗模型", ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.LOCAL_PREFERRED,
                        "https://api.deepseek.com/v1", "env://TEST_DEEPSEEK_API_KEY"));

        assertThat(registered.connectionStatus()).isEqualTo(ModelDeploymentWire.ConnectionStatusValue.READY);
        assertThat(registered.credentialConfigured()).isTrue();
        assertThat(registered.credentialHint()).isEqualTo("环境变量 · TEST_DEEPSEEK_API_KEY");
        assertThat(registered.toString()).doesNotContain("sk-");
    }

    @Test
    void givenActiveModel_whenUpdating_thenConfigurationChangesWithoutExposingCredential() {
        ModelDeploymentWire registered = models.register(identity(), "model-api-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, "MODEL-" + UUID.randomUUID(),
                        "DEEPSEEK", "DeepSeek 医疗模型",
                        ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.LOCAL_PREFERRED,
                        "https://api.deepseek.com/v1", "env://TEST_DEEPSEEK_API_KEY"));
        ModelDeploymentWire updated = models.update(identity(), "model-update-" + UUID.randomUUID(),
                registered.modelDeploymentId(), new ModelDeploymentUpdateRequestWire(
                        organization, facility, "DeepSeek 临床模型",
                        ModelDeploymentUpdateRequestWire.ResidencyPolicyValue.CLOUD_ALLOWED,
                        "https://api.deepseek.com/v1", null,
                        ModelDeploymentUpdateRequestWire.CredentialActionValue.KEEP, registered.rowVersion()));
        assertThat(updated.displayName()).isEqualTo("DeepSeek 临床模型");
        assertThat(updated.credentialConfigured()).isTrue();
        assertThat(updated.rowVersion()).isEqualTo(registered.rowVersion() + 1);
    }

    @Test
    void givenPlaintextCredentialOrHttpEndpoint_whenRegistering_thenConfigurationIsRejected() {
        assertThatThrownBy(() -> models.register(identity(), "model-secret-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, "deepseek-chat", "DEEPSEEK",
                        "不安全模型", ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.LOCAL_PREFERRED,
                        "https://api.deepseek.com/v1", "sk-plaintext")))
                .isInstanceOf(ModelDeploymentException.class);
        assertThatThrownBy(() -> models.register(identity(), "model-http-" + UUID.randomUUID(),
                new ModelDeploymentRegisterRequestWire(organization, facility, "deepseek-chat", "DEEPSEEK",
                        "不安全地址", ModelDeploymentRegisterRequestWire.ResidencyPolicyValue.LOCAL_PREFERRED,
                        "http://api.example.test/v1", "env://TEST_DEEPSEEK_API_KEY")))
                .isInstanceOf(ModelDeploymentException.class);
    }
}
