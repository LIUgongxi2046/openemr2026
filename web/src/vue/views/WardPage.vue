<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { NursingCarePlanWire, ShiftHandoverWire, VitalSignRecordWire } from '../../generated/contracts';
import { issueContextLease, issueWardLease, loadInpatientWorklist, clinicalContext } from '../../clinical-api';
import {
  completeInpatientNursingCarePlan, createInpatientNursingCarePlan,
  completeShiftHandover, createShiftHandover, createShiftHandoverPatient,
  issueInpatientExecutionLease, listInpatientNursingCarePlans, listInpatientVitalSigns,
  listShiftHandoverPatients, listShiftHandovers, recordInpatientVitalSigns, voidShiftHandover,
} from '../../api/execution';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import InpatientPrototypeRail from '../components/InpatientPrototypeRail.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['ward', 'lease'],
  queryFn: () => issueContextLease(null, null, 'WARD_BOARD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const handoversQuery = useQuery({
  queryKey: ['ward', 'handovers'],
  queryFn: () => listShiftHandovers(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const nursingLeaseQuery = useQuery({
  queryKey: ['ward', 'inpatient-nursing-lease'],
  queryFn: () => issueInpatientExecutionLease('INPATIENT_NURSING_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const vitalsQuery = useQuery({
  queryKey: ['ward', 'inpatient-vitals'],
  queryFn: () => listInpatientVitalSigns(nursingLeaseQuery.data.value!),
  enabled: () => Boolean(nursingLeaseQuery.data.value), retry: false,
});
const carePlansQuery = useQuery({
  queryKey: ['ward', 'inpatient-care-plans'],
  queryFn: () => listInpatientNursingCarePlans(nursingLeaseQuery.data.value!),
  enabled: () => Boolean(nursingLeaseQuery.data.value), retry: false,
});
const issue = computed(() => {
  const error = leaseQuery.error.value ?? nursingLeaseQuery.error.value ?? handoversQuery.error.value
    ?? vitalsQuery.error.value ?? carePlansQuery.error.value ?? worklistQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});
const handovers = computed(() => handoversQuery.data.value ?? []);
const vitals = computed(() => vitalsQuery.data.value ?? []);
const carePlans = computed(() => carePlansQuery.data.value ?? []);
const worklistQuery = useQuery({
  queryKey: ['ward', 'inpatient-worklist'],
  queryFn: async () => loadInpatientWorklist(await issueWardLease()),
  retry: false, staleTime: 0, gcTime: 0,
});
const wardPatients = computed(() => worklistQuery.data.value ?? []);
const selectedWardPatientId = ref('');
const selectedWardPatient = computed(() => wardPatients.value.find((item) => item.patient_id === selectedWardPatientId.value) ?? wardPatients.value[0]);

const selectedHandoverId = ref('');
const patientsQuery = useQuery({
  queryKey: ['ward', 'handover-patients', selectedHandoverId],
  queryFn: () => listShiftHandoverPatients(leaseQuery.data.value!, selectedHandoverId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedHandoverId.value), retry: false,
});
const patients = computed(() => patientsQuery.data.value ?? []);

const form = reactive({ shiftFrom: '', shiftTo: '', incomingUserId: clinicalContext.collaboratorUserId, handoverSummary: '' });
const patientForm = reactive({ patientId: clinicalContext.inpatientPatientId, summary: '', riskFlag: false });
const busy = ref('');
const notice = ref('');
const createOpen = ref(false);
const patientOpen = ref(false);
const completeHandoverId = ref('');
const completeHandover = computed(() => handovers.value.find((item) => item.handover_id === completeHandoverId.value));
const voidHandoverId = ref('');
const voidReason = ref('');
const voidHandover = computed(() => handovers.value.find((item) => item.handover_id === voidHandoverId.value));
const vitalOpen = ref(false);
const carePlanOpen = ref(false);
const carePlanTarget = ref<NursingCarePlanWire | null>(null);
const carePlanDisposition = ref<'COMPLETED' | 'DISCONTINUED'>('COMPLETED');
const carePlanEvaluation = ref('');
const vitalForm = reactive({
  source: 'MANUAL' as VitalSignRecordWire['source'], temperature: 36.5, pulse: 72,
  respiration: 16, systolicBp: 120, diastolicBp: 80, spo2: 98,
});
const carePlanForm = reactive({
  nursingProblem: '', goal: '', intervention: '', priority: 'MEDIUM' as NursingCarePlanWire['priority'],
});

function statusLabel(status: string) {
  return status === 'DRAFT' ? '草稿' : status === 'COMPLETED' ? '已完成' : status;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.shiftFrom || !form.shiftTo || !form.incomingUserId || !form.handoverSummary.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createShiftHandover(lease, {
      shift_from: new Date(form.shiftFrom).toISOString(), shift_to: new Date(form.shiftTo).toISOString(), incoming_user_id: form.incomingUserId, handover_summary: form.handoverSummary.trim(),
    });
    form.shiftFrom = ''; form.shiftTo = ''; form.handoverSummary = '';
    createOpen.value = false;
    notice.value = '交接班已创建。'; await handoversQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function complete(handover: ShiftHandoverWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || handover.status !== 'DRAFT') return;
  busy.value = handover.handover_id; notice.value = '';
  try {
    await completeShiftHandover(lease, handover);
    completeHandoverId.value = '';
    notice.value = '交接班已完成。'; await handoversQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function addPatient() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedHandoverId.value || !patientForm.patientId || !patientForm.summary.trim()) return;
  busy.value = 'patient'; notice.value = '';
  try {
    await createShiftHandoverPatient(lease, {
      handover_id: selectedHandoverId.value, patient_id: patientForm.patientId, summary: patientForm.summary.trim(), risk_flag: patientForm.riskFlag,
    });
    patientForm.summary = ''; patientForm.riskFlag = false;
    patientOpen.value = false;
    notice.value = '患者已加入交接清单。'; await patientsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function voidDraft(handover: ShiftHandoverWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || handover.status !== 'DRAFT' || handover.voided_at || voidReason.value.trim().length < 4) return;
  busy.value = `void:${handover.handover_id}`; notice.value = '';
  try {
    await voidShiftHandover(lease, handover, voidReason.value.trim());
    voidHandoverId.value = ''; voidReason.value = '';
    notice.value = '交接班草稿已作废；原内容、原因与审计证据均已保留。';
    await handoversQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function recordVitals() {
  const lease = nursingLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'vitals'; notice.value = '';
  try {
    await recordInpatientVitalSigns(lease, {
      source: vitalForm.source, recorded_at: new Date().toISOString(),
      temperature: vitalForm.temperature, pulse: vitalForm.pulse, respiration: vitalForm.respiration,
      systolic_bp: vitalForm.systolicBp, diastolic_bp: vitalForm.diastolicBp, spo2: vitalForm.spo2,
    });
    vitalOpen.value = false;
    notice.value = '生命体征已写入当前住院就诊，采集来源、记录人和时间均已留痕。';
    await vitalsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createCarePlan() {
  const lease = nursingLeaseQuery.data.value;
  if (!lease || busy.value || !carePlanForm.nursingProblem.trim() || !carePlanForm.goal.trim()
    || !carePlanForm.intervention.trim()) return;
  busy.value = 'care-plan'; notice.value = '';
  try {
    await createInpatientNursingCarePlan(lease, {
      nursing_problem: carePlanForm.nursingProblem.trim(), goal: carePlanForm.goal.trim(),
      intervention: carePlanForm.intervention.trim(), priority: carePlanForm.priority,
    });
    carePlanForm.nursingProblem = ''; carePlanForm.goal = ''; carePlanForm.intervention = '';
    carePlanOpen.value = false;
    notice.value = '护理计划已建立并进入执行状态。';
    await carePlansQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function openCarePlanCompletion(plan: NursingCarePlanWire, disposition: 'COMPLETED' | 'DISCONTINUED') {
  carePlanTarget.value = plan; carePlanDisposition.value = disposition; carePlanEvaluation.value = '';
}

async function completeCarePlan() {
  const lease = nursingLeaseQuery.data.value;
  const plan = carePlanTarget.value;
  if (!lease || !plan || busy.value || carePlanEvaluation.value.trim().length < 4) return;
  busy.value = `care-plan:${plan.care_plan_id}`; notice.value = '';
  try {
    await completeInpatientNursingCarePlan(
      lease, plan, carePlanDisposition.value, carePlanEvaluation.value.trim(),
    );
    carePlanTarget.value = null; carePlanEvaluation.value = '';
    notice.value = carePlanDisposition.value === 'COMPLETED' ? '护理目标已评估完成并关闭。' : '护理计划已终止，原因和证据已保留。';
    await carePlansQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>心内科一病区 · 护理工作台</h1><p>床位风险、本班待办与交接班证据联动，仅接班护士可确认完成</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="handoversQuery.refetch()">刷新交接班</button><button class="btn primary" type="button" @click="createOpen = true">新增交接班</button></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || nursingLeaseQuery.isPending.value || handoversQuery.isPending.value || vitalsQuery.isPending.value || carePlansQuery.isPending.value" kind="loading" message="正在读取病区交接、生命体征与护理计划" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="handoversQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="metric-grid" aria-label="病区交接指标">
        <div class="metric"><div class="name">生命体征记录</div><div class="value">{{ vitals.length }}</div><div class="trend">当前住院就诊</div></div>
        <div class="metric"><div class="name">活动护理计划</div><div class="value">{{ carePlans.filter((plan) => plan.status === 'ACTIVE').length }}</div><div class="trend">需持续评估</div></div>
        <div class="metric"><div class="name">待完成交接</div><div class="value">{{ handovers.filter((h) => h.status === 'DRAFT').length }}</div><div class="trend">仅接班护士确认</div></div>
        <div class="metric"><div class="name">患者级清单</div><div class="value">{{ patients.length }}</div><div class="trend">当前选中交接</div></div>
      </div>
      <div class="prototype-ward-grid">
        <section class="admin-panel ward-patient-board"><header><div><h2>床位与重点患者</h2><p>真实在院清单，按逾期和待办数排序。</p></div><span>{{ wardPatients.length }} 人在院</span></header><div v-if="!wardPatients.length" class="admin-empty">当前病区无在院患者。</div><div v-else class="ward-patient-grid"><button v-for="patient in wardPatients" :key="patient.admission_id" type="button" :class="{ active: patient.patient_id === selectedWardPatient?.patient_id, risk: patient.overdue_task_count > 0 }" @click="selectedWardPatientId = patient.patient_id; patientForm.patientId = patient.patient_id"><span>{{ patient.bed_label }}床</span><strong>{{ patient.patient_display_name }}</strong><small>待办 {{ patient.pending_task_count }} · 逾期 {{ patient.overdue_task_count }}</small></button></div></section>
        <InpatientPrototypeRail mode="ward" :patient-name="selectedWardPatient?.patient_display_name" :bed-label="selectedWardPatient?.bed_label" :pending-count="selectedWardPatient?.pending_task_count ?? 0" :overdue-count="selectedWardPatient?.overdue_task_count ?? 0" :total-count="handovers.length" />
      </div>
      <div class="admin-layout nursing-clinical-grid">
        <section class="admin-panel">
          <header><div><h2>生命体征记录</h2><p>体温、脉搏、呼吸、血压和血氧写入当前住院就诊。</p></div><div class="toolbar-actions"><button class="button secondary" @click="vitalsQuery.refetch()">刷新</button><button class="button primary" @click="vitalOpen = true">记录生命体征</button></div></header>
          <div v-if="vitals.length === 0" class="admin-empty">当前住院就诊暂无生命体征记录。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>时间 / 来源</th><th>体温</th><th>脉搏 / 呼吸</th><th>血压</th><th>血氧</th></tr></thead><tbody><tr v-for="vital in vitals" :key="vital.vital_sign_record_id"><td><strong>{{ formatDate(vital.recorded_at) }}</strong><small>{{ vital.source === 'DEVICE' ? '设备采集' : '人工录入' }}</small></td><td>{{ vital.temperature ?? '—' }} ℃</td><td>{{ vital.pulse ?? '—' }} / {{ vital.respiration ?? '—' }}</td><td>{{ vital.systolic_bp ?? '—' }}/{{ vital.diastolic_bp ?? '—' }} mmHg</td><td>{{ vital.spo2 ?? '—' }}%</td></tr></tbody></table></div>
        </section>
        <section class="admin-panel">
          <header><div><h2>护理计划</h2><p>护理问题、目标、措施、优先级与完成评价全程留痕。</p></div><div class="toolbar-actions"><button class="button secondary" @click="carePlansQuery.refetch()">刷新</button><button class="button primary" @click="carePlanOpen = true">新建护理计划</button></div></header>
          <div v-if="carePlans.length === 0" class="admin-empty">当前住院就诊暂无护理计划。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>护理问题</th><th>目标与措施</th><th>优先级</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="plan in carePlans" :key="plan.care_plan_id"><td><strong>{{ plan.nursing_problem }}</strong><small>v{{ plan.row_version }}</small></td><td><b>{{ plan.goal }}</b><small>{{ plan.intervention }}</small><small v-if="plan.evaluation">评价：{{ plan.evaluation }}</small></td><td><span class="admin-status" :class="plan.priority === 'HIGH' ? 'danger' : ''">{{ plan.priority }}</span></td><td>{{ plan.status }}</td><td><div v-if="plan.status === 'ACTIVE'" class="toolbar-actions"><button class="task-action" @click="openCarePlanCompletion(plan, 'COMPLETED')">评估完成</button><button class="task-action danger" @click="openCarePlanCompletion(plan, 'DISCONTINUED')">终止</button></div><span v-else class="review-wait">已关闭</span></td></tr></tbody></table></div>
        </section>
      </div>
      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>交接班台账</h2><p>班次区间 + 交班/接班护士。</p></div><button class="button secondary" @click="handoversQuery.refetch()">刷新</button></header>
          <div v-if="handovers.length === 0" class="admin-empty">该病区暂无交接班。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班次区间</th><th>摘要</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="handover in handovers" :key="handover.handover_id">
              <td><button class="link-button" @click="selectedHandoverId = handover.handover_id"><strong>{{ handover.shift_from }} → {{ handover.shift_to }}</strong><small>…{{ handover.handover_id.slice(-8) }}</small></button></td>
              <td>{{ handover.handover_summary }}</td>
              <td><span class="admin-status" :class="handover.voided_at ? 'danger' : handover.status.toLowerCase()">{{ handover.voided_at ? '已作废' : statusLabel(handover.status) }}</span><small v-if="handover.void_reason">{{ handover.void_reason }}</small></td>
              <td><div class="toolbar-actions"><button class="task-action" :disabled="handover.status !== 'DRAFT' || Boolean(handover.voided_at) || Boolean(busy)" @click="completeHandoverId = handover.handover_id">{{ busy === handover.handover_id ? '处理中…' : '完成' }}</button><button v-if="handover.status === 'DRAFT' && !handover.voided_at" class="task-action danger" :disabled="Boolean(busy)" @click="voidHandoverId = handover.handover_id">作废</button></div></td>
            </tr>
          </tbody></table></div>
        </section>
        <aside class="admin-panel admin-form-panel"><header><div><h2>护理交接规则</h2><p>交班内容不可变，接班人与交班人必须分离。</p></div></header><div class="card-body"><ul class="admin-rule-list"><li>先创建班次交接记录</li><li>再逐位添加重点患者及风险标记</li><li>只有当前接班护士可确认完成</li></ul></div></aside>
      </div>

      <section class="admin-panel" v-if="selectedHandoverId">
        <header><div><h2>患者级交接清单</h2><p>风险标记用于重点交接。</p></div><button class="button primary" type="button" :disabled="Boolean(busy)" @click="patientOpen = true">加入患者</button></header>
        <div v-if="patients.length === 0" class="admin-empty">该交接班暂无患者清单。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>患者</th><th>摘要</th><th>风险标记</th></tr></thead><tbody>
          <tr v-for="patient in patients" :key="patient.shift_handover_patient_id">
            <td><code>{{ patient.patient_id }}</code></td><td>{{ patient.summary }}</td>
            <td><span class="admin-status" :class="patient.risk_flag ? 'danger' : ''">{{ patient.risk_flag ? '风险' : '常规' }}</span></td>
          </tr>
        </tbody></table></div>
      </section>
      <BusinessActionDialog :open="createOpen" title="新增交接班" description="接班护士与交班护士必须分离；确认后交接内容不可覆盖。" confirm-label="创建交接班" :busy="busy === 'create'" width="wide" @cancel="createOpen = false" @confirm="create"><div class="dialog-grid"><label>交班时间<input v-model="form.shiftFrom" type="datetime-local" required /></label><label>接班时间<input v-model="form.shiftTo" type="datetime-local" required /></label></div><label>接班护士<input v-model="form.incomingUserId" required placeholder="人员 UUID" /></label><label>交接摘要<textarea v-model="form.handoverSummary" required rows="4" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="patientOpen && Boolean(selectedHandoverId)" title="加入患者交接清单" description="患者摘要会成为本次班次的不可变交接证据。" confirm-label="确认加入" :busy="busy === 'patient'" @cancel="patientOpen = false" @confirm="addPatient"><label>患者<input v-model="patientForm.patientId" required placeholder="患者 UUID" /></label><label>交接摘要<textarea v-model="patientForm.summary" required rows="4" /></label><label class="dialog-check"><input v-model="patientForm.riskFlag" type="checkbox" />标记为重点风险患者</label></BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(completeHandover)" title="确认完成交接班" description="完成后交接内容与患者清单均转为只读证据。" confirm-label="确认完成" :busy="Boolean(busy)" @cancel="completeHandoverId = ''" @confirm="completeHandover && complete(completeHandover)"><p v-if="completeHandover" class="dialog-warning">{{ completeHandover.shift_from }} → {{ completeHandover.shift_to }} · {{ completeHandover.handover_summary }}</p></BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(voidHandover)" title="作废交接班草稿" description="医疗记录不物理删除；作废会保留原内容、原因、人员与时间。" confirm-label="确认作废并留痕" danger :busy="Boolean(busy)" @cancel="voidHandoverId = ''; voidReason = ''" @confirm="voidHandover && voidDraft(voidHandover)"><p v-if="voidHandover" class="dialog-warning">{{ voidHandover.handover_summary }}</p><label>作废原因<textarea v-model="voidReason" required minlength="4" maxlength="1000" rows="3" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="vitalOpen" title="记录住院生命体征" description="记录会关联当前患者和住院就诊，采集来源、记录人及时间进入审计证据。" confirm-label="确认记录" :busy="busy === 'vitals'" width="wide" @cancel="vitalOpen = false" @confirm="recordVitals"><div class="dialog-grid"><label>采集来源<select v-model="vitalForm.source"><option value="MANUAL">人工录入</option><option value="DEVICE">设备采集</option></select></label><label>体温（℃）<input v-model.number="vitalForm.temperature" type="number" min="25" max="45" step="0.1" required /></label><label>脉搏（次/分）<input v-model.number="vitalForm.pulse" type="number" min="20" max="300" required /></label><label>呼吸（次/分）<input v-model.number="vitalForm.respiration" type="number" min="5" max="80" required /></label><label>收缩压（mmHg）<input v-model.number="vitalForm.systolicBp" type="number" min="40" max="300" required /></label><label>舒张压（mmHg）<input v-model.number="vitalForm.diastolicBp" type="number" min="20" max="200" required /></label><label>血氧（%）<input v-model.number="vitalForm.spo2" type="number" min="40" max="100" step="0.1" required /></label></div></BusinessActionDialog>
      <BusinessActionDialog :open="carePlanOpen" title="新建护理计划" description="护理问题、目标和措施会进入当前住院就诊的执行闭环。" confirm-label="建立计划" :busy="busy === 'care-plan'" width="wide" @cancel="carePlanOpen = false" @confirm="createCarePlan"><div class="dialog-grid"><label>优先级<select v-model="carePlanForm.priority"><option value="HIGH">高</option><option value="MEDIUM">中</option><option value="LOW">低</option></select></label><label>护理问题<input v-model="carePlanForm.nursingProblem" required maxlength="1000" /></label></div><label>护理目标<textarea v-model="carePlanForm.goal" required maxlength="1000" rows="3" /></label><label>护理措施<textarea v-model="carePlanForm.intervention" required maxlength="2000" rows="4" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(carePlanTarget)" :title="carePlanDisposition === 'COMPLETED' ? '评估并完成护理计划' : '终止护理计划'" description="关闭动作要求形成评价或终止依据；原计划不物理删除。" :confirm-label="carePlanDisposition === 'COMPLETED' ? '确认完成' : '确认终止'" :danger="carePlanDisposition === 'DISCONTINUED'" :busy="busy.startsWith('care-plan:')" @cancel="carePlanTarget = null; carePlanEvaluation = ''" @confirm="completeCarePlan"><p v-if="carePlanTarget" class="dialog-warning">{{ carePlanTarget.nursing_problem }} · {{ carePlanTarget.goal }}</p><label>{{ carePlanDisposition === 'COMPLETED' ? '完成评价' : '终止原因' }}（至少 4 字）<textarea v-model="carePlanEvaluation" required minlength="4" maxlength="1000" rows="4" /></label></BusinessActionDialog>
    </template>
  </section>
</template>
