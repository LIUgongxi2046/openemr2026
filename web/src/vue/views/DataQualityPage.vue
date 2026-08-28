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
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
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
const showInactive = ref(false);

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
const allRules = computed(() => rulesQuery.data.value ?? []);
const rules = computed(() => allRules.value.filter((rule) => showInactive.value || rule.status === 'ACTIVE'));
const evaluations = computed(() => evaluationsQuery.data.value ?? []);
const selectedRule = computed(() => rules.value.find((rule) => rule.data_quality_rule_id === selectedRuleId.value) ?? null);
const activeCount = computed(() => rules.value.filter((rule) => rule.status === 'ACTIVE').length);
const blockingCount = computed(() => rules.value.filter((rule) => rule.status === 'ACTIVE' && rule.severity === 'BLOCKING').length);
const warningCount = computed(() => rules.value.filter((rule) => rule.status === 'ACTIVE' && rule.severity === 'WARNING').length);
const workQueue = computed(() => [...rules.value]
  .filter((rule) => rule.status === 'ACTIVE')
  .sort((left, right) => severityOptions.indexOf(right.severity) - severityOptions.indexOf(left.severity))
  .slice(0, 5));
const evalIssue = computed(() => evaluationsQuery.error.value ? toClinicalIssue(evaluationsQuery.error.value) : null);

const form = reactive({
  ruleCode: '', ruleName: '', dimension: 'COMPLETENESS' as Dimension,
  targetEntity: '', threshold: 0.9, severity: 'WARNING' as Severity,
});
const evalForm = reactive({ targetEntityId: clinicalContext.patientId, measuredValue: 0.5 });
const busy = ref('');
const notice = ref('');
const createOpen = ref(false);
const evaluationOpen = ref(false);
const deactivateOpen = ref(false);
const pendingDeactivate = ref<DataQualityRuleWire | null>(null);

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
    createOpen.value = false;
    await rulesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

function requestDeactivate(rule: DataQualityRuleWire) {
  pendingDeactivate.value = rule;
  deactivateOpen.value = true;
}

async function deactivatePending() {
  if (!pendingDeactivate.value) return;
  await deactivate(pendingDeactivate.value);
  deactivateOpen.value = false;
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
    evaluationOpen.value = false;
    await evaluationsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page data-quality-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 数据质量</p>
        <h1>全院数据质量与问题工单</h1>
        <p>覆盖质量规则、问题队列、整改复核与审计追踪；停用不物理删除，历史证据持续保留。</p>
      </div>
      <div class="admin-inline-tools">
        <label class="admin-code-input"><span>维度筛选</span>
          <select v-model="dimension"><option value="">全部维度</option><option v-for="dim in dimensionOptions" :key="dim" :value="dim">{{ dimensionLabels[dim] }}</option></select>
        </label>
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">查询</button>
        <button class="button primary" :disabled="Boolean(busy)" @click="createOpen = true">新建质量规则</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || rulesQuery.isPending.value" kind="loading" message="正在读取数据质量规则" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="数据质量统计">
        <article><span>规则总数</span><strong>{{ rules.length }}</strong><small>当前筛选</small></article>
        <article><span>有效规则</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
        <article><span>阻断级问题</span><strong>{{ blockingCount }}</strong><small>影响新业务流程</small></article>
        <article><span>警告级问题</span><strong>{{ warningCount }}</strong><small>进入整改队列</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="quality-operations">
        <div class="admin-panel quality-work-queue">
          <header><div><h2>质量问题工作队列</h2><p>阻断级优先，查看评估后可记录实测值并形成复核证据。</p></div></header>
          <div v-if="workQueue.length === 0" class="admin-empty">当前筛选下没有待处理规则。</div>
          <div v-else class="quality-queue-list">
            <button v-for="rule in workQueue" :key="`queue-${rule.data_quality_rule_id}`" class="quality-queue-row" @click="selectRule(rule.data_quality_rule_id)">
              <span><strong>{{ rule.rule_name }}</strong><small>{{ dimensionLabels[rule.dimension] }} · {{ rule.target_entity }}</small></span>
              <span class="quality-queue-meta"><b>{{ severityLabels[rule.severity] }}</b><small>阈值 {{ rule.threshold }}</small></span>
            </button>
          </div>
          <ol class="quality-flow" aria-label="质量整改流程"><li>发现</li><li>分派</li><li>整改</li><li>复核</li><li>关闭</li></ol>
        </div>
        <aside class="admin-panel quality-safeguards">
          <header><div><h2>安全与恢复</h2><p>质量规则直接影响流程，所有动作保留审计证据。</p></div></header>
          <div class="folder-row"><span>规则变更</span><strong>版本化新增</strong></div>
          <div class="folder-row"><span>阻断级失败</span><strong>进入人工复核</strong></div>
          <div class="folder-row"><span>失败重试</span><strong>幂等记录</strong></div>
          <div class="folder-row"><span>规则停用</span><strong>历史证据保留</strong></div>
          <button class="button secondary quality-refresh" @click="reload">刷新工作队列</button>
        </aside>
      </section>

      <section class="admin-panel">
          <header>
            <div><h2>规则台账</h2><p>阈值范围 0–1；默认只展示当前生效的业务规则。</p></div>
            <label class="admin-code-input"><span>历史</span><input v-model="showInactive" type="checkbox" /> 包含已停用</label>
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
                    <button class="task-action" :disabled="Boolean(busy)" @click="selectRule(rule.data_quality_rule_id)">查看评估</button>
                    <button class="task-action" :disabled="rule.status !== 'ACTIVE' || Boolean(busy)" @click="requestDeactivate(rule)">{{ busy === rule.data_quality_rule_id ? '处理中…' : '停用' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <section v-if="selectedRule" class="admin-panel">
        <header>
          <div><h2>评估记录 · {{ selectedRule.rule_code }}</h2><p>记录针对目标实体的实测值与通过/失败结论。</p></div>
          <div class="toolbar-actions"><button class="button primary" :disabled="selectedRule.status !== 'ACTIVE'" @click="evaluationOpen = true">记录评估</button><button class="button secondary" @click="selectRule('')">关闭</button></div>
        </header>
        <ClinicalPageState v-if="evaluationsQuery.isPending.value" kind="loading" message="正在读取评估记录" />
        <ClinicalPageState v-else-if="evalIssue" kind="error" :code="evalIssue.code" :message="evalIssue.message" @retry="evaluationsQuery.refetch()" />
        <div v-else>
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
        </div>
      </section>
    </template>

    <AdminActionDialog v-model:open="createOpen" title="新建数据质量规则" description="规则保存后立即参与对应实体的质量评估；规则身份与阈值不可覆盖修改，变更需停用旧规则并创建新版本。" size="large" :busy="busy === 'create'">
      <form class="admin-form quality-dialog-form" @submit.prevent="createRule">
        <label><span>规则编码</span><input v-model="form.ruleCode" maxlength="96" required placeholder="例：DQ-PATIENT-NAME" /></label>
        <label><span>规则名称</span><input v-model="form.ruleName" maxlength="256" required placeholder="例：患者姓名完整性" /></label>
        <label><span>维度</span><select v-model="form.dimension"><option v-for="dim in dimensionOptions" :key="dim" :value="dim">{{ dimensionLabels[dim] }}</option></select></label>
        <label><span>目标实体</span><input v-model="form.targetEntity" maxlength="96" required placeholder="例：patient / encounter" /></label>
        <label><span>阈值（0–1）</span><input v-model.number="form.threshold" type="number" min="0" max="1" step="0.01" required /></label>
        <label><span>严重级别</span><select v-model="form.severity"><option v-for="severity in severityOptions" :key="severity" :value="severity">{{ severityLabels[severity] }}</option></select></label>
      </form>
      <template #footer="{ close }"><button class="button secondary" :disabled="busy === 'create'" @click="close">取消</button><button class="button primary" :disabled="busy === 'create'" @click="createRule">{{ busy === 'create' ? '正在注册…' : '注册并生效' }}</button></template>
    </AdminActionDialog>
    <AdminActionDialog v-model:open="evaluationOpen" :title="`记录评估 · ${selectedRule?.rule_code ?? ''}`" description="实测值与规则阈值共同决定通过或失败，结论会进入审计链并影响质量整改队列。" :busy="busy === 'record'">
      <form class="admin-form" @submit.prevent="recordEvaluation"><label><span>目标实体 ID</span><input v-model="evalForm.targetEntityId" maxlength="36" required placeholder="UUID" /></label><label><span>实测值（0–1）</span><input v-model.number="evalForm.measuredValue" type="number" min="0" max="1" step="0.01" required /></label></form>
      <template #footer="{ close }"><button class="button secondary" :disabled="busy === 'record'" @click="close">取消</button><button class="button primary" :disabled="busy === 'record'" @click="recordEvaluation">{{ busy === 'record' ? '正在记录…' : '记录评估' }}</button></template>
    </AdminActionDialog>
    <AdminConfirmDialog v-model:open="deactivateOpen" :title="`停用规则 ${pendingDeactivate?.rule_code ?? ''}`" description="停用后新的数据质量评估不再执行该规则，历史失败记录、整改证据和审计链继续保留。" confirm-label="确认停用" :busy="Boolean(busy)" @confirm="deactivatePending" />
  </section>
</template>

<style scoped>
.data-quality-page { display: grid; align-content: start; gap: 14px; }
.data-quality-page > .page-heading,
.data-quality-page > .admin-metrics,
.data-quality-page > .admin-notice,
.data-quality-page > .admin-panel { margin: 0; }
.quality-dialog-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0; }
.admin-inline-tools { display: flex; flex-wrap: wrap; align-items: end; gap: 10px; }
.data-quality-page td.admin-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; min-width: 176px; }
.toolbar-actions { gap: 8px; }
.quality-operations { display: grid; grid-template-columns: minmax(0, 1.7fr) minmax(260px, .8fr); gap: 14px; }
.quality-work-queue, .quality-safeguards { margin: 0; }
.quality-queue-list { display: grid; gap: 8px; }
.quality-queue-row { display: flex; width: 100%; align-items: center; justify-content: space-between; gap: 14px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--card); color: inherit; text-align: left; cursor: pointer; }
.quality-queue-row > span { display: grid; gap: 3px; min-width: 0; }
.quality-queue-row small { color: var(--muted); }
.quality-queue-meta { flex: 0 0 auto; text-align: right; }
.quality-flow { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 8px; margin: 14px 0 0; padding: 0; list-style: none; }
.quality-flow li { padding: 8px 6px; border-radius: 999px; background: var(--blue-50); color: var(--blue); font-size: 11px; font-weight: 700; text-align: center; }
.quality-refresh { width: 100%; margin-top: 12px; }
@media (max-width: 900px) { .quality-operations { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 700px) { .quality-dialog-form { grid-template-columns: minmax(0, 1fr); } .admin-inline-tools { align-items: stretch; } .admin-inline-tools .button { width: 100%; } .quality-flow { grid-template-columns: repeat(3, minmax(0, 1fr)); } .data-quality-page td.admin-actions { min-width: 154px; } }
</style>
