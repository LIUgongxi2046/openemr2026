package org.openemr2026.configuration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.openemr2026.contracts.ConfigurationItemDefineRequestWire;
import org.openemr2026.contracts.ConfigurationItemUpdateRequestWire;
import org.openemr2026.contracts.ConfigurationItemWire;
import org.openemr2026.contracts.ConfigurationLifecycleRequestWire;
import org.openemr2026.security.ClinicalIdentity;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
final class ConfigurationApiTest {

    private static final String TENANT = "018f0000-0000-7000-8000-00000000aa01";
    private static final String USER = "018f0000-0000-7000-8000-00000000aa04";
    private static final String ROLE = "018f0000-0000-7000-8000-00000000aa05";
    private static final String APPROVER = "018f0000-0000-7000-8000-00000000aa06";
    private static final String APPROVER_ROLE = "018f0000-0000-7000-8000-00000000aa07";

    @Autowired
    private ConfigurationService configurations;

    private ClinicalIdentity identity() {
        return new ClinicalIdentity(UUID.fromString(TENANT), UUID.fromString(USER), List.of(UUID.fromString(ROLE)));
    }

    private ClinicalIdentity approver() {
        return new ClinicalIdentity(
                UUID.fromString(TENANT), UUID.fromString(APPROVER), List.of(UUID.fromString(APPROVER_ROLE)));
    }

    @Test
    void givenConfig_whenDefiningAndListing_thenDraftRecorded() {
        String type = "WORKFLOW";
        String key = "WF-" + UUID.randomUUID().toString().substring(0, 8);
        ConfigurationItemWire defined = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire(type, key, "流程-" + key,
                        Map.of("nodes", List.of(Map.of("id", "start", "type", "Start")))));
        assertThat(defined.status()).isEqualTo(ConfigurationItemWire.StatusValue.DRAFT);
        assertThat(defined.configKey()).isEqualTo(key);

        List<ConfigurationItemWire> listed = configurations.list(identity(), type);
        assertThat(listed).extracting(ConfigurationItemWire::configId).contains(defined.configId());
    }

    @Test
    void givenDuplicateKey_whenDefining_thenRejected() {
        String type = "RULE";
        String key = "R-" + UUID.randomUUID().toString().substring(0, 8);
        configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire(type, key, "规则-" + key, Map.of("condition", "all")));
        assertThatThrownBy(() -> configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire(type, key, "重复规则", Map.of())))
                .isInstanceOf(ConfigurationException.class)
                .satisfies(e -> assertThat(((ConfigurationException) e).code()).isEqualTo("CONFIG_KEY_CONFLICT"));
    }

    @Test
    void givenStructuredWorkflow_whenUpdatingApprovingPublishingAndRollingBack_thenHistoryIsControlled() {
        String key = "WF-LIFE-" + UUID.randomUUID().toString().substring(0, 8);
        ConfigurationItemWire draft = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("WORKFLOW", key, "住院会诊流程",
                        workflowPayload("专家意见")));
        ConfigurationItemWire updated = configurations.update(identity(), draft.configId(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemUpdateRequestWire("住院会诊流程 v2", workflowPayload("专家复核"), draft.rowVersion()));
        ConfigurationItemWire validated = transition(identity(), updated,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "运行流程静态校验");
        assertThat(validated.validationState()).isEqualTo(ConfigurationItemWire.ValidationStateValue.VALID);
        ConfigurationItemWire pending = transition(identity(), validated,
                ConfigurationLifecycleRequestWire.ActionValue.SUBMIT, "提交双人审批和发布");
        assertThat(pending.status()).isEqualTo(ConfigurationItemWire.StatusValue.PENDING_APPROVAL);
        assertThatThrownBy(() -> transition(identity(), pending,
                ConfigurationLifecycleRequestWire.ActionValue.APPROVE, "作者尝试批准自己配置"))
                .isInstanceOf(ConfigurationException.class)
                .satisfies(e -> assertThat(((ConfigurationException) e).code())
                        .isEqualTo("CONFIG_SEPARATION_OF_DUTIES"));
        ConfigurationItemWire approved = transition(approver(), pending,
                ConfigurationLifecycleRequestWire.ActionValue.APPROVE, "独立审批人核对差异和证据");
        ConfigurationItemWire active = transition(approver(), approved,
                ConfigurationLifecycleRequestWire.ActionValue.PUBLISH, "校验通过后发布候选配置");
        assertThat(active.status()).isEqualTo(ConfigurationItemWire.StatusValue.ACTIVE);
        assertThat(active.publishedAt()).isNotNull();
        ConfigurationItemWire rolledBack = transition(approver(), active,
                ConfigurationLifecycleRequestWire.ActionValue.ROLLBACK, "演练回退到上一个有效载荷");
        assertThat(rolledBack.payload().get("nodes").toString()).contains("专家意见");
        assertThat(rolledBack.status()).isEqualTo(ConfigurationItemWire.StatusValue.ACTIVE);
    }

    @Test
    void givenIncompleteStructuredPayload_whenSubmitting_thenValidationFailsClosed() {
        String key = "WF-INVALID-" + UUID.randomUUID().toString().substring(0, 8);
        ConfigurationItemWire draft = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("WORKFLOW", key, "不完整流程", Map.of("schema_version", 1)));
        ConfigurationItemWire invalid = transition(identity(), draft,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "检查不完整配置的错误列表");
        assertThat(invalid.validationState()).isEqualTo(ConfigurationItemWire.ValidationStateValue.INVALID);
        assertThat(invalid.validationErrors()).isNotEmpty();
        assertThatThrownBy(() -> transition(identity(), invalid,
                ConfigurationLifecycleRequestWire.ActionValue.SUBMIT, "不完整配置不得进入审批"))
                .isInstanceOf(ConfigurationException.class)
                .satisfies(e -> assertThat(((ConfigurationException) e).code())
                        .isEqualTo("CONFIG_VALIDATION_FAILED"));
    }

    private ConfigurationItemWire transition(
            ClinicalIdentity actor, ConfigurationItemWire item,
            ConfigurationLifecycleRequestWire.ActionValue action, String reason) {
        return configurations.transition(actor, item.configId(), "cfg-" + UUID.randomUUID(),
                new ConfigurationLifecycleRequestWire(action, item.rowVersion(), reason));
    }

    private Map<String, Object> workflowPayload(String reviewNode) {
        return Map.of(
                "schema_version", 1,
                "nodes", List.of("发起", reviewNode, "签署", "审计", "完成"),
                "edges", List.of("发起->" + reviewNode, reviewNode + "->签署", "签署->审计", "审计->完成"),
                "protected_nodes", List.of("签署", "审计"),
                "timeout_policy", "2 小时提醒，4 小时升级");
    }
}
