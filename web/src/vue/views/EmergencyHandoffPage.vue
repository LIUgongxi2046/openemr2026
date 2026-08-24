<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { ShiftHandoverWire } from '../../generated/contracts';
import {
  completeShiftHandover,
  createShiftHandover,
  createShiftHandoverPatient,
  issueEmergencyFacilityLease,
  issueEmergencyLease,
  listEncounterDomainSwitches,
  listShiftHandoverPatients,
  listShiftHandovers,
  recordEncounterDomainSwitch,
} from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
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
  const failed = [facilityLease, patientLease, handoversQuery, handoverPatientsQuery, switchesQuery].find((q) => q.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});
const handovers = computed(() => handoversQuery.data.value ?? []);
const handoverPatients = computed(() => handoverPatientsQuery.data.value ?? []);
const switches = computed(() => switchesQuery.data.value ?? []);
const selectedHandover = computed(() => handovers.value.find((h) => h.handover_id === selectedHandoverId.value) ?? null);

const handoverForm = reactive({ shift_from: '', shift_to: '', incoming_user_id: clinicalContext.collaboratorUserId, handover_summary: '' });
const patientForm = reactive({ summary: '', risk_flag: false });
const switchForm = reactive({
  from_encounter_id: clinicalContext.encounterId,
  to_encounter_id: clinicalContext.inpatientEncounterId,
  from_domain: 'EMERGENCY' as 'OUTPATIENT' | 'EMERGENCY',
  to_domain: 'OUTPATIENT' as 'OUTPATIENT' | 'EMERGENCY',
  reason: '',
});
const busy = ref<string>('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await Promise.all([handoversQuery.refetch(), switchesQuery.refetch(), handoverPatientsQuery.refetch()]);
}

async function createHandover() {
  if (busy.value || !handoverForm.shift_from.trim() || !handoverForm.shift_to.trim() || !handoverForm.handover_summary.trim()) return;
  busy.value = 'handover'; notice.value = '';
  try {
    const created = await createShiftHandover(facilityLease.data.value!, {
      ward_id: wardId,
      shift_from: handoverForm.shift_from.trim(),
      shift_to: handoverForm.shift_to.trim(),
      incoming_user_id: handoverForm.incoming_user_id,
      handover_summary: handoverForm.handover_summary.trim(),
    });
    handoverForm.shift_from = ''; handoverForm.shift_to = ''; handoverForm.handover_summary = '';
    selectedHandoverId.value = created.handover_id;
    notice.value = '交接班已创建，可补充交接患者后完成交接。';
    await handoversQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function completeHandover(handover: ShiftHandoverWire) {
  if (busy.value || handover.status !== 'DRAFT') return;
  busy.value = handover.handover_id; notice.value = '';
  try {
    await completeShiftHandover(facilityLease.data.value!, handover);
    notice.value = '交接班已完成，交接摘要与患者清单进入审计链。';
    await handoversQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function addHandoverPatient() {
  if (busy.value || !selectedHandover.value || !patientForm.summary.trim()) return;
  busy.value = 'patient'; notice.value = '';
  try {
    await createShiftHandoverPatient(facilityLease.data.value!, {
      ward_id: wardId,
      handover_id: selectedHandover.value.handover_id,
      patient_id: clinicalContext.patientId,
      summary: patientForm.summary.trim(),
      risk_flag: patientForm.risk_flag,
    });
    patientForm.summary = ''; patientForm.risk_flag = false;
    notice.value = '交接患者已加入交接清单。';
    await handoverPatientsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function recordSwitch() {
  if (busy.value || !switchForm.reason.trim()) return;
  busy.value = 'switch'; notice.value = '';
  try {
    await recordEncounterDomainSwitch(patientLease.data.value!, {
      from_encounter_id: switchForm.from_encounter_id.trim(),
      to_encounter_id: switchForm.to_encounter_id.trim(),
      from_domain: switchForm.from_domain,
      to_domain: switchForm.to_domain,
      reason: switchForm.reason.trim(),
      switched_at: new Date().toISOString(),
    });
    switchForm.reason = '';
    notice.value = '域切换已记录（先救治后补登 / 门急诊切换）。';
    await switchesQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 急诊</p>
        <h1>急诊会诊、交接与转运</h1>
        <p>交接班按班次与接诊人闭环（草稿→完成），交接患者逐条登记风险；门急诊域切换记录转运去向与原因。</p>
      </div>
      <RouterLink class="button secondary" to="/emergency">返回急诊工作台</RouterLink>
    </div>

    <ClinicalPageState v-if="facilityLease.isPending.value || patientLease.isPending.value || handoversQuery.isPending.value || switchesQuery.isPending.value" kind="loading" message="正在读取交接与转运记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="交接转运统计">
        <article><span>交接班</span><strong>{{ handovers.length }}</strong><small>病区 …{{ wardId.slice(-8) }}</small></article>
        <article><span>待完成交接</span><strong>{{ handovers.filter((h) => h.status === 'DRAFT').length }}</strong><small>DRAFT</small></article>
        <article><span>域切换</span><strong>{{ switches.length }}</strong><small>门急诊</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>交接班台账</h2><p>草稿状态可补充患者并完成。</p></div><button class="button secondary" @click="handoversQuery.refetch()">刷新</button></header>
          <div v-if="!handovers.length" class="admin-empty" role="status">暂无交接班，可在右侧新建。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>班次</th><th>摘要</th><th>状态</th><th>完成时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="handover in handovers" :key="handover.handover_id">
                  <td><strong>{{ handover.shift_from }} → {{ handover.shift_to }}</strong></td>
                  <td>{{ handover.handover_summary }}</td>
                  <td><span class="admin-status" :class="handover.status.toLowerCase()">{{ handover.status === 'DRAFT' ? '草稿' : '已完成' }}</span></td>
                  <td>{{ formatDate(handover.completed_at) }}</td>
                  <td>
                    <button class="task-action" :disabled="Boolean(busy) || handover.status !== 'DRAFT'" @click="completeHandover(handover)">{{ busy === handover.handover_id ? '处理中…' : '完成交接' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <header class="panel-subhead"><div><h2>交接患者清单</h2><p>选择一个交接班后登记交接患者。</p></div></header>
          <div class="admin-inline-tools">
            <label class="admin-code-input"><span>交接班</span>
              <select v-model="selectedHandoverId">
                <option value="" disabled>选择交接班…</option>
                <option v-for="handover in handovers" :key="handover.handover_id" :value="handover.handover_id">{{ handover.shift_from }} → {{ handover.shift_to }}</option>
              </select>
            </label>
          </div>
          <div v-if="!selectedHandover" class="admin-empty" role="status">请先选择交接班。</div>
          <div v-else-if="!handoverPatients.length" class="admin-empty" role="status">该交接班暂无交接患者，可在下方新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>患者</th><th>交接摘要</th><th>风险</th></tr></thead>
              <tbody>
                <tr v-for="patient in handoverPatients" :key="patient.shift_handover_patient_id">
                  <td><code>…{{ patient.patient_id.slice(-8) }}</code></td>
                  <td>{{ patient.summary }}</td>
                  <td><span class="admin-status" :class="patient.risk_flag ? 'danger' : 'muted'">{{ patient.risk_flag ? '高危' : '常规' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
          <form v-if="selectedHandover" class="admin-form" @submit.prevent="addHandoverPatient">
            <label><span>交接患者摘要</span><textarea v-model="patientForm.summary" rows="2" required placeholder="病情、管路、用药与风险" /></label>
            <label class="risk-confirm"><input v-model="patientForm.risk_flag" type="checkbox" /><span>存在危险信号</span></label>
            <button class="button primary" :disabled="Boolean(busy) || !patientForm.summary.trim()">{{ busy === 'patient' ? '正在加入…' : '加入交接清单' }}</button>
          </form>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新建交接班</h2><p>交班/接班班次与摘要必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createHandover">
            <label><span>交班班次</span><input v-model="handoverForm.shift_from" required placeholder="例：白班" /></label>
            <label><span>接班班次</span><input v-model="handoverForm.shift_to" required placeholder="例：夜班" /></label>
            <label><span>接诊人</span><input v-model="handoverForm.incoming_user_id" required placeholder="用户 ID" /></label>
            <label><span>交接摘要</span><textarea v-model="handoverForm.handover_summary" rows="3" required placeholder="整体病情与重点关注" /></label>
            <button class="button primary full" :disabled="Boolean(busy) || !handoverForm.shift_from.trim() || !handoverForm.shift_to.trim() || !handoverForm.handover_summary.trim()">{{ busy === 'handover' ? '正在创建…' : '创建交接班' }}</button>
          </form>
        </section>
      </div>

      <section class="admin-panel">
        <header><div><h2>转运 / 域切换记录</h2><p>门急诊域切换用于「先救治后补登」与跨域流转。</p></div><button class="button secondary" @click="switchesQuery.refetch()">刷新</button></header>
        <div v-if="!switches.length" class="admin-empty" role="status">暂无域切换记录，可在右侧新增。</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>来源域</th><th>目标域</th><th>原因</th><th>切换时间</th></tr></thead>
            <tbody>
              <tr v-for="sw in switches" :key="sw.domain_switch_id">
                <td><span class="admin-status" :class="sw.from_domain.toLowerCase()">{{ sw.from_domain }}</span></td>
                <td><span class="admin-status" :class="sw.to_domain.toLowerCase()">{{ sw.to_domain }}</span></td>
                <td>{{ sw.reason }}</td>
                <td>{{ formatDate(sw.switched_at) }}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <form class="admin-form" @submit.prevent="recordSwitch">
          <div class="form-row">
            <label><span>来源域</span><select v-model="switchForm.from_domain"><option value="EMERGENCY">急诊</option><option value="OUTPATIENT">门诊</option></select></label>
            <label><span>目标域</span><select v-model="switchForm.to_domain"><option value="OUTPATIENT">门诊</option><option value="EMERGENCY">急诊</option></select></label>
          </div>
          <label><span>来源就诊</span><input v-model="switchForm.from_encounter_id" required placeholder="就诊 ID" /></label>
          <label><span>目标就诊</span><input v-model="switchForm.to_encounter_id" required placeholder="就诊 ID" /></label>
          <label><span>切换原因</span><textarea v-model="switchForm.reason" rows="2" required placeholder="例：先救治后补登，门诊转入急诊" /></label>
          <button class="button primary" :disabled="Boolean(busy) || !switchForm.reason.trim()">{{ busy === 'switch' ? '正在记录…' : '记录域切换' }}</button>
        </form>
      </section>
    </template>
  </section>
</template>
