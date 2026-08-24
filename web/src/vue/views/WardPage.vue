<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ShiftHandoverWire } from '../../generated/contracts';
import { issueContextLease, clinicalContext } from '../../clinical-api';
import {
  completeShiftHandover, createShiftHandover, createShiftHandoverPatient,
  listShiftHandoverPatients, listShiftHandovers,
} from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
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
const issue = computed(() => (leaseQuery.error.value ?? handoversQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? handoversQuery.error.value) : null);
const handovers = computed(() => handoversQuery.data.value ?? []);

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

function statusLabel(status: string) {
  return status === 'DRAFT' ? '草稿' : status === 'COMPLETED' ? '已完成' : status;
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.shiftFrom || !form.shiftTo || !form.incomingUserId || !form.handoverSummary.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createShiftHandover(lease, {
      shift_from: form.shiftFrom, shift_to: form.shiftTo, incoming_user_id: form.incomingUserId, handover_summary: form.handoverSummary.trim(),
    });
    form.shiftFrom = ''; form.shiftTo = ''; form.handoverSummary = '';
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
    notice.value = '患者已加入交接清单。'; await patientsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>病区看板</h1><p>交接班与患者级交接清单 · 交接内容不可变 · 仅接班护士可确认完成</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="handoversQuery.refetch()">刷新交接班</button></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || handoversQuery.isPending.value" kind="loading" message="正在读取病区交接" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="handoversQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="metric-grid" aria-label="病区交接指标">
        <div class="metric"><div class="name">交接班记录</div><div class="value">{{ handovers.length }}</div><div class="trend">班次区间台账</div></div>
        <div class="metric"><div class="name">待完成交接</div><div class="value">{{ handovers.filter((h) => h.status === 'DRAFT').length }}</div><div class="trend">仅接班护士确认</div></div>
        <div class="metric"><div class="name">已完成交接</div><div class="value">{{ handovers.filter((h) => h.status === 'COMPLETED').length }}</div><div class="trend">内容不可变</div></div>
        <div class="metric"><div class="name">患者级清单</div><div class="value">{{ patients.length }}</div><div class="trend">当前选中交接</div></div>
      </div>
      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>交接班台账</h2><p>班次区间 + 交班/接班护士。</p></div><button class="button secondary" @click="handoversQuery.refetch()">刷新</button></header>
          <div v-if="handovers.length === 0" class="admin-empty">该病区暂无交接班。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>班次区间</th><th>摘要</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="handover in handovers" :key="handover.handover_id">
              <td><button class="link-button" @click="selectedHandoverId = handover.handover_id"><strong>{{ handover.shift_from }} → {{ handover.shift_to }}</strong><small>…{{ handover.handover_id.slice(-8) }}</small></button></td>
              <td>{{ handover.handover_summary }}</td>
              <td><span class="admin-status" :class="handover.status.toLowerCase()">{{ statusLabel(handover.status) }}</span></td>
              <td><button class="task-action" :disabled="handover.status !== 'DRAFT' || Boolean(busy)" @click="complete(handover)">{{ busy === handover.handover_id ? '处理中…' : '完成' }}</button></td>
            </tr>
          </tbody></table></div>
        </section>
        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增交接班</h2><p>接班护士与交班护士分离。</p></div></header>
          <form class="admin-form" @submit.prevent="create">
            <label><span>交班时间</span><input v-model="form.shiftFrom" type="datetime-local" required /></label>
            <label><span>接班时间</span><input v-model="form.shiftTo" type="datetime-local" required /></label>
            <label><span>接班护士</span><input v-model="form.incomingUserId" required placeholder="人员 UUID" /></label>
            <label><span>交接摘要</span><textarea v-model="form.handoverSummary" required rows="3" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '创建中…' : '创建交接班' }}</button>
          </form>
        </section>
      </div>

      <section class="admin-panel" v-if="selectedHandoverId">
        <header><div><h2>患者级交接清单</h2><p>风险标记用于重点交接。</p></div>
          <form class="admin-inline-form" @submit.prevent="addPatient">
            <input v-model="patientForm.patientId" required placeholder="患者 UUID" />
            <input v-model="patientForm.summary" required placeholder="交接摘要" />
            <label class="inline-check"><input v-model="patientForm.riskFlag" type="checkbox" /> 风险</label>
            <button class="button primary" :disabled="Boolean(busy)">加入</button>
          </form>
        </header>
        <div v-if="patients.length === 0" class="admin-empty">该交接班暂无患者清单。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>患者</th><th>摘要</th><th>风险标记</th></tr></thead><tbody>
          <tr v-for="patient in patients" :key="patient.shift_handover_patient_id">
            <td><code>{{ patient.patient_id }}</code></td><td>{{ patient.summary }}</td>
            <td><span class="admin-status" :class="patient.risk_flag ? 'danger' : ''">{{ patient.risk_flag ? '风险' : '常规' }}</span></td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </main>
</template>
