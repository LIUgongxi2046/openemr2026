<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { MentalHealthRecordWire } from '../../generated/contracts';
import { createMentalHealthRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listMentalHealthRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'mental-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('MENTAL_HEALTH_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'mental-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('MENTAL_HEALTH_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'mental-record', 'records'],
  queryFn: () => listMentalHealthRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  suicideRiskLevel: 'NONE' as MentalHealthRecordWire['suicide_risk_level'],
  violenceRiskLevel: 'NONE' as MentalHealthRecordWire['violence_risk_level'],
  riskAssessedAt: new Date().toISOString(),
  protectiveMeasures: '',
});
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

function riskLabel(value: string) {
  return value === 'NONE' ? '无' : value === 'LOW' ? '低' : value === 'MODERATE' ? '中' : value === 'HIGH' ? '高' : '即刻';
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
    await createMentalHealthRecord(lease, {
      suicide_risk_level: form.suicideRiskLevel,
      violence_risk_level: form.violenceRiskLevel,
      risk_assessed_at: form.riskAssessedAt,
      protective_measures: form.protectiveMeasures.trim() || null,
    });
    form.protectiveMeasures = '';
    notice.value = '精神心理记录已创建，数据分级为受限（RESTRICTED），风险评估已留痕。';
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
        <p class="eyebrow">专科记录 / 精神心理</p>
        <h1>精神心理健康记录</h1>
        <p>自杀/暴力风险分级与保护措施；数据分级为受限（RESTRICTED），敏感信息严格管控。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取精神心理记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>风险评估台账</h2><p>当前患者精神心理风险评估，数据分级 RESTRICTED。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无精神心理记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>自杀风险</th><th>暴力风险</th><th>评估时间</th><th>保护措施</th><th>数据分级</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.mental_health_record_id">
                  <td>{{ riskLabel(record.suicide_risk_level) }}</td>
                  <td>{{ riskLabel(record.violence_risk_level) }}</td>
                  <td>{{ formatDate(record.risk_assessed_at) }}</td>
                  <td>{{ record.protective_measures ?? '—' }}</td>
                  <td><code>{{ record.data_classification }}</code></td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增风险评估</h2><p>自杀/暴力风险等级与评估时间必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>自杀风险等级</span><select v-model="form.suicideRiskLevel">
              <option value="NONE">无</option>
              <option value="LOW">低</option>
              <option value="MODERATE">中</option>
              <option value="HIGH">高</option>
              <option value="IMMINENT">即刻</option>
            </select></label>
            <label><span>暴力风险等级</span><select v-model="form.violenceRiskLevel">
              <option value="NONE">无</option>
              <option value="LOW">低</option>
              <option value="MODERATE">中</option>
              <option value="HIGH">高</option>
            </select></label>
            <label><span>评估时间</span><input v-model="form.riskAssessedAt" type="datetime-local" required /></label>
            <label><span>保护措施</span><textarea v-model="form.protectiveMeasures" rows="3" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建风险评估' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
