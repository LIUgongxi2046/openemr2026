<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { TcmQcReviewWire } from '../../generated/contracts';
import { createTcmQcReview, issueSpecialtyEncounterLease, issueSpecialtyPatientLease, listTcmQcReviews } from '../../api/specialty-layers';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({
  queryKey: ['specialty-layers', 'tcm-qc', 'patient-lease'],
  queryFn: () => issueSpecialtyPatientLease('TCM_QC'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = computed(() => patientLeaseQuery.data.value);

const encounterLeaseQuery = useQuery({
  queryKey: ['specialty-layers', 'tcm-qc', 'encounter-lease'],
  queryFn: () => issueSpecialtyEncounterLease('TCM_QC'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = computed(() => encounterLeaseQuery.data.value);

const recordsQuery = useQuery({
  queryKey: ['specialty-layers', 'tcm-qc', 'records'],
  queryFn: () => listTcmQcReviews(patientLease.value!),
  enabled: () => Boolean(patientLease.value),
  retry: false,
});

const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value)
  ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? recordsQuery.error.value) : null);
const records = computed(() => recordsQuery.data.value ?? []);
const anyPending = computed(() => patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || recordsQuery.isPending.value);

const form = reactive({
  reviewedRecordType: 'HERBAL_PRESCRIPTION' as TcmQcReviewWire['reviewed_record_type'],
  reviewedRecordId: '',
  reviewConclusion: 'PASS' as TcmQcReviewWire['review_conclusion'],
  defectDescription: '',
  reviewedAt: new Date().toISOString(),
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
  if (!lease || busy.value || !form.reviewedRecordId.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createTcmQcReview(lease, {
      reviewed_record_type: form.reviewedRecordType,
      reviewed_record_id: form.reviewedRecordId.trim(),
      review_conclusion: form.reviewConclusion,
      defect_description: form.defectDescription.trim() || null,
      reviewed_at: form.reviewedAt,
    });
    form.reviewedRecordId = ''; form.defectDescription = '';
    notice.value = '质控复核已创建，复核结论与缺陷描述已留痕。';
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
        <p class="eyebrow">专科其余层 / 妇产 · 质控</p>
        <h1>质控复核</h1>
        <p>复核分娩/产前检查记录，登记复核结论与缺陷描述；写入采用患者+就诊上下文租约。</p>
      </div>
      <div class="admin-inline-tools">
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button>
      </div>
    </div>

    <ClinicalPageState v-if="anyPending" kind="loading" message="正在读取质控复核" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>质控复核台账</h2><p>当前患者产科质控复核档案。</p></div>
          </header>
          <div v-if="records.length === 0" class="admin-empty" role="status">暂无质控复核，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>复核记录类型</th><th>记录ID</th><th>结论</th><th>缺陷描述</th><th>复核时间</th></tr></thead>
              <tbody>
                <tr v-for="record in records" :key="record.review_id">
                  <td>{{ record.reviewed_record_type === 'HERBAL_PRESCRIPTION' ? '方药处方' : '四诊记录' }}</td>
                  <td>{{ record.reviewed_record_id }}</td>
                  <td>{{ record.review_conclusion === 'PASS' ? '通过' : '不通过' }}</td>
                  <td>{{ record.defect_description ?? '—' }}</td>
                  <td>{{ formatDate(record.reviewed_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增质控复核</h2><p>复核记录类型、记录ID与结论必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRecord">
            <label><span>复核记录类型</span><select v-model="form.reviewedRecordType">
              <option value="HERBAL_PRESCRIPTION">方药处方</option><option value="FOUR_EXAMINATIONS">四诊记录</option>
            </select></label>
            <label><span>被复核记录ID</span><input v-model="form.reviewedRecordId" required placeholder="UUID" /></label>
            <label><span>复核结论</span><select v-model="form.reviewConclusion">
              <option value="PASS">通过</option><option value="FAIL">不通过</option>
            </select></label>
            <label><span>复核时间</span><input v-model="form.reviewedAt" type="datetime-local" required /></label>
            <label><span>缺陷描述</span><textarea v-model="form.defectDescription" rows="3" placeholder="可选" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建质控复核' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
