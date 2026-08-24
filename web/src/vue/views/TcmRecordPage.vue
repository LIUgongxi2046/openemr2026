<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { createTcmRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listTcmRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'tcm-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('TCM_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'tcm-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('TCM_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'tcm-record', 'records'],
  queryFn: () => listTcmRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  syndromePattern: '',
  treatmentPrinciple: '',
  formulaName: '',
  containsToxicHerb: false,
  toxicHerbPrecautions: '',
});
const busy = ref('');
const notice = ref('');

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = encounterLease.value;
  if (!lease || busy.value || !form.syndromePattern.trim() || !form.treatmentPrinciple.trim() || !form.formulaName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createTcmRecord(lease, {
      syndrome_pattern: form.syndromePattern.trim(),
      treatment_principle: form.treatmentPrinciple.trim(),
      formula_name: form.formulaName.trim(),
      contains_toxic_herb: form.containsToxicHerb,
      toxic_herb_precautions: form.toxicHerbPrecautions.trim() || null,
    });
    form.syndromePattern = ''; form.treatmentPrinciple = ''; form.formulaName = '';
    form.containsToxicHerb = false; form.toxicHerbPrecautions = '';
    notice.value = '中医记录已创建，证型、治则与毒性药材警示已留痕。';
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
        <p class="eyebrow">专科记录 / 中医</p>
        <h1>中医记录</h1>
        <p>证型、治则、方剂与毒性药材警示登记，支撑辨证论治留痕。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取中医记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>中医记录台账</h2><p>当前患者中医档案，含毒性药材警示。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无中医记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>证型</th><th>治则</th><th>方剂名</th><th>含毒性药材</th><th>毒性药材注意事项</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.tcm_record_id">
                  <td><strong>{{ record.syndrome_pattern }}</strong></td>
                  <td>{{ record.treatment_principle }}</td>
                  <td>{{ record.formula_name }}</td>
                  <td>{{ record.contains_toxic_herb ? '是' : '否' }}</td>
                  <td>{{ record.toxic_herb_precautions ?? '—' }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增中医记录</h2><p>证型、治则与方剂名必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>证型</span><input v-model="form.syndromePattern" maxlength="256" required placeholder="例：肝郁气滞" /></label>
            <label><span>治则</span><input v-model="form.treatmentPrinciple" maxlength="256" required placeholder="例：疏肝解郁" /></label>
            <label><span>方剂名</span><input v-model="form.formulaName" maxlength="256" required placeholder="例：逍遥散" /></label>
            <label class="checkbox"><input v-model="form.containsToxicHerb" type="checkbox" />含毒性药材</label>
            <label><span>毒性药材注意事项</span><textarea v-model="form.toxicHerbPrecautions" rows="3" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建中医记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
