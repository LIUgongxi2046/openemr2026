<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { InpatientDocumentRuleWire, InpatientDocumentTaskWire, InpatientWorklistItemWire } from '../../generated/contracts';
import {
  createInpatientClinicalEvent, createInpatientDocumentTask, dischargeInpatient,
  getInpatientSyntheticActor, inpatientSyntheticActors,
  issueInpatientLease, issueWardLease, loadInpatientDocumentRules, loadInpatientOverview,
  loadInpatientWorklist, rejectInpatientDocumentReview, selectInpatientContext,
  setInpatientSyntheticActor, startInpatientDocumentTask,
  type InpatientSyntheticActorKey,
} from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type ClinicalEventType = 'CONSULTATION_REQUESTED' | 'PREOPERATIVE_DECISION' | 'OPERATION_COMPLETED'
  | 'RESCUE_COMPLETED' | 'TRANSFUSION_COMPLETED' | 'CRITICAL_ILLNESS_DECLARED' | 'DEATH_CONFIRMED';

const inpatient = useQuery({
  queryKey: ['clinical', 'inpatient-workspace'],
  queryFn: async () => {
    const [encounterLease, wardLease] = await Promise.all([issueInpatientLease(), issueWardLease()]);
    const [overview, worklist, documentRules] = await Promise.all([
      loadInpatientOverview(encounterLease), loadInpatientWorklist(wardLease), loadInpatientDocumentRules(wardLease),
    ]);
    return { encounterLease, wardLease, overview, worklist, documentRules };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const router = useRouter();

const busy = ref<string | null>(null);
const notice = ref('');
const eventOpen = ref(false);
const eventType = ref<ClinicalEventType>('RESCUE_COMPLETED');
const eventSummary = ref('');
const dischargeOpen = ref(false);
const dischargeDiagnosis = ref('');
const dispositionCode = ref<'HOME' | 'TRANSFER_TO_FACILITY' | 'DEATH' | 'OTHER'>('HOME');
const waiverReason = ref('');
const rejectionTaskId = ref<string | null>(null);
const rejectionReason = ref('');
const selectedActorKey = ref<InpatientSyntheticActorKey>(getInpatientSyntheticActor()?.key ?? 'AUTHOR');
const issue = computed(() => inpatient.error.value ? toClinicalIssue(inpatient.error.value) : null);
const overview = computed(() => inpatient.data.value?.overview);
const admission = computed(() => overview.value?.admission);
const rules = computed(() => inpatient.data.value?.documentRules ?? []);
const pendingCount = computed(() => overview.value?.document_tasks.filter((task) => task.task_state !== 'COMPLETED').length ?? 0);
const overdueCount = computed(() => overview.value?.document_tasks.filter((task) => task.task_state === 'OVERDUE').length ?? 0);
const activeActor = computed(() => inpatientSyntheticActors.find((actor) => actor.key === selectedActorKey.value));

async function execute(label: string, action: () => Promise<void>) {
  if (busy.value) return;
  busy.value = label; notice.value = '';
  try { await action(); await inpatient.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = null; }
}

async function switchActor(key: InpatientSyntheticActorKey) {
  if (busy.value || key === selectedActorKey.value) return;
  busy.value = 'actor'; notice.value = '';
  try {
    setInpatientSyntheticActor(key); selectedActorKey.value = key;
    await inpatient.refetch();
    notice.value = `开发验收身份已切换为${activeActor.value?.roleLabel ?? key}；每次切换均重新签发上下文租约。`;
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = null; }
}

function createDailyCourse() {
  const data = inpatient.data.value; if (!data) return;
  void execute('daily', async () => {
    const occurredAt = new Date().toISOString();
    await createInpatientDocumentTask(data.encounterLease, data.overview, 'IP-DAILY-COURSE', occurredAt, `DAILY:${occurredAt}:${crypto.randomUUID()}`);
    notice.value = '已创建新的日常病程任务';
  });
}
function createClinicalEvent() {
  const data = inpatient.data.value; if (!data || !eventSummary.value.trim()) return;
  void execute('event', async () => {
    await createInpatientClinicalEvent(data.encounterLease, data.overview, eventType.value, eventSummary.value.trim());
    eventSummary.value = ''; eventOpen.value = false; notice.value = '临床事件与对应文书任务已同事务创建';
  });
}
function startTask(task: InpatientDocumentTaskWire) {
  const data = inpatient.data.value; if (!data) return;
  void execute(`start:${task.task_id}`, async () => {
    const rule = data.documentRules.find((candidate) => candidate.document_type_code === task.document_type_code);
    await startInpatientDocumentTask(data.encounterLease, task, rule); notice.value = '住院文书草稿已建立';
  });
}
function beginReject(task: InpatientDocumentTaskWire) { rejectionTaskId.value = task.task_id; rejectionReason.value = ''; }
function rejectTask(task: InpatientDocumentTaskWire) {
  const data = inpatient.data.value; const level = task.next_signature_level;
  if (!data || !level || level === 'AUTHOR' || !rejectionReason.value.trim()) return;
  void execute(`reject:${task.task_id}`, async () => {
    await rejectInpatientDocumentReview(data.encounterLease, task, level, rejectionReason.value.trim());
    rejectionTaskId.value = null; rejectionReason.value = ''; notice.value = '审签已退回，必须形成新版本后重新进入审签';
  });
}
function discharge() {
  const data = inpatient.data.value; if (!data || !dischargeDiagnosis.value.trim()) return;
  void execute('discharge', async () => {
    await dischargeInpatient(data.encounterLease, data.overview, dischargeDiagnosis.value.trim(), dispositionCode.value, waiverReason.value.trim());
    dischargeOpen.value = false; notice.value = '出院门禁已通过，住院状态已更新';
  });
}
async function openPatient(item: InpatientWorklistItemWire) {
  if (busy.value) return;
  selectInpatientContext(item);
  await router.push('/inpatient-overview');
}
function documentLabel(code: string, documentRules: InpatientDocumentRuleWire[]) { return documentRules.find((rule) => rule.document_type_code === code)?.display_name || code; }
function signatureLabel(level: 'AUTHOR' | 'ATTENDING' | 'CHIEF' | 'MEDICAL_RECORDS') { return { AUTHOR: '作者签名', ATTENDING: '主治审签', CHIEF: '主任审签', MEDICAL_RECORDS: '病案确认' }[level]; }
function signatureProgress(task: InpatientDocumentTaskWire) {
  if (task.review_status === 'COMPLETED') return `审签完成 · ${signatureLabel(task.required_signature_level)}`;
  if (task.review_status === 'REJECTED') return '已退回修改';
  if (task.next_signature_level) return `待${signatureLabel(task.next_signature_level)} · 终审${signatureLabel(task.required_signature_level)}`;
  return `终审${signatureLabel(task.required_signature_level)}`;
}
function canActOnTask(task: InpatientDocumentTaskWire) {
  if (!task.working_document_id) return selectedActorKey.value === 'AUTHOR';
  if (task.review_status === 'REJECTED' || task.next_signature_level === 'AUTHOR') return selectedActorKey.value === 'AUTHOR';
  return task.next_signature_level === selectedActorKey.value;
}
function formatDue(minutes: number) { if (minutes < 60) return `${minutes} 分钟`; if (minutes % 1440 === 0) return `${minutes / 1440} 天`; return `${minutes / 60} 小时`; }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>住院医生工作站</h1><p>心内科一病区 · 在管患者实时刷新 · 四角色审签验收</p></div>
      <div class="head-actions"><RouterLink class="btn" to="/admission-bed">入院与床位</RouterLink><RouterLink class="btn primary" to="/inpatient-overview">进入患者总览</RouterLink></div>
    </div>
    <section v-if="inpatientSyntheticActors.length" class="inpatient-role-simulator" aria-label="开发环境四角色审签身份"><div><strong>四角色审签验收</strong><span>仅开发合成环境 · 生产身份必须来自 OIDC，页面不可切换</span></div><div role="group" aria-label="当前审签身份"><button v-for="actor in inpatientSyntheticActors" :key="actor.key" type="button" :class="{ active: actor.key === selectedActorKey }" :disabled="Boolean(busy)" @click="switchActor(actor.key)"><b>{{ actor.roleLabel }}</b><small>{{ actor.displayName }}</small></button></div></section>
    <ClinicalPageState v-if="inpatient.isPending.value" kind="loading" message="正在验证病区岗位、患者租约与床位水位" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="inpatient.refetch()" />
    <template v-else-if="overview && admission && inpatient.data.value">
      <section class="patient-strip" aria-label="住院患者上下文"><div class="patient-avatar">合</div><div><strong>{{ overview.patient_display_name }}</strong><span>{{ developmentCopy.contextNotice }}</span></div><dl><div><dt>住院状态</dt><dd>{{ admission.status }}</dd></div><div><dt>病区床位</dt><dd>{{ overview.ward_display_name }} · {{ overview.bed_label }}床</dd></div><div><dt>当前岗位</dt><dd>{{ activeActor?.roleLabel ?? '住院医师' }} · {{ activeActor?.displayName ?? '当前登录用户' }}</dd></div></dl><span class="lease-badge">当前患者 / 当前住院</span></section>
      <div class="metric-grid" aria-label="住院关键指标">
        <div class="metric"><div class="name">病区在院</div><div class="value">{{ inpatient.data.value.worklist.length }}</div><div class="trend">仅当前岗位授权范围</div></div>
        <div class="metric"><div class="name">待完成文书</div><div class="value">{{ pendingCount }}</div><div class="trend">按国家时限与机构规则</div></div>
        <div class="metric"><div class="name">已超时任务</div><div class="value" :class="{ 'danger-text': overdueCount > 0 }">{{ overdueCount }}</div><div class="trend">{{ overdueCount > 0 ? '需立即处理' : '当前无超时' }}</div></div>
        <div class="metric"><div class="name">数据水印</div><div class="value">{{ overview.data_watermark.slice(0, 8) }}</div><div class="trend">刷新后重新校验</div></div>
      </div>
      <nav class="inpatient-subnav" aria-label="住院患者功能"><RouterLink to="/inpatient-overview">患者总览</RouterLink><RouterLink to="/inpatient-course">病程与文书</RouterLink><RouterLink to="/ip-orders">住院医嘱</RouterLink><RouterLink to="/ip-results">检查检验</RouterLink><RouterLink to="/ip-consult">会诊协同</RouterLink><RouterLink to="/ip-pathway">临床路径</RouterLink><RouterLink to="/inpatient-discharge">出院闭环</RouterLink></nav>
      <div class="grid inpatient-grid"><aside class="card scroll-card"><div class="card-head">病区患者 <span class="sub">{{ inpatient.data.value.worklist.length }} 人</span></div><div class="ward-list"><button v-for="item in inpatient.data.value.worklist" :key="item.admission_id" type="button" :class="{ active: item.admission_id === admission.admission_id }" @click="openPatient(item)"><b>{{ item.bed_label }}床 · {{ item.patient_display_name }}</b><span>待办 {{ item.pending_task_count }} · 超时 {{ item.overdue_task_count }}</span></button></div></aside><section class="editor-card inpatient-overview-card"><div class="card-toolbar"><div><h2>单患者住院总览</h2><span class="state-chip signed">{{ admission.status }}</span></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/inpatient-overview">打开完整总览</RouterLink><button class="button secondary" :disabled="Boolean(busy) || admission.status !== 'ADMITTED' || selectedActorKey !== 'AUTHOR'" @click="createDailyCourse">{{ busy === 'daily' ? '正在创建病程任务…' : '新增病程' }}</button><button v-if="admission.status === 'ADMITTED'" class="button secondary" :disabled="Boolean(busy) || selectedActorKey !== 'AUTHOR'" @click="eventOpen = !eventOpen">记录临床事件</button><RouterLink v-if="admission.status === 'ADMITTED'" class="button secondary" to="/inpatient-discharge">办理出院</RouterLink></div></div>
        <div class="inpatient-summary-grid"><div><span>入院时间</span><strong>{{ formatDate(admission.admitted_at) }}</strong></div><div><span>当前病区</span><strong>{{ overview.ward_display_name }}</strong></div><div><span>当前床位</span><strong>{{ overview.bed_label }}床</strong></div><div><span>住院号</span><strong>…{{ admission.admission_id.slice(-8) }}</strong></div></div>
        <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>
        <section v-if="eventOpen && admission.status === 'ADMITTED'" class="discharge-panel" aria-label="记录住院临床事件"><div><h3>记录临床事件并生成文书任务</h3><p>事件事实与对应文书任务同事务提交；重复来源事件不会重复建任务。</p></div><label>事件类型<select v-model="eventType"><option value="CONSULTATION_REQUESTED">发起会诊</option><option value="PREOPERATIVE_DECISION">确定手术方案</option><option value="OPERATION_COMPLETED">手术完成</option><option value="RESCUE_COMPLETED">抢救结束</option><option value="TRANSFUSION_COMPLETED">输血完成</option><option value="CRITICAL_ILLNESS_DECLARED">宣布病危/病重</option><option value="DEATH_CONFIRMED">确认死亡</option></select></label><label class="event-summary">事件摘要<textarea v-model="eventSummary" rows="3" maxlength="1000" placeholder="记录时间、关键事实、参与人员与结果；详细内容在生成的文书中补充" /></label><div class="toolbar-actions"><button class="button secondary" @click="eventOpen = false">取消</button><button class="button primary" :disabled="Boolean(busy) || !eventSummary.trim()" @click="createClinicalEvent">{{ busy === 'event' ? '正在提交事件与任务…' : '确认并生成文书任务' }}</button></div></section>
        <section v-if="dischargeOpen && admission.status === 'ADMITTED'" class="discharge-panel" aria-label="出院办理"><div><h3>出院办理</h3><p>未完成必需文书时默认阻断；豁免仅限主诊医生并记入审计。</p></div><label>出院诊断<textarea v-model="dischargeDiagnosis" rows="2" maxlength="2000" /></label><label>出院去向<select v-model="dispositionCode"><option value="HOME">回家</option><option value="TRANSFER_TO_FACILITY">转其他医疗机构</option><option value="DEATH">死亡</option><option value="OTHER">其他</option></select></label><label>未完成文书豁免原因（无未完成任务可留空）<textarea v-model="waiverReason" rows="2" maxlength="1000" /></label><div class="toolbar-actions"><button class="button secondary" @click="dischargeOpen = false">取消</button><button class="button primary" :disabled="Boolean(busy) || !dischargeDiagnosis.trim()" @click="discharge">{{ busy === 'discharge' ? '正在执行出院门禁…' : '确认出院' }}</button></div></section>
        <div class="task-table-wrap"><table class="task-table"><thead><tr><th>住院文书任务</th><th>截止时间</th><th>状态</th><th>动作</th></tr></thead><tbody><tr v-for="task in overview.document_tasks" :key="task.task_id"><td><strong>{{ documentLabel(task.document_type_code, rules) }}</strong><small>{{ task.document_type_code }}</small></td><td>{{ formatDate(task.due_at) }}</td><td><span class="task-state" :class="task.task_state.toLowerCase()">{{ task.task_state }}</span><small>{{ signatureProgress(task) }}</small></td><td><RouterLink v-if="task.task_state === 'COMPLETED' && (task.completed_document_id || task.working_document_id)" :to="{ path: '/inpatient-doc-versions', query: { document_id: task.completed_document_id || task.working_document_id } }">查看版本证据</RouterLink><template v-else-if="task.working_document_id"><RouterLink v-if="canActOnTask(task)" :to="{ path: '/inpatient-doc-editor', query: { document_id: task.working_document_id } }">{{ task.review_status === 'IN_REVIEW' && task.next_signature_level !== 'AUTHOR' ? '进入审签' : '继续书写' }}</RouterLink><span v-else class="review-wait">等待{{ task.next_signature_level ? signatureLabel(task.next_signature_level) : '前序处理' }}</span><template v-if="canActOnTask(task) && task.review_status === 'IN_REVIEW' && task.next_signature_level && task.next_signature_level !== 'AUTHOR'"><button class="task-action task-reject-toggle" @click="beginReject(task)">退回修改</button><div v-if="rejectionTaskId === task.task_id" class="task-reject-panel"><textarea v-model="rejectionReason" aria-label="审签退回原因" maxlength="1000" rows="2" placeholder="填写可执行的退回原因" /><button class="task-action" :disabled="Boolean(busy) || !rejectionReason.trim()" @click="rejectTask(task)">{{ busy === `reject:${task.task_id}` ? '正在退回…' : '确认退回' }}</button></div></template></template><button v-else class="task-action" :disabled="Boolean(busy) || selectedActorKey !== 'AUTHOR'" @click="startTask(task)">{{ selectedActorKey !== 'AUTHOR' ? '等待作者建稿' : (busy === `start:${task.task_id}` ? '正在建立草稿…' : '开始书写') }}</button></td></tr></tbody></table></div></section>
        <aside class="card scroll-card"><div class="card-head">文书规则与安全门禁</div><div class="card-body"><details class="document-catalog"><summary><span><b>住院文书规则目录</b><small>版本化配置</small></span><strong>{{ rules.length }} 类</strong></summary><div><article v-for="rule in rules" :key="rule.rule_code"><span><b>{{ rule.display_name }}</b><small>{{ rule.category_code }} · {{ rule.trigger_type }}</small></span><em>{{ rule.required_signature_level }} · {{ formatDue(rule.due_minutes) }}</em></article></div></details><section class="inpatient-safety"><div class="section-title">住院安全门禁</div><ul><li>床位在数据库层禁止重复占用</li><li>病区岗位失效后立即拒绝工作清单</li><li>文书时限由服务端计算，不依赖前端时钟</li><li>入院、审计与 Outbox 同事务提交</li></ul></section></div></aside></div>
    </template>
  </main>
</template>
