<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DermatologyRecordWire } from '../../generated/contracts';
import { createDermatologyRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listDermatologyRecords } from '../../api/specialty';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty', 'dermatology-record', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('DERMATOLOGY_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty', 'dermatology-record', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('DERMATOLOGY_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty', 'dermatology-record', 'records'],
  queryFn: () => listDermatologyRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  bodySite: 'SCALP' as DermatologyRecordWire['body_site'],
  bsaPercent: 0,
  pasiScore: '',
});
const busy = ref('');
const notice = ref('');

function bodySiteLabel(value: string) {
  const map: Record<string, string> = {
    SCALP: '头皮', FACE: '面部', NECK: '颈部', TRUNK: '躯干', UPPER_EXTREMITY: '上肢',
    LOWER_EXTREMITY: '下肢', PALMOPLANTAR: '掌跖', GENITAL: '生殖器', MUCOSAL: '黏膜', OTHER: '其他',
  };
  return map[value] ?? value;
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
    await createDermatologyRecord(lease, {
      body_site: form.bodySite,
      bsa_percent: form.bsaPercent,
      pasi_score: form.pasiScore.trim() === '' ? null : Number(form.pasiScore),
    });
    form.bsaPercent = 0; form.pasiScore = '';
    notice.value = '皮肤科记录已创建，受累部位、体表面积与 PASI 评分已留痕。';
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
        <p class="eyebrow">专科记录 / 皮肤</p>
        <h1>皮肤科记录</h1>
        <p>受累部位、体表面积（BSA）与 PASI 评分登记，用于银屑病等皮损评估。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取皮肤科记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>皮肤科记录台账</h2><p>当前患者皮肤科档案，BSA 为百分比。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无皮肤科记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>部位</th><th>BSA(%)</th><th>PASI 评分</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.dermatology_record_id">
                  <td>{{ bodySiteLabel(record.body_site) }}</td>
                  <td>{{ record.bsa_percent }}</td>
                  <td>{{ record.pasi_score ?? '—' }}</td>
                  <td><span class="admin-status" :class="record.status.toLowerCase()">{{ record.status === 'ACTIVE' ? '有效' : '已完成' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增皮肤科记录</h2><p>部位与 BSA 必填，PASI 评分可选。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>受累部位</span><select v-model="form.bodySite">
              <option value="SCALP">头皮</option>
              <option value="FACE">面部</option>
              <option value="NECK">颈部</option>
              <option value="TRUNK">躯干</option>
              <option value="UPPER_EXTREMITY">上肢</option>
              <option value="LOWER_EXTREMITY">下肢</option>
              <option value="PALMOPLANTAR">掌跖</option>
              <option value="GENITAL">生殖器</option>
              <option value="MUCOSAL">黏膜</option>
              <option value="OTHER">其他</option>
            </select></label>
            <label><span>BSA（%）</span><input v-model.number="form.bsaPercent" type="number" min="0" max="100" step="0.1" required /></label>
            <label><span>PASI 评分</span><input v-model="form.pasiScore" type="number" step="0.1" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建皮肤科记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
