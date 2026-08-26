<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { OphthalmologyRecordWire } from '../../generated/contracts';
import { createOphthalmologyRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listOphthalmologyRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'ophthalmology-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('OPHTHALMOLOGY_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'ophthalmology-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('OPHTHALMOLOGY_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'ophthalmology-record', 'records'],
  queryFn: () => listOphthalmologyRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  laterality: 'OD' as OphthalmologyRecordWire['laterality'],
  iopOd: '',
  iopOs: '',
  surgicalEye: 'NONE' as OphthalmologyRecordWire['surgical_eye'],
});
const busy = ref('');
const notice = ref('');

function lateralityLabel(value: string) {
  return value === 'OD' ? '右眼' : value === 'OS' ? '左眼' : '双眼';
}

function surgicalEyeLabel(value: string) {
  return value === 'NONE' ? '无' : lateralityLabel(value);
}

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = encounterLease.value;
  if (!lease || busy.value) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createOphthalmologyRecord(lease, {
      laterality: form.laterality,
      iop_od_mmhg: String(form.iopOd).trim() === '' ? null : Number(form.iopOd),
      iop_os_mmhg: String(form.iopOs).trim() === '' ? null : Number(form.iopOs),
      surgical_eye: form.surgicalEye,
    });
    form.iopOd = ''; form.iopOs = '';
    notice.value = '眼科记录已创建，眼别、眼压与手术眼标识已留痕。';
    await recordsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">专科记录 / 眼科</p>
        <h1>眼科记录</h1>
        <p>眼别、双眼眼压与手术眼标识登记，用于术前核对与术后随访。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取眼科记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>眼科记录台账</h2><p>当前患者眼科档案，眼压单位 mmHg。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无眼科记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>眼别</th><th>右眼眼压</th><th>左眼眼压</th><th>手术眼</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.ophthalmology_record_id">
                  <td>{{ lateralityLabel(record.laterality) }}</td>
                  <td>{{ record.iop_od_mmhg ?? '—' }}</td>
                  <td>{{ record.iop_os_mmhg ?? '—' }}</td>
                  <td>{{ surgicalEyeLabel(record.surgical_eye) }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增眼科记录</h2><p>眼别与手术眼必填，眼压可选。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>眼别</span><select v-model="form.laterality">
              <option value="OD">右眼</option>
              <option value="OS">左眼</option>
              <option value="OU">双眼</option>
            </select></label>
            <label><span>右眼眼压（mmHg）</span><input v-model.number="form.iopOd" type="number" step="0.1" placeholder="可选" /></label>
            <label><span>左眼眼压（mmHg）</span><input v-model.number="form.iopOs" type="number" step="0.1" placeholder="可选" /></label>
            <label><span>手术眼</span><select v-model="form.surgicalEye">
              <option value="NONE">无</option>
              <option value="OD">右眼</option>
              <option value="OS">左眼</option>
              <option value="OU">双眼</option>
            </select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建眼科记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
