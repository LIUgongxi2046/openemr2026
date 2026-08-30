<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import type { AppointmentWire, PatientSummaryWire, WaitingQueueEntryWire } from '../../generated/contracts';
import {
  bookAppointment, callWaitingQueueEntry, cancelAppointment, checkInAppointment, consultAppointment,
  issueEmergencyFacilityLease, issueOutpatientPatientLease, listAppointments, listScheduleSlots, listWaitingQueue,
  rescheduleAppointment,
} from '../../api/emergency';
import { issuePatientSearchLease, searchPatientsForAdmission } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import { clinicalCodeLabel, patientAge } from '../clinical-display';
import { toClinicalIssue } from '../clinical-error';

const facilityLease = useQuery({ queryKey: ['appointment', 'facility-lease'], queryFn: () => issueEmergencyFacilityLease('APPOINTMENT_SCHEDULING'), retry: false, staleTime: 300_000 });
const slotsQuery = useQuery({
  queryKey: ['appointment', 'slots'],
  queryFn: () => listScheduleSlots(facilityLease.data.value!, new Date().toISOString().slice(0, 10)),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});
const queueQuery = useQuery({
  queryKey: ['appointment', 'waiting-queue'], queryFn: () => listWaitingQueue(facilityLease.data.value!),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});

const searchQuery = ref('');
const candidates = ref<PatientSummaryWire[]>([]);
const selectedPatient = ref<PatientSummaryWire | null>(null);
const patientLease = ref<Awaited<ReturnType<typeof issueOutpatientPatientLease>> | null>(null);
const appointments = ref<AppointmentWire[]>([]);
const busy = ref('');
const notice = ref('');
const searchLease = ref<Awaited<ReturnType<typeof issuePatientSearchLease>> | null>(null);
const activeForm = ref(false);
const editingAppointment = ref<AppointmentWire | null>(null);
const cancellingAppointment = ref<AppointmentWire | null>(null);
const operationReason = ref('');
const form = reactive({ department_id: '', doctor_user_id: '', schedule_slot_id: '', source: 'APPOINTMENT' as 'APPOINTMENT' | 'WALK_IN' | 'EMERGENCY' });

const issue = computed(() => {
  const failed = [facilityLease, slotsQuery, queueQuery].find((item) => item.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});
const slots = computed(() => slotsQuery.data.value ?? []);
const queue = computed(() => queueQuery.data.value ?? []);
const departments = computed(() => [...new Map(slots.value.map((slot) => [slot.department_id, slot.department_name])).entries()]);
const doctors = computed(() => [...new Map(slots.value.filter((slot) => slot.department_id === form.department_id).map((slot) => [slot.doctor_user_id, slot.doctor_display_name])).entries()]);
const availableSlots = computed(() => slots.value.filter((slot) => slot.status === 'OPEN' && slot.booked_count < slot.total_capacity
  && slot.department_id === form.department_id && slot.doctor_user_id === form.doctor_user_id
  && slot.schedule_slot_id !== editingAppointment.value?.schedule_slot_id));
watch(slots, (items) => {
  if (!form.department_id && items[0]) form.department_id = items[0].department_id;
  if (!form.doctor_user_id) form.doctor_user_id = items.find((item) => item.department_id === form.department_id)?.doctor_user_id ?? '';
}, { immediate: true });

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
function patientMeta(sex: string, birth: string, id: string) { return `${clinicalCodeLabel(sex)} · ${patientAge(birth)} 岁 · 患者号 …${id.slice(-8)}`; }
function slotLabel(slot: typeof slots.value[number]) { return `${slot.slot_date} ${slot.start_time.slice(0, 5)}–${slot.end_time.slice(0, 5)} · 余 ${slot.total_capacity - slot.booked_count}`; }

async function search() {
  if (busy.value || !searchQuery.value.trim()) return;
  busy.value = 'search'; notice.value = '';
  try {
    searchLease.value ??= await issuePatientSearchLease();
    candidates.value = await searchPatientsForAdmission(searchLease.value, searchQuery.value.trim());
    if (!candidates.value.length) notice.value = '未找到患者，请核对身份证、就诊卡号或姓名。';
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function choosePatient(patient: PatientSummaryWire) {
  busy.value = 'patient'; notice.value = ''; selectedPatient.value = patient;
  try {
    patientLease.value = await issueOutpatientPatientLease('APPOINTMENT_WORKFLOW', patient.patient_id);
    appointments.value = await listAppointments(patientLease.value, patient.patient_id);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function reloadAppointments() {
  if (patientLease.value && selectedPatient.value) appointments.value = await listAppointments(patientLease.value, selectedPatient.value.patient_id);
}

async function book() {
  if (busy.value || !patientLease.value || !selectedPatient.value || !form.schedule_slot_id) return;
  busy.value = 'book'; notice.value = '';
  try {
    await bookAppointment(patientLease.value, { patient_id: selectedPatient.value.patient_id, schedule_slot_id: form.schedule_slot_id, source: form.source });
    notice.value = '预约挂号已写入数据库。';
    activeForm.value = false;
    form.schedule_slot_id = '';
    await Promise.all([reloadAppointments(), slotsQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginCreate() {
  if (!selectedPatient.value) return;
  editingAppointment.value = null;
  operationReason.value = '';
  form.schedule_slot_id = '';
  activeForm.value = true;
}

function beginEdit(appointment: AppointmentWire) {
  editingAppointment.value = appointment;
  operationReason.value = '';
  form.department_id = appointment.department_id;
  form.doctor_user_id = appointment.doctor_user_id;
  form.schedule_slot_id = '';
  form.source = appointment.source;
  activeForm.value = true;
}

async function submitAppointment() {
  if (!editingAppointment.value) return book();
  if (busy.value || !patientLease.value || !form.schedule_slot_id || operationReason.value.trim().length < 2) return;
  busy.value = 'reschedule'; notice.value = '';
  try {
    await rescheduleAppointment(patientLease.value, editingAppointment.value, form.schedule_slot_id, operationReason.value.trim());
    notice.value = '改约已原子释放原号源并锁定新号源，历史预约事件已留痕。';
    activeForm.value = false; editingAppointment.value = null; operationReason.value = '';
    await Promise.all([reloadAppointments(), slotsQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function confirmCancel() {
  if (busy.value || !patientLease.value || !cancellingAppointment.value || operationReason.value.trim().length < 2) return;
  const target = cancellingAppointment.value;
  busy.value = 'cancel'; notice.value = '';
  try {
    await cancelAppointment(patientLease.value, target, operationReason.value.trim());
    notice.value = '退号完成，号源已释放，取消理由已留痕。';
    cancellingAppointment.value = null; operationReason.value = '';
    await Promise.all([reloadAppointments(), queueQuery.refetch(), slotsQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function operate(type: 'check-in' | 'consult', appointment: AppointmentWire) {
  if (busy.value || !patientLease.value) return;
  busy.value = appointment.appointment_id; notice.value = '';
  try {
    if (type === 'check-in') await checkInAppointment(patientLease.value, appointment);
    if (type === 'consult') await consultAppointment(patientLease.value, appointment);
    notice.value = type === 'check-in' ? '报到成功，已进入候诊队列。' : '接诊已开始。';
    await Promise.all([reloadAppointments(), queueQuery.refetch(), slotsQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function callEntry(entry: WaitingQueueEntryWire) {
  if (busy.value) return;
  busy.value = entry.waiting_queue_entry_id;
  try { await callWaitingQueueEntry(facilityLease.data.value!, entry); notice.value = `已叫号 #${entry.sequence_no}`; await queueQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 门诊</p><h1>预约挂号与就诊队列</h1><p>检索患者身份后选择医院、科室、医生和可用班次；班次号源维护已移至业务配置。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/workflow">班次号源配置</RouterLink><button class="button primary" :disabled="!selectedPatient" @click="beginCreate">新建预约</button></div></div>
    <ClinicalPageState v-if="facilityLease.isPending.value || slotsQuery.isPending.value || queueQuery.isPending.value" kind="loading" message="正在读取号源与候诊队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="slotsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <section class="admin-panel"><header><div><h2>患者身份检索</h2><p>支持身份证号、就诊卡号或姓名；证件原文只在服务端做哈希匹配。</p></div></header><div class="admin-form"><label><span>患者信息</span><div class="admission-search"><input v-model="searchQuery" placeholder="身份证 / 就诊卡 / 姓名" @keyup.enter="search" /><button class="button secondary" :disabled="busy === 'search' || !searchQuery.trim()" @click="search">检索</button></div></label><div v-if="candidates.length" class="admission-candidates"><button v-for="patient in candidates" :key="patient.patient_id" type="button" :class="{ selected: selectedPatient?.patient_id === patient.patient_id }" @click="choosePatient(patient)"><span><strong>{{ patient.display_name }}</strong><small>{{ patient.sex_code }} · {{ patient.birth_date }}</small></span><code>…{{ patient.patient_id.slice(-8) }}</code></button></div></div></section>
      <div class="admin-layout appointment-layout form-closed">
        <section class="admin-panel"><header><div><h2>预约与就诊列表</h2><p>{{ selectedPatient ? `当前患者：${selectedPatient.display_name}` : '请先检索并选择患者' }}</p></div><button class="button secondary" :disabled="!selectedPatient" @click="reloadAppointments">刷新</button></header>
          <div v-if="!selectedPatient || !appointments.length" class="admin-empty">{{ selectedPatient ? '该患者暂无预约记录。' : '选择患者后加载数据库预约记录。' }}</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>患者</th><th>医院 / 科室</th><th>医生 / 班次</th><th>来源 / 状态</th><th>操作</th></tr></thead><tbody><tr v-for="appointment in appointments" :key="appointment.appointment_id"><td><strong>{{ appointment.patient_display_name }}</strong><small>{{ patientMeta(appointment.patient_sex_code, appointment.patient_birth_date, appointment.patient_id) }}</small></td><td><strong>{{ appointment.facility_name }}</strong><small>{{ appointment.department_name }}</small></td><td><strong>{{ appointment.doctor_display_name }}</strong><small>{{ appointment.slot_date }} {{ appointment.slot_start_time.slice(0, 5) }}–{{ appointment.slot_end_time.slice(0, 5) }}</small></td><td><span class="admin-status">{{ clinicalCodeLabel(appointment.source) }}</span><small>{{ clinicalCodeLabel(appointment.status) }}</small></td><td><span class="inline-actions"><button class="task-action" :disabled="Boolean(busy) || appointment.status !== 'BOOKED'" @click="beginEdit(appointment)">编辑改约</button><button class="task-action" :disabled="Boolean(busy) || appointment.status !== 'BOOKED'" @click="operate('check-in', appointment)">报到</button><button class="task-action" :disabled="Boolean(busy) || appointment.status !== 'CHECKED_IN'" @click="operate('consult', appointment)">接诊</button><button class="task-action danger" :disabled="Boolean(busy) || appointment.status !== 'BOOKED'" @click="cancellingAppointment = appointment; operationReason = ''">删除·退号</button></span></td></tr></tbody></table></div>
          <header class="panel-subhead"><div><h2>今日候诊与叫号</h2><p>操作后实时写入数据库队列状态。</p></div></header><div v-if="!queue.length" class="admin-empty">今日暂无候诊患者。</div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>序号</th><th>患者</th><th>状态</th><th>叫号时间</th><th>操作</th></tr></thead><tbody><tr v-for="entry in queue" :key="entry.waiting_queue_entry_id"><td>#{{ entry.sequence_no }}</td><td><strong>{{ entry.patient_display_name }}</strong><small>{{ patientMeta(entry.patient_sex_code, entry.patient_birth_date, entry.patient_id) }}</small></td><td>{{ clinicalCodeLabel(entry.status) }}</td><td>{{ formatDate(entry.called_at) }}</td><td><button class="task-action" :disabled="Boolean(busy) || entry.status !== 'WAITING'" @click="callEntry(entry)">叫号</button></td></tr></tbody></table></div>
        </section>
      </div>
      <BusinessActionDialog :open="activeForm" :title="editingAppointment ? '编辑预约·改约' : '新建预约'" :description="editingAppointment ? '改约会原子锁定新号源、释放原号源并追加审计事件。' : '医院、科室、医生与号源均来自业务配置。'" eyebrow="门诊 / 预约挂号" :confirm-label="editingAppointment ? '确认改约' : '确认预约挂号'" :busy="busy === 'book' || busy === 'reschedule'" width="wide" @cancel="activeForm = false; editingAppointment = null" @confirm="submitAppointment"><div class="dialog-grid"><label><span>患者</span><input :value="selectedPatient?.display_name" disabled /></label><label><span>医院 / 院区</span><input :value="slots[0]?.facility_name || '当前登录院区'" disabled /></label><label><span>科室</span><select v-model="form.department_id" required @change="form.doctor_user_id = ''; form.schedule_slot_id = ''"><option value="" disabled>请选择科室</option><option v-for="[id, name] in departments" :key="id" :value="id">{{ name }}</option></select></label><label><span>医生</span><select v-model="form.doctor_user_id" required @change="form.schedule_slot_id = ''"><option value="" disabled>请选择医生</option><option v-for="[id, name] in doctors" :key="id" :value="id">{{ name }}</option></select></label><label><span>可预约班次</span><select v-model="form.schedule_slot_id" required><option value="" disabled>请选择日期与时段</option><option v-for="slot in availableSlots" :key="slot.schedule_slot_id" :value="slot.schedule_slot_id">{{ slotLabel(slot) }}</option></select></label><label v-if="!editingAppointment"><span>挂号来源</span><select v-model="form.source"><option value="APPOINTMENT">预约</option><option value="WALK_IN">现场挂号</option><option value="EMERGENCY">急诊</option></select></label></div><p v-if="editingAppointment && !availableSlots.length" class="dialog-warning">当前医生暂无其他可用班次，请先配置新号源后再改约。</p><label v-if="editingAppointment">改约原因<textarea v-model="operationReason" required minlength="2" maxlength="1000" rows="3" placeholder="必填，将写入不可变预约事件" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(cancellingAppointment)" title="删除预约·退号" description="不会物理删除：预约转为已取消、释放号源，历史事件保留。" eyebrow="门诊 / 预约挂号" confirm-label="确认退号" danger :busy="busy === 'cancel'" @cancel="cancellingAppointment = null" @confirm="confirmCancel"><p class="dialog-warning">{{ cancellingAppointment?.doctor_display_name }} · {{ cancellingAppointment?.slot_date }} {{ cancellingAppointment?.slot_start_time.slice(0, 5) }}</p><label>退号原因<textarea v-model="operationReason" required minlength="2" maxlength="1000" rows="3" placeholder="必填，将写入不可变预约事件" /></label></BusinessActionDialog>
    </template>
  </section>
</template>
