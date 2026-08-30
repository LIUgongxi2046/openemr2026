<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { DocumentAttachmentWire, DocumentSourceReferenceWire } from '../../generated/contracts';
import {
  addDocumentSourceReference, correctDocumentSourceReference, issueDocumentLease,
  loadCurrentDocument, loadDocumentSources, revokeDocumentSourceReference, uploadDocumentAttachment,
  voidDocumentAttachment,
} from '../../clinical-api';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import RecordPatientStrip from '../components/RecordPatientStrip.vue';
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
const sourceDialog = ref<'attachment' | 'reference' | null>(null);
const evidenceDialog = ref<'reference-correction' | 'reference-revocation' | 'attachment-replacement' | 'attachment-void' | null>(null);
const selectedReference = ref<DocumentSourceReferenceWire | null>(null);
const selectedAttachment = ref<DocumentAttachmentWire | null>(null);
const lifecycleReason = ref('');
const correctedTarget = ref('sections.assessment');
const correctedExcerpt = ref('');
const replacementFile = ref<File | null>(null);
const replacementInput = ref<HTMLInputElement | null>(null);
const replacementTarget = ref('sections.present_illness');
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
  .filter((item) => !['REVOKED', 'SUPERSEDED'].includes(item.evidence_state) && item.freshness !== 'CURRENT').length ?? 0);

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
    sourceDialog.value = null;
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
    sourceDialog.value = null;
    await sourceQuery.refetch();
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}
function beginReferenceCorrection(reference: DocumentSourceReferenceWire) {
  selectedReference.value = reference;
  correctedTarget.value = reference.target_field_path;
  correctedExcerpt.value = '';
  lifecycleReason.value = '';
  evidenceDialog.value = 'reference-correction';
}
function beginReferenceRevocation(reference: DocumentSourceReferenceWire) {
  selectedReference.value = reference;
  lifecycleReason.value = '';
  evidenceDialog.value = 'reference-revocation';
}
function beginAttachmentReplacement(attachment: DocumentAttachmentWire) {
  selectedAttachment.value = attachment;
  replacementFile.value = null;
  lifecycleReason.value = '';
  evidenceDialog.value = 'attachment-replacement';
}
function beginAttachmentVoid(attachment: DocumentAttachmentWire) {
  selectedAttachment.value = attachment;
  lifecycleReason.value = '';
  evidenceDialog.value = 'attachment-void';
}
function selectReplacement(event: Event) {
  replacementFile.value = (event.target as HTMLInputElement).files?.[0] ?? null;
}
async function runLifecycle(action: () => Promise<unknown>, message: string) {
  if (busy.value) return;
  busy.value = true; commandError.value = ''; commandMessage.value = '';
  try {
    await action();
    commandMessage.value = message;
    evidenceDialog.value = null;
    selectedReference.value = null;
    selectedAttachment.value = null;
    await sourceQuery.refetch();
  } catch (error) {
    const failure = toClinicalIssue(error); commandError.value = `${failure.code}：${failure.message}`;
  } finally { busy.value = false; }
}
async function correctReference() {
  const data = sourceQuery.data.value;
  if (!data || !selectedReference.value || lifecycleReason.value.trim().length < 4) return;
  await runLifecycle(() => correctDocumentSourceReference(data.lease, data.document,
    selectedReference.value!.source_reference_id, correctedTarget.value, correctedExcerpt.value,
    lifecycleReason.value), '来源引用已追加更正事件；原始引用未被覆盖。');
}
async function revokeReference() {
  const data = sourceQuery.data.value;
  if (!data || !selectedReference.value || lifecycleReason.value.trim().length < 4) return;
  await runLifecycle(() => revokeDocumentSourceReference(data.lease, data.document,
    selectedReference.value!.source_reference_id, lifecycleReason.value),
  '来源引用已撤销并退出当前质控范围，原始证据继续保留。');
}
async function replaceAttachment() {
  const data = sourceQuery.data.value;
  if (!data || !selectedAttachment.value || !replacementFile.value || lifecycleReason.value.trim().length < 4) return;
  await runLifecycle(() => uploadDocumentAttachment(data.lease, data.document, replacementFile.value!,
    replacementTarget.value, { attachmentId: selectedAttachment.value!.attachment_id, reason: lifecycleReason.value }),
  '替换附件已写入；原附件被标记为已替换，文件与哈希仍可追溯。');
  if (replacementInput.value) replacementInput.value.value = '';
  replacementFile.value = null;
}
async function voidAttachment() {
  const data = sourceQuery.data.value;
  if (!data || !selectedAttachment.value || lifecycleReason.value.trim().length < 4) return;
  await runLifecycle(() => voidDocumentAttachment(data.lease, data.document,
    selectedAttachment.value!.attachment_id, lifecycleReason.value),
  '附件已业务作废并退出当前使用范围，存储对象与审计证据未删除。');
}
function formatBytes(bytes: number) { return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KiB`; }
function formatTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value)); }
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><h1>病历来源与证据中心</h1><p>逐条确认病历事实、报告版本、引用位置和过期状态</p></div><div class="toolbar-actions"><button class="btn" type="button" :disabled="busy" @click="sourceQuery.refetch()">刷新外部来源</button><RouterLink class="btn primary" to="/record-editor">返回编辑</RouterLink></div></div>
    <RecordPatientStrip />
    <ClinicalPageState v-if="sourceQuery.isPending.value" kind="loading" message="正在校验文书、附件与来源版本" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="sourceQuery.refetch()" />
    <template v-else-if="sourceQuery.data.value">
      <p v-if="commandMessage" class="record-command-message" role="status">{{ commandMessage }}</p><p v-if="commandError" class="record-command-error" role="alert">{{ commandError }}</p>
      <section v-if="!editable" class="record-source-lock"><strong>当前版本不可编辑</strong><span>仅当前草稿作者可添加附件或来源；已签文书不允许追加证据。</span></section>
      <div class="grid evidence-layout record-real-evidence">
        <section class="card" aria-label="来源版本链"><div class="toolbar"><select class="select" aria-label="来源类型"><option>全部来源类型</option></select><select class="select" aria-label="核验状态"><option>全部核验状态</option></select><input class="search" placeholder="来源、业务号或引用内容"><button class="btn" type="button" :disabled="!editable || busy" @click="sourceDialog = 'reference'">新建来源</button></div><div v-if="sourceQuery.data.value.bundle.references.length === 0" class="record-source-empty">当前版本尚无外部来源引用。</div><table v-else class="table"><thead><tr><th>来源</th><th>系统/版本</th><th>引用位置</th><th>状态</th><th></th></tr></thead><tbody><tr v-for="reference in sourceQuery.data.value.bundle.references" :key="reference.source_reference_id" :class="{ voided: ['REVOKED', 'SUPERSEDED'].includes(reference.evidence_state) }"><td><b>{{ reference.display_label }}</b><br><span class="meta">{{ reference.source_type }}</span></td><td>{{ reference.source_version_ref }}<br><span class="meta">当前 {{ reference.current_version_ref || 'MISSING' }}</span></td><td>{{ reference.target_field_path }}</td><td><span class="status" :class="reference.freshness === 'CURRENT' ? 'green' : 'red'">{{ reference.evidence_state }} / {{ reference.freshness }}</span></td><td><div class="record-row-actions"><button class="btn sm" type="button" :disabled="!editable || !['ACTIVE', 'CORRECTED'].includes(reference.evidence_state)" @click="beginReferenceCorrection(reference)">更正</button><button class="btn sm danger" type="button" :disabled="!editable || !['ACTIVE', 'CORRECTED'].includes(reference.evidence_state)" @click="beginReferenceRevocation(reference)">撤销</button></div></td></tr></tbody></table><div class="card-body"><div class="notice hard"><div class="notice-title">来源更正影响</div>{{ staleCount ? `${staleCount} 条来源已过期或缺失，相关“已处理”结论必须重新评估。` : '当前来源版本一致；任何后续更正都不会静默覆盖已签文书。' }}</div></div></section>
        <aside class="card"><div class="card-head">当前来源证据 · 实时</div><div class="card-body"><div class="source-preview"><span>病历来源链 · 当前文书</span><b>{{ sourceQuery.data.value.bundle.references.length }} 条来源 / {{ sourceQuery.data.value.bundle.attachments.length }} 个附件</b><p>证据水印 {{ sourceQuery.data.value.bundle.data_watermark.slice(0, 20) }}…<br>文书状态 {{ sourceQuery.data.value.document.status }}</p></div><div class="folder-row">患者/就诊<span>已核验</span></div><div class="folder-row">报告版本<span>{{ staleCount ? '需重核' : '当前有效' }}</span></div><div class="folder-row">完整性<span>{{ staleCount ? '存在失效来源' : '已对账' }}</span></div><div class="footer-actions"><button class="btn" type="button" :disabled="!editable || busy" @click="sourceDialog = 'attachment'">新建附件证据</button><button class="btn primary" type="button" :disabled="!editable || busy" @click="sourceDialog = 'reference'">确认并引用</button></div></div></aside>
      </div>
      <section class="record-attachment-list" aria-label="不可变附件对象"><header><h2>附件对象</h2><span>更新采用替换，删除采用业务作废</span></header><div v-if="sourceQuery.data.value.bundle.attachments.length === 0" class="record-source-empty">尚无附件。</div><article v-for="attachment in sourceQuery.data.value.bundle.attachments" :key="attachment.attachment_id" :class="{ voided: attachment.evidence_state !== 'ACTIVE' }"><div><strong>{{ attachment.original_filename }}</strong><small>{{ attachment.media_type }} · {{ formatBytes(attachment.byte_size) }} · {{ formatTime(attachment.created_at) }}</small><small>{{ attachment.evidence_state }}<template v-if="attachment.lifecycle_reason"> · {{ attachment.lifecycle_reason }}</template></small></div><code>{{ attachment.content_hash.slice(0, 24) }}…</code><span>{{ attachment.storage_status }} / {{ attachment.malware_scan_status }}</span><div class="record-row-actions"><button class="button secondary" type="button" :disabled="!editable || attachment.evidence_state !== 'ACTIVE'" @click="beginAttachmentReplacement(attachment)">替换</button><button class="button danger" type="button" :disabled="!editable || attachment.evidence_state !== 'ACTIVE'" @click="beginAttachmentVoid(attachment)">作废</button></div></article></section>
      <BusinessActionDialog :open="sourceDialog === 'attachment'" title="新建附件证据" description="附件一经写入不可覆盖或物理删除；服务端会校验文件大小、类型、哈希和恶意内容。" eyebrow="病历 / 来源证据" confirm-label="校验并写入证据" :busy="busy" @cancel="sourceDialog = null; selectedFile = null" @confirm="uploadAttachment"><label>目标字段<select v-model="attachmentTarget"><option value="sections.present_illness">现病史</option><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option></select></label><label>文件<input ref="attachmentInput" type="file" accept=".pdf,.dcm,.jpg,.jpeg,.png,.txt,application/pdf,application/dicom,image/jpeg,image/png,text/plain" @change="selectAttachment"></label><p class="dialog-warning">{{ selectedFile ? `${selectedFile.name} · ${formatBytes(selectedFile.size)}` : '请选择待校验文件' }}</p></BusinessActionDialog>
      <BusinessActionDialog :open="sourceDialog === 'reference'" title="新建临床来源引用" description="服务端将核验资源所属患者和就诊，并固化当前权威版本。" eyebrow="病历 / 来源证据" confirm-label="固化当前版本" :busy="busy" width="wide" @cancel="sourceDialog = null" @confirm="addSource"><div class="dialog-grid"><label>来源类型<select v-model="sourceType"><option value="DIAGNOSIS">诊断</option><option value="ORDER">医嘱</option><option value="RESULT">检验/检查结果</option></select></label><label>来源资源 ID<input v-model="sourceResourceId" placeholder="UUID" autocomplete="off"></label><label>目标字段<select v-model="sourceTarget"><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option><option value="sections.present_illness">现病史</option></select></label></div><label>引用摘要（仅存哈希）<textarea v-model="sourceExcerpt" rows="3"></textarea></label></BusinessActionDialog>
      <BusinessActionDialog :open="evidenceDialog === 'reference-correction'" title="更正来源引用" description="追加更正事件改变有效目标字段；原引用与历史字段仍保留。" eyebrow="病历 / 来源更正" confirm-label="追加更正证据" :busy="busy" :confirm-disabled="lifecycleReason.trim().length < 4" @cancel="evidenceDialog = null" @confirm="correctReference"><label>有效目标字段<select v-model="correctedTarget"><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option><option value="sections.present_illness">现病史</option></select></label><label>更正后的引用摘要<textarea v-model="correctedExcerpt" rows="3" /></label><label>更正原因（至少 4 字）<textarea v-model="lifecycleReason" rows="3" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="evidenceDialog === 'reference-revocation'" title="撤销来源引用" description="撤销后退出当前质控范围，但原引用与审计链保持不可变。" eyebrow="病历 / 来源撤销" confirm-label="确认撤销并留痕" danger :busy="busy" :confirm-disabled="lifecycleReason.trim().length < 4" @cancel="evidenceDialog = null" @confirm="revokeReference"><label>撤销原因（至少 4 字）<textarea v-model="lifecycleReason" rows="4" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="evidenceDialog === 'attachment-replacement'" title="替换附件证据" description="上传新的不可变对象，并把原附件标记为已替换。" eyebrow="病历 / 附件替换" confirm-label="上传替换并留痕" :busy="busy" :confirm-disabled="!replacementFile || lifecycleReason.trim().length < 4" @cancel="evidenceDialog = null" @confirm="replaceAttachment"><label>新附件<input ref="replacementInput" type="file" accept=".pdf,.dcm,.jpg,.jpeg,.png,.txt,application/pdf,application/dicom,image/jpeg,image/png,text/plain" @change="selectReplacement"></label><label>目标字段<select v-model="replacementTarget"><option value="sections.present_illness">现病史</option><option value="sections.assessment">评估/诊断</option><option value="sections.treatment_plan">治疗计划</option></select></label><label>替换原因（至少 4 字）<textarea v-model="lifecycleReason" rows="3" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="evidenceDialog === 'attachment-void'" title="作废附件证据" description="附件退出当前使用范围，但存储对象、哈希与审计证据不会删除。" eyebrow="病历 / 附件作废" confirm-label="确认作废并留痕" danger :busy="busy" :confirm-disabled="lifecycleReason.trim().length < 4" @cancel="evidenceDialog = null" @confirm="voidAttachment"><label>作废原因（至少 4 字）<textarea v-model="lifecycleReason" rows="4" /></label></BusinessActionDialog>
    </template>
  </section>
</template>
