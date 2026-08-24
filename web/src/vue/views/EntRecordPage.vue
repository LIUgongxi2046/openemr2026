<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { EntRecordWire } from '../../generated/contracts';
import { createEntRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listEntRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'ent-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('ENT_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'ent-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('ENT_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'ent-record', 'records'],
  queryFn: () => listEntRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  laterality: 'LEFT' as EntRecordWire['laterality'],
  region: 'EAR' as EntRecordWire['region'],
  airwayRiskLevel: 'NONE' as EntRecordWire['airway_risk_level'],
  airwayPrecautions: '',
});
const busy = ref('');
const notice = ref('');

function lateralityLabel(value: string) {
  return value === 'LEFT' ? '左' : value === 'RIGHT' ? '右' : '双侧';
}

function regionLabel(value: string) {
  return value === 'EAR' ? '耳' : value === 'NOSE' ? '鼻' : '咽喉';
}

function riskLabel(value: string) {
  return value === 'NONE' ? '无' : value === 'LOW' ? '低' : value === 'MODERATE' ? '中' : '高';
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
    await createEntRecord(lease, {
      laterality: form.laterality,
      region: form.region,
      airway_risk_level: form.airwayRiskLevel,
      airway_precautions: form.airwayPrecautions.trim() || null,
    });
    form.airwayPrecautions = '';
    notice.value = '耳鼻喉记录已创建，气道风险等级与注意事项已留痕。';
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
        <p class="eyebrow">专科记录 / 耳鼻喉</p>
        <h1>耳鼻喉记录</h1>
        <p>侧别、部位、气道风险等级与气道注意事项登记，用于麻醉与急救预警。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取耳鼻喉记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>耳鼻喉记录台账</h2><p>当前患者耳鼻喉档案，含气道风险分级。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无耳鼻喉记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>侧别</th><th>部位</th><th>气道风险</th><th>气道注意事项</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.ent_record_id">
                  <td>{{ lateralityLabel(record.laterality) }}</td>
                  <td>{{ regionLabel(record.region) }}</td>
                  <td>{{ riskLabel(record.airway_risk_level) }}</td>
                  <td>{{ record.airway_precautions ?? '—' }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增耳鼻喉记录</h2><p>侧别、部位与气道风险等级必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>侧别</span><select v-model="form.laterality">
              <option value="LEFT">左</option>
              <option value="RIGHT">右</option>
              <option value="BILATERAL">双侧</option>
            </select></label>
            <label><span>部位</span><select v-model="form.region">
              <option value="EAR">耳</option>
              <option value="NOSE">鼻</option>
              <option value="THROAT">咽喉</option>
            </select></label>
            <label><span>气道风险等级</span><select v-model="form.airwayRiskLevel">
              <option value="NONE">无</option>
              <option value="LOW">低</option>
              <option value="MODERATE">中</option>
              <option value="HIGH">高</option>
            </select></label>
            <label><span>气道注意事项</span><textarea v-model="form.airwayPrecautions" rows="3" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建耳鼻喉记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
