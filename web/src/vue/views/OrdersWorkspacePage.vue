<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { ClinicalOrderWire, MedicationSafetyEvaluationWire, OrderExecutionTaskWire } from '../../generated/contracts';
import { checkClinicalOrderSafety, controlClinicalOrder, createClinicalOrder, issueOrderLease, listClinicalOrders, recordOrderExecution, signClinicalOrder } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const mode = computed<'outpatient' | 'inpatient'>(() => route.meta.contractId === 'ip-orders' ? 'inpatient' : 'outpatient');
const formOpen = ref(false); const notice = ref(''); const busy = ref<string | null>(null);
const orderScope = ref<'LONG_TERM' | 'TEMPORARY'>(mode.value === 'inpatient' ? 'LONG_TERM' : 'TEMPORARY');
const itemType = ref<'MEDICATION' | 'LAB' | 'IMAGING' | 'TREATMENT' | 'NURSING' | 'DIET' | 'OTHER'>('LAB');
const catalogCode = ref('LAB-CBC'); const displayName = ref('血常规'); const quantity = ref(1); const unit = ref('次');
const indication = ref('明确当前诊疗问题'); const instructions = ref(''); const doseValue = ref(500); const doseUnit = ref('mg'); const routeCode = ref('PO'); const frequencyCode = ref('TID');
const safetyEvaluations = ref<Record<string, MedicationSafetyEvaluationWire>>({});
const controlOrderId = ref<string | null>(null); const controlAction = ref<'stop' | 'cancel' | null>(null); const controlReason = ref('');
const ordersQuery = useQuery({
  queryKey: ['clinical', 'orders', mode],
  queryFn: async () => { const lease = await issueOrderLease(mode.value); return { lease, orders: await listClinicalOrders(lease, mode.value) }; },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => ordersQuery.error.value ? toClinicalIssue(ordersQuery.error.value) : null);

async function run(key: string, action: () => Promise<void>) {
  if (busy.value || !ordersQuery.data.value) return;
  busy.value = key; notice.value = '';
  try { await action(); await ordersQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = null; }
}
function createOrder() {
  const data = ordersQuery.data.value; if (!data) return;
  void run('create', async () => {
    await createClinicalOrder(data.lease, mode.value, { orderScope: orderScope.value, clinicalIndication: indication.value.trim(), itemType: itemType.value, catalogCode: catalogCode.value.trim(), displayName: displayName.value.trim(), requestedQuantity: quantity.value, quantityUnit: unit.value.trim(), doseValue: itemType.value === 'MEDICATION' ? doseValue.value : undefined, doseUnit: itemType.value === 'MEDICATION' ? doseUnit.value.trim() : undefined, routeCode: itemType.value === 'MEDICATION' ? routeCode.value.trim() : undefined, frequencyCode: itemType.value === 'MEDICATION' ? frequencyCode.value.trim() : undefined, instructions: instructions.value.trim() });
    formOpen.value = false; notice.value = '医嘱草稿已创建，尚未生效';
  });
}
function sign(order: ClinicalOrderWire) {
  const data = ordersQuery.data.value; if (!data) return;
  void run(`sign:${order.order_id}`, async () => {
    const evaluation = await checkClinicalOrderSafety(data.lease, mode.value, order);
    safetyEvaluations.value = { ...safetyEvaluations.value, [order.order_id]: evaluation };
    if (!evaluation.passed) { notice.value = `MEDICATION_SAFETY_BLOCKED：发现 ${evaluation.blocking_count} 项确定性硬规则问题，未签署且未生成执行任务`; return; }
    await signClinicalOrder(data.lease, mode.value, order); notice.value = '确定性用药安全规则通过，医嘱已签署生效';
  });
}
function execute(task: OrderExecutionTaskWire, eventType: 'PARTIAL' | 'COMPLETED') {
  const data = ordersQuery.data.value; if (!data) return;
  const remaining = task.requested_quantity - task.performed_quantity;
  void run(`execute:${task.execution_task_id}`, async () => { await recordOrderExecution(data.lease, mode.value, task, eventType, eventType === 'PARTIAL' ? remaining / 2 : remaining); });
}
function beginControl(order: ClinicalOrderWire, action: 'stop' | 'cancel') { controlOrderId.value = order.order_id; controlAction.value = action; controlReason.value = ''; }
function submitControl(order: ClinicalOrderWire) {
  const data = ordersQuery.data.value; const action = controlAction.value;
  if (!data || !action || !controlReason.value.trim()) return;
  void run(`${action}:${order.order_id}`, async () => { await controlClinicalOrder(data.lease, mode.value, order, action, controlReason.value.trim()); controlOrderId.value = null; controlAction.value = null; controlReason.value = ''; });
}
function validCreate() { return catalogCode.value.trim() && displayName.value.trim() && indication.value.trim() && quantity.value > 0 && (itemType.value !== 'MEDICATION' || (doseValue.value > 0 && doseUnit.value.trim() && routeCode.value.trim() && frequencyCode.value.trim())); }
</script>

<template>
  <main id="main-content" class="content vue-native-page"><div class="page-heading"><div><p class="eyebrow">{{ mode === 'inpatient' ? '住院 / 医嘱与用药' : '门诊 / 医嘱与处方' }}</p><h1>{{ mode === 'inpatient' ? '住院医嘱与用药中心' : '门诊医嘱与处方' }}</h1></div><div class="toolbar-actions"><button class="button secondary" @click="formOpen = !formOpen">新增医嘱</button><span class="status-legend"><span class="dot success" />医嘱服务连接</span></div></div>
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.clinicalPatientName }}</strong><span>当前{{ mode === 'inpatient' ? '住院' : '门诊' }}就诊</span></div><dl><div><dt>工作域</dt><dd>{{ mode === 'inpatient' ? '住院' : '门诊' }}</dd></div><div><dt>硬规则</dt><dd>RULESET-MEDICATION-6</dd></div><div><dt>执行事实</dt><dd>不可删除</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>
    <section v-if="formOpen" class="order-create-panel" aria-label="新建医嘱草稿"><div><h2>新建医嘱草稿</h2><p>签署前不产生执行任务；签署后禁止静默修改项目和数量。</p></div><label>医嘱类型<select v-model="orderScope"><option value="TEMPORARY">临时医嘱</option><option value="LONG_TERM">长期医嘱</option></select></label><label>项目类别<select v-model="itemType"><option value="MEDICATION">药品</option><option value="LAB">检验</option><option value="IMAGING">检查</option><option value="TREATMENT">治疗</option><option value="NURSING">护理</option><option value="DIET">膳食</option><option value="OTHER">其他</option></select></label><label>目录编码<input v-model="catalogCode" maxlength="128" /></label><label>项目名称<input v-model="displayName" maxlength="256" /></label><label>数量<input v-model.number="quantity" type="number" min="0.001" step="0.001" /></label><label>单位<input v-model="unit" maxlength="64" /></label><template v-if="itemType === 'MEDICATION'"><label>单次剂量<input v-model.number="doseValue" type="number" min="0.001" step="0.001" /></label><label>剂量单位<input v-model="doseUnit" maxlength="64" /></label><label>给药途径<input v-model="routeCode" maxlength="64" /></label><label>频次编码<input v-model="frequencyCode" maxlength="64" /></label></template><label class="wide">临床指征<textarea v-model="indication" rows="2" maxlength="1000" /></label><label class="wide">执行说明<textarea v-model="instructions" rows="2" maxlength="1000" /></label><div class="toolbar-actions"><button class="button secondary" @click="formOpen = false">取消</button><button class="button primary" :disabled="busy === 'create' || !validCreate()" @click="createOrder">{{ busy === 'create' ? '正在创建…' : '保存医嘱草稿' }}</button></div></section>
    <ClinicalPageState v-if="ordersQuery.isPending.value" kind="loading" message="正在加载当前就诊医嘱" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="ordersQuery.refetch()" />
    <section v-else-if="ordersQuery.data.value" class="orders-workspace"><div v-if="ordersQuery.data.value.orders.length === 0" class="empty-state order-empty"><span>医</span><p>当前就诊尚无医嘱</p><small>点击“新增医嘱”创建草稿；草稿不会直接进入执行。</small></div>
      <article v-for="order in ordersQuery.data.value.orders" :key="order.order_id" class="order-card"><header><div><span class="order-scope" :class="order.order_scope.toLowerCase()">{{ order.order_scope === 'LONG_TERM' ? '长期' : '临时' }}</span><strong>{{ order.clinical_indication }}</strong><small>医嘱 …{{ order.order_id.slice(-8) }} · v{{ order.row_version }}</small></div><span class="task-state" :class="order.status.toLowerCase()">{{ order.status }}</span></header>
        <div class="order-items"><div v-for="item in order.items" :key="item.order_item_id" class="order-item-row"><div><b>{{ item.display_name }}</b><small>{{ item.item_type }} · {{ item.catalog_code }}</small><small v-if="item.item_type === 'MEDICATION'" class="medication-directions">{{ item.dose_value }} {{ item.dose_unit }} · {{ item.route_code }} · {{ item.frequency_code }} · 成分 {{ item.ingredient_code }}</small></div><span>{{ item.requested_quantity }} {{ item.quantity_unit }}</span><span>{{ item.item_state }}</span><div class="order-row-actions"><template v-for="task in order.execution_tasks.filter((candidate) => candidate.order_item_id === item.order_item_id)" :key="task.execution_task_id"><small>{{ task.performed_quantity }}/{{ task.requested_quantity }} {{ task.quantity_unit }}</small><button v-if="['PENDING','ACCEPTED','IN_PROGRESS','PARTIAL'].includes(task.task_state) && ['ACTIVE','IN_PROGRESS'].includes(order.status) && task.requested_quantity - task.performed_quantity > 1" class="task-action" :disabled="busy === `execute:${task.execution_task_id}`" @click="execute(task, 'PARTIAL')">部分执行</button><button v-if="(['PENDING','ACCEPTED','IN_PROGRESS','PARTIAL'].includes(task.task_state) && ['ACTIVE','IN_PROGRESS'].includes(order.status)) || (order.status === 'STOPPING' && ['ACCEPTED','IN_PROGRESS','PARTIAL'].includes(task.task_state))" class="task-action" :disabled="busy === `execute:${task.execution_task_id}`" @click="execute(task, 'COMPLETED')">{{ order.status === 'STOPPING' ? '收口在途执行' : '完成剩余' }}</button></template></div></div></div>
        <section v-if="safetyEvaluations[order.order_id]" class="medication-safety-panel" :class="safetyEvaluations[order.order_id].passed ? 'passed' : 'blocked'" aria-label="确定性用药安全评估"><header><strong>{{ safetyEvaluations[order.order_id].passed ? '确定性用药安全规则通过' : `硬规则阻断 ${safetyEvaluations[order.order_id].blocking_count} 项` }}</strong><small>{{ safetyEvaluations[order.order_id].rule_watermark }} · 医嘱 v{{ safetyEvaluations[order.order_id].evaluated_order_row_version }}</small></header><article v-for="finding in safetyEvaluations[order.order_id].findings" :key="finding.finding_id"><b>{{ finding.title }}</b><span>{{ finding.code }}</span><p>{{ finding.detail }}</p><code>{{ finding.evidence_source }}</code></article><p class="safety-boundary">AI 仅可补充候选提示；过敏、重复和剂量硬规则由服务端执行，不能由 AI 降级或绕过。</p></section>
        <div v-if="controlOrderId === order.order_id && controlAction" class="order-control-panel" role="group"><div><strong>{{ controlAction === 'stop' ? '停止医嘱' : '取消医嘱' }}</strong><small>{{ controlAction === 'stop' ? '待执行任务将取消；在途任务收口后停止。' : '仅无执行事实的医嘱可取消。' }}</small></div><label>原因<textarea v-model="controlReason" maxlength="1000" rows="2" placeholder="必填，将写入不可变控制事件" /></label><div class="toolbar-actions"><button class="button secondary" @click="controlOrderId = null">返回</button><button class="button danger" :disabled="!controlReason.trim() || busy === `${controlAction}:${order.order_id}`" @click="submitControl(order)">确认并留痕</button></div></div>
        <footer><span>数据水印 {{ order.data_watermark.slice(0, 12) }}…</span><div class="toolbar-actions"><template v-if="['ACTIVE','IN_PROGRESS'].includes(order.status) && controlOrderId !== order.order_id"><button v-if="order.status === 'ACTIVE' && order.execution_tasks.every((task) => task.task_state === 'PENDING')" class="button secondary" @click="beginControl(order, 'cancel')">取消医嘱</button><button class="button danger secondary" @click="beginControl(order, 'stop')">停止医嘱</button></template><button v-if="order.status === 'DRAFT'" class="button primary" :disabled="busy === `sign:${order.order_id}`" @click="sign(order)">{{ busy === `sign:${order.order_id}` ? '正在执行硬规则并签署…' : '安全预检并签署生效' }}</button></div></footer></article>
    </section>
  </main>
</template>
