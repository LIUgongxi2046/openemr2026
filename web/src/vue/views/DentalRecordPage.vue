<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { createDentalRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listDentalRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'dental-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('DENTAL_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'dental-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('DENTAL_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'dental-record', 'records'],
  queryFn: () => listDentalRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({ toothNotation: '', procedureTooth: '' });
const busy = ref('');
const notice = ref('');

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = encounterLease.value;
  if (!lease || busy.value || !form.toothNotation.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createDentalRecord(lease, {
      tooth_notation: form.toothNotation.trim(),
      procedure_tooth: form.procedureTooth.trim() || null,
    });
    form.toothNotation = ''; form.procedureTooth = '';
    notice.value = '口腔记录已创建，牙位记法与操作牙位已留痕。';
    await recordsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">专科记录 / 口腔</p>
        <h1>口腔记录</h1>
        <p>牙位记法与操作牙位登记，支撑口腔治疗与复诊追溯。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取口腔记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>口腔记录台账</h2><p>当前患者口腔档案，牙位记法登记。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无口腔记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>牙位记法</th><th>操作牙位</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.dental_record_id">
                  <td><code>{{ record.tooth_notation }}</code></td>
                  <td>{{ record.procedure_tooth ?? '—' }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增口腔记录</h2><p>牙位记法必填，操作牙位可选。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>牙位记法</span><input v-model="form.toothNotation" maxlength="32" required placeholder="例：11 / 36 / 48" /></label>
            <label><span>操作牙位</span><input v-model="form.procedureTooth" maxlength="32" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建口腔记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
