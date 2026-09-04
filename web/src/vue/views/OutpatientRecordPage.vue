<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query';
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import type { AIProposalWire, DocumentVersionWire, QualityFindingWire } from '../../generated/contracts';

import {
  ClinicalApiError,
  decideProposal,
  loadCurrentDocument,
  runQualityChecks,
  saveDocumentDraft,
  signDocument,
  startAiDraft,
} from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import {
  clearSecureDocumentDraft,
  clinicalJsonSnapshot,
  clinicalContextFingerprint,
  loadSecureDocumentDraft,
  saveSecureDocumentDraft,
  type SecureDocumentDraft,
} from '../../secure-draft-cache';
import AgentInlineReview from '../components/AgentInlineReview.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { useCurrentDocument } from '../composables/use-current-document';

const sectionFields = [
  ['chief_complaint', '主诉', 3],
  ['present_illness', '现病史', 6],
  ['assessment', '诊断与评估', 3],
  ['treatment_plan', '治疗与随访计划', 3],
] as const;
const configuredAutosaveDelay = Number(import.meta.env.VITE_AUTOSAVE_DELAY_MS);
const autosaveDelayMs = import.meta.env.DEV && Number.isFinite(configuredAutosaveDelay)
  ? Math.min(5000, Math.max(100, configuredAutosaveDelay))
  : 800;

const current = useCurrentDocument();
const queryClient = useQueryClient();
const sections = ref<Record<string, unknown>>({});
const findings = ref<QualityFindingWire[]>([]);
const proposal = ref<AIProposalWire | null>(null);
const assistantOpen = ref(true);
const busy = ref<string | null>(null);
const notice = ref('');
const warningDisposition = ref('已核对警告，不影响本次签署');
const saveState = ref<'idle' | 'dirty' | 'autosaving' | 'saved' | 'offline' | 'conflict' | 'error' | 'signed'>('idle');
const lastSavedAt = ref('');
const secureStorageId = ref('');
const contextFingerprint = ref('');
const recoveryDraft = ref<SecureDocumentDraft | null>(null);
const conflictRemote = ref<DocumentVersionWire | null>(null);
const conflictLocal = ref<Record<string, unknown>>({});
const conflictBaseVersionId = ref('');
const editGeneration = ref(0);
const issue = computed(() => current.error.value ? toClinicalIssue(current.error.value) : null);
const document = computed(() => current.data.value?.document);
const hasUnsavedChanges = computed(() => ['dirty', 'autosaving', 'offline', 'conflict', 'error'].includes(saveState.value));
const saveStateLabel = computed(() => ({
  idle: '正在准备安全草稿', dirty: '有未保存更改', autosaving: '正在自动保存…', saved: '已自动保存',
  offline: '离线 · 加密草稿已保留', conflict: '版本冲突 · 禁止覆盖', error: '保存失败 · 草稿已保留', signed: '已签署只读',
})[saveState.value]);
const conflictFields = computed(() => {
  const remoteSections = conflictRemote.value?.sections ?? {};
  return sectionFields.filter(([field]) =>
    String(conflictLocal.value[field] ?? '') !== String(remoteSections[field] ?? ''));
});
const agentPatientId = computed(() => current.data.value?.lease.patient_id ?? null);
const agentEncounterId = computed(() => current.data.value?.lease.encounter_id ?? null);
const outpatientDraftObjective = computed(() => '基于当前门诊就诊信息起草病历文书候选，仅供医生审阅后采用，不自动写入。');

let debounceTimer: ReturnType<typeof setTimeout> | undefined;
let maximumTimer: ReturnType<typeof setTimeout> | undefined;
let saveInFlight = false;
let composing = false;

watch(() => current.data.value?.document.document_id, async (nextDocumentId, previousDocumentId) => {
  const next = current.data.value?.document;
  if (!next) return;
  clearAutosaveTimers();
  if (previousDocumentId && previousDocumentId !== nextDocumentId && secureStorageId.value) {
    await clearSecureCopyQuietly(secureStorageId.value);
  }
  sections.value = { ...next.sections };
  editGeneration.value = 0;
  conflictRemote.value = null;
  recoveryDraft.value = null;
  saveState.value = next.status === 'SIGNED' ? 'signed' : 'saved';
  const fingerprint = await clinicalContextFingerprint([
    current.data.value?.lease.tenant_id ?? '', current.data.value?.lease.patient_id ?? '',
    current.data.value?.lease.encounter_id ?? '', next.document_id,
  ]);
  contextFingerprint.value = fingerprint;
  secureStorageId.value = `document-${fingerprint}`;
  if (next.status !== 'DRAFT') {
    await clearSecureCopyQuietly(secureStorageId.value);
    return;
  }
  try {
    const recovered = await loadSecureDocumentDraft(secureStorageId.value, fingerprint);
    if (recovered && JSON.stringify(recovered.sections) !== JSON.stringify(next.sections)) recoveryDraft.value = recovered;
  } catch {
    saveState.value = 'error';
    notice.value = '当前浏览器无法启用会话级加密草稿，已停止自动保存；请检查浏览器存储策略后重试。';
  }
}, { immediate: true });

onMounted(() => {
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  window.addEventListener('beforeunload', handleBeforeUnload);
});
onBeforeUnmount(() => {
  clearAutosaveTimers();
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
  window.removeEventListener('beforeunload', handleBeforeUnload);
});

async function execute(label: string, action: () => Promise<void>) {
  busy.value = label;
  notice.value = '';
  try {
    await action();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = null;
  }
}

function replaceCurrentDocument(nextDocument: NonNullable<typeof document.value>) {
  if (!current.data.value) return;
  queryClient.setQueryData([
    'clinical',
    'current-document',
    current.data.value.lease.patient_id,
    current.data.value.lease.encounter_id,
  ], {
    lease: current.data.value.lease,
    document: nextDocument,
  });
}

function save() {
  void persistDraft(true);
}

function checkQuality() {
  const snapshot = current.data.value;
  if (!snapshot) return;
  void execute('quality', async () => {
    findings.value = await runQualityChecks(snapshot.lease, snapshot.document);
    notice.value = findings.value.length === 0 ? '确定性质控通过，可以进入签署' : `发现 ${findings.value.length} 项待处理问题`;
  });
}

function askAi() {
  const snapshot = current.data.value;
  if (!snapshot) return;
  void execute('ai', async () => {
    const run = await startAiDraft(snapshot.lease, snapshot.document);
    proposal.value = run.proposals[0] ?? null;
    assistantOpen.value = true;
    notice.value = run.state === 'DEGRADED' ? 'AI 当前不可用，病历主链仍可手工完成' : 'AI 候选已生成，尚未写入病历';
  });
}

function decide(decision: 'ACCEPTED' | 'REJECTED') {
  const snapshot = current.data.value;
  if (!snapshot || !proposal.value) return;
  void execute('proposal', async () => {
    const next = await decideProposal(snapshot.lease, proposal.value!, decision);
    proposal.value = next;
    const proposedSections = next.payload.sections;
    if (decision === 'ACCEPTED' && proposedSections && typeof proposedSections === 'object' && !Array.isArray(proposedSections)) {
      sections.value = { ...proposedSections as Record<string, unknown> };
      markDirty();
      notice.value = 'AI 候选已由医生接受到编辑区，正在进入自动保存；仍需重新质控';
    } else {
      notice.value = 'AI 候选已拒绝，病历未发生变化';
    }
  });
}

function sign() {
  const snapshot = current.data.value;
  if (!snapshot) return;
  void execute('sign', async () => {
    const evidence = await signDocument(snapshot.lease, snapshot.document, warningDisposition.value);
    notice.value = `签署证据已创建：${evidence.signature_status}`;
    if (secureStorageId.value) await clearSecureCopyQuietly(secureStorageId.value);
    await current.refetch();
    await queryClient.invalidateQueries({ queryKey: ['clinical', 'record-governance'] });
  });
}

function updateSection(field: string, event: Event) {
  sections.value = {
    ...sections.value,
    [field]: (event.target as HTMLTextAreaElement).value,
  };
  markDirty();
}

function compositionStart() {
  composing = true;
}

function compositionEnd() {
  composing = false;
  scheduleAutosave();
}

function markDirty() {
  if (document.value?.status !== 'DRAFT' || saveState.value === 'conflict') return;
  editGeneration.value += 1;
  saveState.value = navigator.onLine ? 'dirty' : 'offline';
  findings.value = [];
  proposal.value = null;
  void persistSecureCopy();
  scheduleAutosave();
}

function scheduleAutosave(delay = autosaveDelayMs) {
  if (composing || saveState.value === 'conflict' || document.value?.status !== 'DRAFT') return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => void persistDraft(false), delay);
  maximumTimer ??= setTimeout(() => void persistDraft(false), 5000);
}

function clearAutosaveTimers() {
  if (debounceTimer) clearTimeout(debounceTimer);
  if (maximumTimer) clearTimeout(maximumTimer);
  debounceTimer = undefined;
  maximumTimer = undefined;
}

async function persistSecureCopy(): Promise<boolean> {
  const snapshot = current.data.value;
  if (!snapshot || !secureStorageId.value || !contextFingerprint.value) return false;
  try {
    await saveSecureDocumentDraft(secureStorageId.value, {
      contextFingerprint: contextFingerprint.value,
      documentId: snapshot.document.document_id,
      baseVersionId: snapshot.document.document_version_id,
      baseRowVersion: snapshot.document.row_version,
      sections: clinicalJsonSnapshot(sections.value),
      updatedAt: new Date().toISOString(),
    });
    return true;
  } catch {
    clearAutosaveTimers();
    saveState.value = 'error';
    notice.value = '会话级加密草稿写入失败，系统已停止自动保存以避免误判；请先复制当前内容并检查浏览器存储策略。';
    return false;
  }
}

async function clearSecureCopyQuietly(storageId: string): Promise<void> {
  try { await clearSecureDocumentDraft(storageId); } catch { /* cleanup must not block the clinical workflow */ }
}

async function persistDraft(manual: boolean) {
  const snapshot = current.data.value;
  if (!snapshot || snapshot.document.status !== 'DRAFT' || saveInFlight || saveState.value === 'conflict') return;
  if (!hasUnsavedChanges.value) {
    if (manual) notice.value = '当前内容已保存，无需生成重复版本';
    return;
  }
  if (!navigator.onLine) {
    saveState.value = 'offline';
    await persistSecureCopy();
    return;
  }
  clearAutosaveTimers();
  saveInFlight = true;
  saveState.value = 'autosaving';
  const startedGeneration = editGeneration.value;
  const submittedSections = clinicalJsonSnapshot(sections.value);
  try {
    const next = await saveDocumentDraft(snapshot.lease, snapshot.document, submittedSections);
    replaceCurrentDocument(next);
    findings.value = [];
    proposal.value = null;
    lastSavedAt.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    if (editGeneration.value === startedGeneration) {
      saveState.value = 'saved';
      if (secureStorageId.value) await clearSecureCopyQuietly(secureStorageId.value);
      if (manual) notice.value = `草稿已保存为不可变版本 v${next.version_no}`;
    } else {
      saveState.value = 'dirty';
      await persistSecureCopy();
      scheduleAutosave();
    }
  } catch (error) {
    await persistSecureCopy();
    if (error instanceof ClinicalApiError && error.code === 'VERSION_CONFLICT') {
      conflictLocal.value = clinicalJsonSnapshot(sections.value);
      conflictBaseVersionId.value = snapshot.document.document_version_id;
      try { conflictRemote.value = await loadCurrentDocument(snapshot.lease); } catch { conflictRemote.value = null; }
      saveState.value = 'conflict';
      notice.value = '检测到其他工作站已保存新版本；本地草稿仍在加密缓存中，系统不会覆盖。';
    } else {
      saveState.value = navigator.onLine ? 'error' : 'offline';
      notice.value = navigator.onLine ? '自动保存失败，本地加密草稿已保留；请重试。' : '网络已断开，本地加密草稿已保留。';
    }
  } finally {
    saveInFlight = false;
  }
}

function handleOffline() {
  if (document.value?.status === 'DRAFT' && hasUnsavedChanges.value) saveState.value = 'offline';
}

function handleOnline() {
  if (saveState.value === 'offline' || saveState.value === 'error') {
    saveState.value = 'dirty';
    scheduleAutosave(100);
  }
}

function handleBeforeUnload(event: BeforeUnloadEvent) {
  if (!hasUnsavedChanges.value) return;
  event.preventDefault();
  event.returnValue = '';
}

function restoreSecureDraft() {
  if (!recoveryDraft.value) return;
  sections.value = clinicalJsonSnapshot(recoveryDraft.value.sections);
  recoveryDraft.value = null;
  markDirty();
  notice.value = '加密草稿已恢复到编辑区，将基于当前服务端版本重新保存。';
}

async function discardSecureDraft() {
  recoveryDraft.value = null;
  if (secureStorageId.value) await clearSecureCopyQuietly(secureStorageId.value);
}

function chooseConflictField(field: string, source: 'local' | 'remote') {
  const value = source === 'local' ? conflictLocal.value[field] : (conflictRemote.value?.sections ?? {})[field];
  sections.value = { ...sections.value, [field]: value ?? '' };
}

function remoteConflictValue(field: string) {
  return String((conflictRemote.value?.sections ?? {})[field] ?? '—');
}

function continueAfterConflict() {
  if (!conflictRemote.value) return;
  replaceCurrentDocument(conflictRemote.value);
  conflictRemote.value = null;
  conflictBaseVersionId.value = '';
  editGeneration.value += 1;
  saveState.value = 'dirty';
  void persistSecureCopy();
  scheduleAutosave(100);
  notice.value = '已基于当前服务端版本继续，所选字段将生成新的不可变草稿版本。';
}

async function useRemoteVersion() {
  if (!conflictRemote.value) return;
  sections.value = { ...(conflictRemote.value.sections ?? {}) };
  replaceCurrentDocument(conflictRemote.value);
  conflictRemote.value = null;
  conflictBaseVersionId.value = '';
  saveState.value = 'saved';
  if (secureStorageId.value) await clearSecureCopyQuietly(secureStorageId.value);
  notice.value = '已采用服务器当前版本，本地冲突草稿已清除。';
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">门诊 / 病历编辑</p><h1>门诊病历工作台</h1></div>
      <div class="status-legend" :class="`save-${saveState}`"><span class="dot" :class="saveState === 'saved' || saveState === 'signed' ? 'success' : saveState === 'conflict' || saveState === 'error' ? 'danger' : 'warning'" />{{ saveStateLabel }}<small v-if="lastSavedAt"> · {{ lastSavedAt }}</small></div></div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>{{ developmentCopy.contextNotice }}</span></div><dl>
        <div><dt>患者标识</dt><dd>…{{ current.data.value?.lease.patient_id?.slice(-6) }}</dd></div>
        <div><dt>就诊类型</dt><dd>门诊 · 进行中</dd></div><div><dt>数据范围</dt><dd>当前患者 / 当前就诊</dd></div></dl>
      <span v-if="current.data.value" class="lease-badge">受控租约</span></section>
    <AgentInlineReview v-if="current.data.value" agent-code="DOCUMENT_DRAFTER" stage-code="OUTPATIENT" :objective="outpatientDraftObjective" :patient-id="agentPatientId" :encounter-id="agentEncounterId" target-type="ENCOUNTER" :target-id="agentEncounterId" title="AI 门诊文书起草候选" source-route="opd-record" />
    <ClinicalPageState v-if="current.isPending.value" kind="loading" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="current.refetch()" />
    <div v-else-if="document && current.data.value" class="clinical-grid" :class="{ 'assistant-collapsed': !assistantOpen }">
      <section class="editor-card" aria-label="病历编辑器"><div class="card-toolbar"><div><h2>门诊病历</h2>
        <span class="state-chip" :class="{ signed: document.status === 'SIGNED' }">{{ document.status === 'SIGNED' ? '已签署' : `草稿 v${document.version_no}` }}</span></div>
        <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy) || hasUnsavedChanges" @click="checkQuality">运行质控</button>
          <button class="button ai" :disabled="Boolean(busy) || document.status === 'SIGNED'" @click="askAi">AI 辅助</button>
          <button class="button primary" :disabled="Boolean(busy) || document.status === 'SIGNED' || saveState === 'autosaving' || saveState === 'conflict'" @click="save">{{ saveState === 'autosaving' ? '保存中…' : '立即保存' }}</button></div></div>
        <div v-if="notice" class="notice" role="status">{{ notice }}</div>
        <section v-if="recoveryDraft" class="draft-recovery-banner" aria-label="加密草稿恢复"><div><strong>检测到本会话的未提交加密草稿</strong><span>保存于 {{ new Date(recoveryDraft.updatedAt).toLocaleString('zh-CN') }}；恢复后必须重新审阅差异。</span></div><div><button class="button secondary" @click="discardSecureDraft">丢弃</button><button class="button primary" @click="restoreSecureDraft">恢复到编辑区</button></div></section>
        <section v-if="saveState === 'conflict'" class="draft-conflict-panel" role="alert"><header><div><strong>版本冲突：系统已禁止覆盖</strong><span>本地基于旧版本编辑，服务器已有新版本。请逐字段选择后再基于当前版本继续。</span></div><RouterLink v-if="conflictRemote && conflictBaseVersionId" :to="`/record-diff/${document.document_id}/${conflictBaseVersionId}/${conflictRemote.document_version_id}`">打开完整版本差异</RouterLink></header><article v-for="field in conflictFields" :key="field[0]"><strong>{{ field[1] }}</strong><div><span>本地草稿</span><p>{{ String(conflictLocal[field[0]] ?? '—') }}</p><button @click="chooseConflictField(field[0], 'local')">选择本地</button></div><div><span>服务器当前版</span><p>{{ remoteConflictValue(field[0]) }}</p><button @click="chooseConflictField(field[0], 'remote')">选择服务器</button></div></article><footer><button class="button secondary" @click="useRemoteVersion">全部采用服务器版本</button><button class="button primary" :disabled="!conflictRemote" @click="continueAfterConflict">基于当前版本继续</button></footer></section>
        <div class="document-meta"><span>文书类型：{{ document.document_type_code }}</span><span>内容哈希：{{ document.content_hash.slice(0, 12) }}…</span><span>停止输入 {{ autosaveDelayMs }}ms 自动保存 · 最长 5s</span><span>自动合并：禁用</span></div>
        <form class="record-form" @submit.prevent><label v-for="field in sectionFields" :key="field[0]" class="field-group"><span>{{ field[1] }}</span>
          <textarea :value="String(sections[field[0]] ?? '')" :rows="field[2]" :readonly="document.status === 'SIGNED' || saveState === 'conflict'" :aria-describedby="`${field[0]}-hint`" @compositionstart="compositionStart" @compositionend="compositionEnd" @input="updateSection(field[0], $event)" />
          <small :id="`${field[0]}-hint`">自动保存形成不可变草稿版本；断网时仅保留本会话加密副本；签署后不可修改。</small></label></form></section>
      <aside class="right-rail" aria-label="质控与 AI 辅助"><section class="side-card"><div class="side-card-title"><h2>病历质控</h2><span>{{ findings.length }}</span></div>
        <div v-if="findings.length === 0" class="empty-state"><span>✓</span><p>尚无未处理发现</p><small>保存后运行确定性质控</small></div>
        <article v-for="finding in findings" v-else :key="finding.finding_id" class="finding" :class="finding.severity.toLowerCase()"><strong>{{ finding.severity }}</strong><p>{{ finding.message }}</p><code>{{ finding.field_path }}</code></article>
        <label class="warning-disposition"><span>警告处置说明</span><input v-model="warningDisposition" /></label>
        <button class="button danger full" :disabled="Boolean(busy) || document.status === 'SIGNED' || hasUnsavedChanges" @click="sign">{{ document.status === 'SIGNED' ? '病历已签署' : hasUnsavedChanges ? '请先完成自动保存' : '签署当前版本' }}</button>
        <RouterLink class="record-governance-link" to="/record-qc">查看完整质控与签名证据</RouterLink></section>
        <section v-if="assistantOpen" class="side-card ai-card"><div class="side-card-title"><h2>AI医助 Eva</h2><span class="ai-state">医生确认</span></div>
          <div v-if="!proposal" class="empty-state ai-empty"><span>✦</span><p>Eva 不会直接改写病历</p><small>点击“AI 辅助”生成带来源的病历草稿</small></div>
          <template v-else><div class="ai-warning">草稿尚未写入病历，请医生逐项审阅。</div><div class="proposal-copy">{{ String(proposal.payload.notice || '病历段落草稿') }}</div>
            <h3>来源证据</h3><div v-for="reference in proposal.references" :key="reference.reference_id" class="reference"><strong>{{ reference.source_type }}</strong><p>{{ reference.excerpt || '结构化字段引用' }}</p><code>{{ reference.field_path }}</code></div>
            <div class="proposal-actions"><button class="button secondary" :disabled="Boolean(busy) || proposal.status !== 'PENDING_REVIEW'" @click="decide('REJECTED')">拒绝</button>
              <button class="button ai" :disabled="Boolean(busy) || proposal.status !== 'PENDING_REVIEW'" @click="decide('ACCEPTED')">接受到编辑区</button></div></template></section></aside>
    </div>
    <button class="ai-fab" aria-label="打开AI医助Eva病历候选面板" :aria-expanded="assistantOpen" @click="assistantOpen = !assistantOpen"><img src="/brand/ai-medical-assistant-eva.png" alt="" width="32" height="32" /><small>{{ assistantOpen ? '收起 Eva' : 'AI医助 Eva' }}</small></button>
  </section>
</template>
