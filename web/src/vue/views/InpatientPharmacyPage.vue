<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ClinicalOrderWire, PharmacyDispensingWire } from '../../generated/contracts';
import { developmentCopy } from '../../development-copy';
import { issueOrderLease, listClinicalOrders } from '../../clinical-api';
import {
  issueInpatientExecutionLease, issueInpatientExecutionPatientLease, listInpatientPharmacyDispensings,
  prepareInpatientPharmacyDispensing, transitionInpatientPharmacyDispensing,
  updateInpatientPharmacyDispensing, voidInpatientPharmacyDispensing,
} from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ExecutionPatientContextBar from '../components/ExecutionPatientContextBar.vue';
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
const ordersQuery = useQuery({
  queryKey: ['execution', 'inpatient-pharmacy', 'active-medication-orders'],
  queryFn: async () => {
    const lease = await issueOrderLease('inpatient');
    return listClinicalOrders(lease, 'inpatient');
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const dispensingsQuery = useQuery({
  queryKey: ['execution', 'inpatient-pharmacy', 'dispensings'],
  queryFn: () => listInpatientPharmacyDispensings(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? writeLeaseQuery.error.value ?? ordersQuery.error.value ?? dispensingsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? writeLeaseQuery.error.value ?? ordersQuery.error.value ?? dispensingsQuery.error.value) : null);
const dispensings = computed(() => dispensingsQuery.data.value ?? []);
const pendingCount = computed(() => dispensings.value.filter((d) => d.status !== 'DISPENSED' && !d.voided_at).length);
const voidedCount = computed(() => dispensings.value.filter((d) => Boolean(d.voided_at)).length);

type MedicationOrderChoice = {
  order: ClinicalOrderWire;
  item: ClinicalOrderWire['items'][number];
};
const medicationOrderChoices = computed<MedicationOrderChoice[]>(() => (ordersQuery.data.value ?? [])
  .filter((order) => ['SIGNED', 'ACTIVE', 'IN_PROGRESS'].includes(order.status))
  .flatMap((order) => order.items
    .filter((item) => item.item_type === 'MEDICATION' && ['ACTIVE', 'IN_PROGRESS'].includes(item.item_state))
    .map((item) => ({ order, item }))));
const form = reactive({ orderItemId: '', drugCode: '', batchNumber: '', quantity: 1, quantityUnit: '' });
const busy = ref('');
const notice = ref('');
const createDialogOpen = ref(false);
const editTarget = ref<PharmacyDispensingWire | null>(null);
const voidTarget = ref<PharmacyDispensingWire | null>(null);
const transitionTarget = ref<PharmacyDispensingWire | null>(null);
const transitionAction = ref<'VERIFY' | 'DISPENSE'>('VERIFY');
const voidReason = ref('');
const editForm = reactive({ drugCode: '', batchNumber: '', quantity: 1, quantityUnit: '片' });

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await Promise.all([dispensingsQuery.refetch(), ordersQuery.refetch()]);
}

function selectMedicationOrder() {
  const choice = medicationOrderChoices.value.find(({ item }) => item.order_item_id === form.orderItemId);
  if (!choice) { form.drugCode = ''; form.quantityUnit = ''; return; }
  form.drugCode = choice.item.catalog_code;
  form.quantityUnit = choice.item.quantity_unit;
  form.quantity = Math.min(Math.max(form.quantity, 1), choice.item.requested_quantity);
}

async function prepare() {
  const lease = writeLeaseQuery.data.value;
  const choice = medicationOrderChoices.value.find(({ item }) => item.order_item_id === form.orderItemId);
  if (!lease || !choice || busy.value || !form.batchNumber.trim() || form.quantity <= 0) return;
  busy.value = 'prepare'; notice.value = '';
  try {
    await prepareInpatientPharmacyDispensing(lease, {
      order_id: choice.order.order_id, order_item_id: choice.item.order_item_id,
      drug_code: choice.item.catalog_code, batch_number: form.batchNumber.trim(),
      quantity: form.quantity, quantity_unit: form.quantityUnit.trim(),
      prepared_at: new Date().toISOString(),
    });
    form.orderItemId = ''; form.drugCode = ''; form.batchNumber = ''; form.quantityUnit = '';
    createDialogOpen.value = false;
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
    transitionTarget.value = null;
    notice.value = action === 'VERIFY' ? '已第二人核验摆药，可发往病区。' : '已发药，床旁给药请前往诊疗执行中心。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function openEdit(dispensing: PharmacyDispensingWire) {
  editForm.drugCode = dispensing.drug_code;
  editForm.batchNumber = dispensing.batch_number;
  editForm.quantity = dispensing.quantity;
  editForm.quantityUnit = dispensing.quantity_unit;
  editTarget.value = dispensing;
}

function openTransition(dispensing: PharmacyDispensingWire, action: 'VERIFY' | 'DISPENSE') {
  transitionTarget.value = dispensing;
  transitionAction.value = action;
}

async function updateDispensing() {
  const lease = writeLeaseQuery.data.value;
  const dispensing = editTarget.value;
  if (!lease || !dispensing || busy.value || !editForm.drugCode.trim() || !editForm.batchNumber.trim()
    || editForm.quantity <= 0 || !editForm.quantityUnit.trim()) return;
  busy.value = `update:${dispensing.dispensing_id}`; notice.value = '';
  try {
    await updateInpatientPharmacyDispensing(lease, dispensing, {
      drug_code: editForm.drugCode.trim(), batch_number: editForm.batchNumber.trim(),
      quantity: editForm.quantity, quantity_unit: editForm.quantityUnit.trim(),
    });
    editTarget.value = null;
    notice.value = '摆药信息已更正并生成新版本；核验必须基于更正后的批次与数量。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function voidDispensing() {
  const lease = writeLeaseQuery.data.value;
  const dispensing = voidTarget.value;
  if (!lease || !dispensing || busy.value || voidReason.value.trim().length < 4) return;
  busy.value = `void:${dispensing.dispensing_id}`; notice.value = '';
  try {
    await voidInpatientPharmacyDispensing(lease, dispensing, voidReason.value.trim());
    voidTarget.value = null; voidReason.value = '';
    notice.value = '摆药记录已作废并保留审计证据，后续核验和发药已被阻断。';
    await dispensingsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">诊疗执行 / 药房</p><h1>住院药房、配液与床旁给药</h1><p>住院摆药 → 第二人核验 → 发往病区；床旁给药（执行）在诊疗执行中心闭环。</p></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/care-operations">床旁给药 / 执行中心</RouterLink><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button><button class="button primary" @click="createDialogOpen = true">新增摆药</button></div>
    </div>
    <ExecutionPatientContextBar />
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.inpatientPatientName }}</strong><span>住院摆药与发药</span></div><dl><div><dt>发药前提</dt><dd>双人核验</dd></div><div><dt>给药执行</dt><dd>执行中心闭环</dd></div></dl><span class="lease-badge">当前住院患者 / 当前住院就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || writeLeaseQuery.isPending.value || ordersQuery.isPending.value || dispensingsQuery.isPending.value" kind="loading" message="正在读取住院摆药台账与有效医嘱" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="住院药房统计">
        <article><span>摆药笔数</span><strong>{{ dispensings.length }}</strong><small>当前患者</small></article>
        <article><span>未发药</span><strong>{{ pendingCount }}</strong><small>待核验 / 待发</small></article>
        <article><span>已发药</span><strong>{{ dispensings.filter((item) => item.status === 'DISPENSED').length }}</strong></article>
        <article><span>已作废</span><strong>{{ voidedCount }}</strong><small>保留审计证据</small></article>
      </section>

      <section class="admin-panel">
          <header><div><h2>住院摆药台账</h2><p>PREPARED（摆药）→ VERIFIED（核验）→ DISPENSED（发药）。</p></div><button class="button secondary" @click="dispensingsQuery.refetch()">刷新</button></header>
          <div v-if="dispensings.length === 0" class="empty-state"><span>药</span><p>当前患者暂无摆药记录</p><small>在右侧录入药品与批次开始摆药</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>药品 / 来源医嘱</th><th>批次</th><th>数量</th><th>核验人</th><th>状态</th><th>时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="dispensing in dispensings" :key="dispensing.dispensing_id">
                  <td><strong><code>{{ dispensing.drug_code }}</code></strong><small>{{ dispensing.order_item_id ? `医嘱项 …${dispensing.order_item_id.slice(-8)}` : '历史门诊摆药记录' }}</small></td>
                  <td>{{ dispensing.batch_number }}</td>
                  <td>{{ dispensing.quantity }} {{ dispensing.quantity_unit }}</td>
                  <td>{{ dispensing.verified_by ? `…${dispensing.verified_by.slice(-8)}` : '—' }}</td>
                  <td><span class="admin-status" :class="dispensing.voided_at ? 'voided' : dispensing.status.toLowerCase()">{{ dispensing.voided_at ? '已作废' : statusLabels[dispensing.status] }}</span><small v-if="dispensing.void_reason">{{ dispensing.void_reason }}</small></td>
                  <td>{{ formatDate(dispensing.dispensed_at ?? dispensing.verified_at ?? dispensing.prepared_at) }}</td>
                  <td class="admin-actions">
                    <button v-if="dispensing.status === 'PREPARED' && !dispensing.voided_at" class="task-action" :disabled="Boolean(busy)" @click="openEdit(dispensing)">编辑</button>
                    <button v-if="dispensing.status === 'PREPARED' && !dispensing.voided_at" class="task-action" :disabled="Boolean(busy)" @click="openTransition(dispensing, 'VERIFY')">第二人核验</button>
                    <button v-if="dispensing.status === 'VERIFIED' && !dispensing.voided_at" class="task-action" :disabled="Boolean(busy)" @click="openTransition(dispensing, 'DISPENSE')">发往病区</button>
                    <button v-if="dispensing.status !== 'DISPENSED' && !dispensing.voided_at" class="task-action danger" :disabled="Boolean(busy)" @click="voidTarget = dispensing; voidReason = ''">作废</button>
                    <span v-if="dispensing.status === 'DISPENSED'" class="review-wait">已发药不可直接删除</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <BusinessActionDialog :open="createDialogOpen" title="新增住院摆药" description="只能从当前住院就诊已签署且有效的药品医嘱选择；累计摆药量不得超过医嘱量。" eyebrow="诊疗执行 / 住院药房" confirm-label="确认摆药" :busy="busy === 'prepare'" @cancel="createDialogOpen = false" @confirm="prepare">
        <div class="admin-form">
          <label><span>有效药品医嘱</span><select v-model="form.orderItemId" required @change="selectMedicationOrder"><option value="">请选择已签署有效医嘱</option><option v-for="choice in medicationOrderChoices" :key="choice.item.order_item_id" :value="choice.item.order_item_id">{{ choice.item.display_name }} · {{ choice.item.catalog_code }} · {{ choice.item.requested_quantity }} {{ choice.item.quantity_unit }} · …{{ choice.order.order_id.slice(-8) }}</option></select></label>
          <label><span>药品编码</span><input v-model="form.drugCode" readonly aria-readonly="true" placeholder="随医嘱自动带入" /></label>
          <label><span>批次号</span><input v-model="form.batchNumber" maxlength="64" required placeholder="例：BATCH-2026-0812" /></label>
          <label><span>数量</span><input v-model.number="form.quantity" type="number" min="0.01" step="0.01" required /></label>
          <label><span>单位</span><input v-model="form.quantityUnit" readonly aria-readonly="true" placeholder="随医嘱自动带入" /></label>
        </div>
        <p v-if="medicationOrderChoices.length === 0" class="dialog-warning">当前没有可摆药的已签署有效药品医嘱，请先在“医嘱与用药”完成医嘱签署。</p>
      </BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(editTarget)" title="编辑待核验摆药" description="只允许修改尚未核验且未作废的摆药；修改后行版本递增并写入审计链。" confirm-label="保存更正" :busy="busy.startsWith('update:')" @cancel="editTarget = null" @confirm="updateDispensing">
        <div class="dialog-grid"><label>药品编码<input v-model="editForm.drugCode" :readonly="Boolean(editTarget?.order_item_id)" maxlength="128" required /></label><label>批次号<input v-model="editForm.batchNumber" maxlength="128" required /></label><label>数量<input v-model.number="editForm.quantity" type="number" min="0.01" step="0.01" required /></label><label>单位<input v-model="editForm.quantityUnit" :readonly="Boolean(editTarget?.order_item_id)" maxlength="32" required /></label></div>
      </BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(transitionTarget)" :title="transitionAction === 'VERIFY' ? '确认第二人核验' : '确认发往病区'" :description="transitionAction === 'VERIFY' ? '核验将锁定药品、批次和数量，核验人与摆药人必须分离。' : '发药后不可直接作废；退药需进入独立退药流程。'" :confirm-label="transitionAction === 'VERIFY' ? '确认核验' : '确认发药'" :busy="busy.startsWith(`${transitionAction}:`)" @cancel="transitionTarget = null" @confirm="transitionTarget && transition(transitionTarget, transitionAction)">
        <p v-if="transitionTarget" class="dialog-warning">{{ transitionTarget.drug_code }} · {{ transitionTarget.batch_number }} · {{ transitionTarget.quantity }} {{ transitionTarget.quantity_unit }}</p>
      </BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(voidTarget)" title="作废摆药记录" description="不会物理删除记录；作废原因、人员、时间和行版本会永久留痕，并阻断后续核验与发药。" confirm-label="确认作废" :busy="busy.startsWith('void:')" danger @cancel="voidTarget = null; voidReason = ''" @confirm="voidDispensing">
        <p v-if="voidTarget" class="dialog-warning">{{ voidTarget.drug_code }} · {{ voidTarget.batch_number }} · {{ voidTarget.quantity }} {{ voidTarget.quantity_unit }}</p><label>作废原因（至少 4 字）<textarea v-model="voidReason" maxlength="1000" required rows="4" placeholder="说明录入错误或流程终止原因" /></label>
      </BusinessActionDialog>
    </template>
  </section>
</template>
