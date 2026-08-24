<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { AppointmentWire, WaitingQueueEntryWire } from '../../generated/contracts';
import {
  bookAppointment,
  callWaitingQueueEntry,
  cancelAppointment,
  checkInAppointment,
  consultAppointment,
  createScheduleSlot,
  issueEmergencyFacilityLease,
  issueEmergencyLease,
  listAppointments,
  listWaitingQueue,
} from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const facilityLease = useQuery({
  queryKey: ['appointment', 'facility-lease'],
  queryFn: () => issueEmergencyFacilityLease('APPOINTMENT_SCHEDULING'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = useQuery({
  queryKey: ['appointment', 'patient-lease'],
  queryFn: () => issueEmergencyLease('APPOINTMENT_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});

const appointmentsQuery = useQuery({
  queryKey: ['appointment', 'items'],
  queryFn: () => listAppointments(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const queueQuery = useQuery({
  queryKey: ['appointment', 'waiting-queue'],
  queryFn: () => listWaitingQueue(facilityLease.data.value!),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});

const issue = computed(() => {
  const failed = [facilityLease, patientLease, appointmentsQuery, queueQuery].find((q) => q.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});
const appointments = computed(() => appointmentsQuery.data.value ?? []);
const queue = computed(() => queueQuery.data.value ?? []);

const slotForm = reactive({
  visit_type: 'OUTPATIENT' as 'OUTPATIENT' | 'EMERGENCY',
  slot_date: new Date().toISOString().slice(0, 10),
  start_time: '08:00',
  end_time: '09:00',
  total_capacity: 20,
});
const bookForm = reactive({ schedule_slot_id: '', source: 'WALK_IN' as 'APPOINTMENT' | 'WALK_IN' | 'EMERGENCY' });
const busy = ref<string>('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await Promise.all([appointmentsQuery.refetch(), queueQuery.refetch()]);
}

async function createSlot() {
  if (busy.value || !slotForm.slot_date || !slotForm.start_time || !slotForm.end_time) return;
  busy.value = 'slot'; notice.value = '';
  try {
    const slot = await createScheduleSlot(facilityLease.data.value!, {
      visit_type: slotForm.visit_type,
      slot_date: slotForm.slot_date,
      start_time: slotForm.start_time,
      end_time: slotForm.end_time,
      total_capacity: slotForm.total_capacity,
    });
    bookForm.schedule_slot_id = slot.schedule_slot_id;
    notice.value = `班次号源已创建（号源 …${slot.schedule_slot_id.slice(-8)}），可直接用于预约。`;
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function book() {
  if (busy.value || !bookForm.schedule_slot_id.trim()) return;
  busy.value = 'book'; notice.value = '';
  try {
    await bookAppointment(patientLease.data.value!, { schedule_slot_id: bookForm.schedule_slot_id.trim(), source: bookForm.source });
    notice.value = '预约已生成（BOOKED），可报到进入就诊。';
    await appointmentsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function cancel(appointment: AppointmentWire, reason: string) {
  if (busy.value) return;
  busy.value = appointment.appointment_id; notice.value = '';
  try {
    await cancelAppointment(patientLease.data.value!, appointment, reason);
    notice.value = '退号完成，号源释放。';
    await appointmentsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function checkIn(appointment: AppointmentWire) {
  if (busy.value || appointment.status !== 'BOOKED') return;
  busy.value = appointment.appointment_id; notice.value = '';
  try {
    await checkInAppointment(patientLease.data.value!, appointment);
    notice.value = '已报到，生成就诊并进入候诊队列。';
    await Promise.all([appointmentsQuery.refetch(), queueQuery.refetch()]);
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function consult(appointment: AppointmentWire) {
  if (busy.value || appointment.status !== 'CHECKED_IN') return;
  busy.value = appointment.appointment_id; notice.value = '';
  try {
    await consultAppointment(patientLease.data.value!, appointment);
    notice.value = '接诊推进完成。';
    await appointmentsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function callEntry(entry: WaitingQueueEntryWire) {
  if (busy.value) return;
  busy.value = entry.waiting_queue_entry_id; notice.value = '';
  try {
    await callWaitingQueueEntry(facilityLease.data.value!, entry);
    notice.value = `已叫号 #${entry.sequence_no}。`;
    await queueQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 门急诊</p>
        <h1>预约、挂号、分诊、叫号与留观</h1>
        <p>班次号源 → 预约/现场挂号 → 报到生成就诊 → 候诊叫号 → 接诊推进；退号释放号源，全链路可追踪。</p>
      </div>
      <RouterLink class="button secondary" to="/outpatient">返回门诊</RouterLink>
    </div>

    <ClinicalPageState v-if="facilityLease.isPending.value || patientLease.isPending.value || appointmentsQuery.isPending.value || queueQuery.isPending.value" kind="loading" message="正在读取预约与候诊队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="预约挂号统计">
        <article><span>预约记录</span><strong>{{ appointments.length }}</strong><small>患者 …{{ clinicalContext.patientId.slice(-8) }}</small></article>
        <article><span>候诊队列</span><strong>{{ queue.length }}</strong><small>当前院区</small></article>
        <article><span>已报到</span><strong>{{ appointments.filter((a) => a.status === 'CHECKED_IN').length }}</strong><small>CHECKED_IN</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>预约与就诊</h2><p>报到后进入候诊队列，接诊推进完成就诊。</p></div><button class="button secondary" @click="appointmentsQuery.refetch()">刷新</button></header>
          <div v-if="!appointments.length" class="admin-empty" role="status">该患者暂无预约记录，可在右侧新建号源并预约。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>类型</th><th>来源</th><th>状态</th><th>预约时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="appointment in appointments" :key="appointment.appointment_id">
                  <td><span class="admin-status" :class="appointment.visit_type.toLowerCase()">{{ appointment.visit_type === 'EMERGENCY' ? '急诊' : '门诊' }}</span></td>
                  <td>{{ appointment.source }}</td>
                  <td><span class="admin-status" :class="appointment.status.toLowerCase()">{{ appointment.status }}</span></td>
                  <td>{{ formatDate(appointment.booked_at) }}</td>
                  <td>
                    <span class="inline-actions">
                      <button class="task-action" :disabled="Boolean(busy) || appointment.status !== 'BOOKED'" @click="checkIn(appointment)">报到</button>
                      <button class="task-action" :disabled="Boolean(busy) || appointment.status !== 'CHECKED_IN'" @click="consult(appointment)">接诊</button>
                      <button class="task-action" :disabled="Boolean(busy) || !['BOOKED', 'CHECKED_IN'].includes(appointment.status)" @click="cancel(appointment, '患者主动退号')">退号</button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <header class="panel-subhead"><div><h2>候诊队列与叫号</h2><p>按序号叫号推进接诊。</p></div></header>
          <div v-if="!queue.length" class="admin-empty" role="status">今日暂无候诊患者。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>序号</th><th>状态</th><th>叫号时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="entry in queue" :key="entry.waiting_queue_entry_id">
                  <td><strong>#{{ entry.sequence_no }}</strong></td>
                  <td><span class="admin-status" :class="entry.status.toLowerCase()">{{ entry.status }}</span></td>
                  <td>{{ formatDate(entry.called_at) }}</td>
                  <td><button class="task-action" :disabled="Boolean(busy) || entry.status !== 'WAITING'" @click="callEntry(entry)">叫号</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>班次号源</h2><p>新建号源后自动填入预约表单。</p></div></header>
          <form class="admin-form" @submit.prevent="createSlot">
            <label><span>就诊类型</span><select v-model="slotForm.visit_type"><option value="OUTPATIENT">门诊</option><option value="EMERGENCY">急诊</option></select></label>
            <label><span>号源日期</span><input v-model="slotForm.slot_date" type="date" required /></label>
            <div class="form-row">
              <label><span>开始</span><input v-model="slotForm.start_time" type="time" required /></label>
              <label><span>结束</span><input v-model="slotForm.end_time" type="time" required /></label>
            </div>
            <label><span>总号源数</span><input v-model.number="slotForm.total_capacity" type="number" min="1" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'slot' ? '正在创建…' : '创建班次号源' }}</button>
          </form>

          <header class="panel-subhead"><div><h2>预约 / 现场挂号</h2><p>需要号源 ID（创建号源后自动填入）。</p></div></header>
          <form class="admin-form" @submit.prevent="book">
            <label><span>号源 ID</span><input v-model="bookForm.schedule_slot_id" required placeholder="schedule_slot_id" /></label>
            <label><span>来源</span><select v-model="bookForm.source"><option value="APPOINTMENT">预约</option><option value="WALK_IN">现场挂号</option><option value="EMERGENCY">急诊</option></select></label>
            <button class="button primary full" :disabled="Boolean(busy) || !bookForm.schedule_slot_id.trim()">{{ busy === 'book' ? '正在预约…' : '预约/挂号' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
