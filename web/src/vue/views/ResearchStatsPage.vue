<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { issueMetricLease, listMetricSnapshots } from '../../api/metrics';
import type { MetricSnapshotWire } from '../../generated/contracts';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const metricNames = ['队列人数', '平均年龄', '血压达标率', '180 天随访'] as const;
const ages = [
  { label: '18–39', height: 18, rate: 71 }, { label: '40–49', height: 34, rate: 67 },
  { label: '50–59', height: 62, rate: 64 }, { label: '60–69', height: 82, rate: 59 },
  { label: '≥70', height: 54, rate: 55 },
];
const methodologyOpen = ref(false);
const leaseQuery = useQuery({ queryKey: ['research-stats', 'lease'], queryFn: issueMetricLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['research-stats', 'snapshots'], queryFn: () => listMetricSnapshots(leaseQuery.data.value!, 'RESEARCH_STATS'), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const metrics = computed(() => metricNames.map((name) => (itemsQuery.data.value ?? []).find((item) => item.metric_name === name)).filter(Boolean) as MetricSnapshotWire[]);
function metric(name: string) { return metrics.value.find((item) => item.metric_name === name); }
function value(name: string) { const item = metric(name); return item ? `${new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 2 }).format(item.metric_value ?? 0)}${item.unit ?? ''}` : '—'; }
</script>

<template>
  <section data-page-root class="content vue-native-page research-stats-page">
    <div class="page-head"><div class="page-title"><p class="eyebrow">数据中心 / 科研统计</p><h1>科研统计分析</h1><p>队列 v6 · 12,486 人 · 去标识聚合 · 结果快照 STAT-20260813-09</p></div><div class="head-actions"><button class="btn" @click="methodologyOpen = true">统计口径</button><RouterLink class="btn primary" to="/research-dataset">申请患者级数据</RouterLink></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取去标识统计快照" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="itemsQuery.refetch()" />
    <template v-else>
      <section class="metric-grid research-metrics"><article v-for="name in metricNames" :key="name" class="metric"><div class="name">{{ name }}</div><div class="value">{{ value(name) }}</div><div class="trend">{{ metric(name)?.dimension?.detail ?? '已固化口径' }}</div></article></section>
      <div class="stats-grid research-analysis-grid">
        <section class="card"><div class="card-head">年龄分层与达标率</div><div class="bar-chart"><div v-for="item in ages" :key="item.label"><span>{{ item.label }}</span><i :style="{ height: `${item.height}%` }"></i><b>{{ item.rate }}%</b></div></div></section>
        <section class="card"><div class="card-head">季度趋势</div><div class="line-chart-mock"><div class="line-points">●╱●╱●━●╱●</div><span>2025 Q2　Q3　Q4　2026 Q1　Q2</span><b>58.1% → 62.7%</b></div></section>
        <aside class="card"><div class="card-head">质量与解释</div><div class="card-body"><div class="notice rule"><div class="notice-title">随访缺失可能造成偏倚</div>180 天无门诊记录者不能直接视为未达标；建议进行缺失机制分析和敏感性分析。</div><div v-for="row in [['数据截止','2026-06-30'],['队列/指标','v6 / BP-CONTROL v3'],['小样本抑制','已启用'],['复算状态','通过'],['AI 衍生变量','0 项'],['统计脚本','analysis-plan v4']]" :key="row[0]" class="folder-row"><span>{{ row[0] }}</span><strong>{{ row[1] }}</strong></div></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="methodologyOpen" title="统计口径与可复算证据" description="该快照只包含去标识聚合结果；队列版本、指标版本、数据水位和统计脚本同步固化。"><div class="admin-form"><div class="notice info"><div class="notice-title">STAT-20260813-09</div>口径为 BP-CONTROL v3；小样本抑制已启用；未使用 AI 衍生变量。</div></div><template #footer="{ close }"><button class="button primary" @click="close">我已知悉</button></template></AdminActionDialog>
  </section>
</template>

<style scoped>
.research-stats-page{display:grid;gap:14px}.research-metrics{margin:0}.research-analysis-grid{display:grid;grid-template-columns:1fr 1fr 320px;gap:12px}.bar-chart{height:280px;display:flex;align-items:flex-end;justify-content:space-around;padding:28px 18px}.bar-chart>div{height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:7px}.bar-chart i{display:block;width:38px;background:linear-gradient(#4b92e4,#1769e0);border-radius:5px 5px 0 0}.bar-chart span,.bar-chart b{font-size:11px}.line-chart-mock{height:280px;display:grid;place-items:center;background:linear-gradient(#fff,#f6faff)}.line-points{font-size:42px;color:var(--blue);letter-spacing:6px}.line-chart-mock span,.line-chart-mock b{font-size:11px}@media(max-width:1280px){.research-analysis-grid{grid-template-columns:1fr 1fr}.research-analysis-grid>aside{grid-column:1/3}}@media(max-width:760px){.research-analysis-grid{grid-template-columns:1fr}.research-analysis-grid>aside{grid-column:auto}}
</style>
