<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { issueConfigurationLease, listConfigurations } from '../../api/config';
import QualityGovernanceOverview from '../components/QualityGovernanceOverview.vue';
import { toClinicalIssue } from '../clinical-error';
import { downloadQualityCsv, type QualityOverviewMetric, type QualityOverviewRow } from '../quality-overview';

const router = useRouter();
const leaseQuery = useQuery({ queryKey: ['quality-overview', 'department-qc', 'lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 5 * 60_000 });
const itemsQuery = useQuery({ queryKey: ['quality-overview', 'department-qc'], queryFn: () => listConfigurations(leaseQuery.data.value!, 'DEPARTMENT_QC_CASE'), enabled: () => Boolean(leaseQuery.data.value), retry: false, staleTime: 0 });
const items = computed(() => itemsQuery.data.value ?? []);
const payload = (item: (typeof items.value)[number]) => item.payload as Record<string, unknown>;
const isOpen = (item: (typeof items.value)[number]) => String(payload(item).workflow_status) !== 'CLOSED';
const open = computed(() => items.value.filter(isOpen));
const blocking = computed(() => open.value.filter((item) => payload(item).severity === 'BLOCKING'));
const overdue = computed(() => open.value.filter((item) => payload(item).due_at && new Date(String(payload(item).due_at)).getTime() < Date.now()));
const closedRate = computed(() => items.value.length ? ((items.value.length - open.value.length) / items.value.length * 100).toFixed(1) : '0.0');
const traceable = computed(() => items.value.filter((item) => payload(item).china_policy_basis && payload(item).source_reference));
const traceabilityRate = computed(() => items.value.length ? (traceable.value.length / items.value.length * 100).toFixed(1) : '0.0');
const metrics = computed<QualityOverviewMetric[]>(() => [
  { label: '待整改缺陷', value: open.value.length, hint: '可下钻到业务对象' },
  { label: '阻断缺陷', value: blocking.value.length, hint: '可下钻到业务对象' },
  { label: '逾期工单', value: overdue.value.length, hint: '可下钻到业务对象' },
  { label: '闭环率', value: `${closedRate.value}%`, hint: '可下钻到业务对象' },
]);
const rows = computed<QualityOverviewRow[]>(() => [
  { object: '高风险待办', keyData: String(blocking.value.length), progress: `${open.value.length} 项开放缺陷`, status: blocking.value.length ? '需处理' : '正常', tone: blocking.value.length ? 'red' : 'green' },
  { object: '制度与来源可追溯率', keyData: `${traceabilityRate.value}%`, progress: `${traceable.value.length}/${items.value.length} 项同时具备制度依据与来源`, status: Number(traceabilityRate.value) >= 100 ? '正常' : '待补齐', tone: Number(traceabilityRate.value) >= 100 ? 'green' : 'yellow' },
  { object: '本期闭环率', keyData: `${closedRate.value}%`, progress: `已闭环 ${items.value.length - open.value.length} 项`, status: Number(closedRate.value) >= 96 ? '达标' : '观察', tone: Number(closedRate.value) >= 96 ? 'green' : 'blue' },
]);
const issue = computed(() => leaseQuery.error.value ?? itemsQuery.error.value ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value).message : '');
function exportItems() { downloadQualityCsv(`院科质控整改清单-${new Date().toISOString().slice(0, 10)}.csv`, ['编码', '名称', '责任人', '范围', '风险', '状态', '时限'], items.value.map((item) => [item.config_key, item.display_name, payload(item).owner as string, payload(item).scope as string, payload(item).severity as string, payload(item).workflow_status as string, payload(item).due_at as string])); }
</script>

<template>
  <QualityGovernanceOverview title="院科病历质控与整改" description="按院区、科室、病区、文书类型和责任人管理运行质控、终末质控与整改复核" :metrics="metrics" :rows="rows" :workflow="['定义抽样范围','运行规则/人工抽查','分派缺陷','临床人员更正文书','质控复核闭环']" :warning="`${blocking.length} 份病历存在终末质控阻断`" safety-text="此页面只管理缺陷和整改任务；点击具体病历后跨域进入病历中心，不在质量中心直接修改临床原文。" export-label="导出整改清单" primary-label="创建质控抽查" detail-label="跨域：进入病历中心整改" :loading="leaseQuery.isPending.value || itemsQuery.isPending.value" :error="issue" @export="exportItems" @primary="router.push('/department-qc/cases?create=1')" @detail="router.push('/record')" @retry="itemsQuery.refetch()" />
</template>
