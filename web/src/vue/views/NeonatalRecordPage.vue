<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { NeonatalRecordWire } from '../../generated/contracts';
import { createNeonatalRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listNeonatalRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'neonatal-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('NEONATAL_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'neonatal-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('NEONATAL_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'neonatal-record', 'records'],
  queryFn: () => listNeonatalRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  motherPatientId: '',
  birthDatetime: new Date().toISOString(),
  gestationalAgeWeeks: 0,
  apgar1min: 0,
  apgar5min: 0,
  birthWeightG: 0,
  sexAtBirth: 'MALE' as NeonatalRecordWire['sex_at_birth'],
});
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function sexLabel(value: string) {
  return value === 'MALE' ? '男' : value === 'FEMALE' ? '女' : '不确定';
}

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = encounterLease.value;
  if (!lease || busy.value || !form.motherPatientId.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createNeonatalRecord(lease, {
      mother_patient_id: form.motherPatientId.trim(),
      birth_datetime: form.birthDatetime,
      gestational_age_weeks: form.gestationalAgeWeeks,
      apgar_1min: form.apgar1min,
      apgar_5min: form.apgar5min,
      birth_weight_g: form.birthWeightG,
      sex_at_birth: form.sexAtBirth,
    });
    form.motherPatientId = ''; form.gestationalAgeWeeks = 0;
    form.apgar1min = 0; form.apgar5min = 0; form.birthWeightG = 0;
    notice.value = '新生儿记录已创建，Apgar 评分与出生体重已留痕。';
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
        <p class="eyebrow">专科记录 / 新生儿</p>
        <h1>新生儿记录</h1>
        <p>出生时间、胎龄、Apgar 评分、出生体重与出生性别登记，关联母亲患者。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取新生儿记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>新生儿记录台账</h2><p>当前患者新生儿档案，含 Apgar 与出生体重。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无新生儿记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>母亲</th><th>出生时间</th><th>胎龄(周)</th><th>Apgar 1分钟</th><th>Apgar 5分钟</th><th>出生体重(g)</th><th>性别</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.neonatal_record_id">
                  <td><code>…{{ record.mother_patient_id.slice(-8) }}</code></td>
                  <td>{{ formatDate(record.birth_datetime) }}</td>
                  <td>{{ record.gestational_age_weeks }}</td>
                  <td>{{ record.apgar_1min }}</td>
                  <td>{{ record.apgar_5min }}</td>
                  <td>{{ record.birth_weight_g }}</td>
                  <td>{{ sexLabel(record.sex_at_birth) }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增新生儿记录</h2><p>母亲患者 ID、出生时间、胎龄、Apgar、出生体重与性别必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>母亲患者 ID</span><input v-model="form.motherPatientId" maxlength="36" required placeholder="UUID" /></label>
            <label><span>出生时间</span><input v-model="form.birthDatetime" type="datetime-local" required /></label>
            <label><span>胎龄（周）</span><input v-model.number="form.gestationalAgeWeeks" type="number" min="0" required /></label>
            <label><span>Apgar 1 分钟</span><input v-model.number="form.apgar1min" type="number" min="0" max="10" required /></label>
            <label><span>Apgar 5 分钟</span><input v-model.number="form.apgar5min" type="number" min="0" max="10" required /></label>
            <label><span>出生体重（g）</span><input v-model.number="form.birthWeightG" type="number" min="0" required /></label>
            <label><span>出生性别</span><select v-model="form.sexAtBirth">
              <option value="MALE">男</option>
              <option value="FEMALE">女</option>
              <option value="INDETERMINATE">不确定</option>
            </select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建新生儿记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
