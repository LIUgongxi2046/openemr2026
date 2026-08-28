<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { issueMetricLease, listMetricSnapshots } from '../../api/metrics';
import type { MetricSnapshotWire } from '../../generated/contracts';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const metricNames = ['队列人数', '平均年龄', '血压达标率', '180 天随访'] as const;
const methodologyOpen = ref(false);
const leaseQuery = useQuery({ queryKey: ['research-stats', 'lease'], queryFn: issueMetricLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['research-stats', 'snapshots'], queryFn: () => listMetricSnapshots(leaseQuery.data.value!, 'RESEARCH_STATS'), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const snapshots = computed(() => itemsQuery.data.value ?? []);
const metrics = computed(() => metricNames.map((name) => snapshots.value.find((item) => item.metric_name === name)).filter(Boolean) as MetricSnapshotWire[]);
const ageSnapshots = computed(() => snapshots.value
  .filter((item) => item.dimension?.group === 'AGE_DISTRIBUTION')
  .sort((left, right) => Number(left.dimension?.order ?? 0) - Number(right.dimension?.order ?? 0)));
const maxAgeCount = computed(() => Math.max(...ageSnapshots.value.map((item) => item.metric_value ?? 0), 1));
const ages = computed(() => ageSnapshots.value.map((item) => ({
  label: String(item.dimension?.label ?? item.metric_name),
  height: Math.max(8, Math.round((item.metric_value ?? 0) / maxAgeCount.value * 100)),
  rate: Number(item.dimension?.rate ?? 0),
  count: item.metric_value ?? 0,
})));
const trendSnapshot = computed(() => snapshots.value.find((item) => item.dimension?.group === 'TREND'));
const trendPoints = computed(() => {
  const labels = Array.isArray(trendSnapshot.value?.dimension?.labels) ? trendSnapshot.value?.dimension?.labels : [];
  const values = Array.isArray(trendSnapshot.value?.dimension?.values) ? trendSnapshot.value?.dimension?.values : [];
  return labels.map((label, index) => ({ label: String(label), value: Number(values[index] ?? 0) }));
});
const methodology = computed(() => trendSnapshot.value?.dimension ?? {});
const latestSnapshot = computed(() => snapshots.value[0]);
function metric(name: string) { return metrics.value.find((item) => item.metric_name === name); }
function value(name: string) { const item = metric(name); return item ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(item.metric_value ?? 0)}${item.unit ?? ''}` : '—'; }
function integer(value: number) { return new Intl.NumberFormat('zh-CN').format(value); }
</script>

<template>
  <section data-page-root class="content vue-native-page research-stats-page">
    <div class="page-head"><div class="page-title"><p class="eyebrow">数据中心 / 科研统计</p><h1>科研统计分析</h1><p>{{ methodology.cohort_version ?? '已固化队列版本' }} · 去标识聚合 · 最新快照 …{{ latestSnapshot?.snapshot_id.slice(-8) ?? '等待生成' }}</p></div><div class="head-actions"><button class="btn" @click="methodologyOpen = true">统计口径</button><RouterLink class="btn primary" to="/research-dataset">申请患者级数据</RouterLink></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取去标识统计快照" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="itemsQuery.refetch()" />
    <template v-else>
      <section class="metric-grid research-metrics"><article v-for="name in metricNames" :key="name" class="metric"><div class="name">{{ name }}</div><div class="value">{{ value(name) }}</div><div class="trend">{{ metric(name)?.dimension?.detail ?? '已固化口径' }}</div></article></section>
      <div class="stats-grid research-analysis-grid">
        <section class="card"><div class="card-head">年龄分层与达标率 <span class="sub">来自指标快照</span></div><div v-if="ages.length" class="bar-chart"><div v-for="item in ages" :key="item.label" :title="`${integer(item.count)}人`"><span>{{ item.label }}</span><i :style="{ height: `${item.height}%` }"></i><b>{{ item.rate }}%</b></div></div><div v-else class="card-body">暂无年龄分层快照。</div></section>
        <section class="card"><div class="card-head">季度趋势 <span class="sub">{{ trendSnapshot?.metric_name ?? '等待快照' }}</span></div><div v-if="trendPoints.length" class="trend-points"><article v-for="point in trendPoints" :key="point.label"><b>{{ point.value }}%</b><span>{{ point.label }}</span></article></div><div v-else class="card-body">暂无趋势快照。</div></section>
        <aside class="card"><div class="card-head">质量与解释</div><div class="card-body"><div class="notice rule"><div class="notice-title">聚合统计使用边界</div>患者级数据必须另行申请；当前页面只读取已固化、可复算的去标识指标快照。</div><div v-for="row in [['数据截止', methodology.data_cutoff ?? '—'],['队列/指标', `${methodology.cohort_version ?? '—'} / ${methodology.indicator_version ?? '—'}`],['小样本抑制', methodology.small_cell_suppression ?? '—'],['数据来源', methodology.source ?? '—'],['AI 衍生变量', `${methodology.ai_derived_fields ?? '—'} 项`],['统计脚本', methodology.script_version ?? '—']]" :key="String(row[0])" class="folder-row"><span>{{ row[0] }}</span><strong>{{ row[1] }}</strong></div></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="methodologyOpen" title="统计口径与可复算证据" description="该快照只包含去标识聚合结果；队列版本、指标版本、数据水位和统计脚本同步固化。"><div class="admin-form"><div class="notice info"><div class="notice-title">快照 …{{ trendSnapshot?.snapshot_id.slice(-8) ?? '尚未生成' }}</div>{{ methodology.indicator_version ?? '未登记指标版本' }} · {{ methodology.formula ?? '未登记计算公式' }} · 小样本抑制{{ methodology.small_cell_suppression ?? '未登记' }}。</div></div><template #footer="{ close }"><button class="button primary" @click="close">我已知悉</button></template></AdminActionDialog>
  </section>
</template>

<style scoped>
.research-stats-page{display:grid;gap:14px}.research-metrics{margin:0}.research-analysis-grid{display:grid;grid-template-columns:1fr 1fr 320px;gap:12px}.bar-chart{height:280px;display:flex;align-items:flex-end;justify-content:space-around;padding:28px 18px}.bar-chart>div{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px}.bar-chart i{display:block;width:38px;background:linear-gradient(#4b92e4,#1769e0);border-radius:5px 5px 0 0}.bar-chart span,.bar-chart b{font-size:11px}.trend-points{min-height:280px;display:grid;grid-template-columns:repeat(5,minmax(0,1fr));align-items:end;gap:8px;padding:30px 18px;background:linear-gradient(#fff,#f6faff)}.trend-points article{display:grid;align-content:end;gap:8px;min-height:80px;padding:12px 6px;border-top:4px solid var(--blue);background:var(--blue-50);text-align:center}.trend-points article:nth-child(2){min-height:105px}.trend-points article:nth-child(3){min-height:130px}.trend-points article:nth-child(4){min-height:155px}.trend-points article:nth-child(5){min-height:180px}.trend-points span,.trend-points b{font-size:11px}@media(max-width:1280px){.research-analysis-grid{grid-template-columns:1fr 1fr}.research-analysis-grid>aside{grid-column:1/3}}@media(max-width:760px){.research-analysis-grid{grid-template-columns:1fr}.research-analysis-grid>aside{grid-column:auto}.trend-points{grid-template-columns:1fr;align-items:stretch}.trend-points article,.trend-points article:nth-child(n){min-height:0}}
</style>
