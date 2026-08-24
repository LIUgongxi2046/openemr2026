<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import type { InpatientDocumentTaskWire } from '../../generated/contracts';
import {
  getInpatientSyntheticActor, inpatientSyntheticActors, issueInpatientLease,
  loadInpatientDocument, loadInpatientDocumentGovernance, loadInpatientOverview,
  runInpatientDocumentQuality, saveInpatientDocumentDraft, setInpatientSyntheticActor,
  signInpatientDocument, type InpatientSyntheticActorKey,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const documentId = computed(() => typeof route.query.document_id === 'string' ? route.query.document_id : '');
const selectedActorKey = ref<InpatientSyntheticActorKey>(getInpatientSyntheticActor()?.key ?? 'AUTHOR');
const sections = ref<Record<string, string>>({});
const baseline = ref('');
const busy = ref('');
const notice = ref('');
const commandError = ref('');
const warningDisposition = ref('');

const editorQuery = useQuery({
  queryKey: ['clinical', 'inpatient-document-editor', documentId],
  queryFn: async () => {
    if (!documentId.value) return { kind: 'missing' as const };
    const lease = await issueInpatientLease();
    const document = await loadInpatientDocument(lease, documentId.value);
    const [overview, governance] = await Promise.all([
      loadInpatientOverview(lease), loadInpatientDocumentGovernance(lease, document),
    ]);
    return { kind: 'ready' as const, lease, document, overview, governance };
  },
  retry: false, staleTime: 0, gcTime: 0,
});

watch(() => editorQuery.data.value, (data) => {
  if (data?.kind !== 'ready') return;
  const next = Object.fromEntries(Object.entries(data.document.sections ?? {}).map(([key, value]) => [key, typeof value === 'string' ? value : JSON.stringify(value)]));
  sections.value = next; baseline.value = JSON.stringify(next);
}, { immediate: true });

const issue = computed(() => editorQuery.error.value ? toClinicalIssue(editorQuery.error.value) : null);
const data = computed(() => editorQuery.data.value?.kind === 'ready' ? editorQuery.data.value : null);
const task = computed(() => data.value?.overview.document_tasks.find((item) => item.working_document_id === documentId.value));
const activeActor = computed(() => inpatientSyntheticActors.find((actor) => actor.key === selectedActorKey.value));
const dirty = computed(() => JSON.stringify(sections.value) !== baseline.value);
const qualityPassed = computed(() => data.value?.governance.quality_run?.outcome === 'PASSED');
const qualityWarning = computed(() => data.value?.governance.quality_run?.outcome === 'WARNING');
const qualityAcceptable = computed(() => qualityPassed.value || qualityWarning.value);
const canEdit = computed(() => selectedActorKey.value === 'AUTHOR' && task.value
  && ['AUTHOR', null].includes(task.value.next_signature_level ?? null)
  && task.value.review_status !== 'COMPLETED');
const canSign = computed(() => task.value?.next_signature_level === selectedActorKey.value
  && qualityAcceptable.value && !dirty.value && task.value.review_status !== 'COMPLETED'
  && (!qualityWarning.value || warningDisposition.value.trim().length >= 4));
const stages: Array<{ key: InpatientSyntheticActorKey; label: string }> = [
  { key: 'AUTHOR', label: '作者签名' }, { key: 'ATTENDING', label: '主治审签' },
  { key: 'CHIEF', label: '主任审签' }, { key: 'MEDICAL_RECORDS', label: '病案确认' },
];

async function execute(label: string, action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = label; notice.value = ''; commandError.value = '';
  try { await action(); }
  catch (error) { commandError.value = `${toClinicalIssue(error).code}：${toClinicalIssue(error).message}`; }
  finally { busy.value = ''; }
}

async function switchActor(key: InpatientSyntheticActorKey) {
  if (key === selectedActorKey.value || busy.value) return;
  await execute('actor', async () => {
    setInpatientSyntheticActor(key); selectedActorKey.value = key;
    await editorQuery.refetch(); notice.value = `已切换为${activeActor.value?.roleLabel ?? key}并重新签发患者上下文租约。`;
  });
}

function fillSyntheticContent() {
  if (!canEdit.value) return;
  sections.value = Object.fromEntries(Object.keys(sections.value).map((key) => [key, `合成验收内容：${fieldLabel(key)}，已由作者核对。`]));
}

async function save() {
  const current = data.value;
  if (!current || !canEdit.value || !dirty.value) return;
  await execute('save', async () => {
    await saveInpatientDocumentDraft(current.lease, current.document, { ...sections.value });
    await editorQuery.refetch(); notice.value = '已生成新的不可变住院病历版本；旧审签证据不会沿用。';
  });
}

async function qualityCheck() {
  const current = data.value;
  if (!current || dirty.value || selectedActorKey.value !== 'AUTHOR') return;
  await execute('quality', async () => {
    const findings = await runInpatientDocumentQuality(current.lease, current.document);
    await editorQuery.refetch();
    notice.value = findings.some((item) => item.severity === 'BLOCKING') ? '质控发现阻断项，请修订并重新保存。' : '确定性质控已通过，可执行当前层级签名。';
  });
}

async function sign() {
  const current = data.value;
  if (!current || !canSign.value) return;
  await execute('sign', async () => {
    await signInpatientDocument(current.lease, current.document, selectedActorKey.value, warningDisposition.value);
    warningDisposition.value = '';
    await editorQuery.refetch(); notice.value = task.value?.review_status === 'COMPLETED' ? '四角色审签完成，住院文书任务已闭环。' : '本级签名已固化，文书已流转到下一审签岗位。';
  });
}

function stageState(stage: InpatientSyntheticActorKey, currentTask?: InpatientDocumentTaskWire) {
  if (!currentTask) return 'pending';
  const order = stages.map((item) => item.key);
  const completedIndex = currentTask.current_signature_level ? order.indexOf(currentTask.current_signature_level) : -1;
  const index = order.indexOf(stage);
  if (index <= completedIndex) return 'complete';
  if (currentTask.next_signature_level === stage) return 'current';
  if (index > order.indexOf(currentTask.required_signature_level)) return 'not-required';
  return 'pending';
}

function fieldLabel(key: string) {
  return ({ case_summary: '病例摘要', diagnostic_basis: '诊断依据', treatment_course: '诊疗经过', quality_conclusion: '病案质量结论', chief_complaint: '主诉', present_illness: '现病史', assessment: '临床评估', treatment_plan: '诊疗计划', differential_diagnosis: '鉴别诊断', communication: '沟通记录' } as Record<string, string>)[key]
    ?? key.replaceAll('_', ' ');
}
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value)); }
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">住院 / 病历创作与分级审签</p><h1>住院病历 · 专注编辑</h1></div><RouterLink class="button secondary" to="/inpatient">返回住院工作站</RouterLink></div>
    <section v-if="inpatientSyntheticActors.length" class="inpatient-role-simulator compact" aria-label="开发环境四角色审签身份"><div><strong>当前验收身份</strong><span>仅开发合成环境；生产由 OIDC 与岗位任期决定</span></div><div role="group"><button v-for="actor in inpatientSyntheticActors" :key="actor.key" type="button" :class="{ active: actor.key === selectedActorKey }" :disabled="Boolean(busy)" @click="switchActor(actor.key)"><b>{{ actor.roleLabel }}</b><small>{{ actor.displayName }}</small></button></div></section>
    <ClinicalPageState v-if="editorQuery.isPending.value" kind="loading" message="正在核验患者、住院任务、文书版本与审签证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="editorQuery.refetch()" />
    <div v-else-if="editorQuery.data.value?.kind === 'missing'" class="record-evidence-empty"><h2>未选择住院文书</h2><p>请从住院工作站的文书任务进入，系统不会猜测患者或文书上下文。</p><RouterLink class="button primary" to="/inpatient">选择文书任务</RouterLink></div>
    <template v-else-if="data && task">
      <section class="patient-strip" aria-label="住院病历上下文"><div class="patient-avatar">合</div><div><strong>{{ data.overview.patient_display_name }}</strong><span>{{ data.document.document_type_code }}</span></div><dl><div><dt>病区床位</dt><dd>{{ data.overview.ward_display_name }} · {{ data.overview.bed_label }}床</dd></div><div><dt>版本状态</dt><dd>v{{ data.document.version_no }} · {{ data.document.status }}</dd></div><div><dt>当前岗位</dt><dd>{{ activeActor?.roleLabel ?? '住院医师' }}</dd></div></dl><span class="lease-badge">住院号 …{{ task.admission_id.slice(-8) }}</span></section>
      <section class="inpatient-signature-steps" aria-label="四角色审签进度"><article v-for="(stage, index) in stages" :key="stage.key" :class="stageState(stage.key, task)"><span>{{ index + 1 }}</span><div><strong>{{ stage.label }}</strong><small>{{ stageState(stage.key, task) === 'complete' ? '证据已固化' : stageState(stage.key, task) === 'current' ? '当前待办' : stageState(stage.key, task) === 'not-required' ? '本规则不要求' : '等待前序' }}</small></div></article></section>
      <div v-if="notice || commandError" class="legal-action-message" :class="{ error: commandError }" role="status">{{ commandError || notice }}</div>
      <div class="inpatient-document-layout">
        <section class="inpatient-document-editor">
          <header><div><p class="eyebrow">结构化正文</p><h2>{{ task.document_type_code }}</h2></div><div class="toolbar-actions"><button v-if="inpatientSyntheticActors.length" class="button secondary" :disabled="!canEdit || Boolean(busy)" @click="fillSyntheticContent">填入合成验收内容</button><button class="button primary" :disabled="!canEdit || !dirty || Boolean(busy)" @click="save">{{ busy === 'save' ? '保存中…' : '保存新版本' }}</button></div></header>
          <div v-if="!canEdit" class="document-readonly-banner"><strong>只读审签视图</strong><span>{{ task.next_signature_level === selectedActorKey ? '请核对正文、质控和历史签名后执行本级签署或返回工作站退回。' : `当前待办属于 ${task.next_signature_level ?? '已完成'} 岗位。` }}</span></div>
          <div class="inpatient-section-form"><label v-for="(_, key) in sections" :key="key"><span>{{ fieldLabel(String(key)) }}</span><small>{{ String(key) }}</small><textarea v-model="sections[key]" rows="4" :readonly="!canEdit" /></label></div>
        </section>
        <aside class="inpatient-review-rail">
          <section><header><div><p class="eyebrow">确定性门禁</p><h2>质控与当前动作</h2></div><span :class="['review-outcome', data.governance.quality_run?.outcome?.toLowerCase() ?? 'missing']">{{ data.governance.quality_run?.outcome ?? '未运行' }}</span></header><dl><div><dt>文书内容哈希</dt><dd>{{ data.document.content_hash.slice(0, 18) }}…</dd></div><div><dt>质控规则版本</dt><dd>{{ data.governance.quality_run?.rule_version ?? '—' }}</dd></div><div><dt>阻断问题</dt><dd>{{ data.governance.quality_run?.blocking_count ?? '—' }}</dd></div><div><dt>下一签名</dt><dd>{{ task.next_signature_level ?? '已完成' }}</dd></div></dl><div class="review-actions"><button class="button secondary full" :disabled="selectedActorKey !== 'AUTHOR' || dirty || Boolean(busy) || task.review_status === 'COMPLETED'" @click="qualityCheck">{{ busy === 'quality' ? '质控中…' : '运行确定性质控' }}</button><label v-if="qualityWarning && task.next_signature_level"><span>警告处置说明（至少 4 字）</span><textarea v-model="warningDisposition" rows="2" maxlength="1000" placeholder="说明已核对的警告及处置结论" /></label><button class="button primary full" :disabled="!canSign || Boolean(busy)" @click="sign">{{ task.review_status === 'COMPLETED' ? '审签已完成' : (busy === 'sign' ? '签署中…' : `执行${activeActor?.roleLabel ?? selectedActorKey}签名`) }}</button><small v-if="task.review_status === 'COMPLETED'">四级签名链已固化，正文转为只读。</small><small v-else-if="dirty">存在未保存修改，质控与签名已禁用。</small><small v-else-if="!qualityAcceptable">必须先取得绑定当前内容哈希的通过或可处置警告结论。</small><small v-else-if="qualityWarning && warningDisposition.trim().length < 4">质控存在警告，必须记录人工核对和处置说明。</small><small v-else-if="task.next_signature_level !== selectedActorKey">请切换到 {{ task.next_signature_level ?? '任务已完成' }} 对应的真实岗位。</small></div></section>
          <section><header><div><p class="eyebrow">不可变证据</p><h2>签名时间轴</h2></div><span>{{ data.governance.signatures.length }} 份</span></header><div v-if="data.governance.signatures.length === 0" class="legal-empty-state compact"><strong>尚未签名</strong><p>作者签名后，每一级人员、角色、时间与内容哈希将在此固化。</p></div><article v-for="signature in data.governance.signatures" v-else :key="signature.signature_id" class="inpatient-signature-evidence"><span>{{ signature.signature_role }}</span><div><strong>{{ signature.signer_display_name }}</strong><small>{{ formatDate(signature.signed_at) }} · {{ signature.signature_status }}</small><code>{{ signature.content_hash.slice(0, 16) }}…</code></div></article></section>
          <section class="review-safety-note"><h2>审签安全边界</h2><ul><li>不允许跳过前序层级</li><li>要求人员分离时同一人不可连续签署</li><li>退回后必须生成新版本并重新质控</li><li>CA 未回传时不伪造有效证据</li></ul></section>
        </aside>
      </div>
    </template>
  </section>
</template>
