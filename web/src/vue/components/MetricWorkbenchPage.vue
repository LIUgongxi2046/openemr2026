<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { computeMetricSnapshots, issueMetricLease, listMetricSnapshots, recordMetricSnapshot } from '../../api/metrics';
import type { MetricSnapshotWire } from '../../generated/contracts';
import type { MetricWorkbenchDefinition } from '../metric-workbenches';
import ClinicalPageState from './ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const props = defineProps<{ definition: MetricWorkbenchDefinition }>();
const leaseQuery = useQuery({ queryKey: ['metric', 'lease'], queryFn: issueMetricLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['metric', props.definition.metricType], queryFn: () => listMetricSnapshots(leaseQuery.data.value!, props.definition.metricType), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const items = computed(() => itemsQuery.data.value ?? []);
const latest = computed(() => props.definition.defaultMetrics.map((name) => items.value.find((item) => item.metric_name === name)).filter(Boolean) as MetricSnapshotWire[]);
const history = computed(() => items.value.filter((item) => !latest.value.includes(item)).slice(0, 20));
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const busy = ref(''); const notice = ref('');
const form = reactive({ name: props.definition.defaultMetrics[0] ?? '', value: 0, unit: '' });

async function computeMetrics() {
  if (!leaseQuery.data.value || busy.value) return;
  busy.value = 'compute'; notice.value = '';
  try { await computeMetricSnapshots(leaseQuery.data.value, props.definition.metricType); notice.value = '指标已按登记公式从事实表计算，并固化来源、公式、范围和周期。'; await itemsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function recordManual() {
  if (!leaseQuery.data.value || busy.value || !form.name.trim()) return;
  busy.value = 'manual'; notice.value = '';
  try { await recordMetricSnapshot(leaseQuery.data.value, { metric_type: props.definition.metricType, metric_name: form.name.trim(), metric_value: form.value, unit: form.unit.trim() || null }); notice.value = '人工快照已记录并进入审计哈希链；它不会冒充自动计算口径。'; await itemsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
function value(item: MetricSnapshotWire) { return `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(item.metric_value ?? 0)}${item.unit ?? ''}`; }
function date(value?: string) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'; }
</script>

<template>
  <main id="main-content" class="content vue-native-page metric-workbench-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">{{ definition.perspective }} / 指标快照</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div><div class="toolbar-actions"><button class="button secondary" @click="itemsQuery.refetch()">刷新</button><button class="button primary" :disabled="Boolean(busy)" @click="computeMetrics">{{ busy === 'compute' ? '计算中…' : '按登记口径计算' }}</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取指标目录、血缘与快照" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="itemsQuery.refetch()" />
    <template v-else><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <section class="metric-workflow"><article v-for="(step,index) in definition.workflow" :key="step"><span>{{ index + 1 }}</span><strong>{{ step }}</strong></article></section>
      <section class="semantic-metrics" aria-label="最新指标"><article v-for="name in definition.defaultMetrics" :key="name"><span>{{ name }}</span><strong>{{ latest.find((item) => item.metric_name === name) ? value(latest.find((item) => item.metric_name === name)!) : '—' }}</strong><small>{{ latest.find((item) => item.metric_name === name)?.period ?? '尚未计算' }}</small></article></section>
      <div class="metric-layout"><section class="admin-panel"><header><div><h2>指标目录与血缘</h2><p>每个自动快照携带事实来源与公式</p></div><span>{{ latest.length }}/{{ definition.defaultMetrics.length }} 已计算</span></header><div v-if="!latest.length" class="admin-empty">暂无自动计算快照。执行“按登记口径计算”后生成。</div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>指标</th><th>当前值</th><th>事实来源</th><th>公式</th><th>周期 / 水位</th></tr></thead><tbody><tr v-for="item in latest" :key="item.snapshot_id"><td><strong>{{ item.metric_name }}</strong><small>{{ item.metric_type }}</small></td><td><strong>{{ value(item) }}</strong></td><td><code>{{ item.dimension?.source ?? 'MANUAL' }}</code></td><td>{{ item.dimension?.formula ?? '人工记录，无自动公式' }}</td><td>{{ item.period ?? '—' }}<small>{{ date(item.computed_at) }} · v{{ item.row_version }}</small></td></tr></tbody></table></div></section>
        <aside class="metric-side"><section class="admin-panel"><header><div><h2>业务入口</h2><p>从指标回到可整改事实</p></div></header><nav><RouterLink v-for="link in definition.links" :key="link.to" :to="link.to">{{ link.label }} →</RouterLink></nav></section><section class="admin-panel"><header><div><h2>人工参考快照</h2><p>明确标记为无自动公式</p></div></header><form class="admin-form" @submit.prevent="recordManual"><label>指标名<select v-model="form.name"><option v-for="name in definition.defaultMetrics" :key="name">{{ name }}</option></select></label><label>参考值<input v-model.number="form.value" type="number" step="0.01" /></label><label>单位<input v-model="form.unit" placeholder="可为空" /></label><button class="button secondary full" :disabled="Boolean(busy)">{{ busy === 'manual' ? '记录中…' : '记录人工快照' }}</button></form></section></aside></div>
      <section v-if="history.length" class="admin-panel metric-history"><header><div><h2>历史与人工快照</h2><p>最新自动口径之外的近 20 条记录</p></div></header><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>指标</th><th>值</th><th>来源</th><th>时间</th></tr></thead><tbody><tr v-for="item in history" :key="item.snapshot_id"><td>{{ item.metric_name }}</td><td>{{ value(item) }}</td><td>{{ item.dimension?.source ?? 'MANUAL' }}</td><td>{{ date(item.computed_at) }}</td></tr></tbody></table></div></section>
    </template>
  </main>
</template>

<style scoped>
.metric-workflow{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin:14px 0}.metric-workflow article{display:flex;align-items:center;gap:8px;padding:12px;border:1px solid var(--line);border-radius:9px;background:#fff}.metric-workflow span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#eaf1fb;color:#245493}.semantic-metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:14px}.semantic-metrics article{display:grid;gap:3px;padding:14px;border:1px solid var(--line);border-radius:10px;background:#fff}.semantic-metrics span,.semantic-metrics small{font-size:11px;color:#667085}.semantic-metrics strong{font-size:24px}.metric-layout{display:grid;grid-template-columns:minmax(0,1fr) 310px;gap:14px}.metric-side{display:grid;gap:14px}.metric-side nav{display:grid;padding:8px}.metric-side nav a{padding:10px;border-radius:7px}.metric-side nav a:hover{background:#eef6ff}.admin-table td small{display:block;color:#667085}.metric-history{margin-top:14px}@media(max-width:900px){.metric-workflow,.semantic-metrics,.metric-layout{grid-template-columns:1fr 1fr}}@media(max-width:600px){.metric-workflow,.semantic-metrics,.metric-layout{grid-template-columns:1fr}}
</style>
