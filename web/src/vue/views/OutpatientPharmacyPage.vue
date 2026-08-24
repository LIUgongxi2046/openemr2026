<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { PharmacyDispensingWire } from '../../generated/contracts';
import { developmentCopy } from '../../development-copy';
import { issueExecutionPatientLease, listPharmacyDispensings, preparePharmacyDispensing, transitionPharmacyDispensing } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const statusLabels: Record<PharmacyDispensingWire['status'], string> = {
  PREPARED: '已调配', VERIFIED: '已核验', DISPENSED: '已发药',
};
const leaseQuery = useQuery({
  queryKey: ['execution', 'outpatient-pharmacy', 'lease'],
  queryFn: () => issueExecutionPatientLease('PHARMACY_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const dispensingsQuery = useQuery({
  queryKey: ['execution', 'outpatient-pharmacy', 'dispensings'],
  queryFn: () => listPharmacyDispensings(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? dispensingsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? dispensingsQuery.error.value) : null);
const dispensings = computed(() => dispensingsQuery.data.value ?? []);
const preparedCount = computed(() => dispensings.value.filter((d) => d.status === 'PREPARED').length);
const dispensedCount = computed(() => dispensings.value.filter((d) => d.status === 'DISPENSED').length);

const form = reactive({ drugCode: '', batchNumber: '', quantity: 1, quantityUnit: '片' });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await dispensingsQuery.refetch(); }

async function prepare() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.drugCode.trim() || !form.batchNumber.trim() || form.quantity <= 0 || !form.quantityUnit.trim()) return;
  busy.value = 'prepare'; notice.value = '';
  try {
    await preparePharmacyDispensing(lease, {
      drug_code: form.drugCode.trim(), batch_number: form.batchNumber.trim(),
      quantity: form.quantity, quantity_unit: form.quantityUnit.trim(),
      prepared_at: new Date().toISOString(),
    });
    form.drugCode = ''; form.batchNumber = '';
    notice.value = '调剂已调配，等待第二人审方核验后方可发药。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transition(dispensing: PharmacyDispensingWire, action: 'VERIFY' | 'DISPENSE') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = `${action}:${dispensing.dispensing_id}`; notice.value = '';
  try {
    await transitionPharmacyDispensing(lease, dispensing, action);
    notice.value = action === 'VERIFY' ? '已第二人核验，可发药。' : '已双人核验后发药，出箱事件已同步。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">医疗协同执行 / 药房</p><h1>门诊药房审方与调剂</h1><p>调配 → 第二人审方核验 → 发药，三步闭环；未核验不可发药。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button></div>
    </div>
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.outpatientPatientName }}</strong><span>门诊发药双人核验</span></div><dl><div><dt>发药前提</dt><dd>第二人核验</dd></div><div><dt>批次</dt><dd>强制填写</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || dispensingsQuery.isPending.value" kind="loading" message="正在读取门诊调剂台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="门诊药房统计">
        <article><span>调剂笔数</span><strong>{{ dispensings.length }}</strong><small>当前患者</small></article>
        <article><span>待核验</span><strong>{{ preparedCount }}</strong><small>PREPARED</small></article>
        <article><span>已发药</span><strong>{{ dispensedCount }}</strong><small>DISPENSED</small></article>
      </section>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>调剂台账</h2><p>状态机：PREPARED → VERIFIED → DISPENSED，每步写入审计链。</p></div><button class="button secondary" @click="dispensingsQuery.refetch()">刷新</button></header>
          <div v-if="dispensings.length === 0" class="empty-state"><span>药</span><p>当前患者暂无调剂记录</p><small>在右侧录入药品与批次开始调配</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>药品</th><th>批次</th><th>数量</th><th>调配人 / 核验人</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="dispensing in dispensings" :key="dispensing.dispensing_id">
                  <td><strong><code>{{ dispensing.drug_code }}</code></strong><small>…{{ dispensing.dispensing_id.slice(-8) }}</small></td>
                  <td>{{ dispensing.batch_number }}</td>
                  <td>{{ dispensing.quantity }} {{ dispensing.quantity_unit }}</td>
                  <td><small>调配 …{{ dispensing.dispensed_by.slice(-8) }}</small><small>核验 {{ dispensing.verified_by ? `…${dispensing.verified_by.slice(-8)}` : '—' }}</small></td>
                  <td><span class="admin-status" :class="dispensing.status.toLowerCase()">{{ statusLabels[dispensing.status] }}</span></td>
                  <td>{{ formatDate(dispensing.dispensed_at ?? dispensing.verified_at ?? dispensing.prepared_at) }}</td>
                  <td class="admin-actions">
                    <button v-if="dispensing.status === 'PREPARED'" class="task-action" :disabled="Boolean(busy)" @click="transition(dispensing, 'VERIFY')">第二人核验</button>
                    <button v-if="dispensing.status === 'VERIFIED'" class="task-action" :disabled="Boolean(busy)" @click="transition(dispensing, 'DISPENSE')">发药</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>调配</h2><p>药品编码、批次与数量必填；调配后需第二人核验。</p></div></header>
          <form class="admin-form" @submit.prevent="prepare">
            <label><span>药品编码</span><input v-model="form.drugCode" maxlength="64" required placeholder="例：DRUG-AMOXICILLIN" /></label>
            <label><span>批次号</span><input v-model="form.batchNumber" maxlength="64" required placeholder="例：BATCH-2026-0812" /></label>
            <label><span>数量</span><input v-model.number="form.quantity" type="number" min="0.01" step="0.01" required /></label>
            <label><span>单位</span><input v-model="form.quantityUnit" maxlength="16" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'prepare' ? '正在调配…' : '调配并待核验' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
