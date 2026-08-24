<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { InpatientConsultationWire } from '../../generated/contracts';
import {
  acceptInpatientConsultation, completeInpatientConsultation, createInpatientConsultation,
  getInpatientSyntheticActor, inpatientSyntheticActors, issueInpatientLease,
  loadInpatientConsultations, loadInpatientOverview, rejectInpatientConsultation,
  setInpatientSyntheticActor, signInpatientConsultationOpinion, type InpatientSyntheticActorKey,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const selectedActorKey = ref<InpatientSyntheticActorKey>(getInpatientSyntheticActor()?.key ?? 'AUTHOR');
const selectedConsultationId = ref('');
const filter = ref<'ACTIVE' | 'ALL' | InpatientConsultationWire['status']>('ACTIVE');
const openCreate = ref(false);
const busy = ref(false);
const notice = ref('');
const requestedDepartment = ref('心血管内科');
const urgency = ref<'ROUTINE' | 'URGENT' | 'EMERGENCY'>('ROUTINE');
const reason = ref('');
const clinicalQuestion = ref('');
const dueAt = ref(defaultDueAt());
const rejectionReason = ref('');
const opinion = ref('');
const recommendation = ref('');

const workspace = useQuery({
  queryKey: ['clinical', 'inpatient-consultations', selectedActorKey],
  queryFn: async () => {
    const lease = await issueInpatientLease();
    const [overview, consultations] = await Promise.all([
      loadInpatientOverview(lease), loadInpatientConsultations(lease),
    ]);
    if (!selectedConsultationId.value && consultations.length) {
      selectedConsultationId.value = consultations[0].consultation_id;
    }
    return { lease, overview, consultations };
  },
  retry: false, staleTime: 0, gcTime: 0,
});

const issue = computed(() => workspace.error.value ? toClinicalIssue(workspace.error.value) : null);
const activeActor = computed(() => inpatientSyntheticActors.find((actor) => actor.key === selectedActorKey.value));
const consultations = computed(() => workspace.data.value?.consultations ?? []);
const filteredConsultations = computed(() => consultations.value.filter((item) => {
  if (filter.value === 'ALL') return true;
  if (filter.value === 'ACTIVE') return ['REQUESTED', 'ACCEPTED', 'OPINION_SIGNED'].includes(item.status);
  return item.status === filter.value;
}));
const selected = computed(() => consultations.value.find((item) => item.consultation_id === selectedConsultationId.value)
  ?? filteredConsultations.value[0]);
const activeCount = computed(() => consultations.value.filter((item) => ['REQUESTED', 'ACCEPTED', 'OPINION_SIGNED'].includes(item.status)).length);
const overdueCount = computed(() => consultations.value.filter((item) => item.overdue).length);
const signedCount = computed(() => consultations.value.filter((item) => ['OPINION_SIGNED', 'COMPLETED'].includes(item.status)).length);
const canAccept = computed(() => selected.value?.status === 'REQUESTED'
  && activeActor.value?.userId !== selected.value.requested_by);
const canSign = computed(() => selected.value?.status === 'ACCEPTED'
  && activeActor.value?.userId === selected.value.accepted_by);
const canComplete = computed(() => selected.value?.status === 'OPINION_SIGNED'
  && activeActor.value?.userId === selected.value.requested_by);

async function switchActor(key: InpatientSyntheticActorKey) {
  if (busy.value || key === selectedActorKey.value) return;
  busy.value = true; notice.value = '';
  try {
    setInpatientSyntheticActor(key); selectedActorKey.value = key;
    await workspace.refetch();
    notice.value = `已切换为${activeActor.value?.roleLabel ?? key}，并重新签发住院患者租约。`;
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}

async function refresh(selectedId?: string) {
  if (selectedId) selectedConsultationId.value = selectedId;
  await workspace.refetch();
}

async function submitCreate() {
  if (!workspace.data.value || busy.value) return;
  busy.value = true; notice.value = '';
  try {
    const created = await createInpatientConsultation(workspace.data.value.lease, {
      requestedDepartment: requestedDepartment.value.trim(), urgency: urgency.value,
      reason: reason.value.trim(), clinicalQuestion: clinicalQuestion.value.trim(),
      dueAt: new Date(dueAt.value).toISOString(),
    });
    reason.value = ''; clinicalQuestion.value = ''; openCreate.value = false;
    await refresh(created.consultation_id);
    notice.value = '会诊申请已正式提交，待独立临床医生接诊。';
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}

async function execute(action: 'accept' | 'reject' | 'sign' | 'complete') {
  if (!workspace.data.value || !selected.value || busy.value) return;
  busy.value = true; notice.value = '';
  try {
    const lease = workspace.data.value.lease;
    const current = selected.value;
    let changed: InpatientConsultationWire;
    if (action === 'accept') changed = await acceptInpatientConsultation(lease, current);
    else if (action === 'reject') changed = await rejectInpatientConsultation(lease, current, rejectionReason.value.trim());
    else if (action === 'sign') changed = await signInpatientConsultationOpinion(
      lease, current, opinion.value.trim(), recommendation.value.trim(),
    );
    else changed = await completeInpatientConsultation(lease, current);
    rejectionReason.value = ''; opinion.value = ''; recommendation.value = '';
    if (action === 'complete' || action === 'reject') filter.value = 'ALL';
    await refresh(changed.consultation_id);
    notice.value = action === 'accept' ? '已接诊，现在由接诊医生负责签署会诊意见。'
      : action === 'reject' ? '已记录退回原因，申请不会被误判为完成。'
        : action === 'sign' ? '会诊意见已签署固化，等待申请医生闭环确认。'
          : '申请医生已确认采纳，会诊闭环完成。';
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}

function defaultDueAt() {
  const date = new Date(Date.now() + 2 * 60 * 60 * 1000);
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}
function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}
function actorName(userId?: string | null) {
  if (!userId) return '—';
  return inpatientSyntheticActors.find((actor) => actor.userId === userId)?.displayName ?? `用户…${userId.slice(-6)}`;
}
function statusLabel(status: InpatientConsultationWire['status']) {
  return { REQUESTED: '待接诊', ACCEPTED: '已接诊', REJECTED: '已退回', OPINION_SIGNED: '意见已签', COMPLETED: '已完成', CANCELLED: '已取消' }[status];
}
function urgencyLabel(value: InpatientConsultationWire['urgency']) {
  return { ROUTINE: '普通', URGENT: '紧急', EMERGENCY: '立即' }[value];
}
</script>

<template>
  <main id="main-content" class="content vue-native-page inpatient-consult-page">
    <div class="page-heading"><div><p class="eyebrow">住院 / 跨科协同</p><h1>住院查房、会诊与协同</h1><p>申请、接诊、意见签署和申请方确认分离，通知不代表完成。</p></div><button class="button primary" type="button" @click="openCreate = !openCreate">{{ openCreate ? '收起申请' : '新建会诊' }}</button></div>
    <nav class="inpatient-subnav" aria-label="住院患者功能"><RouterLink to="/inpatient-overview">患者总览</RouterLink><RouterLink to="/inpatient-course">病程与文书</RouterLink><RouterLink to="/ip-orders">住院医嘱</RouterLink><RouterLink to="/ip-results">检查检验</RouterLink><RouterLink to="/ip-consult">会诊协同</RouterLink><RouterLink to="/ip-pathway">临床路径</RouterLink><RouterLink to="/inpatient-discharge">出院闭环</RouterLink></nav>
    <section v-if="inpatientSyntheticActors.length" class="inpatient-role-simulator" aria-label="开发环境会诊岗位身份"><div><strong>当前验收身份</strong><span>只在开发合成环境可切换；生产身份由 OIDC 与岗位任期确定</span></div><div role="group"><button v-for="actor in inpatientSyntheticActors" :key="actor.key" type="button" :class="{ active: actor.key === selectedActorKey }" :disabled="busy" @click="switchActor(actor.key)"><b>{{ actor.roleLabel }}</b><small>{{ actor.displayName }}</small></button></div></section>
    <ClinicalPageState v-if="workspace.isPending.value" kind="loading" message="正在校验住院患者租约与会诊队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="workspace.refetch()" />
    <template v-else-if="workspace.data.value">
      <section class="patient-strip" aria-label="住院患者上下文"><div class="patient-avatar">合</div><div><strong>{{ workspace.data.value.overview.patient_display_name }}</strong><span>{{ workspace.data.value.overview.ward_display_name }} · {{ workspace.data.value.overview.bed_label }}床</span></div><dl><div><dt>当前身份</dt><dd>{{ activeActor?.displayName ?? '当前登录人' }}</dd></div><div><dt>住院状态</dt><dd>{{ workspace.data.value.overview.admission.status }}</dd></div><div><dt>租约范围</dt><dd>当前患者·当前住院</dd></div></dl><span class="lease-badge">…{{ workspace.data.value.overview.admission.admission_id.slice(-8) }}</span></section>
      <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

      <section v-if="openCreate" class="consult-create-card"><header><div><p class="eyebrow">标准化申请</p><h2>新建住院会诊</h2></div><span>申请后内容固化，修改需重新发起</span></header><form @submit.prevent="submitCreate"><label>邀请科室<input v-model="requestedDepartment" required minlength="2" maxlength="128" /></label><label>紧急程度<select v-model="urgency"><option value="ROUTINE">普通</option><option value="URGENT">紧急</option><option value="EMERGENCY">立即</option></select></label><label>期望完成时间<input v-model="dueAt" required type="datetime-local" /></label><label class="wide">会诊原因<textarea v-model="reason" required minlength="4" maxlength="1000" rows="3" placeholder="当前临床问题、已完成的处置和邀请理由" /></label><label class="wide">希望解决的临床问题<textarea v-model="clinicalQuestion" required minlength="4" maxlength="2000" rows="3" placeholder="请用可回答的临床问题描述" /></label><footer><small>服务端将校验当前住院状态、病区权限与时限。</small><button class="button primary" :disabled="busy || reason.trim().length < 4 || clinicalQuestion.trim().length < 4">{{ busy ? '正在提交…' : '提交会诊申请' }}</button></footer></form></section>

      <div class="consult-metrics"><article><span>未闭环</span><strong>{{ activeCount }}</strong><small>待接诊 / 已接诊 / 待确认</small></article><article><span>已超时</span><strong>{{ overdueCount }}</strong><small>由服务端基于时限推导</small></article><article><span>已签意见</span><strong>{{ signedCount }}</strong><small>签署后不可覆盖</small></article></div>
      <div class="consult-workspace">
        <section class="consult-queue"><header><div><p class="eyebrow">会诊队列</p><h2>当前住院会诊</h2></div><select v-model="filter" aria-label="按会诊状态筛选"><option value="ACTIVE">未闭环</option><option value="ALL">全部</option><option value="REQUESTED">待接诊</option><option value="ACCEPTED">已接诊</option><option value="OPINION_SIGNED">意见已签</option><option value="COMPLETED">已完成</option><option value="REJECTED">已退回</option></select></header><div class="consult-queue-list"><button v-for="item in filteredConsultations" :key="item.consultation_id" type="button" :class="{ active: item.consultation_id === selected?.consultation_id }" @click="selectedConsultationId = item.consultation_id"><span><b>{{ item.requested_department }}</b><em :class="item.urgency.toLowerCase()">{{ urgencyLabel(item.urgency) }}</em></span><strong>{{ item.clinical_question }}</strong><small>{{ actorName(item.requested_by) }} · {{ formatDate(item.requested_at) }}</small><footer><i :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</i><mark v-if="item.overdue">已超时</mark><time>{{ formatDate(item.due_at) }}前</time></footer></button><div v-if="!filteredConsultations.length" class="clinical-empty-state" role="status">当前筛选下没有会诊，可从页面右上角新建。</div></div></section>

        <section v-if="selected" class="consult-detail"><header><div><span class="state-chip" :class="selected.status.toLowerCase()">{{ statusLabel(selected.status) }}</span><h2>{{ selected.requested_department }}会诊</h2><p>{{ selected.reason }}</p></div><code>水印 {{ selected.data_watermark.slice(0, 12) }}…</code></header><div class="consult-question"><span>希望解决的临床问题</span><strong>{{ selected.clinical_question }}</strong><dl><div><dt>紧急程度</dt><dd>{{ urgencyLabel(selected.urgency) }}</dd></div><div><dt>期望完成</dt><dd :class="{ danger: selected.overdue }">{{ formatDate(selected.due_at) }}{{ selected.overdue ? '·已超时' : '' }}</dd></div><div><dt>当前版本</dt><dd>v{{ selected.row_version }}</dd></div></dl></div>
          <div class="consult-timeline" aria-label="会诊证据时间轴"><article class="done"><span>1</span><div><b>申请已提交</b><small>{{ actorName(selected.requested_by) }} · {{ formatDate(selected.requested_at) }}</small></div></article><article :class="{ done: selected.accepted_at || selected.status === 'REJECTED' }"><span>2</span><div><b>{{ selected.status === 'REJECTED' ? '申请已退回' : '独立医生接诊' }}</b><small>{{ selected.status === 'REJECTED' ? selected.rejection_reason : selected.accepted_at ? actorName(selected.accepted_by) + ' · ' + formatDate(selected.accepted_at) : '等待接诊' }}</small></div></article><article :class="{ done: selected.opinion_signed_at }"><span>3</span><div><b>会诊意见签署</b><small>{{ selected.opinion_signed_at ? actorName(selected.opinion_signed_by) + ' · ' + formatDate(selected.opinion_signed_at) : '尚未签署' }}</small></div></article><article :class="{ done: selected.completed_at }"><span>4</span><div><b>申请方闭环确认</b><small>{{ selected.completed_at ? actorName(selected.completed_by) + ' · ' + formatDate(selected.completed_at) : '通知不代表完成' }}</small></div></article></div>
          <section v-if="selected.opinion" class="signed-consult-opinion"><header><strong>已签会诊意见</strong><span>不可覆盖·已审计</span></header><div><b>专业判断</b><p>{{ selected.opinion }}</p></div><div><b>处置建议</b><p>{{ selected.recommendation }}</p></div></section>
          <div v-if="selected.status === 'REQUESTED'" class="consult-action-panel"><template v-if="canAccept"><strong>接诊医生处置</strong><p>接诊后你将获得当前患者、当前住院的限时上下文，并负责签署意见。</p><div class="toolbar-actions"><button class="button primary" :disabled="busy" @click="execute('accept')">接受会诊</button></div><label>无法接诊的原因<textarea v-model="rejectionReason" rows="2" minlength="4" maxlength="1000" placeholder="退回必须说明原因" /></label><button class="button danger" :disabled="busy || rejectionReason.trim().length < 4" @click="execute('reject')">记录原因并退回</button></template><div v-else class="consult-gate"><strong>职责分离门禁</strong><p>申请人不能接受或退回自己的会诊，请切换到独立临床岗位。</p></div></div>
          <form v-else-if="selected.status === 'ACCEPTED' && canSign" class="consult-action-panel" @submit.prevent="execute('sign')"><strong>签署会诊意见</strong><label>专业判断<textarea v-model="opinion" required minlength="4" maxlength="8000" rows="4" /></label><label>处置建议<textarea v-model="recommendation" required minlength="4" maxlength="8000" rows="4" /></label><button class="button primary" :disabled="busy || opinion.trim().length < 4 || recommendation.trim().length < 4">签署并固化意见</button></form>
          <div v-else-if="selected.status === 'ACCEPTED'" class="consult-action-panel consult-gate"><strong>等待接诊医生</strong><p>只有 {{ actorName(selected.accepted_by) }} 可以签署本次会诊意见。</p></div>
          <div v-else-if="selected.status === 'OPINION_SIGNED'" class="consult-action-panel"><template v-if="canComplete"><strong>确认会诊闭环</strong><p>请在阅读意见并安排后续处置后确认；该动作不会修改已签意见。</p><button class="button primary" :disabled="busy" @click="execute('complete')">已阅读并确认闭环</button></template><div v-else class="consult-gate"><strong>等待申请医生确认</strong><p>只有 {{ actorName(selected.requested_by) }} 可以完成本次闭环。</p></div></div>
          <div v-else-if="selected.status === 'COMPLETED'" class="consult-complete-banner"><strong>会诊已完成闭环</strong><span>申请、接诊、签署与确认证据可独立追溯。</span></div>
          <div v-else-if="selected.status === 'REJECTED'" class="consult-rejected-banner"><strong>会诊已退回</strong><span>{{ selected.rejection_reason }}</span></div>
        </section>
        <section v-else class="consult-detail clinical-empty-state">选择一条会诊查看完整证据与下一步动作。</section>
      </div>
    </template>
  </main>
</template>
