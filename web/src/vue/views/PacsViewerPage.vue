<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueResultLease, listClinicalResults } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
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

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function abnormalLabel(value: string) { return ({ NORMAL: '正常', HIGH: '偏高', LOW: '偏低', CRITICAL_HIGH: '危急偏高', CRITICAL_LOW: '危急偏低' } as Record<string, string>)[value] || value; }
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">病历与病案 / PACS 影像报告</p><h1>PACS 影像调阅</h1></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/record-editor">引用关键结论</RouterLink><RouterLink class="button primary" to="/opd-results">返回结果工作台</RouterLink></div></div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>影像报告只读调阅 · 当前门诊就诊</span></div><dl>
        <div><dt>报告类型</dt><dd>IMAGING 影像</dd></div>
        <div><dt>已签发</dt><dd>{{ finalCount }} 份</dd></div>
        <div><dt>图像可用性</dt><dd>依赖 DICOM 连接器</dd></div></dl>
      <span class="lease-badge">当前患者 / 当前就诊</span></section>
    <ClinicalPageState v-if="resultsQuery.isPending.value" kind="loading" message="正在加载影像报告" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="resultsQuery.refetch()" />
    <div v-else class="result-layout">
      <section class="result-list">
        <div v-if="imagingReports.length === 0" class="empty-state result-empty"><span>影</span><p>当前就诊尚无 PACS 影像报告</p><small>影像报告由结果工作台录入或 RIS/DICOM 授权工作流回传后在此调阅。</small></div>
        <article v-for="result in imagingReports" :key="result.result_id" class="result-card">
          <header><div><span class="result-type imaging">{{ result.report_type }}</span><strong>{{ result.conclusion }}</strong><small>{{ result.source_system }} · 来源键 …{{ result.source_report_key.slice(-8) }} · 报告 v{{ result.version_no }} · {{ formatDate(result.reported_at) }}</small></div><span class="task-state" :class="result.report_status.toLowerCase()">{{ result.report_status === 'CORRECTED' ? '已更正' : '已签发' }}</span></header>
          <div class="result-observations"><div v-for="observation in result.observations" :key="observation.observation_id"><b>{{ observation.item_name }}</b><span>{{ observation.numeric_value ?? observation.text_value }} {{ observation.unit }}</span><small>{{ observation.reference_low ?? '—' }} – {{ observation.reference_high ?? '—' }}</small><em class="result-flag" :class="observation.abnormal_flag.toLowerCase()">{{ abnormalLabel(observation.abnormal_flag) }}</em></div></div>
          <footer><span>水印 {{ result.data_watermark.slice(0, 12) }}… · 原医嘱 …{{ result.order_id.slice(-8) }}</span><RouterLink class="task-action" to="/record-editor">引用关键结论</RouterLink></footer>
        </article>
      </section>
      <aside class="side-card result-safety"><div class="side-card-title"><h2>影像调阅边界</h2><span>3</span></div>
        <ul style="padding-left: 18px; margin: 12px 0 0; color: #526275; font-size: 12px; line-height: 1.75;">
          <li>影像报告与 DICOM 图像实例可用性分别呈现。</li>
          <li>调阅须在授权会话与患者上下文内，来源状态受控。</li>
          <li>真实 DICOMweb/WADO-RS 图像服务属于待授权集成适配器。</li>
        </ul>
        <div class="archive-truth-note" style="margin-top: 14px"><strong>当前能力边界</strong><span>本页连接真实结果报告 API；像素级影像调阅依赖后续 DICOM 连接器授权。</span></div></aside>
    </div>
  </section>
</template>
