<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QualityFindingWire } from '../../generated/contracts';
import { runQualityChecks, saveDocumentDraft, signDocument } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { useCurrentDocument } from '../composables/use-current-document';

const sectionFields = [
  ['chief_complaint', '主诉', 3],
  ['present_illness', '现病史', 6],
  ['assessment', '诊断与评估', 3],
  ['treatment_plan', '治疗与随访计划', 3],
] as const;

const current = useCurrentDocument();
const sections = ref<Record<string, unknown>>({});
const findings = ref<QualityFindingWire[]>([]);
const busy = ref<string | null>(null);
const notice = ref('');
const savedAt = ref('');
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'signed'>('idle');

const issue = computed(() => current.error.value ? toClinicalIssue(current.error.value) : null);
const document = computed(() => current.data.value?.document);
const filledSections = computed(() => Object.values(sections.value).filter((value) => String(value ?? '').trim()).length);
const saveStateLabel = computed(() => ({
  idle: '尚未编辑', dirty: '有未保存更改', saving: '正在保存…', saved: '已保存',
  conflict: '版本冲突 · 禁止覆盖', signed: '已签署只读',
} as Record<string, string>)[saveState.value]);

watch(() => current.data.value?.document, (doc) => {
  if (!doc) return;
  sections.value = { ...(doc.sections ?? {}) };
  findings.value = [];
  savedAt.value = '';
  saveState.value = doc.status === 'SIGNED' ? 'signed' : 'idle';
}, { immediate: true });

function updateSection(field: string, event: Event) {
  sections.value = { ...sections.value, [field]: (event.target as HTMLTextAreaElement).value };
  findings.value = [];
  saveState.value = document.value?.status === 'DRAFT' ? 'dirty' : saveState.value;
}

async function save() {
  const snapshot = current.data.value;
  if (!snapshot || busy.value || snapshot.document.status !== 'DRAFT') return;
  busy.value = 'save'; notice.value = ''; saveState.value = 'saving';
  try {
    await saveDocumentDraft(snapshot.lease, snapshot.document, sections.value);
    await current.refetch();
    saveState.value = 'saved';
    savedAt.value = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }).format(new Date());
    notice.value = '草稿已保存为新的不可变版本';
  } catch (error) {
    const next = toClinicalIssue(error);
    saveState.value = next.code === 'VERSION_CONFLICT' ? 'conflict' : 'dirty';
    notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = null; }
}

function checkQuality() {
  const snapshot = current.data.value;
  if (!snapshot || busy.value) return;
  busy.value = 'quality'; notice.value = '';
  runQualityChecks(snapshot.lease, snapshot.document)
    .then((result) => {
      findings.value = result;
      notice.value = result.length === 0 ? '确定性质控通过，可以进入签署' : `发现 ${result.length} 项待处理问题`;
    })
    .catch((error) => { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; })
    .finally(() => { busy.value = null; });
}

function sign() {
  const snapshot = current.data.value;
  if (!snapshot || busy.value) return;
  busy.value = 'sign'; notice.value = '';
  signDocument(snapshot.lease, snapshot.document, '医生在专注编辑器中复核后签署')
    .then(async (evidence) => {
      notice.value = `签署证据已创建：${evidence.signature_status}`;
      await current.refetch();
    })
    .catch((error) => { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; })
    .finally(() => { busy.value = null; });
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">门诊 / 专注编辑</p><h1>门诊病历 · 专注编辑</h1></div>
      <div class="status-legend" :class="`save-${saveState}`"><span class="dot" :class="saveState === 'saved' || saveState === 'signed' ? 'success' : saveState === 'conflict' ? 'danger' : 'warning'" />{{ saveStateLabel }}<small v-if="savedAt"> · {{ savedAt }}</small></div></div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>{{ developmentCopy.contextNotice }}</span></div><dl>
        <div><dt>患者标识</dt><dd>…{{ current.data.value?.lease.patient_id?.slice(-6) }}</dd></div>
        <div><dt>就诊类型</dt><dd>门诊 · 进行中</dd></div>
        <div><dt>数据范围</dt><dd>当前患者 / 当前就诊</dd></div></dl>
      <span v-if="current.data.value" class="lease-badge">受控租约</span></section>
    <ClinicalPageState v-if="current.isPending.value" kind="loading" message="正在加载当前病历版本" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="current.refetch()" />
    <div v-else-if="document && current.data.value" class="clinical-grid">
      <section class="editor-card" aria-label="专注编辑器">
        <div class="card-toolbar"><div><h2>门诊病历</h2>
          <span class="state-chip" :class="{ signed: document.status === 'SIGNED' }">{{ document.status === 'SIGNED' ? '已签署' : `草稿 v${document.version_no}` }}</span></div>
          <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy) || saveState === 'dirty'" @click="checkQuality">运行质控</button>
            <button class="button primary" :disabled="Boolean(busy) || document.status === 'SIGNED' || saveState === 'saving' || saveState === 'conflict'" @click="save">{{ saveState === 'saving' ? '保存中…' : '立即保存' }}</button></div></div>
        <div v-if="notice" class="notice" role="status">{{ notice }}</div>
        <div v-if="saveState === 'conflict'" class="draft-conflict-panel" style="margin: 14px; padding: 14px; color: #8e2626; border: 1px solid #efb6bb; border-radius: 8px; background: #fff7f7;" role="alert"><strong>版本冲突：系统已禁止覆盖</strong><p style="margin: 6px 0 0; color: #6f4650; font-size: 12px;">其他工作站已保存新版本，本地编辑基于旧版本，请刷新后基于当前版本继续。</p></div>
        <div v-if="filledSections === 0" class="empty-state" style="padding: 18px"><span>章</span><p>当前版本尚无已填写章节</p><small>在下方章节中开始书写，保存会形成不可变草稿版本。</small></div>
        <div class="document-meta"><span>文书类型：{{ document.document_type_code }}</span><span>内容哈希：{{ document.content_hash.slice(0, 12) }}…</span><span>当前版本 v{{ document.version_no }} · 行版本 {{ document.row_version }}</span><span>自动合并：禁用</span></div>
        <form class="record-form" @submit.prevent><label v-for="field in sectionFields" :key="field[0]" class="field-group"><span>{{ field[1] }}</span>
          <textarea :value="String(sections[field[0]] ?? '')" :rows="field[2]" :readonly="document.status === 'SIGNED' || saveState === 'conflict'" @input="updateSection(field[0], $event)" />
          <small>保存形成不可变草稿版本；签署后不可修改。</small></label></form>
      </section>
      <aside class="right-rail" aria-label="质控与签署"><section class="side-card"><div class="side-card-title"><h2>病历质控</h2><span>{{ findings.length }}</span></div>
        <div v-if="findings.length === 0" class="empty-state"><span>✓</span><p>尚无未处理发现</p><small>保存后运行确定性质控</small></div>
        <article v-for="finding in findings" v-else :key="finding.finding_id" class="finding" :class="finding.severity.toLowerCase()"><strong>{{ finding.severity }}</strong><p>{{ finding.message }}</p><code>{{ finding.field_path }}</code></article>
        <button class="button danger full" :disabled="Boolean(busy) || document.status === 'SIGNED' || saveState === 'dirty' || saveState === 'saving' || saveState === 'conflict'" @click="sign">{{ document.status === 'SIGNED' ? '病历已签署' : '签署当前版本' }}</button>
        <RouterLink class="record-governance-link" style="display: block; margin-top: 12px; color: #1769e0; font-size: 11px; font-weight: 700;" to="/record-qc">查看完整质控与签名证据</RouterLink></section>
        <section class="side-card"><div class="side-card-title"><h2>编辑边界</h2><span>3</span></div>
          <ul style="padding-left: 18px; margin: 12px 0 0; color: #526275; font-size: 12px; line-height: 1.75;">
            <li>只编辑当前患者 / 当前就诊的当前版本。</li>
            <li>每次保存形成新版本，已签内容不可覆盖。</li>
            <li>来源证据与 AI 候选在完整编辑工作台查看。</li>
          </ul></section></aside>
    </div>
  </main>
</template>
