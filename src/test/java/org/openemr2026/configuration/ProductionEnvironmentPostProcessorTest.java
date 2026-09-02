package org.openemr2026.configuration;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.boot.bootstrap.DefaultBootstrapContext;
import org.springframework.boot.logging.DeferredLogs;
import org.springframework.boot.support.EnvironmentPostProcessorsFactory;
import org.springframework.boot.SpringApplication;
import org.springframework.context.ApplicationContextException;
import org.springframework.core.env.MapPropertySource;
import org.springframework.mock.env.MockEnvironment;

final class ProductionEnvironmentPostProcessorTest {

    private final ProductionEnvironmentPostProcessor processor = new ProductionEnvironmentPostProcessor();
    private final SpringApplication application = new SpringApplication(Object.class);

    @TempDir
    Path temporaryDirectory;

    @Test
    void givenANonProductionProfile_whenConfigurationIsAbsent_thenValidationIsNotApplied() {
        MockEnvironment environment = new MockEnvironment().withProperty("spring.profiles.active", "dev-synthetic");
        environment.setActiveProfiles("dev-synthetic");

        assertThatCode(() -> processor.postProcessEnvironment(environment, application)).doesNotThrowAnyException();
    }

    @Test
    void givenThePackagedApplication_whenLoadingBootFactories_thenTheProductionGateIsRegistered() {
        var processors = EnvironmentPostProcessorsFactory
                .fromSpringFactories(getClass().getClassLoader())
                .getEnvironmentPostProcessors(new DeferredLogs(), new DefaultBootstrapContext());

        assertThat(processors).anyMatch(ProductionEnvironmentPostProcessor.class::isInstance);
    }

    @Test
    void givenProductionWithMissingConfiguration_whenBootstrapping_thenAllCriticalDomainsFailClosed() {
        MockEnvironment environment = productionEnvironment(Map.of());

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("Production configuration rejected")
                .hasMessageContaining("identity.issuer-uri")
                .hasMessageContaining("signing.ca-base-uri")
                .hasMessageContaining("encryption.kms-key-uri")
                .hasMessageContaining("storage.endpoint")
                .hasMessageContaining("archive.ocr-endpoint")
                .hasMessageContaining("archive.cda-validation-endpoint")
                .hasMessageContaining("archive.malware-scanner.host")
                .hasMessageContaining("integration.truststore-ref")
                .hasMessageContaining("database.password-ref");
    }

    @Test
    void givenProductionCombinedWithSyntheticIdentity_whenBootstrapping_thenProfilesAreRejected() {
        MockEnvironment environment = productionEnvironment(completeProperties(false));
        environment.setActiveProfiles("prod", "dev-synthetic");

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("prod cannot be combined with dev-synthetic");
    }

    @Test
    void givenInlineSecretAndHttpEndpoint_whenBootstrapping_thenTheyAreRejectedWithoutLeakingTheSecret() {
        Map<String, Object> properties = completeProperties(false);
        properties.put("openemr2026.production.signing.private-key-ref", "never-log-this-secret");
        properties.put("openemr2026.production.identity.issuer-uri", "http://idp.hospital.example");
        MockEnvironment environment = productionEnvironment(properties);

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("must use env:// or file://")
                .hasMessageContaining("must be an absolute https URI")
                .hasMessageNotContaining("never-log-this-secret");
    }

    @Test
    void givenAnEnvironmentSecretReferenceWithoutAProvisionedTarget_whenBootstrapping_thenItFailsClosed() {
        Map<String, Object> properties = completeProperties(false);
        properties.remove("TEST_STORAGE_SECRET");
        MockEnvironment environment = productionEnvironment(properties);

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("storage.secret-key-ref: referenced environment secret is unavailable");
    }

    @Test
    void givenAReadableMountedSecretFile_whenBootstrapping_thenTheFileReferenceIsAccepted() throws Exception {
        Path mountedSecret = temporaryDirectory.resolve("ca-private-key");
        Files.writeString(mountedSecret, "synthetic-test-secret");
        Map<String, Object> properties = completeProperties(false);
        properties.put("openemr2026.production.signing.private-key-ref", mountedSecret.toUri().toString());
        MockEnvironment environment = productionEnvironment(properties);

        assertThatCode(() -> processor.postProcessEnvironment(environment, application)).doesNotThrowAnyException();
    }

    @Test
    void givenAiEnabledWithoutItsControlledConfiguration_whenBootstrapping_thenItFailsClosed() {
        Map<String, Object> properties = completeProperties(false);
        properties.put("openemr2026.production.ai.enabled", "true");
        MockEnvironment environment = productionEnvironment(properties);

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("ai.base-uri")
                .hasMessageContaining("ai.model-id")
                .hasMessageContaining("ai.api-key-ref");
    }

    @Test
    void givenCompleteOnPremProductionReferences_whenBootstrapping_thenConfigurationGatePasses() {
        MockEnvironment environment = productionEnvironment(completeProperties(false));

        assertThatCode(() -> processor.postProcessEnvironment(environment, application)).doesNotThrowAnyException();
    }

    @Test
    void givenCompleteAiConfiguration_whenBootstrapping_thenConfigurationGatePasses() {
        MockEnvironment environment = productionEnvironment(completeProperties(true));

        assertThatCode(() -> processor.postProcessEnvironment(environment, application)).doesNotThrowAnyException();
    }

    @Test
    void givenResourceServerIssuerOrAudienceDrift_whenBootstrapping_thenConfigurationIsRejected() {
        Map<String, Object> properties = completeProperties(false);
        properties.put("spring.security.oauth2.resourceserver.jwt.issuer-uri", "https://other-idp.example/oidc");
        properties.put("spring.security.oauth2.resourceserver.jwt.audiences", "other-application");
        MockEnvironment environment = productionEnvironment(properties);

        assertThatThrownBy(() -> processor.postProcessEnvironment(environment, application))
                .isInstanceOf(ApplicationContextException.class)
                .hasMessageContaining("jwt.issuer-uri: must match")
                .hasMessageContaining("jwt.audiences: must match");
    }

    private static MockEnvironment productionEnvironment(Map<String, Object> properties) {
        MockEnvironment environment = new MockEnvironment();
        environment.setActiveProfiles("prod");
        environment.getPropertySources().addFirst(new MapPropertySource("test-production", properties));
        return environment;
    }

    private static Map<String, Object> completeProperties(boolean aiEnabled) {
        Map<String, Object> properties = new HashMap<>();
        properties.put("openemr2026.synthetic-dataset-enabled", "false");
        properties.put("spring.datasource.url", "jdbc:postgresql://db.hospital.example/openemr2026");
        properties.put("spring.datasource.username", "openemr2026_app");
        properties.put("openemr2026.production.deployment-id", "hospital-a-prod");
        properties.put("openemr2026.production.allow-development-identity", "false");
        properties.put("openemr2026.production.data-residency", "ON_PREM_ONLY");
        properties.put("openemr2026.production.identity.issuer-uri", "https://idp.hospital.example/oidc");
        properties.put("openemr2026.production.identity.audience", "openemr2026-clinical");
        properties.put("openemr2026.production.identity.required-acr", "urn:openemr2026:acr:mfa");
        properties.put("openemr2026.production.identity.mfa-required", "true");
        properties.put("spring.security.oauth2.resourceserver.jwt.issuer-uri", "https://idp.hospital.example/oidc");
        properties.put("spring.security.oauth2.resourceserver.jwt.audiences", "openemr2026-clinical");
        properties.put("openemr2026.production.signing.ca-base-uri", "https://ca.hospital.example/api");
        properties.put("openemr2026.production.signing.timestamp-uri", "https://tsa.hospital.example/api");
        properties.put("openemr2026.production.signing.client-certificate-ref", "env://TEST_CA_CERT");
        properties.put("openemr2026.production.signing.private-key-ref", "env://TEST_CA_KEY");
        properties.put("openemr2026.production.signing.trust-anchor-ref", "env://TEST_CA_TRUST");
        properties.put("openemr2026.production.encryption.kms-key-uri", "kms://hospital-kms/openemr2026-master");
        properties.put("openemr2026.production.encryption.database-key-ref", "env://TEST_DATABASE_KEY");
        properties.put("openemr2026.production.encryption.object-key-ref", "env://TEST_OBJECT_KEY");
        properties.put("openemr2026.production.storage.endpoint", "https://objects.hospital.example");
        properties.put("openemr2026.production.storage.bucket", "openemr2026-records");
        properties.put("openemr2026.production.storage.object-lock-required", "true");
        properties.put("openemr2026.production.storage.access-key-ref", "env://TEST_STORAGE_ACCESS");
        properties.put("openemr2026.production.storage.secret-key-ref", "env://TEST_STORAGE_SECRET");
        properties.put("openemr2026.archive.ocr-endpoint", "https://ocr.hospital.example/v1/extract");
        properties.put("openemr2026.archive.cda-validation-endpoint", "https://hie.hospital.example/v1/cda/validate");
        properties.put("openemr2026.archive.malware-scanner.host", "clamav.hospital.internal");
        properties.put("openemr2026.production.integration.truststore-ref", "env://TEST_INTEGRATION_TRUST");
        properties.put("openemr2026.production.integration.client-certificate-ref", "env://TEST_INTEGRATION_CERT");
        properties.put("openemr2026.production.database.password-ref", "env://TEST_DATABASE_PASSWORD");
        properties.put("openemr2026.production.ai.enabled", Boolean.toString(aiEnabled));
        properties.put("TEST_CA_CERT", "resolved");
        properties.put("TEST_CA_KEY", "resolved");
        properties.put("TEST_CA_TRUST", "resolved");
        properties.put("TEST_DATABASE_KEY", "resolved");
        properties.put("TEST_OBJECT_KEY", "resolved");
        properties.put("TEST_STORAGE_ACCESS", "resolved");
        properties.put("TEST_STORAGE_SECRET", "resolved");
        properties.put("TEST_INTEGRATION_TRUST", "resolved");
        properties.put("TEST_INTEGRATION_CERT", "resolved");
        properties.put("TEST_DATABASE_PASSWORD", "resolved");
        if (aiEnabled) {
            properties.put("openemr2026.production.ai.base-uri", "https://model.hospital.example/v1");
            properties.put("openemr2026.production.ai.model-id", "deepseek-local-approved");
            properties.put("openemr2026.production.ai.api-key-ref", "env://TEST_AI_KEY");
            properties.put("openemr2026.production.ai.residency", "ON_PREM_ONLY");
            properties.put("TEST_AI_KEY", "resolved");
        }
        return properties;
    }
}
