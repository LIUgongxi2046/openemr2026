<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueResultLease, listClinicalResults } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
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

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function abnormalLabel(value: string) { return ({ NORMAL: '正常', HIGH: '偏高', LOW: '偏低', CRITICAL_HIGH: '危急偏高', CRITICAL_LOW: '危急偏低' } as Record<string, string>)[value] || value; }
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">病历与病案 / LIS 检验报告</p><h1>LIS 检验报告调阅</h1></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/record-editor">引用到病历</RouterLink><RouterLink class="button primary" to="/opd-results">返回结果工作台</RouterLink></div></div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>检验报告只读调阅 · 当前门诊就诊</span></div><dl>
        <div><dt>报告类型</dt><dd>LAB 检验</dd></div>
        <div><dt>危急值</dt><dd>接收 ≠ 处置</dd></div>
        <div><dt>来源关联</dt><dd>医嘱 / 执行 / 来源键</dd></div></dl>
      <span class="lease-badge">当前患者 / 当前就诊</span></section>
    <ClinicalPageState v-if="resultsQuery.isPending.value" kind="loading" message="正在加载检验报告" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="resultsQuery.refetch()" />
    <div v-else class="result-layout">
      <section class="result-list">
        <div v-if="labReports.length === 0" class="empty-state result-empty"><span>检</span><p>当前就诊尚无 LIS 检验报告</p><small>报告由结果工作台录入或 LIS 授权工作流回传后在此调阅。</small></div>
        <article v-for="result in labReports" :key="result.result_id" class="result-card">
          <header><div><span class="result-type">{{ result.report_type }}</span><strong>{{ result.conclusion }}</strong><small>{{ result.source_system }} · 来源键 …{{ result.source_report_key.slice(-8) }} · 报告 v{{ result.version_no }} · {{ formatDate(result.reported_at) }}</small></div><span class="task-state" :class="result.report_status.toLowerCase()">{{ result.report_status === 'CORRECTED' ? '已更正' : '已签发' }}</span></header>
          <div class="result-observations"><div v-for="observation in result.observations" :key="observation.observation_id"><b>{{ observation.item_name }}</b><span>{{ observation.numeric_value ?? observation.text_value }} {{ observation.unit }}</span><small>{{ observation.reference_low ?? '—' }} – {{ observation.reference_high ?? '—' }}</small><em class="result-flag" :class="observation.abnormal_flag.toLowerCase()">{{ abnormalLabel(observation.abnormal_flag) }}</em></div></div>
          <section v-for="critical in result.critical_values" :key="critical.critical_value_id" class="critical-panel" :class="critical.state.toLowerCase()"><header><strong>危急值责任闭环</strong><span>{{ critical.state === 'OPEN' ? '待接收' : critical.state === 'ACKNOWLEDGED' ? '已接收·待处置' : '已处置' }}</span></header><p style="margin: 8px 12px; color: #526275; font-size: 11px;">此处为只读调阅；“查看”不等于接收，接收与处置在结果工作台完成。</p></section>
          <footer><span>水印 {{ result.data_watermark.slice(0, 12) }}… · 原医嘱 …{{ result.order_id.slice(-8) }}</span><RouterLink class="task-action" to="/record-editor">引用到病历</RouterLink></footer>
        </article>
      </section>
      <aside class="side-card result-safety"><div class="side-card-title"><h2>调阅安全边界</h2><span>3</span></div>
        <ul style="padding-left: 18px; margin: 12px 0 0; color: #526275; font-size: 12px; line-height: 1.75;">
          <li>报告必须关联正确患者、就诊、医嘱和已完成执行。</li>
          <li>危急值“查看”不等于接收，责任闭环在结果工作台。</li>
          <li>更正只追加版本，原报告保持可追溯。</li>
        </ul>
        <div v-if="criticalOpenCount" class="archive-truth-note" style="margin-top: 14px"><strong>待接收危急值 {{ criticalOpenCount }} 项</strong><span>请到结果工作台完成复读确认与临床处置。</span></div></aside>
    </div>
  </main>
</template>
