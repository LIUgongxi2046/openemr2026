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
const requests = computed(() => requestsQuery.data.value ?? []);
const requestedCount = computed(() => requests.value.filter((request) => request.status === 'REQUESTED').length);
const exportedCount = computed(() => requests.value.filter((request) => request.status === 'EXPORTED').length);

const form = reactive({ purpose: '', scopeDescription: '' });
const busy = ref('');
const notice = ref('');

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
  const watermark = window.prompt('请输入导出水印（随数据集落盘，用于追踪泄露）', `仅供研究评审 · ${request.request_id.slice(0, 8)}`);
  if (!watermark) return;
  busy.value = request.request_id; notice.value = '';
  try {
    await exportResearchDatasetRequest(lease, request, watermark);
    notice.value = `请求 ${request.purpose} 已导出并加盖水印。`;
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
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 科研</p>
        <h1>研究数据集请求</h1>
        <p>管理去标识化研究数据集的申请、审批、导出与销毁生命周期；导出数据强制加盖可追踪水印。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || requestsQuery.isPending.value" kind="loading" message="正在读取研究数据集请求" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="请求统计">
        <article><span>请求总数</span><strong>{{ requests.length }}</strong><small>全部状态</small></article>
        <article><span>待审批</span><strong>{{ requestedCount }}</strong><small>REQUESTED</small></article>
        <article><span>已导出</span><strong>{{ exportedCount }}</strong><small>EXPORTED</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>请求台账</h2><p>状态机：REQUESTED → APPROVED → EXPORTED → DESTROYED（或 REJECTED）。</p></div>
            <button class="button secondary" @click="requestsQuery.refetch()">刷新</button>
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
                    <button class="task-action" :disabled="request.status !== 'REQUESTED' || Boolean(busy)" @click="approve(request)">{{ busy === request.request_id && request.status === 'REQUESTED' ? '处理中…' : '批准' }}</button>
                    <button class="task-action" :disabled="request.status !== 'APPROVED' || Boolean(busy)" @click="exportRequest(request)">导出</button>
                    <button class="task-action" :disabled="request.status !== 'EXPORTED' || Boolean(busy)" @click="destroy(request)">销毁</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>创建请求</h2><p>目的与范围描述均为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="createRequest">
            <label><span>目的</span><input v-model="form.purpose" maxlength="256" required placeholder="例：糖尿病并发症风险建模" /></label>
            <label><span>范围描述</span><textarea v-model="form.scopeDescription" required placeholder="例：2024–2026 年确诊 2 型糖尿病的去标识化就诊与检验记录" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建请求' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
