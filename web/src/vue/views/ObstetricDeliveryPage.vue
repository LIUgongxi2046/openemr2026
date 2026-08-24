<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ObstetricDeliveryRecordWire } from '../../generated/contracts';
import { createObstetricDeliveryRecord, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listObstetricDeliveryRecords } from '../../api/specialty-layers';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty-layers', 'obgyn-treatment', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('OBGYN_DELIVERY'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty-layers', 'obgyn-treatment', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('OBGYN_DELIVERY'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty-layers', 'obgyn-treatment', 'records'],
  queryFn: () => listObstetricDeliveryRecords(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  neonatePatientId: '',
  deliveryMethod: 'VAGINAL' as ObstetricDeliveryRecordWire['delivery_method'],
  deliveredAt: new Date().toISOString(),
  bloodLossMl: 0,
  laborDurationMinutes: '',
  postpartumHemorrhage: false,
});
const busy = ref('');
const notice = ref('');

function deliveryMethodLabel(value: string) {
  const map: Record<string, string> = {
    VAGINAL: '阴道分娩', CESAREAN: '剖宫产', FORCEPS: '产钳助产', VACUUM: '胎吸助产',
  };
  return map[value] ?? value;
}

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await recordsQuery.refetch();
}

async function createRecord() {
  const lease = patientLease.value;
  if (!lease || busy.value) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createObstetricDeliveryRecord(lease, {
      neonate_patient_id: form.neonatePatientId.trim() || null,
      delivery_method: form.deliveryMethod,
      delivered_at: form.deliveredAt,
      blood_loss_ml: form.bloodLossMl,
      labor_duration_minutes: form.laborDurationMinutes.trim() === '' ? null : Number(form.laborDurationMinutes),
      postpartum_hemorrhage: form.postpartumHemorrhage,
    });
    form.neonatePatientId = ''; form.bloodLossMl = 0;
    form.laborDurationMinutes = ''; form.postpartumHemorrhage = false;
    notice.value = '分娩记录已创建，分娩方式、失血量与产后出血标识已留痕。';
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
        <p class="eyebrow">专科其余层 / 妇产 · 治疗</p>
        <h1>分娩记录</h1>
        <p>分娩方式、分娩时间、失血量、产程时长与产后出血标识登记；按患者上下文留痕审计链。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取分娩记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>分娩记录台账</h2><p>当前患者产科分娩档案。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无分娩记录，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>分娩方式</th><th>分娩时间</th><th>失血量(ml)</th><th>产程(分)</th><th>产后出血</th><th>新生儿ID</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.delivery_record_id">
                  <td>{{ deliveryMethodLabel(record.delivery_method) }}</td>
                  <td>{{ formatDate(record.delivered_at) }}</td>
                  <td>{{ record.blood_loss_ml }}</td>
                  <td>{{ record.labor_duration_minutes ?? '—' }}</td>
                  <td>{{ record.postpartum_hemorrhage ? '是' : '否' }}</td>
                  <td>{{ record.neonate_patient_id ?? '—' }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增分娩记录</h2><p>分娩方式、分娩时间与失血量必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>分娩方式</span><select v-model="form.deliveryMethod">
              <option value="VAGINAL">阴道分娩</option>
              <option value="CESAREAN">剖宫产</option>
              <option value="FORCEPS">产钳助产</option>
              <option value="VACUUM">胎吸助产</option>
            </select></label>
            <label><span>分娩时间</span><input v-model="form.deliveredAt" type="datetime-local" required /></label>
            <label><span>失血量（ml）</span><input v-model.number="form.bloodLossMl" type="number" min="0" required /></label>
            <label><span>产程时长（分）</span><input v-model="form.laborDurationMinutes" type="number" min="0" placeholder="可选" /></label>
            <label><span>新生儿ID</span><input v-model="form.neonatePatientId" placeholder="可选 UUID" /></label>
            <label class="checkbox"><input v-model="form.postpartumHemorrhage" type="checkbox" />产后出血</label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建分娩记录' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
