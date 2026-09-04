<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import type { QualityFindingWire } from '../../generated/contracts';
import { runQualityChecks, saveDocumentDraft, signDocument } from '../../clinical-api';
import AgentInlineReview from '../components/AgentInlineReview.vue';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import RecordPatientStrip from '../components/RecordPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';
import { useCurrentDocument } from '../composables/use-current-document';

const sectionFields = [
  ['chief_complaint', '主诉', 3],
  ['present_illness', '现病史', 6],
  ['past_history', '既往史', 4],
  ['allergy_history', '过敏史', 3],
  ['physical_exam', '体格检查', 5],
  ['auxiliary_exam', '辅助检查', 5],
  ['assessment', '诊断与评估', 3],
  ['treatment_plan', '治疗计划', 4],
  ['followup_plan', '复诊与随访计划', 3],
] as const;

const current = useCurrentDocument();
const sections = ref<Record<string, unknown>>({});
const findings = ref<QualityFindingWire[]>([]);
const busy = ref<string | null>(null);
const notice = ref('');
const savedAt = ref('');
const saveState = ref<'idle' | 'dirty' | 'saving' | 'saved' | 'conflict' | 'signed'>('idle');
const saveDialogOpen = ref(false);
const signDialogOpen = ref(false);
const activeSection = ref('present_illness');

const issue = computed(() => current.error.value ? toClinicalIssue(current.error.value) : null);
const document = computed(() => current.data.value?.document);
const agentPatientId = computed(() => current.data.value?.lease.patient_id ?? null);
const agentEncounterId = computed(() => current.data.value?.lease.encounter_id ?? null);
const agentDraftObjective = computed(() => '基于当前病历起草或完善文书内容候选，仅供医生审阅后采用，不自动写入。');
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

function save() {
  if (saveState.value === 'dirty') saveDialogOpen.value = true;
}

async function confirmSave() {
  const snapshot = current.data.value;
  if (!snapshot || busy.value || snapshot.document.status !== 'DRAFT') return;
  busy.value = 'save'; notice.value = ''; saveState.value = 'saving';
  try {
    await saveDocumentDraft(snapshot.lease, snapshot.document, sections.value);
    saveDialogOpen.value = false;
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
  signDialogOpen.value = true;
}

function focusSection(field: string) {
  activeSection.value = field;
  window.document.getElementById(`record-field-${field}`)?.focus();
}

function outlineState(field: string) {
  if (activeSection.value === field) return ['当前', 'blue'] as const;
  return String(sections.value[field] ?? '').trim() ? ['已填写', 'green'] as const : ['待完善', 'amber'] as const;
}

function confirmSign() {
  const snapshot = current.data.value;
  if (!snapshot || busy.value) return;
  busy.value = 'sign'; notice.value = '';
  signDocument(snapshot.lease, snapshot.document, '医生在专注编辑器中复核后签署')
    .then(async (evidence) => {
      notice.value = `签署证据已创建：${evidence.signature_status}`;
      signDialogOpen.value = false;
      await current.refetch();
    })
    .catch((error) => { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; })
    .finally(() => { busy.value = null; });
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><h1>病历 · 专注编辑</h1><p>{{ document ? `草稿 v${document.version_no} · ${document.document_type_code}` : '当前版本' }} · {{ saveStateLabel }}</p></div>
      <div class="toolbar-actions"><RouterLink class="btn" to="/record-sources">来源证据</RouterLink><button class="btn" type="button" :disabled="Boolean(busy) || saveState === 'dirty'" @click="checkQuality">质控 {{ findings.length }}</button><button class="btn primary" type="button" :disabled="Boolean(busy) || document?.status !== 'DRAFT' || saveState === 'dirty'" @click="sign">提交审签</button></div></div>
    <RecordPatientStrip />
    <AgentInlineReview v-if="current.data.value" agent-code="DOCUMENT_DRAFTER" stage-code="OUTPATIENT" :objective="agentDraftObjective" :patient-id="agentPatientId" :encounter-id="agentEncounterId" target-type="DOCUMENT" :target-id="agentEncounterId" title="AI 病历起草候选" source-route="record-editor" />
    <ClinicalPageState v-if="current.isPending.value" kind="loading" message="正在加载当前病历版本" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="current.refetch()" />
    <div v-else-if="document && current.data.value" class="focus-editor record-real-focus">
      <aside class="focus-outline card"><div class="card-head">文书章节 <span class="sub">{{ Math.round((filledSections / sectionFields.length) * 100) }}%</span></div><button v-for="(item, index) in sectionFields" :key="item[0]" class="outline-item" :class="{ active: activeSection === item[0] }" type="button" @click="focusSection(item[0])"><span>{{ index + 1 }}</span><b>{{ item[1] }}</b><em class="status" :class="outlineState(item[0])[1]">{{ outlineState(item[0])[0] }}</em></button></aside>
      <section class="card focus-canvas" aria-label="专注编辑器"><div class="editor-ribbon"><button class="btn sm" type="button" title="纯文本病历不写入富文本样式" @click="notice = '当前病历按纯文本语义保存；加粗不进入临床正文。'"><b>B</b></button><button class="btn sm" type="button" title="纯文本病历不写入富文本样式" @click="notice = '当前病历按纯文本语义保存；斜体不进入临床正文。'"><i>I</i></button><button class="btn sm" type="button" @click="focusSection('assessment')">结构化字段</button><RouterLink class="btn sm" to="/record-sources">插入来源</RouterLink><RouterLink class="btn sm" to="/record-qc">AI 质控建议</RouterLink><span class="grow" /><span class="status green">● {{ savedAt || '当前版本已载入' }}</span></div>
        <div v-if="notice" class="notice record-editor-notice" role="status">{{ notice }}</div><div v-if="saveState === 'conflict'" class="notice hard" role="alert"><div class="notice-title">版本冲突：系统已禁止覆盖</div>其他工作站已保存新版本，请刷新后基于当前版本继续。</div>
        <article class="document-sheet"><h2>临床病历</h2><p class="document-meta">当前患者 · 当前就诊 · {{ document.document_type_code }}</p><div v-for="field in sectionFields" :key="field[0]" class="doc-section"><b>{{ field[1] }}</b><textarea :id="`record-field-${field[0]}`" class="field textarea" :class="{ 'warning-field': field[0] === 'treatment_plan', 'source-field': field[0] === 'assessment' }" :value="String(sections[field[0]] ?? '')" :rows="field[2]" :readonly="document.status !== 'DRAFT' || saveState === 'conflict'" @focus="activeSection = field[0]" @input="updateSection(field[0], $event)" /></div></article>
        <div class="footer-actions"><RouterLink class="btn" to="/record">退出并保存</RouterLink><span class="grow" /><RouterLink class="btn" to="/record-sources">核验来源</RouterLink><button class="btn" type="button" :disabled="Boolean(busy) || saveState !== 'dirty'" @click="save">{{ saveState === 'saving' ? '保存中…' : '保存新版本' }}</button><button class="btn primary" type="button" :disabled="Boolean(busy) || saveState === 'dirty'" @click="checkQuality">签署前检查</button></div></section>
      <aside class="assist-rail"><RouterLink to="/record-sources"><b>源</b><span>来源</span></RouterLink><RouterLink to="/record-qc"><b>{{ findings.length }}</b><span>质控</span></RouterLink><RouterLink to="/record-versions"><b>v{{ document.version_no }}</b><span>版本</span></RouterLink><RouterLink to="/pacs-viewer"><b>影</b><span>影像</span></RouterLink></aside>
    </div>
    <BusinessActionDialog :open="saveDialogOpen" title="保存病历编辑" description="编辑会以新的不可变草稿版本保存，旧版本不被覆盖。" eyebrow="病历 / 编辑确认" confirm-label="确认保存新版本" :busy="busy === 'save'" @cancel="saveDialogOpen = false" @confirm="confirmSave"><p class="dialog-warning">当前已填 {{ filledSections }} 个章节；保存后已有质控结果将按新内容重新计算。</p></BusinessActionDialog>
    <BusinessActionDialog :open="signDialogOpen" title="签署当前不可变版本" description="服务端会重新校验质控、版本和签名策略。" eyebrow="病历 / 签署确认" confirm-label="确认签署并留存证据" danger :busy="busy === 'sign'" @cancel="signDialogOpen = false" @confirm="confirmSign"><p class="dialog-warning">签署后正文不可覆盖；修改只能通过更正/补记弹窗生成新版本。</p></BusinessActionDialog>
  </section>
</template>
