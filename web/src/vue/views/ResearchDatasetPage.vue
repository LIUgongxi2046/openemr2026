<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ResearchDatasetRequestWire } from '../../generated/contracts';
import {
  approveResearchDatasetRequest,
  createResearchDatasetRequest,
  destroyResearchDatasetRequest,
  exportResearchDatasetRequest,
  issueDataLease,
  listResearchDatasetRequests,
} from '../../api/data';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type RequestStatus = ResearchDatasetRequestWire['status'];
const statusLabels: Record<RequestStatus, string> = {
  REQUESTED: '已请求', APPROVED: '已批准', EXPORTED: '已导出', DESTROYED: '已销毁', REJECTED: '已拒绝',
};

const leaseQuery = useQuery({
  queryKey: ['data', 'research-dataset', 'lease'],
  queryFn: () => issueDataLease('RESEARCH_DATASET_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const requestsQuery = useQuery({
  queryKey: ['data', 'research-dataset', 'requests'],
  queryFn: () => listResearchDatasetRequests(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? requestsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? requestsQuery.error.value) : null);
const showHistory = ref(false);
const allRequests = computed(() => requestsQuery.data.value ?? []);
const requests = computed(() => allRequests.value.filter((request) => showHistory.value
  || !['DESTROYED', 'REJECTED'].includes(request.status)));
const requestedCount = computed(() => requests.value.filter((request) => request.status === 'REQUESTED').length);
const exportedCount = computed(() => requests.value.filter((request) => request.status === 'EXPORTED').length);

const form = reactive({ purpose: '', scopeDescription: '' });
const busy = ref('');
const notice = ref('');
const createOpen = ref(false);
const approveOpen = ref(false);
const exportOpen = ref(false);
const destroyOpen = ref(false);
const selectedRequest = ref<ResearchDatasetRequestWire | null>(null);
const exportWatermark = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await requestsQuery.refetch();
}

async function createRequest() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.purpose.trim() || !form.scopeDescription.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createResearchDatasetRequest(lease, {
      purpose: form.purpose.trim(),
      scope_description: form.scopeDescription.trim(),
    });
    form.purpose = ''; form.scopeDescription = '';
    notice.value = '研究数据集请求已创建，进入待审批队列。';
    createOpen.value = false;
    await requestsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function approve(request: ResearchDatasetRequestWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || request.status !== 'REQUESTED') return;
  busy.value = request.request_id; notice.value = '';
  try {
    await approveResearchDatasetRequest(lease, request);
    notice.value = `请求 ${request.purpose} 已批准，可导出。`;
    await requestsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function exportRequest(request: ResearchDatasetRequestWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || request.status !== 'APPROVED') return;
  const watermark = exportWatermark.value.trim();
  if (!watermark) return;
  busy.value = request.request_id; notice.value = '';
  try {
    await exportResearchDatasetRequest(lease, request, watermark);
    notice.value = `请求 ${request.purpose} 已导出并加盖水印。`;
    exportOpen.value = false;
    await requestsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function destroy(request: ResearchDatasetRequestWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || request.status !== 'EXPORTED') return;
  busy.value = request.request_id; notice.value = '';
  try {
    await destroyResearchDatasetRequest(lease, request);
    notice.value = `请求 ${request.purpose} 的导出数据已销毁。`;
    await requestsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

function requestApprove(request: ResearchDatasetRequestWire) { selectedRequest.value = request; approveOpen.value = true; }
function requestExport(request: ResearchDatasetRequestWire) {
  selectedRequest.value = request;
  exportWatermark.value = `仅供研究评审 · ${request.request_id.slice(0, 8)}`;
  exportOpen.value = true;
}
function requestDestroy(request: ResearchDatasetRequestWire) { selectedRequest.value = request; destroyOpen.value = true; }
async function approveSelected() { if (selectedRequest.value) await approve(selectedRequest.value); approveOpen.value = false; }
async function exportSelected() { if (selectedRequest.value) await exportRequest(selectedRequest.value); }
async function destroySelected() { if (selectedRequest.value) await destroy(selectedRequest.value); destroyOpen.value = false; }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav class="admin-breadcrumb" aria-label="科研中心层级导航"><RouterLink to="/research">← 返回科研中心</RouterLink></nav>
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 科研</p>
        <h1>研究数据集请求</h1>
        <p>管理去标识化研究数据集的申请、审批、导出与销毁生命周期；导出数据强制加盖可追踪水印。</p>
      </div>
      <div class="toolbar-actions"><button class="button secondary" @click="reload">刷新</button><button class="button primary" @click="createOpen = true">新建数据申请</button></div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || requestsQuery.isPending.value" kind="loading" message="正在读取研究数据集请求" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="请求统计">
        <article><span>当前请求</span><strong>{{ requests.length }}</strong><small>默认排除终态历史</small></article>
        <article><span>待审批</span><strong>{{ requestedCount }}</strong></article>
        <article><span>已导出</span><strong>{{ exportedCount }}</strong></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-panel">
          <header>
            <div><h2>请求台账</h2><p>状态机：REQUESTED → APPROVED → EXPORTED → DESTROYED（或 REJECTED）。</p></div>
            <label class="admin-code-input"><span>历史</span><input v-model="showHistory" type="checkbox" /> 包含已拒绝/已销毁</label>
          </header>
          <div v-if="requests.length === 0" class="admin-empty" role="status">暂无研究数据集请求，可在右侧创建。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>目的</th><th>范围描述</th><th>状态</th><th>水印</th><th>更新时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="request in requests" :key="request.request_id">
                  <td><strong>{{ request.purpose }}</strong><small>…{{ request.request_id.slice(-8) }} · v{{ request.row_version }}</small></td>
                  <td>{{ request.scope_description }}</td>
                  <td><span class="admin-status" :class="request.status.toLowerCase()">{{ statusLabels[request.status] }}</span></td>
                  <td><code v-if="request.export_watermark">{{ request.export_watermark }}</code><small v-else>—</small></td>
                  <td>{{ formatDate(request.exported_at ?? request.approved_at) }}</td>
                  <td class="admin-actions">
                    <button class="task-action" :disabled="request.status !== 'REQUESTED' || Boolean(busy)" @click="requestApprove(request)">{{ busy === request.request_id && request.status === 'REQUESTED' ? '处理中…' : '批准' }}</button>
                    <button class="task-action" :disabled="request.status !== 'APPROVED' || Boolean(busy)" @click="requestExport(request)">导出</button>
                    <button class="task-action" :disabled="request.status !== 'EXPORTED' || Boolean(busy)" @click="requestDestroy(request)">销毁</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>
    </template>

    <AdminActionDialog v-model:open="createOpen" title="新建科研数据申请" description="申请将绑定研究目的、字段范围和审批证据；创建后进入 REQUESTED 状态，不会自动导出任何患者级数据。" :busy="busy === 'create'">
      <form class="admin-form" @submit.prevent="createRequest"><label><span>研究目的</span><input v-model="form.purpose" maxlength="256" required placeholder="例：糖尿病并发症风险建模" /></label><label><span>范围描述</span><textarea v-model="form.scopeDescription" required placeholder="例：2024–2026 年确诊 2 型糖尿病的去标识化就诊与检验记录" /></label></form>
      <template #footer="{ close }"><button class="button secondary" :disabled="busy === 'create'" @click="close">取消</button><button class="button primary" :disabled="busy === 'create'" @click="createRequest">{{ busy === 'create' ? '正在创建…' : '创建请求' }}</button></template>
    </AdminActionDialog>
    <AdminActionDialog v-model:open="exportOpen" :title="`受控导出 · ${selectedRequest?.purpose ?? ''}`" description="水印会随数据集落盘，用于泄露追踪；导出后状态进入 EXPORTED，并启动到期销毁计时。" :busy="Boolean(busy)">
      <form class="admin-form" @submit.prevent="exportSelected"><label><span>导出水印</span><input v-model="exportWatermark" required maxlength="256" /></label><div class="notice hard"><div class="notice-title">仅允许院内科研安全区</div>默认禁止外带；自由文本和原始影像需要额外审查。</div></form>
      <template #footer="{ close }"><button class="button secondary" :disabled="Boolean(busy)" @click="close">取消</button><button class="button primary" :disabled="Boolean(busy) || !exportWatermark.trim()" @click="exportSelected">确认受控导出</button></template>
    </AdminActionDialog>
    <AdminConfirmDialog v-model:open="approveOpen" :title="`批准 ${selectedRequest?.purpose ?? '数据申请'}`" description="批准后该申请可进入受控导出阶段；审批不会自动生成或下载数据。" confirm-label="确认批准" :busy="Boolean(busy)" @confirm="approveSelected" />
    <AdminConfirmDialog v-model:open="destroyOpen" :title="`销毁 ${selectedRequest?.purpose ?? '导出数据集'}`" description="销毁会终止新的访问并记录销毁证据；申请、审批、水印和审计链仍永久保留。" confirm-label="确认销毁" :busy="Boolean(busy)" @confirm="destroySelected" />
  </section>
</template>
