<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import {
  addDocumentSourceReference, clinicalContext, issueDocumentLease, loadCurrentDocument,
  loadDocumentSources, uploadDocumentAttachment,
} from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const busy = ref(false);
const attachmentInput = ref<HTMLInputElement | null>(null);
const commandMessage = ref('');
const commandError = ref('');
const selectedFile = ref<File | null>(null);
const attachmentTarget = ref('sections.present_illness');
const sourceType = ref<'DIAGNOSIS' | 'ORDER' | 'RESULT'>('RESULT');
const sourceResourceId = ref('');
const sourceTarget = ref('sections.assessment');
const sourceExcerpt = ref('');
const sourceQuery = useQuery({
  queryKey: ['clinical', 'record-sources'],
  queryFn: async () => {
    const lease = await issueDocumentLease();
    const document = await loadCurrentDocument(lease);
    return { lease, document, bundle: await loadDocumentSources(lease, document) };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => sourceQuery.error.value ? toClinicalIssue(sourceQuery.error.value) : null);
const editable = computed(() => sourceQuery.data.value?.document.status === 'DRAFT');
const staleCount = computed(() => sourceQuery.data.value?.bundle.references
  .filter((item) => item.freshness !== 'CURRENT').length ?? 0);

function selectAttachment(event: Event) {
  selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}
async function uploadAttachment() {
  const data = sourceQuery.data.value;
  if (!data || !selectedFile.value || busy.value) return;
  busy.value = true; commandError.value = ''; commandMessage.value = '';
  try {
    await uploadDocumentAttachment(data.lease, data.document, selectedFile.value, attachmentTarget.value);
    commandMessage.value = '附件已完成哈希、类型与恶意内容检查，并写入不可变来源链。';
    selectedFile.value = null;
    if (attachmentInput.value) attachmentInput.value.value = '';
    await sourceQuery.refetch();
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}
async function addSource() {
  const data = sourceQuery.data.value;
  if (!data || !sourceResourceId.value.trim() || busy.value) return;
  busy.value = true; commandError.value = ''; commandMessage.value = '';
  try {
    await addDocumentSourceReference(data.lease, data.document, sourceType.value,
      sourceResourceId.value.trim(), sourceTarget.value, sourceExcerpt.value);
    commandMessage.value = '来源已按当前权威版本固化；后续源数据变化将标记过期并阻断签署。';
    sourceResourceId.value = ''; sourceExcerpt.value = '';
    await sourceQuery.refetch();
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}
function formatBytes(bytes: number) { return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`; }
function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value)); }
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">病历主轴 / 来源证据</p><h1>病历来源与附件</h1></div><RouterLink class="button secondary" to="/record">返回病历工作台</RouterLink></div>
    <p class="record-center-intro">把诊断、医嘱、检验检查与外部附件固定到病历字段和精确版本；源变更后不会静默沿用旧质控结论。</p>
    <nav class="record-subnav" aria-label="病历二级导航"><RouterLink to="/record">病历工作台</RouterLink><RouterLink to="/opd-record">专注编辑</RouterLink><RouterLink class="active" to="/record-sources">来源与附件</RouterLink><RouterLink to="/record-qc">质控与审签</RouterLink><RouterLink to="/record-versions">版本证据</RouterLink></nav>
    <section class="patient-strip" aria-label="患者与就诊上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.patientName }}</strong><span>当前门诊就诊</span></div><dl><div><dt>患者标识</dt><dd>…{{ clinicalContext.patientId.slice(-6) }}</dd></div><div><dt>就诊标识</dt><dd>…{{ clinicalContext.encounterId.slice(-6) }}</dd></div><div><dt>工作域</dt><dd>病历中心 / 来源证据</dd></div></dl></section>
    <ClinicalPageState v-if="sourceQuery.isPending.value" kind="loading" message="正在校验文书、附件与来源版本" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="sourceQuery.refetch()" />
    <template v-else-if="sourceQuery.data.value">
      <section class="record-source-metrics" aria-label="来源证据指标"><article><span>附件</span><strong>{{ sourceQuery.data.value.bundle.attachments.length }}</strong><small>只读对象证据</small></article><article><span>来源引用</span><strong>{{ sourceQuery.data.value.bundle.references.length }}</strong><small>精确到字段</small></article><article :class="{ danger: staleCount > 0 }"><span>过期/缺失</span><strong>{{ staleCount }}</strong><small>{{ staleCount ? '必须重新质控' : '来源版本一致' }}</small></article><article><span>文书状态</span><strong>{{ sourceQuery.data.value.document.status }}</strong><small>{{ editable ? '可追加来源' : '证据已冻结' }}</small></article></section>
      <p v-if="commandMessage" class="record-command-message" role="status">{{ commandMessage }}</p><p v-if="commandError" class="record-command-error" role="alert">{{ commandError }}</p>
      <section v-if="!editable" class="record-source-lock"><strong>当前版本不可编辑</strong><span>仅当前草稿作者可添加附件或来源；已签文书不允许追加证据。</span></section>
      <div class="record-source-layout">
        <section class="record-source-main" aria-label="来源版本链"><header><div><h2>来源版本链</h2><p>展示记录时版本与当前权威版本</p></div><code>{{ sourceQuery.data.value.bundle.data_watermark.slice(0, 16) }}…</code></header><div v-if="sourceQuery.data.value.bundle.references.length === 0" class="record-source-empty">当前版本尚无外部来源引用。</div><article v-for="reference in sourceQuery.data.value.bundle.references" :key="reference.source_reference_id"><span class="source-kind">{{ reference.source_type }}</span><div><strong>{{ reference.display_label }}</strong><small>{{ reference.target_field_path }}</small><code>记录 {{ reference.source_version_ref }} · 当前 {{ reference.current_version_ref || 'MISSING' }}</code></div><span class="source-freshness" :class="reference.freshness.toLowerCase()">{{ reference.freshness }}</span></article></section>
        <aside class="record-source-actions" aria-label="来源证据操作"><section><h2>上传附件</h2><label>目标字段<select v-model="attachmentTarget" :disabled="!editable || busy"><option value="sections.present_illness">现病史</option><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option></select></label><label>文件<input ref="attachmentInput" type="file" :disabled="!editable || busy" accept=".pdf,.dcm,.jpg,.jpeg,.png,.txt,application/pdf,application/dicom,image/jpeg,image/png,text/plain" @change="selectAttachment"></label><small>最大 25 MiB；校验 SHA-256、MIME 特征与恶意内容。</small><button class="button primary" type="button" :disabled="!editable || busy || !selectedFile" @click="uploadAttachment">{{ busy ? '处理中…' : '校验并写入证据' }}</button></section>
          <section><h2>关联临床来源</h2><label>来源类型<select v-model="sourceType" :disabled="!editable || busy"><option value="DIAGNOSIS">诊断</option><option value="ORDER">医嘱</option><option value="RESULT">检验/检查结果</option></select></label><label>来源资源 ID<input v-model="sourceResourceId" :disabled="!editable || busy" placeholder="UUID" autocomplete="off"></label><label>目标字段<select v-model="sourceTarget" :disabled="!editable || busy"><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option><option value="sections.present_illness">现病史</option></select></label><label>引用摘要（仅存哈希）<textarea v-model="sourceExcerpt" :disabled="!editable || busy" rows="2"></textarea></label><button class="button secondary" type="button" :disabled="!editable || busy || !sourceResourceId.trim()" @click="addSource">固化当前版本</button></section></aside>
      </div>
      <section class="record-attachment-list" aria-label="不可变附件对象"><header><h2>附件对象</h2><span>不提供覆盖或删除入口</span></header><div v-if="sourceQuery.data.value.bundle.attachments.length === 0" class="record-source-empty">尚无附件。</div><article v-for="attachment in sourceQuery.data.value.bundle.attachments" :key="attachment.attachment_id"><div><strong>{{ attachment.original_filename }}</strong><small>{{ attachment.media_type }} · {{ formatBytes(attachment.byte_size) }} · {{ formatTime(attachment.created_at) }}</small></div><code>{{ attachment.content_hash.slice(0, 24) }}…</code><span>{{ attachment.storage_status }} / {{ attachment.malware_scan_status }}</span></article></section>
    </template>
  </main>
</template>
