<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ImagingOrderWire, OrderExecutionTaskWire } from '../../generated/contracts';
import { authSession } from '../../auth-session';
import { clinicalContext, issueOrderLease, listClinicalOrders, recordOrderExecution } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import { createImagingOrder, issueExecutionLease, issueExecutionPatientLease, listImagingOrders, transitionImagingOrder } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import ExecutionPatientContextBar from '../components/ExecutionPatientContextBar.vue';
import AgentInlineReview from '../components/AgentInlineReview.vue';
import { toClinicalIssue } from '../clinical-error';

type Modality = ImagingOrderWire['modality'];
type BodyPart = ImagingOrderWire['body_part'];
type Laterality = ImagingOrderWire['laterality'];
const modalities: Modality[] = ['CT', 'MRI', 'XRAY', 'ULTRASOUND'];
const bodyParts: BodyPart[] = ['HEAD', 'NECK', 'CHEST', 'ABDOMEN', 'PELVIS', 'SPINE', 'UPPER_EXTREMITY', 'LOWER_EXTREMITY', 'OTHER'];
const lateralities: Laterality[] = ['NONE', 'LEFT', 'RIGHT', 'BILATERAL'];
const bodyPartLabels: Record<BodyPart, string> = {
  HEAD: '头', NECK: '颈', CHEST: '胸', ABDOMEN: '腹', PELVIS: '骨盆', SPINE: '脊柱', UPPER_EXTREMITY: '上肢', LOWER_EXTREMITY: '下肢', OTHER: '其他',
};
const lateralityLabels: Record<Laterality, string> = { NONE: '—', LEFT: '左', RIGHT: '右', BILATERAL: '双侧' };
const statusLabels: Record<ImagingOrderWire['status'], string> = {
  ORDERED: '已申请', PERFORMED: '已执行', REPORTED: '已报告', CANCELLED: '已取消',
};

const leaseQuery = useQuery({
  queryKey: ['execution', 'imaging-workbench', 'lease'],
  queryFn: () => issueExecutionPatientLease('IMAGING_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const writeLeaseQuery = useQuery({
  queryKey: ['execution', 'imaging-workbench', 'write-lease'],
  queryFn: () => issueExecutionLease('IMAGING_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const ordersQuery = useQuery({
  queryKey: ['execution', 'imaging-workbench', 'orders'],
  queryFn: () => listImagingOrders(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const clinicalOrdersQuery = useQuery({
  queryKey: ['execution', 'imaging-workbench', 'clinical-orders'],
  queryFn: async () => {
    const lease = await issueOrderLease('outpatient');
    return { lease, orders: await listClinicalOrders(lease, 'outpatient') };
  },
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? writeLeaseQuery.error.value ?? ordersQuery.error.value ?? clinicalOrdersQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? writeLeaseQuery.error.value ?? ordersQuery.error.value ?? clinicalOrdersQuery.error.value) : null);
const orders = computed(() => ordersQuery.data.value ?? []);
const clinicalImagingTasks = computed(() => (clinicalOrdersQuery.data.value?.orders ?? []).flatMap((order) =>
  order.execution_tasks.map((task) => ({
    order,
    task,
    item: order.items.find((item) => item.order_item_id === task.order_item_id),
  }))).filter((entry) => entry.item?.item_type === 'IMAGING'));
const reportedCount = computed(() => orders.value.filter((o) => o.status === 'REPORTED').length);
const activeRoleCodes = computed(() => new Set(authSession.user?.role_codes ?? []));
const canPrescribe = computed(() => ['CLINICIAN', 'ATTENDING_PHYSICIAN', 'CHIEF_PHYSICIAN']
  .some((role) => activeRoleCodes.value.has(role)));
const canExecute = computed(() => activeRoleCodes.value.has('RADIOLOGIST'));
const agentPatientId = computed(() => clinicalContext.patientId || null);
const agentEncounterId = computed(() => clinicalContext.encounterId || null);
const imagingSchedulingObjective = computed(() => '对当前影像设备与检查排程进行调度建议，输出候选，仅供医生审阅。');

const form = reactive({ modality: 'CT' as Modality, bodyPart: 'CHEST' as BodyPart, laterality: 'NONE' as Laterality, contrastRequired: false });
const busy = ref('');
const notice = ref('');
const createDialogOpen = ref(false);
const cancelTarget = ref<ImagingOrderWire | null>(null);
const completionTarget = ref<{ task: OrderExecutionTaskWire; displayName: string } | null>(null);

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await ordersQuery.refetch(); }

async function completeClinicalExecution() {
  const data = clinicalOrdersQuery.data.value;
  const target = completionTarget.value;
  if (!data || !target || busy.value) return;
  const remaining = target.task.requested_quantity - target.task.performed_quantity;
  if (remaining <= 0) return;
  busy.value = `complete-clinical:${target.task.execution_task_id}`; notice.value = '';
  try {
    await recordOrderExecution(data.lease, 'outpatient', target.task, 'COMPLETED', remaining);
    completionTarget.value = null;
    notice.value = '影像执行事实已追加，可在结果工作台录入并签发报告。';
    await clinicalOrdersQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function create() {
  const lease = writeLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createImagingOrder(lease, {
      modality: form.modality, body_part: form.bodyPart, laterality: form.laterality,
      contrast_required: form.contrastRequired, ordered_at: new Date().toISOString(),
    });
    notice.value = '影像检查已申请，进入执行与报告闭环。';
    createDialogOpen.value = false;
    await ordersQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transition(order: ImagingOrderWire, action: 'PERFORM' | 'REPORT' | 'CANCEL') {
  const lease = writeLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = `${action}:${order.imaging_order_id}`; notice.value = '';
  try {
    await transitionImagingOrder(lease, order, action);
    if (action === 'CANCEL') cancelTarget.value = null;
    notice.value = action === 'PERFORM' ? '已登记执行，可录入报告。' : action === 'REPORT' ? '报告已完成并归档。' : '检查已取消。';
    await ordersQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">诊疗执行 / 影像</p><h1>检查影像工作台</h1><p>影像申请 → 执行 → 报告三步闭环；造影剂需求显式登记。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button><button v-if="canPrescribe" class="button primary" @click="createDialogOpen = true">新增检查申请</button></div>
    </div>
    <ExecutionPatientContextBar />
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.outpatientPatientName }}</strong><span>当前患者影像检查</span></div><dl><div><dt>部位</dt><dd>显式登记</dd></div><div><dt>造影剂</dt><dd>强制勾选</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>
    <div v-if="!canPrescribe && !canExecute" class="inline-notice" role="status">当前岗位仅可查看影像台账；申请需医师岗位，执行与报告需放射科医师岗位。</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || writeLeaseQuery.isPending.value || ordersQuery.isPending.value || clinicalOrdersQuery.isPending.value" kind="loading" message="正在读取影像检查台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="影像检查统计">
        <article><span>检查数</span><strong>{{ orders.length }}</strong><small>当前患者</small></article>
        <article><span>已报告</span><strong>{{ reportedCount }}</strong></article>
        <article><span>造影剂</span><strong>{{ orders.filter((o) => o.contrast_required).length }}</strong><small>需造影</small></article>
      </section>

      <AgentInlineReview agent-code="MEDICAL_TECH_SCHEDULING" stage-code="EQUIPMENT" :objective="imagingSchedulingObjective" :patient-id="agentPatientId" :encounter-id="agentEncounterId" target-type="ENCOUNTER" :target-id="agentEncounterId" title="AI 影像排程候选" source-route="imaging-workbench" />

      <section class="admin-panel">
          <header><div><h2>影像检查台账</h2><p>状态机：ORDERED → PERFORMED → REPORTED（或 CANCELLED）。</p></div><button class="button secondary" @click="ordersQuery.refetch()">刷新</button></header>
          <div v-if="orders.length === 0" class="empty-state"><span>影</span><p>当前患者暂无影像检查</p><small>在右侧申请检查</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>模态</th><th>部位 / 侧别</th><th>造影剂</th><th>执行时间</th><th>报告时间</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="order in orders" :key="order.imaging_order_id">
                  <td><strong>{{ order.modality }}</strong><small>…{{ order.imaging_order_id.slice(-8) }}</small></td>
                  <td>{{ bodyPartLabels[order.body_part] }} · {{ lateralityLabels[order.laterality] }}</td>
                  <td>{{ order.contrast_required ? '需造影' : '无' }}</td>
                  <td>{{ formatDate(order.performed_at) }}</td>
                  <td>{{ formatDate(order.reported_at) }}</td>
                  <td><span class="admin-status" :class="order.status.toLowerCase()">{{ statusLabels[order.status] }}</span></td>
                  <td class="admin-actions">
                    <button v-if="canExecute && order.status === 'ORDERED'" class="task-action" :disabled="Boolean(busy)" @click="transition(order, 'PERFORM')">登记执行</button>
                    <button v-if="canExecute && order.status === 'PERFORMED'" class="task-action" :disabled="Boolean(busy)" @click="transition(order, 'REPORT')">登记报告归档</button>
                    <button v-if="canPrescribe && order.status === 'ORDERED'" class="task-action danger" :disabled="Boolean(busy)" @click="cancelTarget = order">取消</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <section class="admin-panel">
        <header><div><h2>临床影像医嘱执行</h2><p>将医师已签署的影像医嘱转为可追溯执行事实；不在医嘱页由开立医师代执行。</p></div><button class="button secondary" @click="clinicalOrdersQuery.refetch()">刷新</button></header>
        <div v-if="clinicalImagingTasks.length === 0" class="empty-state"><span>执</span><p>当前患者暂无影像医嘱执行任务</p></div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>项目</th><th>执行任务</th><th>数量</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="entry in clinicalImagingTasks" :key="entry.task.execution_task_id">
            <td><strong>{{ entry.item?.display_name }}</strong><small>{{ entry.item?.catalog_code }}</small></td>
            <td><code>…{{ entry.task.execution_task_id.slice(-8) }}</code></td>
            <td>{{ entry.task.performed_quantity }}/{{ entry.task.requested_quantity }} {{ entry.task.quantity_unit }}</td>
            <td><span class="admin-status" :class="entry.task.task_state.toLowerCase()">{{ entry.task.task_state }}</span></td>
            <td class="admin-actions"><button v-if="canExecute && entry.task.task_state !== 'COMPLETED'" class="task-action" :disabled="Boolean(busy)" @click="completionTarget = { task: entry.task, displayName: entry.item?.display_name ?? '影像检查' }">完成影像执行</button></td>
          </tr>
        </tbody></table></div>
      </section>

      <AdminActionDialog v-model:open="createDialogOpen" title="新增影像检查申请" description="模态、部位、侧别必填；造影剂需求必须显式确认。" eyebrow="诊疗执行 / 检查影像" :busy="busy === 'create'">
        <form class="admin-form" @submit.prevent="create">
          <label><span>模态</span><select v-model="form.modality"><option v-for="m in modalities" :key="m" :value="m">{{ m }}</option></select></label>
          <label><span>部位</span><select v-model="form.bodyPart"><option v-for="part in bodyParts" :key="part" :value="part">{{ bodyPartLabels[part] }}</option></select></label>
          <label><span>侧别</span><select v-model="form.laterality"><option v-for="lat in lateralities" :key="lat" :value="lat">{{ lateralityLabels[lat] }}</option></select></label>
          <label class="checkbox"><input v-model="form.contrastRequired" type="checkbox" />需要造影剂</label>
          <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在申请…' : '申请检查' }}</button>
        </form>
      </AdminActionDialog>

      <AdminActionDialog :open="Boolean(cancelTarget)" title="取消影像检查" description="检查不会物理删除，将转为已取消并保留审计记录。" eyebrow="诊疗执行 / 高风险操作" tone="danger" :busy="busy.startsWith('CANCEL:')" @update:open="cancelTarget = $event ? cancelTarget : null">
        <div class="admin-confirm-impact"><strong>{{ cancelTarget?.modality }} · {{ cancelTarget ? bodyPartLabels[cancelTarget.body_part] : '' }}</strong><p>确认后，该申请不能继续登记执行或报告。</p></div>
        <button class="button danger full" :disabled="Boolean(busy)" @click="cancelTarget && transition(cancelTarget, 'CANCEL')">{{ busy.startsWith('CANCEL:') ? '正在取消…' : '确认取消检查' }}</button>
      </AdminActionDialog>
      <AdminActionDialog :open="Boolean(completionTarget)" title="确认影像执行完成" description="确认患者、部位、侧别和采集完整性后追加执行事实。" eyebrow="诊疗执行 / 影像" :busy="busy.startsWith('complete-clinical:')" @update:open="completionTarget = $event ? completionTarget : null">
        <div class="admin-confirm-impact"><strong>{{ completionTarget?.displayName }}</strong><p>完成后该任务可进入报告录入和签发流程。</p></div>
        <button class="button primary full" :disabled="Boolean(busy)" @click="completeClinicalExecution">{{ busy.startsWith('complete-clinical:') ? '正在记录…' : '确认完成影像执行' }}</button>
      </AdminActionDialog>
    </template>
  </section>
</template>
