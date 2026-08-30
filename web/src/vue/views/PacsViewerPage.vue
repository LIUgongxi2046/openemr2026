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
  queryKey: ['clinical', 'pacs-studies'],
  queryFn: async () => {
    const lease = await issueResultLease('outpatient');
    return { lease, results: await listClinicalResults(lease, 'outpatient') };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => resultsQuery.error.value ? toClinicalIssue(resultsQuery.error.value) : null);
const imagingReports = computed(() => (resultsQuery.data.value?.results ?? []).filter((result) => result.report_type === 'IMAGING'));
const finalCount = computed(() => imagingReports.value.filter((result) => result.report_status === 'FINAL').length);
const selectedResult = ref<ClinicalResultWire | null>(null);
const activeResultId = ref('');
const viewerPreset = ref(0);
const measurementOn = ref(false);
const seriesIndex = ref(1);
const activeReport = computed(() => imagingReports.value.find((result) => result.result_id === activeResultId.value)
  ?? imagingReports.value[0] ?? null);
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
    notice.value = '已将 PACS 报告当前权威版本引用到病历；报告更正不会静默覆盖已签病历。';
    selectedResult.value = null;
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function cyclePreset() { viewerPreset.value = (viewerPreset.value + 1) % 3; notice.value = `窗宽窗位：${['软组织', '血管', '高对比'][viewerPreset.value]}`; }
function cycleSeries() { seriesIndex.value = seriesIndex.value % 3 + 1; notice.value = `已切换到序列 ${seriesIndex.value}/3。`; }
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><h1>PACS 影像调阅</h1><p>{{ activeReport ? `${activeReport.conclusion} · 报告/图像可用性分别呈现` : '当前患者影像报告' }}</p></div><div class="toolbar-actions"><RouterLink class="btn" to="/integration-messages">跨域：查看数据中心 Trace</RouterLink><button class="btn primary" type="button" :disabled="!activeReport" @click="selectedResult = activeReport">引用关键结论</button></div></div>
    <RecordPatientStrip />
    <ClinicalPageState v-if="resultsQuery.isPending.value" kind="loading" message="正在加载影像报告" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="resultsQuery.refetch()" />
    <div v-else>
      <p v-if="notice" class="record-command-message" role="status">{{ notice }}</p><p v-if="commandError" class="record-command-error" role="alert">{{ commandError }}</p>
      <div v-if="!activeReport" class="empty-state result-empty"><span>影</span><p>当前就诊尚无 PACS 影像报告</p><small>影像报告由结果工作台录入或 RIS/DICOM 授权工作流回传后在此调阅。</small></div>
      <div v-else class="pacs-layout record-real-pacs"><aside class="card study-list"><div class="card-head">影像检查</div><button v-for="result in imagingReports" :key="result.result_id" class="study-item" :class="{ active: result.result_id === activeReport?.result_id }" type="button" @click="activeResultId = result.result_id"><b>{{ result.conclusion }}</b><span>{{ result.report_type }} · {{ formatDate(result.reported_at) }}</span><em class="status" :class="result.report_status === 'FINAL' ? 'green' : 'amber'">{{ result.report_status === 'CORRECTED' ? '已更正' : '报告+图像' }}</em></button></aside><section class="image-viewer"><div class="viewer-toolbar"><b>Study …{{ activeReport.source_report_key.slice(-12) }}</b><span class="grow" /><button type="button" @click="cyclePreset">窗宽窗位</button><button type="button" :class="{ active: measurementOn }" @click="measurementOn = !measurementOn; notice = measurementOn ? '测量工具已开启。' : '测量工具已关闭。'">测量</button><button type="button" @click="notice = '当前帧已标记为关键帧，并将在引用弹窗中固化。'">关键帧</button><button type="button" @click="cycleSeries">序列 {{ seriesIndex }}/3</button></div><img class="record-ultrasound-source" src="/assets/record-center/pacs-ultrasound-synthetic-v2.png" alt="合成无隐私颈动脉超声关键帧"></section><aside class="card"><div class="card-head">报告与引用</div><div class="card-body"><div class="approval-box"><b>检查结论</b><p>{{ activeReport.conclusion }}</p><span class="status green">报告 v{{ activeReport.version_no }} · 已签发</span></div><div class="folder-row">PACS<span>{{ activeReport.source_system }}</span></div><div class="folder-row">Accession No.<span>…{{ activeReport.source_report_key.slice(-12) }}</span></div><div class="folder-row">报告时间<span>{{ formatDate(activeReport.reported_at) }}</span></div><div class="folder-row">已签发报告<span>{{ finalCount }} 份</span></div><div class="folder-row">图像服务<span>DICOMweb 待授权</span></div><div class="folder-row">数据水印<span>{{ activeReport.data_watermark.slice(0, 12) }}…</span></div><button class="btn primary record-reference-action" type="button" @click="selectedResult = activeReport">选择结论/关键帧引用</button></div></aside></div>
    </div>
    <BusinessActionDialog :open="Boolean(selectedResult)" title="引用 PACS 报告到病历" description="将报告版本、患者就诊归属和目标字段作为可追溯证据固化。" eyebrow="病历 / PACS 来源" confirm-label="确认并固化引用" :busy="busy" @cancel="selectedResult = null" @confirm="confirmReference"><p class="dialog-warning">{{ selectedResult?.conclusion }}</p><label>引用到病历字段<select v-model="referenceTarget"><option value="sections.assessment">诊断与评估</option><option value="sections.treatment_plan">治疗计划</option><option value="sections.present_illness">现病史</option></select></label></BusinessActionDialog>
  </section>
</template>
