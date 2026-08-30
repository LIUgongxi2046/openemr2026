<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { EncounterDomainSwitchWire, ShiftHandoverPatientWire, ShiftHandoverWire } from '../../generated/contracts';
import {
  completeShiftHandover,
  correctEncounterDomainSwitch,
  correctShiftHandover,
  correctShiftHandoverPatient,
  createShiftHandover,
  createShiftHandoverPatient,
  issueEmergencyFacilityLease,
  issueEmergencyLease,
  issueHandoverPatientLease,
  listEncounterDomainSwitches,
  listShiftHandoverPatients,
  listShiftHandovers,
  recordEncounterDomainSwitch,
  voidShiftHandover,
  voidEncounterDomainSwitch,
  voidShiftHandoverPatient,
} from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import EmergencyPatientStrip from '../components/EmergencyPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const wardId = clinicalContext.inpatientWardId;

const facilityLease = useQuery({
  queryKey: ['emergency', 'handoff', 'facility-lease'],
  queryFn: () => issueEmergencyFacilityLease('EMERGENCY_HANDOFF'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = useQuery({
  queryKey: ['emergency', 'handoff', 'patient-lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_HANDOFF'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const handoverPatientLease = useQuery({
  queryKey: ['emergency', 'handoff', 'admitted-patient-lease'],
  queryFn: () => issueHandoverPatientLease(clinicalContext.inpatientPatientId, 'EMERGENCY_HANDOFF'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});

const handoversQuery = useQuery({
  queryKey: ['emergency', 'handoff', 'handovers'],
  queryFn: () => listShiftHandovers(facilityLease.data.value!, wardId),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});
const selectedHandoverId = ref<string>('');
const handoverPatientsQuery = useQuery({
  queryKey: ['emergency', 'handoff', 'handover-patients', selectedHandoverId],
  queryFn: () => listShiftHandoverPatients(facilityLease.data.value!, selectedHandoverId.value),
  enabled: () => Boolean(facilityLease.data.value && selectedHandoverId.value), retry: false,
});
const switchesQuery = useQuery({
  queryKey: ['emergency', 'handoff', 'switches'],
  queryFn: () => listEncounterDomainSwitches(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});

const issue = computed(() => {
  const failed = [facilityLease, patientLease, handoverPatientLease, handoversQuery, handoverPatientsQuery, switchesQuery].find((q) => q.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});
const handovers = computed(() => handoversQuery.data.value ?? []);
const handoverPatients = computed(() => handoverPatientsQuery.data.value ?? []);
const switches = computed(() => switchesQuery.data.value ?? []);
const selectedHandover = computed(() => handovers.value.find((h) => h.handover_id === selectedHandoverId.value) ?? null);
watch(handovers, (items) => {
  if (items.length && !items.some((item) => item.handover_id === selectedHandoverId.value && !item.voided_at)) {
    selectedHandoverId.value = items.find((item) => !item.voided_at)?.handover_id ?? items[0].handover_id;
  }
}, { immediate: true });

const handoverForm = reactive({ shift_from: '', shift_to: '', incoming_user_id: clinicalContext.collaboratorUserId, handover_summary: '' });
const patientForm = reactive({ summary: '', risk_flag: false, reason: '' });
const switchForm = reactive({
  from_encounter_id: clinicalContext.emergencyEncounterId,
  to_encounter_id: clinicalContext.inpatientEncounterId,
  from_domain: 'EMERGENCY' as 'OUTPATIENT' | 'EMERGENCY',
  to_domain: 'OUTPATIENT' as 'OUTPATIENT' | 'EMERGENCY',
  reason: '',
  correction_reason: '',
});
const busy = ref<string>('');
const notice = ref('');
const createHandoverOpen = ref(false);
const overviewOpen = ref(false);
const patientDialogOpen = ref(false);
const switchDialogOpen = ref(false);
const completeTarget = ref<ShiftHandoverWire | null>(null);
const voidTarget = ref<ShiftHandoverWire | null>(null);
const voidReason = ref('');
const editingHandover = ref<ShiftHandoverWire | null>(null);
const handoverCorrectionReason = ref('');
const editingPatient = ref<ShiftHandoverPatientWire | null>(null);
const voidPatientTarget = ref<ShiftHandoverPatientWire | null>(null);
const patientVoidReason = ref('');
const editingSwitch = ref<EncounterDomainSwitchWire | null>(null);
const voidSwitchTarget = ref<EncounterDomainSwitchWire | null>(null);
const switchVoidReason = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await Promise.all([handoversQuery.refetch(), switchesQuery.refetch(), handoverPatientsQuery.refetch()]);
}

function openCreateHandover() { editingHandover.value = null; handoverCorrectionReason.value = ''; Object.assign(handoverForm, { shift_from: new Date().toISOString().slice(0, 16), shift_to: new Date(Date.now() + 8 * 60 * 60_000).toISOString().slice(0, 16), incoming_user_id: clinicalContext.collaboratorUserId, handover_summary: '' }); createHandoverOpen.value = true; }
function openEditHandover(item: ShiftHandoverWire) { editingHandover.value = item; handoverCorrectionReason.value = ''; Object.assign(handoverForm, { shift_from: new Date(item.shift_from).toISOString().slice(0, 16), shift_to: new Date(item.shift_to).toISOString().slice(0, 16), incoming_user_id: item.incoming_user_id, handover_summary: item.handover_summary }); createHandoverOpen.value = true; }
function openCreatePatient() { editingPatient.value = null; Object.assign(patientForm, { summary: '', risk_flag: false, reason: '' }); patientDialogOpen.value = true; }
function openEditPatient(item: ShiftHandoverPatientWire) { editingPatient.value = item; Object.assign(patientForm, { summary: item.summary, risk_flag: item.risk_flag, reason: '' }); patientDialogOpen.value = true; }
function openCreateSwitch() { editingSwitch.value = null; Object.assign(switchForm, { from_encounter_id: clinicalContext.emergencyEncounterId, to_encounter_id: clinicalContext.inpatientEncounterId, from_domain: 'EMERGENCY', to_domain: 'OUTPATIENT', reason: '', correction_reason: '' }); switchDialogOpen.value = true; }
function openEditSwitch(item: EncounterDomainSwitchWire) { editingSwitch.value = item; Object.assign(switchForm, { from_encounter_id: item.from_encounter_id, to_encounter_id: item.to_encounter_id, from_domain: item.from_domain, to_domain: item.to_domain, reason: item.reason, correction_reason: '' }); switchDialogOpen.value = true; }

async function createHandover() {
  if (busy.value || !handoverForm.shift_from.trim() || !handoverForm.shift_to.trim() || !handoverForm.handover_summary.trim() || (editingHandover.value && handoverCorrectionReason.value.trim().length < 4)) return;
  busy.value = 'handover'; notice.value = '';
  try {
    const input = {
      ward_id: wardId,
      shift_from: new Date(handoverForm.shift_from).toISOString(),
      shift_to: new Date(handoverForm.shift_to).toISOString(),
      incoming_user_id: handoverForm.incoming_user_id,
      handover_summary: handoverForm.handover_summary.trim(),
    };
    const created = editingHandover.value
      ? await correctShiftHandover(facilityLease.data.value!, editingHandover.value, { ...input, reason: handoverCorrectionReason.value.trim() })
      : await createShiftHandover(facilityLease.data.value!, input);
    handoverForm.shift_from = ''; handoverForm.shift_to = ''; handoverForm.handover_summary = '';
    selectedHandoverId.value = created.handover_id;
    notice.value = editingHandover.value ? '交接班已生成更正版本，有效患者清单已同步继承。' : '交接班已创建，可补充交接患者后完成交接。';
    editingHandover.value = null; handoverCorrectionReason.value = '';
    createHandoverOpen.value = false;
    await handoversQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function completeHandover() {
  const handover = completeTarget.value;
  if (!handover) return;
  if (busy.value || handover.status !== 'DRAFT') return;
  busy.value = handover.handover_id; notice.value = '';
  try {
    await completeShiftHandover(facilityLease.data.value!, handover);
    notice.value = '交接班已完成，交接摘要与患者清单进入审计链。';
    completeTarget.value = null;
    await handoversQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function addHandoverPatient() {
  if (busy.value || !selectedHandover.value || !patientForm.summary.trim() || (editingPatient.value && patientForm.reason.trim().length < 4)) return;
  busy.value = 'patient'; notice.value = '';
  try {
    const input = {
      ward_id: wardId,
      handover_id: selectedHandover.value.handover_id,
      patient_id: clinicalContext.inpatientPatientId,
      summary: patientForm.summary.trim(),
      risk_flag: patientForm.risk_flag,
    };
    if (editingPatient.value) await correctShiftHandoverPatient(handoverPatientLease.data.value!, editingPatient.value, wardId, { summary: input.summary, risk_flag: input.risk_flag, reason: patientForm.reason.trim() });
    else await createShiftHandoverPatient(handoverPatientLease.data.value!, input);
    patientForm.summary = ''; patientForm.risk_flag = false;
    notice.value = editingPatient.value ? '交接患者条目已生成更正版本。' : '交接患者已加入交接清单。';
    editingPatient.value = null;
    patientDialogOpen.value = false;
    await handoverPatientsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function confirmVoidHandover() {
  const handover = voidTarget.value;
  if (!handover || busy.value || voidReason.value.trim().length < 4) return;
  busy.value = 'void'; notice.value = '';
  try {
    await voidShiftHandover(facilityLease.data.value!, handover, voidReason.value.trim());
    notice.value = '交接班已删除（逻辑作废），原始交接证据继续只读保留。';
    voidTarget.value = null; voidReason.value = '';
    await handoversQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function recordSwitch() {
  if (busy.value || !switchForm.reason.trim() || (editingSwitch.value && switchForm.correction_reason.trim().length < 4)) return;
  busy.value = 'switch'; notice.value = '';
  try {
    const input = {
      from_encounter_id: switchForm.from_encounter_id.trim(),
      to_encounter_id: switchForm.to_encounter_id.trim(),
      from_domain: switchForm.from_domain,
      to_domain: switchForm.to_domain,
      reason: switchForm.reason.trim(),
      switched_at: new Date().toISOString(),
    };
    if (editingSwitch.value) await correctEncounterDomainSwitch(patientLease.data.value!, editingSwitch.value, { ...input, correction_reason: switchForm.correction_reason.trim() });
    else await recordEncounterDomainSwitch(patientLease.data.value!, input);
    switchForm.reason = '';
    notice.value = editingSwitch.value ? '域切换已生成更正版本。' : '域切换已记录（先救治后补登 / 门急诊切换）。';
    editingSwitch.value = null;
    switchDialogOpen.value = false;
    await switchesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function confirmVoidPatient() { const lease = handoverPatientLease.data.value; const target = voidPatientTarget.value; if (!lease || !target || busy.value || patientVoidReason.value.trim().length < 4) return; busy.value = 'patient-void'; try { await voidShiftHandoverPatient(lease, target, wardId, patientVoidReason.value.trim()); notice.value = '交接患者已逻辑删除，不再阻断交接流程。'; voidPatientTarget.value = null; patientVoidReason.value = ''; await handoverPatientsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoidSwitch() { const lease = patientLease.data.value; const target = voidSwitchTarget.value; if (!lease || !target || busy.value || switchVoidReason.value.trim().length < 4) return; busy.value = 'switch-void'; try { await voidEncounterDomainSwitch(lease, target, switchVoidReason.value.trim()); notice.value = '域切换已逻辑删除，不再计入当前流转追踪。'; voidSwitchTarget.value = null; switchVoidReason.value = ''; await switchesQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-head"><div class="page-title"><h1>急诊会诊、交接与转运</h1><p>急会诊时限、跨班交接和跨区域转运共享同一未完任务清单</p></div><div class="head-actions"><button class="btn" @click="overviewOpen=true">交班总览</button><button class="btn" @click="openCreateHandover">新建交接班</button><button class="btn" @click="openCreateSwitch">记录域切换</button><button class="btn primary" @click="selectedHandover?.status==='DRAFT' ? (completeTarget=selectedHandover) : openCreateHandover()">发起交接确认</button></div></div>

    <ClinicalPageState v-if="facilityLease.isPending.value || patientLease.isPending.value || handoverPatientLease.isPending.value || handoversQuery.isPending.value || switchesQuery.isPending.value" kind="loading" message="正在读取交接与转运记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <EmergencyPatientStrip />
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="grid secondary-grid emergency-prototype-layout">
        <section class="card scroll-card emergency-prototype-main"><div class="card-head">导管室交接单 <span class="status" :class="selectedHandover?.status==='DRAFT'?'amber':'green'">{{ selectedHandover?.status==='DRAFT'?'待双方确认':'已完成' }}</span></div><div class="card-body">
          <div class="emergency-handoff-selector"><label><span>当前交接班</span><select v-model="selectedHandoverId"><option value="" disabled>选择交接班…</option><option v-for="handover in handovers" :key="handover.handover_id" :value="handover.handover_id">{{ handover.shift_from }} → {{ handover.shift_to }} · {{ handover.status }}</option></select></label><button class="btn sm" :disabled="!selectedHandover || selectedHandover.status!=='DRAFT'" @click="openCreatePatient">新增交接患者</button></div>
          <div v-if="!selectedHandover" class="clinical-empty-state compact"><strong>暂无交接班</strong><span>请新建交接班后登记交接患者。</span></div>
          <template v-else><div v-for="item in handoverPatients.slice(0, 8)" :key="item.shift_handover_patient_id" class="handoff-row"><span class="status" :class="item.risk_flag?'red':'green'">{{ item.risk_flag?'阻断':'已核' }}</span><b>患者 …{{ item.patient_id.slice(-8) }}</b><p>{{ item.summary }}</p><span class="inline-actions"><button class="btn sm" :disabled="selectedHandover.status!=='DRAFT'" @click="openEditPatient(item)">编辑</button><button class="btn sm danger" :disabled="selectedHandover.status!=='DRAFT'" @click="voidPatientTarget=item">删除</button></span></div><div v-if="handoverPatients.length>8" class="emergency-table-summary">显示最近 8 名交接患者；完整清单共 {{ handoverPatients.length }} 人。</div><div v-if="!handoverPatients.length" class="clinical-empty-state compact"><strong>尚未添加交接患者</strong><span>交接患者摘要、风险和责任人将进入审计链。</span></div><div class="form-row"><div class="label">交接摘要</div><div class="field textarea">{{ selectedHandover.handover_summary }}</div></div><div class="inline-actions emergency-handoff-actions"><button class="btn" :disabled="selectedHandover.status!=='DRAFT'||Boolean(selectedHandover.voided_at)" @click="openEditHandover(selectedHandover)">编辑交接</button><button class="btn primary" :disabled="selectedHandover.status!=='DRAFT'||Boolean(selectedHandover.voided_at)" @click="completeTarget=selectedHandover">完成交接</button><button class="btn danger" :disabled="Boolean(selectedHandover.voided_at)" @click="voidTarget=selectedHandover">删除</button></div></template>
        </div></section>
        <aside class="card scroll-card emergency-prototype-side"><div class="card-head">会诊与责任确认</div><div class="card-body"><div class="approval-box"><b>急诊跨班 / 跨区域交接</b><p class="meta">{{ selectedHandover ? `${selectedHandover.shift_from} → ${selectedHandover.shift_to}` : '待创建交接班' }}</p><span class="status" :class="selectedHandover?.status==='DRAFT'?'amber':'green'">{{ selectedHandover?.status==='DRAFT'?'待接班确认':'流程已闭环' }}</span></div><div class="section-title emergency-summary-title">交接双方</div><div v-for="actor in [['移交医生','急诊责任医生','已确认','green'],['移交护士','急诊责任护士','已确认','green'],['接收人员',selectedHandover?.incoming_user_id?'已指定':'待指定',selectedHandover?.incoming_user_id?'green':'amber'],['接收单元','随域切换确认',switches.length?'已确认':'待确认',switches.length?'green':'amber']]" :key="actor[0]" class="queue-item"><div class="queue-title">{{ actor[0] }} · {{ actor[1] }}<span class="status" :class="actor[3]">{{ actor[2] }}</span></div></div><div class="notice hard"><div class="notice-title">{{ handoverPatients.filter((item)=>item.risk_flag).length }} 个交接阻断</div>高危患者、未回结果和未完任务必须明确责任人；紧急转运仍需记录带入责任和补录时限。</div></div></aside>
      </div>
      <div class="emergency-handoff-lower"><section class="admin-panel"><header><div><h2>交接班历史</h2><p>版本、状态、完成时间与逻辑作废证据。</p></div><button class="button secondary" @click="handoversQuery.refetch()">刷新</button></header><div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班次</th><th>摘要</th><th>状态</th><th>完成时间</th><th>操作</th></tr></thead><tbody><tr v-for="handover in handovers.slice(0, 6)" :key="handover.handover_id" :class="{'is-voided':handover.voided_at}"><td><strong>{{ formatDate(handover.shift_from) }} → {{ formatDate(handover.shift_to) }}</strong></td><td>{{ handover.handover_summary }}</td><td>{{ handover.voided_at?'已作废':handover.status==='DRAFT'?'草稿':'已完成' }}</td><td>{{ formatDate(handover.completed_at) }}</td><td><span class="inline-actions"><button class="task-action" :disabled="handover.status!=='DRAFT'||Boolean(handover.voided_at)" @click="openEditHandover(handover)">编辑</button><button class="task-action" :disabled="handover.status!=='DRAFT'||Boolean(handover.voided_at)" @click="completeTarget=handover">完成</button><button class="task-action danger" :disabled="Boolean(handover.voided_at)" @click="voidTarget=handover">删除</button></span></td></tr></tbody></table></div><div v-if="handovers.length>6" class="emergency-table-summary">仅展示最近 6 个交接班；历史共 {{ handovers.length }} 条。</div></section><section class="admin-panel"><header><div><h2>转运 / 域切换记录</h2><p>先救治后补登与门急诊流转。</p></div><button class="button secondary" @click="openCreateSwitch">新增域切换</button></header><div v-if="!switches.length" class="admin-empty">暂无域切换记录。</div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>来源域</th><th>目标域</th><th>原因</th><th>切换时间</th><th>操作</th></tr></thead><tbody><tr v-for="sw in switches.slice(0, 6)" :key="sw.domain_switch_id"><td>{{ sw.from_domain }}</td><td>{{ sw.to_domain }}</td><td>{{ sw.reason }}</td><td>{{ formatDate(sw.switched_at) }}</td><td><span class="inline-actions"><button class="task-action" @click="openEditSwitch(sw)">编辑</button><button class="task-action danger" @click="voidSwitchTarget=sw">删除</button></span></td></tr></tbody></table></div></section></div>
    </template>

    <AdminActionDialog v-model:open="overviewOpen" title="急诊交班总览" description="交接班、患者风险和域切换均来自真实流程数据。" eyebrow="急诊 / 交接总览"><div class="emergency-rule-dialog"><div><span class="status blue">交接班</span><b>{{ handovers.length }} 条，待完成 {{ handovers.filter((item)=>item.status==='DRAFT'&&!item.voided_at).length }} 条</b></div><div><span class="status red">高危患者</span><b>{{ handoverPatients.filter((item)=>item.risk_flag).length }} 人</b></div><div><span class="status green">域切换</span><b>{{ switches.length }} 条</b></div></div></AdminActionDialog>

    <AdminActionDialog v-model:open="createHandoverOpen" :title="editingHandover?'编辑急诊交接班':'新建急诊交接班'" description="仅草稿可更正；更正后有效患者清单会继承到新版本。" eyebrow="急诊 / 会诊交接" :busy="busy==='handover'"><form class="admin-form" @submit.prevent="createHandover"><label><span>交班开始</span><input v-model="handoverForm.shift_from" type="datetime-local" autofocus required /></label><label><span>交班结束</span><input v-model="handoverForm.shift_to" type="datetime-local" required /></label><label><span>接诊人</span><input v-model="handoverForm.incoming_user_id" required /></label><label><span>交接摘要</span><textarea v-model="handoverForm.handover_summary" rows="3" required /></label><label v-if="editingHandover"><span>更正原因（至少 4 字）</span><textarea v-model="handoverCorrectionReason" rows="2" required /></label><button class="button primary" :disabled="Boolean(busy)||!handoverForm.shift_from.trim()||!handoverForm.shift_to.trim()||!handoverForm.handover_summary.trim()||(Boolean(editingHandover)&&handoverCorrectionReason.trim().length<4)">{{ busy==='handover'?'正在保存…':editingHandover?'保存更正版本':'创建交接班' }}</button></form></AdminActionDialog>
    <AdminActionDialog v-model:open="patientDialogOpen" :title="editingPatient?'编辑交接患者':'新增交接患者'" description="患者级摘要和风险标记会直接改变交接阻断统计。" eyebrow="急诊 / 患者交接" :busy="busy==='patient'"><form class="admin-form" @submit.prevent="addHandoverPatient"><label><span>交接患者摘要</span><textarea v-model="patientForm.summary" rows="3" autofocus required placeholder="病情、管路、用药与风险" /></label><label class="risk-confirm"><input v-model="patientForm.risk_flag" type="checkbox" /><span>存在危险信号</span></label><label v-if="editingPatient"><span>更正原因（至少 4 字）</span><textarea v-model="patientForm.reason" rows="2" required /></label><button class="button primary" :disabled="Boolean(busy)||!patientForm.summary.trim()||(Boolean(editingPatient)&&patientForm.reason.trim().length<4)">{{ busy==='patient'?'正在保存…':editingPatient?'保存更正版本':'加入交接清单' }}</button></form></AdminActionDialog>
    <AdminActionDialog :open="Boolean(completeTarget)" title="完成交接" description="确认后草稿转为已完成，摘要与患者清单进入不可逆审计链。" eyebrow="急诊 / 交接闭环" :busy="Boolean(busy)" @update:open="!$event&&(completeTarget=null)"><div class="admin-confirm-impact"><strong>{{ formatDate(completeTarget?.shift_from) }} → {{ formatDate(completeTarget?.shift_to) }}</strong><p>{{ completeTarget?.handover_summary }}</p></div><template #footer><button class="button secondary" @click="completeTarget=null">取消</button><button class="button primary" :disabled="Boolean(busy)" @click="completeHandover">{{ busy?'正在完成…':'确认完成交接' }}</button></template></AdminActionDialog>
    <AdminActionDialog v-model:open="switchDialogOpen" :title="editingSwitch?'编辑转运 / 域切换':'记录转运 / 域切换'" description="来源域与目标域必须不同，保存后影响门急诊流转追踪。" eyebrow="急诊 / 转运交接" size="large" :busy="busy==='switch'"><form class="admin-form" @submit.prevent="recordSwitch"><div class="form-row"><label><span>来源域</span><select v-model="switchForm.from_domain"><option value="EMERGENCY">急诊</option><option value="OUTPATIENT">门诊</option></select></label><label><span>目标域</span><select v-model="switchForm.to_domain"><option value="OUTPATIENT">门诊</option><option value="EMERGENCY">急诊</option></select></label></div><label><span>来源就诊</span><input v-model="switchForm.from_encounter_id" required /></label><label><span>目标就诊</span><input v-model="switchForm.to_encounter_id" required /></label><label><span>切换原因</span><textarea v-model="switchForm.reason" rows="3" required /></label><label v-if="editingSwitch"><span>更正原因（至少 4 字）</span><textarea v-model="switchForm.correction_reason" rows="2" required /></label><button class="button primary" :disabled="Boolean(busy)||!switchForm.reason.trim()||(Boolean(editingSwitch)&&switchForm.correction_reason.trim().length<4)">{{ busy==='switch'?'正在保存…':editingSwitch?'保存更正版本':'记录域切换' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除急诊交接班" description="删除执行为逻辑作废；该交接班将退出当前交接流程，历史证据不会被物理清除。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoidHandover"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
    <AdminConfirmDialog :open="Boolean(voidPatientTarget)" title="删除交接患者" description="该条目将退出交接风险和出院阻断计算。" confirm-label="确认删除并作废" :busy="busy==='patient-void'" @update:open="!$event&&(voidPatientTarget=null)" @confirm="confirmVoidPatient"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="patientVoidReason" rows="3" required /></label></AdminConfirmDialog>
    <AdminConfirmDialog :open="Boolean(voidSwitchTarget)" title="删除域切换记录" description="该记录将退出当前转运与流转追踪，历史证据保留。" confirm-label="确认删除并作废" :busy="busy==='switch-void'" @update:open="!$event&&(voidSwitchTarget=null)" @confirm="confirmVoidSwitch"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="switchVoidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
