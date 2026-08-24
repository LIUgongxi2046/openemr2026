<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ChargeItemWire } from '../../generated/contracts';
import { clinicalContext, issueContextLease } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import { createCharge, createPriceCatalogVersion, issueExecutionLease, listCharges, reverseCharge } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['execution', 'billing', 'lease'],
  queryFn: () => issueExecutionLease('BILLING_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const chargesQuery = useQuery({
  queryKey: ['execution', 'billing', 'charges'],
  queryFn: () => listCharges(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const priceLeaseQuery = useQuery({
  queryKey: ['execution', 'billing', 'price-lease'],
  queryFn: () => issueContextLease(null, null, 'BILLING_PRICE_CATALOG'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const issue = computed(() => (leaseQuery.error.value ?? chargesQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? chargesQuery.error.value) : null);
const charges = computed(() => chargesQuery.data.value ?? []);
const totalAmount = computed(() => charges.value.filter((c) => c.status === 'CHARGED').reduce((sum, c) => sum + c.amount, 0));
const reversedCount = computed(() => charges.value.filter((c) => c.status === 'REVERSED').length);

const chargeForm = reactive({ itemCode: '', quantity: 1 });
const priceForm = reactive({ catalogCode: '', itemCode: '', itemName: '', unitPrice: 0, unit: '次', releaseVersion: '' });
const busy = ref('');
const notice = ref('');
const reversingId = ref('');
const reverseReason = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await chargesQuery.refetch(); }

async function submitCharge() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !chargeForm.itemCode.trim() || chargeForm.quantity <= 0) return;
  busy.value = 'charge'; notice.value = '';
  try {
    await createCharge(lease, { item_code: chargeForm.itemCode.trim(), quantity: chargeForm.quantity });
    chargeForm.itemCode = '';
    notice.value = '收费已入账，价格取自当前生效价格目录，审计链与出箱事件已同步记录。';
    await chargesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function submitPrice() {
  const lease = priceLeaseQuery.data.value;
  if (!lease || busy.value || !priceForm.catalogCode.trim() || !priceForm.itemCode.trim() || !priceForm.itemName.trim() || priceForm.unitPrice <= 0 || !priceForm.releaseVersion.trim()) return;
  busy.value = 'price'; notice.value = '';
  try {
    await createPriceCatalogVersion(lease, {
      catalog_code: priceForm.catalogCode.trim(), item_code: priceForm.itemCode.trim(),
      item_name: priceForm.itemName.trim(), unit_price: priceForm.unitPrice,
      unit: priceForm.unit.trim() || '次', effective_from: new Date().toISOString(),
      release_version: priceForm.releaseVersion.trim(),
    });
    priceForm.itemCode = ''; priceForm.itemName = ''; priceForm.releaseVersion = '';
    notice.value = '价格目录版本已创建，收费将按生效期匹配单价。';
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginReverse(charge: ChargeItemWire) { reversingId.value = charge.charge_item_id; reverseReason.value = ''; }

async function submitReverse(charge: ChargeItemWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !reverseReason.value.trim()) return;
  busy.value = `reverse:${charge.charge_item_id}`; notice.value = '';
  try {
    await reverseCharge(lease, charge, reverseReason.value.trim());
    reversingId.value = '';
    notice.value = '收费已冲正，原收费与冲正记录均不可变留痕。';
    await chargesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">医疗协同执行 / 收费与价格</p><h1>费用、收退费、预交与结算</h1><p>按价格目录记费、冲正留痕；价格目录按版本管理，不物理删除历史价格。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button></div>
    </div>
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.outpatientPatientName }}</strong><span>当前就诊收费</span></div><dl><div><dt>价格来源</dt><dd>价格目录版本</dd></div><div><dt>冲正</dt><dd>不可物理删除</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || chargesQuery.isPending.value" kind="loading" message="正在读取收费台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="收费统计">
        <article><span>收费笔数</span><strong>{{ charges.length }}</strong><small>当前就诊</small></article>
        <article><span>已收金额</span><strong>{{ totalAmount.toFixed(2) }}</strong><small>CHARGED</small></article>
        <article><span>冲正笔数</span><strong>{{ reversedCount }}</strong><small>REVERSED</small></article>
      </section>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>收费台账</h2><p>单价与金额由价格目录匹配，冲正必须附原因。</p></div><button class="button secondary" @click="chargesQuery.refetch()">刷新</button></header>
          <div v-if="charges.length === 0" class="empty-state"><span>费</span><p>当前就诊尚无收费记录</p><small>可在右侧记费，或先创建价格目录版本</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>项目</th><th>数量</th><th>单价</th><th>金额</th><th>状态</th><th>入账时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="charge in charges" :key="charge.charge_item_id">
                  <td><strong>{{ charge.item_name }}</strong><small><code>{{ charge.item_code }}</code> · …{{ charge.charge_item_id.slice(-8) }}</small></td>
                  <td>{{ charge.quantity }} {{ charge.unit }}</td>
                  <td>{{ charge.unit_price.toFixed(2) }}</td>
                  <td>{{ charge.amount.toFixed(2) }}</td>
                  <td><span class="admin-status" :class="charge.status.toLowerCase()">{{ charge.status === 'CHARGED' ? '已收费' : '已冲正' }}</span></td>
                  <td>{{ formatDate(charge.charged_at) }}</td>
                  <td class="admin-actions">
                    <button v-if="charge.status === 'CHARGED'" class="task-action" :disabled="Boolean(busy)" @click="beginReverse(charge)">冲正</button>
                    <span v-else class="danger-text">已冲正</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div v-if="reversingId" class="admin-form">
            <label><span>冲正原因（必填）</span><textarea v-model="reverseReason" rows="2" placeholder="说明退费原因，写入审计链" /></label>
            <div class="toolbar-actions">
              <button class="button secondary" :disabled="Boolean(busy)" @click="reversingId = ''">取消</button>
              <button class="button danger" :disabled="!reverseReason.trim() || Boolean(busy)" @click="submitReverse(charges.find((c) => c.charge_item_id === reversingId)!)">确认冲正</button>
            </div>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>记费</h2><p>项目编码与数量必填，单价来自价格目录。</p></div></header>
          <form class="admin-form" @submit.prevent="submitCharge">
            <label><span>项目编码</span><input v-model="chargeForm.itemCode" maxlength="96" required placeholder="例：CHARGE-CONSULT" /></label>
            <label><span>数量</span><input v-model.number="chargeForm.quantity" type="number" min="0.01" step="0.01" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'charge' ? '正在记费…' : '记费入账' }}</button>
          </form>
        </section>
      </div>

      <section class="admin-panel">
        <header><div><h2>价格目录版本</h2><p>新增版本后，收费按生效期匹配单价；历史版本保留不删。</p></div></header>
        <form class="admin-form" @submit.prevent="submitPrice">
          <label><span>目录编码</span><input v-model="priceForm.catalogCode" maxlength="64" required placeholder="例：CATALOG-CHARGE" /></label>
          <label><span>项目编码</span><input v-model="priceForm.itemCode" maxlength="96" required placeholder="例：CHARGE-CONSULT" /></label>
          <label><span>项目名称</span><input v-model="priceForm.itemName" maxlength="256" required placeholder="例：门诊诊察费" /></label>
          <label><span>单价</span><input v-model.number="priceForm.unitPrice" type="number" min="0.01" step="0.01" required /></label>
          <label><span>单位</span><input v-model="priceForm.unit" maxlength="16" required /></label>
          <label><span>发布版本</span><input v-model="priceForm.releaseVersion" maxlength="32" required placeholder="例：2026-08-01" /></label>
          <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'price' ? '正在创建…' : '创建价格版本' }}</button>
        </form>
      </section>
    </template>
  </section>
</template>
