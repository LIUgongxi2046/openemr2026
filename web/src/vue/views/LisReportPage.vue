<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { ClinicalResultWire } from '../../generated/contracts';
import { addDocumentSourceReference, issueDocumentLease, issueResultLease, listClinicalResults, loadCurrentDocument } from '../../clinical-api';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import RecordPatientStrip from '../components/RecordPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const resultsQuery = useQuery({
  queryKey: ['clinical', 'lis-reports'],
  queryFn: async () => {
    const lease = await issueResultLease('outpatient');
    return { lease, results: await listClinicalResults(lease, 'outpatient') };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => resultsQuery.error.value ? toClinicalIssue(resultsQuery.error.value) : null);
const labReports = computed(() => (resultsQuery.data.value?.results ?? []).filter((result) => result.report_type === 'LAB'));
const criticalOpenCount = computed(() => labReports.value.reduce((sum, result) => sum + result.critical_values.filter((critical) => critical.state === 'OPEN').length, 0));
const activeResultId = ref('');
const activeReport = computed(() => labReports.value.find((result) => result.result_id === activeResultId.value)
  ?? labReports.value[0] ?? null);
const selectedResult = ref<ClinicalResultWire | null>(null);
const referenceTarget = ref('sections.assessment');
const busy = ref(false);
const notice = ref('');
const commandError = ref('');

async function confirmReference() {
  if (!selectedResult.value || busy.value) return;
  busy.value = true; notice.value = ''; commandError.value = '';
  try {
    const lease = await issueDocumentLease();
    const document = await loadCurrentDocument(lease);
    await addDocumentSourceReference(lease, document, 'RESULT', selectedResult.value.result_id,
      referenceTarget.value, selectedResult.value.conclusion);
    notice.value = '已将 LIS 报告当前权威版本引用到病历；报告后续更正会使引用失效并触发重新质控。';
    selectedResult.value = null;
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function abnormalLabel(value: string) { return ({ NORMAL: '正常', HIGH: '偏高', LOW: '偏低', CRITICAL_HIGH: '危急偏高', CRITICAL_LOW: '危急偏低' } as Record<string, string>)[value] || value; }
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><h1>LIS 检验报告调阅</h1><p>{{ activeReport ? `${activeReport.conclusion} · 报告 v${activeReport.version_no}` : '当前患者检验报告' }}</p></div><div class="toolbar-actions"><RouterLink class="btn" to="/integration-messages">跨域：查看数据中心消息链</RouterLink><button class="btn primary" type="button" :disabled="!activeReport" @click="selectedResult = activeReport">引用到病历</button></div></div>
    <RecordPatientStrip />
    <ClinicalPageState v-if="resultsQuery.isPending.value" kind="loading" message="正在加载检验报告" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="resultsQuery.refetch()" />
    <div v-else>
      <p v-if="notice" class="record-command-message" role="status">{{ notice }}</p><p v-if="commandError" class="record-command-error" role="alert">{{ commandError }}</p>
      <div v-if="!activeReport" class="empty-state result-empty"><span>检</span><p>当前就诊尚无 LIS 检验报告</p><small>报告由结果工作台录入或 LIS 授权工作流回传后在此调阅。</small></div>
      <div v-else class="grid report-layout record-real-report"><aside class="card study-list"><div class="card-head">检验报告</div><button v-for="report in labReports" :key="report.result_id" class="study-item" :class="{ active: report.result_id === activeReport?.result_id }" type="button" @click="activeResultId = report.result_id"><b>{{ report.conclusion }}</b><span>{{ report.source_system }} · {{ formatDate(report.reported_at) }}</span><em class="status" :class="report.report_status === 'FINAL' ? 'green' : 'amber'">{{ report.report_status === 'CORRECTED' ? '已更正' : '已审核' }} v{{ report.version_no }}</em></button></aside><section class="card"><div class="card-head">检验报告当前权威版本 <span class="status green">{{ activeReport.report_status === 'CORRECTED' ? '已更正' : '已审核' }} · v{{ activeReport.version_no }}</span></div><table class="table lab-table"><thead><tr><th>项目</th><th>结果</th><th>标志</th><th>单位</th><th>参考范围</th><th>方法</th></tr></thead><tbody><tr v-for="observation in activeReport.observations" :key="observation.observation_id" :class="{ 'result-alert': observation.abnormal_flag !== 'NORMAL' }"><td><b>{{ observation.item_name }}</b></td><td>{{ observation.numeric_value ?? observation.text_value }}</td><td>{{ abnormalLabel(observation.abnormal_flag) }}</td><td>{{ observation.unit || '—' }}</td><td>{{ observation.reference_low ?? '—' }}–{{ observation.reference_high ?? '—' }}</td><td>源报告未提供</td></tr></tbody></table><div class="card-body"><div v-if="criticalOpenCount" class="notice hard"><div class="notice-title">待接收危急值 {{ criticalOpenCount }} 项</div>查看不等于接收；请到结果工作台完成复读确认与临床处置。</div></div></section><aside class="card"><div class="card-head">申请—执行—报告证据</div><div class="card-body"><div class="folder-row">申请<span>…{{ activeReport.order_id.slice(-8) }}</span></div><div class="folder-row">执行任务<span>…{{ activeReport.execution_task_id.slice(-8) }}</span></div><div class="folder-row">报告时间<span>{{ formatDate(activeReport.reported_at) }}</span></div><div class="folder-row">来源系统<span>{{ activeReport.source_system }}</span></div><div class="folder-row">报告版本<span>v{{ activeReport.version_no }}</span></div><div class="folder-row">业务对账<span>后端已校验患者/就诊/医嘱/执行</span></div><div class="folder-row">来源键<span>…{{ activeReport.source_report_key.slice(-8) }}</span></div><div class="notice rule"><div class="notice-title">临床处置待办</div>异常结果需要医生确认；报告更正只追加版本，不覆盖既往引用。</div><button class="btn primary record-reference-action" type="button" @click="selectedResult = activeReport">确认并作为来源</button></div></aside></div>
    </div>
    <BusinessActionDialog :open="Boolean(selectedResult)" title="引用 LIS 报告到病历" description="将固化报告的当前权威版本、患者就诊归属与目标字段，不是复制一段无来源文本。" eyebrow="病历 / LIS 来源" confirm-label="确认并固化引用" :busy="busy" @cancel="selectedResult = null" @confirm="confirmReference"><p class="dialog-warning">{{ selectedResult?.conclusion }}</p><label>引用到病历字段<select v-model="referenceTarget"><option value="sections.assessment">诊断与评估</option><option value="sections.treatment_plan">治疗计划</option><option value="sections.present_illness">现病史</option></select></label></BusinessActionDialog>
  </section>
</template>
