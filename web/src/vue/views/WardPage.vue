<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ShiftHandoverWire } from '../../generated/contracts';
import { issueContextLease, issueWardLease, loadInpatientWorklist, clinicalContext } from '../../clinical-api';
import {
  completeShiftHandover, createShiftHandover, createShiftHandoverPatient,
  listShiftHandoverPatients, listShiftHandovers, voidShiftHandover,
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
const issue = computed(() => (leaseQuery.error.value ?? handoversQuery.error.value ?? worklistQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? handoversQuery.error.value ?? worklistQuery.error.value) : null);
const handovers = computed(() => handoversQuery.data.value ?? []);
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

function statusLabel(status: string) {
  return status === 'DRAFT' ? '草稿' : status === 'COMPLETED' ? '已完成' : status;
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
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>心内科一病区 · 护理工作台</h1><p>床位风险、本班待办与交接班证据联动，仅接班护士可确认完成</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="handoversQuery.refetch()">刷新交接班</button><button class="btn primary" type="button" @click="createOpen = true">新增交接班</button></div>
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
      <div class="prototype-ward-grid">
        <section class="admin-panel ward-patient-board"><header><div><h2>床位与重点患者</h2><p>真实在院清单，按逾期和待办数排序。</p></div><span>{{ wardPatients.length }} 人在院</span></header><div v-if="!wardPatients.length" class="admin-empty">当前病区无在院患者。</div><div v-else class="ward-patient-grid"><button v-for="patient in wardPatients" :key="patient.admission_id" type="button" :class="{ active: patient.patient_id === selectedWardPatient?.patient_id, risk: patient.overdue_task_count > 0 }" @click="selectedWardPatientId = patient.patient_id; patientForm.patientId = patient.patient_id"><span>{{ patient.bed_label }}床</span><strong>{{ patient.patient_display_name }}</strong><small>待办 {{ patient.pending_task_count }} · 逾期 {{ patient.overdue_task_count }}</small></button></div></section>
        <InpatientPrototypeRail mode="ward" :patient-name="selectedWardPatient?.patient_display_name" :bed-label="selectedWardPatient?.bed_label" :pending-count="selectedWardPatient?.pending_task_count ?? 0" :overdue-count="selectedWardPatient?.overdue_task_count ?? 0" :total-count="handovers.length" />
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
    </template>
  </section>
</template>
