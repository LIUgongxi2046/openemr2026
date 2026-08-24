<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DataQualityRuleWire } from '../../generated/contracts';
import { clinicalContext } from '../../clinical-api';
import {
  deactivateDataQualityRule,
  issueDataLease,
  listDataQualityEvaluations,
  listDataQualityRules,
  recordDataQualityEvaluation,
  registerDataQualityRule,
} from '../../api/data';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type Dimension = DataQualityRuleWire['dimension'];
type Severity = DataQualityRuleWire['severity'];

const dimensionOptions: Dimension[] = ['COMPLETENESS', 'CONSISTENCY', 'TIMELINESS', 'UNIQUENESS', 'VALIDITY'];
const severityOptions: Severity[] = ['INFO', 'WARNING', 'BLOCKING'];
const dimensionLabels: Record<Dimension, string> = {
  COMPLETENESS: '完整性', CONSISTENCY: '一致性', TIMELINESS: '及时性', UNIQUENESS: '唯一性', VALIDITY: '有效性',
};
const severityLabels: Record<Severity, string> = { INFO: '提示', WARNING: '警告', BLOCKING: '阻断' };

const dimension = ref('');
const selectedRuleId = ref('');

const leaseQuery = useQuery({
  queryKey: ['data', 'data-quality', 'lease'],
  queryFn: () => issueDataLease('DATA_QUALITY_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const rulesQuery = useQuery({
  queryKey: ['data', 'data-quality', 'rules', dimension],
  queryFn: () => listDataQualityRules(leaseQuery.data.value!, dimension.value || undefined),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const evaluationsQuery = useQuery({
  queryKey: ['data', 'data-quality', 'evaluations', selectedRuleId],
  queryFn: () => listDataQualityEvaluations(leaseQuery.data.value!, selectedRuleId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedRuleId.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? rulesQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? rulesQuery.error.value) : null);
const rules = computed(() => rulesQuery.data.value ?? []);
const evaluations = computed(() => evaluationsQuery.data.value ?? []);
const selectedRule = computed(() => rules.value.find((rule) => rule.data_quality_rule_id === selectedRuleId.value) ?? null);
const activeCount = computed(() => rules.value.filter((rule) => rule.status === 'ACTIVE').length);
const evalIssue = computed(() => evaluationsQuery.error.value ? toClinicalIssue(evaluationsQuery.error.value) : null);

const form = reactive({
  ruleCode: '', ruleName: '', dimension: 'COMPLETENESS' as Dimension,
  targetEntity: '', threshold: 0.9, severity: 'WARNING' as Severity,
});
const evalForm = reactive({ targetEntityId: clinicalContext.patientId, measuredValue: 0.5 });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await rulesQuery.refetch();
}

async function selectRule(ruleId: string) {
  selectedRuleId.value = ruleId;
  notice.value = '';
  if (ruleId) await evaluationsQuery.refetch();
}

async function createRule() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.ruleCode.trim() || !form.ruleName.trim() || !form.targetEntity.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await registerDataQualityRule(lease, {
      rule_code: form.ruleCode.trim(),
      rule_name: form.ruleName.trim(),
      dimension: form.dimension,
      target_entity: form.targetEntity.trim(),
      threshold: form.threshold,
      severity: form.severity,
    });
    form.ruleCode = ''; form.ruleName = ''; form.targetEntity = '';
    notice.value = '数据质量规则已注册，审计链与事件出箱已同步记录。';
    await rulesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(rule: DataQualityRuleWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || rule.status !== 'ACTIVE') return;
  busy.value = rule.data_quality_rule_id; notice.value = '';
  try {
    await deactivateDataQualityRule(lease, rule);
    notice.value = `规则 ${rule.rule_name} 已停用。`;
    await rulesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function recordEvaluation() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedRuleId.value || !evalForm.targetEntityId.trim()) return;
  busy.value = 'record'; notice.value = '';
  try {
    await recordDataQualityEvaluation(lease, {
      data_quality_rule_id: selectedRuleId.value,
      target_entity_id: evalForm.targetEntityId.trim(),
      measured_value: evalForm.measuredValue,
      evaluated_at: new Date().toISOString(),
    });
    notice.value = '评估已记录，通过/失败结论已写入审计链。';
    await evaluationsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 数据质量</p>
        <h1>数据质量规则</h1>
        <p>按维度注册完整性、一致性、及时性、唯一性与有效性规则，记录规则级评估结论；停用不物理删除。</p>
      </div>
      <div class="admin-inline-tools">
        <label class="admin-code-input"><span>维度筛选</span>
          <select v-model="dimension"><option value="">全部维度</option><option v-for="dim in dimensionOptions" :key="dim" :value="dim">{{ dimensionLabels[dim] }}</option></select>
        </label>
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">查询</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || rulesQuery.isPending.value" kind="loading" message="正在读取数据质量规则" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="数据质量统计">
        <article><span>规则总数</span><strong>{{ rules.length }}</strong><small>当前筛选</small></article>
        <article><span>有效规则</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
        <article><span>评估记录</span><strong>{{ selectedRule ? evaluations.length : 0 }}</strong><small>{{ selectedRule ? selectedRule.rule_code : '未选择' }}</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>规则台账</h2><p>阈值范围 0–1；选择规则后可在下方查看评估记录。</p></div>
            <button class="button secondary" @click="rulesQuery.refetch()">刷新</button>
          </header>
          <div v-if="rules.length === 0" class="admin-empty" role="status">暂无数据质量规则，可在右侧注册。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>规则编码</th><th>名称 / 维度</th><th>目标实体</th><th>阈值</th><th>严重级别</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="rule in rules" :key="rule.data_quality_rule_id">
                  <td><code>{{ rule.rule_code }}</code></td>
                  <td><strong>{{ rule.rule_name }}</strong><small>{{ dimensionLabels[rule.dimension] }} · …{{ rule.data_quality_rule_id.slice(-8) }}</small></td>
                  <td>{{ rule.target_entity }}</td>
                  <td>{{ rule.threshold }}</td>
                  <td>{{ severityLabels[rule.severity] }}</td>
                  <td><span class="admin-status" :class="rule.status.toLowerCase()">{{ rule.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td class="admin-actions">
                    <button class="task-action" :disabled="Boolean(busy)" @click="selectRule(rule.data_quality_rule_id)">评估</button>
                    <button class="task-action" :disabled="rule.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(rule)">{{ busy === rule.data_quality_rule_id ? '处理中…' : '停用' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>注册规则</h2><p>规则编码、名称与目标实体必填，阈值默认 0.9。</p></div></header>
          <form class="admin-form" @submit.prevent="createRule">
            <label><span>规则编码</span><input v-model="form.ruleCode" maxlength="96" required placeholder="例：DQ-PATIENT-NAME" /></label>
            <label><span>规则名称</span><input v-model="form.ruleName" maxlength="256" required placeholder="例：患者姓名完整性" /></label>
            <label><span>维度</span><select v-model="form.dimension"><option v-for="dim in dimensionOptions" :key="dim" :value="dim">{{ dimensionLabels[dim] }}</option></select></label>
            <label><span>目标实体</span><input v-model="form.targetEntity" maxlength="96" required placeholder="例：patient / encounter" /></label>
            <label><span>阈值（0–1）</span><input v-model.number="form.threshold" type="number" min="0" max="1" step="0.01" required /></label>
            <label><span>严重级别</span><select v-model="form.severity"><option v-for="severity in severityOptions" :key="severity" :value="severity">{{ severityLabels[severity] }}</option></select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在注册…' : '注册并生效' }}</button>
          </form>
        </section>
      </div>

      <section v-if="selectedRule" class="admin-panel">
        <header>
          <div><h2>评估记录 · {{ selectedRule.rule_code }}</h2><p>记录针对目标实体的实测值与通过/失败结论。</p></div>
          <button class="button secondary" @click="selectRule('')">关闭</button>
        </header>
        <ClinicalPageState v-if="evaluationsQuery.isPending.value" kind="loading" message="正在读取评估记录" />
        <ClinicalPageState v-else-if="evalIssue" kind="error" :code="evalIssue.code" :message="evalIssue.message" @retry="evaluationsQuery.refetch()" />
        <div v-else class="admin-layout">
          <section>
            <div v-if="evaluations.length === 0" class="admin-empty" role="status">该规则暂无评估记录，可在右侧记录。</div>
            <div v-else class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr><th>目标实体</th><th>实测值</th><th>阈值</th><th>结论</th><th>评估时间</th></tr></thead>
                <tbody>
                  <tr v-for="evaluation in evaluations" :key="evaluation.data_quality_evaluation_id">
                    <td><code>…{{ evaluation.target_entity_id.slice(-8) }}</code></td>
                    <td>{{ evaluation.measured_value }}</td>
                    <td>{{ evaluation.threshold }}</td>
                    <td><span class="admin-status" :class="evaluation.status.toLowerCase()">{{ evaluation.status === 'PASSED' ? '通过' : '失败' }}</span></td>
                    <td>{{ formatDate(evaluation.evaluated_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="admin-form-panel">
            <form class="admin-form" @submit.prevent="recordEvaluation">
              <label><span>目标实体 ID</span><input v-model="evalForm.targetEntityId" maxlength="36" required placeholder="UUID" /></label>
              <label><span>实测值（0–1）</span><input v-model.number="evalForm.measuredValue" type="number" min="0" max="1" step="0.01" required /></label>
              <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'record' ? '正在记录…' : '记录评估' }}</button>
            </form>
          </section>
        </div>
      </section>
    </template>
  </main>
</template>
