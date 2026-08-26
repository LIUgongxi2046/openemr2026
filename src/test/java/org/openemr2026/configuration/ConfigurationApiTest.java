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
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@ActiveProfiles("dev-synthetic")
@Transactional
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

    @Test
    void givenUnsafeDomainModels_whenValidating_thenProtectedBusinessGatesFailClosed() {
        ConfigurationItemWire workflow = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("WORKFLOW", "WF-UNSAFE-" + UUID.randomUUID(), "无终态流程",
                        Map.of("schema_version", 2,
                                "nodes", List.of(
                                        Map.of("id", "start", "name", "开始", "type", "START", "owner", "医生"),
                                        Map.of("id", "task", "name", "无人任务", "type", "TASK", "owner", "")),
                                "edges", List.of(Map.of("from", "start", "to", "task", "condition", "已提交")),
                                "protected_nodes", List.of("audit"), "timeout_policy", "30 分钟提醒")));
        ConfigurationItemWire workflowResult = transition(identity(), workflow,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "验证无终态和保护节点硬门");
        assertThat(workflowResult.validationErrors()).anyMatch(error -> error.contains("终态"));
        assertThat(workflowResult.validationErrors()).anyMatch(error -> error.contains("签署"));

        ConfigurationItemWire rule = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("RULE", "RULE-UNSAFE-" + UUID.randomUUID(), "AI 越权规则",
                        Map.of("schema_version", 2, "conditions", List.of("病情变化"), "actions", List.of("阻断医嘱"),
                                "rule_layer", "AI_ADVICE", "sample_case", Map.of("case_id", "SYN-1"),
                                "rules", List.of(Map.of("id", "ai-block", "name", "AI 自动阻断", "layer", "AI_ADVICE",
                                        "condition", "模型认为高风险", "action", "阻断处方", "evidence", "eval-v1")))));
        ConfigurationItemWire ruleResult = transition(identity(), rule,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "验证 AI 不得直接阻断临床动作");
        assertThat(ruleResult.validationErrors()).anyMatch(error -> error.contains("AI 建议不得直接阻断"));

        ConfigurationItemWire scope = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("SCOPE", "SCOPE-UNSAFE-" + UUID.randomUUID(), "无范围高权",
                        Map.of("schema_version", 2, "roles", List.of("临时医生"), "data_scopes", List.of("全部患者"),
                                "separation_of_duties", "作者!=审批人", "temporary_grant_hours", 4,
                                "permissions", List.of(Map.of("role", "临时医生", "resource", "全部病历", "action", "导出",
                                        "scope", "全部患者", "effect", "ALLOW", "temporary_hours", 0)))));
        ConfigurationItemWire scopeResult = transition(identity(), scope,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "验证高权限必须绑定范围和到期");
        assertThat(scopeResult.validationErrors()).anyMatch(error -> error.contains("无范围高权限"));
    }

    @Test
    void givenRoleCatalogDefinition_whenValidating_thenRoleAndWorkgroupSchemaIsSupported() {
        String key = "ROLE-" + UUID.randomUUID().toString().substring(0, 8);
        ConfigurationItemWire draft = configurations.define(identity(), "cfg-" + UUID.randomUUID(),
                new ConfigurationItemDefineRequestWire("ROLE_CATALOG", key, "心内科住院医生",
                        Map.of("schema_version", 1, "object_type", "ROLE", "parent_role_code", "ROLE-DOCTOR",
                                "permission_summary", "住院病历查看与书写", "scope", "心内科病区",
                                "owner", "医务处")));
        ConfigurationItemWire validated = transition(identity(), draft,
                ConfigurationLifecycleRequestWire.ActionValue.VALIDATE, "校验角色目录结构和职责分离字段");
        assertThat(validated.validationState()).isEqualTo(ConfigurationItemWire.ValidationStateValue.VALID);
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
