<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import type { AgentRunBudgetWire } from '../../generated/contracts';
import {
  deactivateAgentRunBudget,
  defineAgentRunBudget,
  getAgentRunBudgetSummary,
  issueAiLease,
  listAgentRunBudgetConsumptions,
  listAgentRunBudgets,
  recordAgentRunBudgetConsumption,
} from '../../api/ai-platform';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { doctorFacingAiText } from '../medical-ai-terminology';

const leaseQuery = useQuery({
  queryKey: ['ai-platform', 'aiops', 'lease'],
  queryFn: () => issueAiLease('AI_PLATFORM_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const budgetsQuery = useQuery({
  queryKey: ['ai-platform', 'aiops', 'budgets'],
  queryFn: () => listAgentRunBudgets(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});

const selectedBudgetId = ref('');
watch(() => budgetsQuery.data.value, (budgets) => {
  if (!budgets?.length) { selectedBudgetId.value = ''; return; }
  if (!budgets.some((budget) => budget.budget_id === selectedBudgetId.value)) {
    selectedBudgetId.value = budgets.find((budget) => budget.status === 'ACTIVE')?.budget_id ?? budgets[0].budget_id;
  }
});

const summaryQuery = useQuery({
  queryKey: ['ai-platform', 'aiops', 'summary', selectedBudgetId],
  queryFn: () => getAgentRunBudgetSummary(leaseQuery.data.value!, selectedBudgetId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedBudgetId.value),
  retry: false,
});
const consumptionsQuery = useQuery({
  queryKey: ['ai-platform', 'aiops', 'consumptions', selectedBudgetId],
  queryFn: () => listAgentRunBudgetConsumptions(leaseQuery.data.value!, selectedBudgetId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedBudgetId.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? budgetsQuery.error.value ?? summaryQuery.error.value ?? consumptionsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? budgetsQuery.error.value ?? summaryQuery.error.value ?? consumptionsQuery.error.value) : null);
const budgets = computed(() => budgetsQuery.data.value ?? []);
const summary = computed(() => summaryQuery.data.value ?? null);
const consumptions = computed(() => consumptionsQuery.data.value ?? []);
const activeCount = computed(() => budgets.value.filter((budget) => budget.status === 'ACTIVE').length);

const defineForm = reactive({ budgetCode: '', budgetName: '', maxTokens: 1_000_000, maxDurationSeconds: 600 });
const recordForm = reactive({ runId: crypto.randomUUID(), tokensConsumed: 1000, durationSeconds: 30 });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}
function formatInt(value: number | null | undefined) {
  return value == null ? '—' : new Intl.NumberFormat('zh-CN').format(value);
}

async function reload() {
  notice.value = '';
  await Promise.all([budgetsQuery.refetch(), summaryQuery.refetch(), consumptionsQuery.refetch()]);
}

async function defineBudget() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !defineForm.budgetCode.trim() || !defineForm.budgetName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await defineAgentRunBudget(lease, {
      budget_code: defineForm.budgetCode.trim(),
      budget_name: defineForm.budgetName.trim(),
      max_tokens: Math.floor(defineForm.maxTokens),
      max_duration_seconds: Math.floor(defineForm.maxDurationSeconds),
    });
    defineForm.budgetCode = ''; defineForm.budgetName = '';
    notice.value = '医助处理额度已定义，版本记录和操作留痕已同步更新。';
    await budgetsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(budget: AgentRunBudgetWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || budget.status !== 'ACTIVE') return;
  busy.value = budget.budget_id; notice.value = '';
  try {
    await deactivateAgentRunBudget(lease, budget);
    notice.value = `医助处理额度“${doctorFacingAiText(budget.budget_name)}”已停用。`;
    await budgetsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function recordConsumption() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedBudgetId.value || !recordForm.runId.trim()) return;
  busy.value = 'record'; notice.value = '';
  try {
    await recordAgentRunBudgetConsumption(lease, {
      budget_id: selectedBudgetId.value,
      run_id: recordForm.runId.trim(),
      tokens_consumed: Math.floor(recordForm.tokensConsumed),
      duration_seconds: Math.floor(recordForm.durationSeconds),
      recorded_at: new Date().toISOString(),
    });
    recordForm.runId = crypto.randomUUID();
    notice.value = '任务用量已记录，操作留痕已同步更新。';
    await Promise.all([summaryQuery.refetch(), consumptionsQuery.refetch()]);
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">AI 中心 / 医助运行监测</p>
        <h1>医助处理额度与用量</h1>
        <p>设置医助任务的生成额度和最长处理时间，查看实际用量；所有变更保留版本和操作记录。</p>
      </div>
      <div class="admin-inline-tools">
        <label class="admin-code-input"><span>处理额度</span>
          <select v-model="selectedBudgetId">
            <option value="" disabled>请选择处理额度</option>
            <option v-for="budget in budgets" :key="budget.budget_id" :value="budget.budget_id">{{ doctorFacingAiText(budget.budget_name) }}（{{ budget.budget_code }}）</option>
          </select>
        </label>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || budgetsQuery.isPending.value" kind="loading" message="正在读取医助处理额度" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="医助处理额度统计">
        <article><span>额度方案</span><strong>{{ budgets.length }}</strong><small>全部定义</small></article>
        <article><span>启用方案</span><strong>{{ activeCount }}</strong><small>当前可用</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>处理额度台账</h2><p>编码不可变；停用后保留历史记录。</p></div>
            <button class="button secondary" @click="budgetsQuery.refetch()">刷新</button>
          </header>
          <div v-if="budgets.length === 0" class="admin-empty" role="status">暂无处理额度方案，可在右侧定义。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>名称 / 编码</th><th>最大生成额度</th><th>最长处理时间</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="budget in budgets" :key="budget.budget_id">
                  <td><strong>{{ doctorFacingAiText(budget.budget_name) }}</strong><small><code>{{ budget.budget_code }}</code> · …{{ budget.budget_id.slice(-8) }}</small></td>
                  <td>{{ formatInt(budget.max_tokens) }}</td>
                  <td>{{ formatInt(budget.max_duration_seconds) }} 秒</td>
                  <td><span class="admin-status" :class="budget.status.toLowerCase()">{{ budget.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="budget.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(budget)">{{ busy === budget.budget_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>定义处理额度</h2><p>设置方案编码、名称、最大生成额度和最长处理时间。</p></div></header>
          <form class="admin-form" @submit.prevent="defineBudget">
            <label><span>方案编码</span><input v-model="defineForm.budgetCode" maxlength="128" required placeholder="例：DAILY-STANDARD" /></label>
            <label><span>方案名称</span><input v-model="defineForm.budgetName" maxlength="256" required placeholder="例：门诊标准额度" /></label>
            <label><span>最大生成额度</span><input v-model.number="defineForm.maxTokens" type="number" min="0" step="1" required /></label>
            <label><span>最长处理时间（秒）</span><input v-model.number="defineForm.maxDurationSeconds" type="number" min="0" step="1" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在定义…' : '定义并生效' }}</button>
          </form>
        </section>
      </div>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>任务用量总览</h2><p>对比当前额度方案的累计用量与上限。</p></div>
            <button class="button secondary" :disabled="!selectedBudgetId" @click="summaryQuery.refetch()">刷新</button>
          </header>
          <div v-if="!selectedBudgetId" class="admin-empty" role="status">请先选择处理额度方案。</div>
          <div v-else-if="summaryQuery.isPending.value" class="admin-empty" role="status">正在计算任务用量…</div>
          <div v-else-if="summary" class="admin-metrics" aria-label="任务用量总览">
            <article><span>已用生成额度</span><strong>{{ formatInt(summary.total_tokens) }}</strong><small>上限 {{ formatInt(summary.max_tokens) }}</small></article>
            <article><span>累计处理时间</span><strong>{{ formatInt(summary.total_duration_seconds) }} 秒</strong><small>上限 {{ formatInt(summary.max_duration_seconds) }} 秒</small></article>
          </div>
        </section>
      </div>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>任务用量明细</h2><p>记录每次医助任务的生成额度和处理时间。</p></div>
            <button class="button secondary" :disabled="!selectedBudgetId" @click="consumptionsQuery.refetch()">刷新</button>
          </header>
          <div v-if="!selectedBudgetId" class="admin-empty" role="status">请先选择处理额度方案。</div>
          <div v-else-if="consumptions.length === 0" class="admin-empty" role="status">该方案暂无任务用量记录，可在右侧记录。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>任务编号</th><th>生成额度</th><th>处理时间</th><th>记录时间</th></tr></thead>
              <tbody>
                <tr v-for="consumption in consumptions" :key="consumption.consumption_id">
                  <td><code>{{ consumption.run_id }}</code></td>
                  <td>{{ formatInt(consumption.tokens_consumed) }}</td>
                  <td>{{ formatInt(consumption.duration_seconds) }} 秒</td>
                  <td>{{ formatDate(consumption.recorded_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>记录任务用量</h2><p>任务编号默认生成，也可填写已有任务编号。</p></div></header>
          <form class="admin-form" @submit.prevent="recordConsumption">
            <label><span>任务编号</span><input v-model="recordForm.runId" maxlength="36" required placeholder="系统任务编号" /></label>
            <label><span>生成额度用量</span><input v-model.number="recordForm.tokensConsumed" type="number" min="0" step="1" required /></label>
            <label><span>处理时间（秒）</span><input v-model.number="recordForm.durationSeconds" type="number" min="0" step="1" required /></label>
            <button class="button primary full" :disabled="Boolean(busy) || !selectedBudgetId">{{ busy === 'record' ? '正在记录…' : '记录任务用量' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
