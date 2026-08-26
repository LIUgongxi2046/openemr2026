<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { PharmacyDispensingWire } from '../../generated/contracts';
import { developmentCopy } from '../../development-copy';
import { issueInpatientExecutionLease, issueInpatientExecutionPatientLease, listInpatientPharmacyDispensings, prepareInpatientPharmacyDispensing, transitionInpatientPharmacyDispensing } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const statusLabels: Record<PharmacyDispensingWire['status'], string> = {
  PREPARED: '已摆药', VERIFIED: '已核验', DISPENSED: '已发药',
};
const leaseQuery = useQuery({
  queryKey: ['execution', 'inpatient-pharmacy', 'lease'],
  queryFn: () => issueInpatientExecutionPatientLease('PHARMACY_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const writeLeaseQuery = useQuery({
  queryKey: ['execution', 'inpatient-pharmacy', 'write-lease'],
  queryFn: () => issueInpatientExecutionLease('PHARMACY_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const dispensingsQuery = useQuery({
  queryKey: ['execution', 'inpatient-pharmacy', 'dispensings'],
  queryFn: () => listInpatientPharmacyDispensings(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? writeLeaseQuery.error.value ?? dispensingsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? writeLeaseQuery.error.value ?? dispensingsQuery.error.value) : null);
const dispensings = computed(() => dispensingsQuery.data.value ?? []);
const pendingCount = computed(() => dispensings.value.filter((d) => d.status !== 'DISPENSED').length);

const form = reactive({ drugCode: '', batchNumber: '', quantity: 1, quantityUnit: '片' });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await dispensingsQuery.refetch(); }

async function prepare() {
  const lease = writeLeaseQuery.data.value;
  if (!lease || busy.value || !form.drugCode.trim() || !form.batchNumber.trim() || form.quantity <= 0 || !form.quantityUnit.trim()) return;
  busy.value = 'prepare'; notice.value = '';
  try {
    await prepareInpatientPharmacyDispensing(lease, {
      drug_code: form.drugCode.trim(), batch_number: form.batchNumber.trim(),
      quantity: form.quantity, quantity_unit: form.quantityUnit.trim(),
      prepared_at: new Date().toISOString(),
    });
    form.drugCode = ''; form.batchNumber = '';
    notice.value = '住院摆药已完成，双人核验后发往病区。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transition(dispensing: PharmacyDispensingWire, action: 'VERIFY' | 'DISPENSE') {
  const lease = writeLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = `${action}:${dispensing.dispensing_id}`; notice.value = '';
  try {
    await transitionInpatientPharmacyDispensing(lease, dispensing, action);
    notice.value = action === 'VERIFY' ? '已第二人核验摆药，可发往病区。' : '已发药，床旁给药请前往医疗协同中心。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">医疗协同执行 / 药房</p><h1>住院药房、配液与床旁给药</h1><p>住院摆药 → 第二人核验 → 发往病区；床旁给药（执行）在医疗协同中心闭环。</p></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/care-operations">床旁给药 / 协同中心</RouterLink><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button></div>
    </div>
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.inpatientPatientName }}</strong><span>住院摆药与发药</span></div><dl><div><dt>发药前提</dt><dd>双人核验</dd></div><div><dt>给药执行</dt><dd>协同中心闭环</dd></div></dl><span class="lease-badge">当前住院患者 / 当前住院就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || writeLeaseQuery.isPending.value || dispensingsQuery.isPending.value" kind="loading" message="正在读取住院摆药台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="住院药房统计">
        <article><span>摆药笔数</span><strong>{{ dispensings.length }}</strong><small>当前患者</small></article>
        <article><span>未发药</span><strong>{{ pendingCount }}</strong><small>待核验 / 待发</small></article>
        <article><span>已发药</span><strong>{{ dispensings.length - pendingCount }}</strong><small>DISPENSED</small></article>
      </section>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>住院摆药台账</h2><p>PREPARED（摆药）→ VERIFIED（核验）→ DISPENSED（发药）。</p></div><button class="button secondary" @click="dispensingsQuery.refetch()">刷新</button></header>
          <div v-if="dispensings.length === 0" class="empty-state"><span>药</span><p>当前患者暂无摆药记录</p><small>在右侧录入药品与批次开始摆药</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>药品</th><th>批次</th><th>数量</th><th>核验人</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="dispensing in dispensings" :key="dispensing.dispensing_id">
                  <td><strong><code>{{ dispensing.drug_code }}</code></strong><small>…{{ dispensing.dispensing_id.slice(-8) }}</small></td>
                  <td>{{ dispensing.batch_number }}</td>
                  <td>{{ dispensing.quantity }} {{ dispensing.quantity_unit }}</td>
                  <td>{{ dispensing.verified_by ? `…${dispensing.verified_by.slice(-8)}` : '—' }}</td>
                  <td><span class="admin-status" :class="dispensing.status.toLowerCase()">{{ statusLabels[dispensing.status] }}</span></td>
                  <td>{{ formatDate(dispensing.dispensed_at ?? dispensing.verified_at ?? dispensing.prepared_at) }}</td>
                  <td class="admin-actions">
                    <button v-if="dispensing.status === 'PREPARED'" class="task-action" :disabled="Boolean(busy)" @click="transition(dispensing, 'VERIFY')">第二人核验</button>
                    <button v-if="dispensing.status === 'VERIFIED'" class="task-action" :disabled="Boolean(busy)" @click="transition(dispensing, 'DISPENSE')">发往病区</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>摆药</h2><p>药品编码、批次与数量必填；摆药后双人核验。</p></div></header>
          <form class="admin-form" @submit.prevent="prepare">
            <label><span>药品编码</span><input v-model="form.drugCode" maxlength="64" required placeholder="例：DRUG-CEFTRIAXONE" /></label>
            <label><span>批次号</span><input v-model="form.batchNumber" maxlength="64" required placeholder="例：BATCH-2026-0812" /></label>
            <label><span>数量</span><input v-model.number="form.quantity" type="number" min="0.01" step="0.01" required /></label>
            <label><span>单位</span><input v-model="form.quantityUnit" maxlength="16" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'prepare' ? '正在摆药…' : '摆药并待核验' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
