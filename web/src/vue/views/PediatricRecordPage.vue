<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { PediatricRecordWire } from '../../generated/contracts';
import { createPediatricRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listPediatricRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'pediatrics-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('PEDIATRICS_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'pediatrics-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('PEDIATRICS_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'pediatrics-record', 'records'],
  queryFn: () => listPediatricRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  guardianName: '',
  guardianRelationship: 'MOTHER' as PediatricRecordWire['guardian_relationship'],
  guardianPhone: '',
  ageInMonths: 0,
  weightKg: 0,
  measuredAt: new Date().toISOString(),
  criticalFlag: false,
});
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = encounterLease.value;
  if (!lease || busy.value || !form.guardianName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createPediatricRecord(lease, {
      guardian_name: form.guardianName.trim(),
      guardian_relationship: form.guardianRelationship,
      guardian_phone: form.guardianPhone.trim() || null,
      age_in_months: form.ageInMonths,
      weight_kg: form.weightKg,
      measured_at: form.measuredAt,
      critical_flag: form.criticalFlag,
    });
    form.guardianName = ''; form.guardianPhone = '';
    form.ageInMonths = 0; form.weightKg = 0; form.criticalFlag = false;
    notice.value = '儿科记录已创建，监护人信息与测量时间已留痕。';
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
        <p class="eyebrow">专科记录 / 儿科</p>
        <h1>儿科记录</h1>
        <p>监护人、月龄、体重与危急标志登记；危急标志用于风险显式提示。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取儿科记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>儿科记录台账</h2><p>当前患者儿科档案，危急标志显式登记。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无儿科记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>监护人</th><th>关系</th><th>电话</th><th>月龄</th><th>体重(kg)</th><th>测量时间</th><th>危急</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.pediatric_record_id">
                  <td><strong>{{ record.guardian_name }}</strong></td>
                  <td>{{ record.guardian_relationship }}</td>
                  <td>{{ record.guardian_phone ?? '—' }}</td>
                  <td>{{ record.age_in_months }}</td>
                  <td>{{ record.weight_kg }}</td>
                  <td>{{ formatDate(record.measured_at) }}</td>
                  <td>{{ record.critical_flag ? '危急' : '—' }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增儿科记录</h2><p>监护人、关系、月龄、体重与测量时间必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>监护人姓名</span><input v-model="form.guardianName" maxlength="128" required /></label>
            <label><span>监护人关系</span><select v-model="form.guardianRelationship">
              <option value="MOTHER">母亲</option>
              <option value="FATHER">父亲</option>
              <option value="LEGAL_GUARDIAN">法定监护人</option>
              <option value="OTHER">其他</option>
            </select></label>
            <label><span>监护人电话</span><input v-model="form.guardianPhone" maxlength="32" placeholder="可选" /></label>
            <label><span>月龄</span><input v-model.number="form.ageInMonths" type="number" min="0" required /></label>
            <label><span>体重（kg）</span><input v-model.number="form.weightKg" type="number" min="0" step="0.1" required /></label>
            <label><span>测量时间</span><input v-model="form.measuredAt" type="datetime-local" required /></label>
            <label class="checkbox"><input v-model="form.criticalFlag" type="checkbox" />危急标志</label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建儿科记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
