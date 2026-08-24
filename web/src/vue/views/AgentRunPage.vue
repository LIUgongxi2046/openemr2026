<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import type { AIRunSnapshotWire } from '../../generated/contracts';
import { issueAiLease, listAiRuns } from '../../api/ai-platform';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['ai', 'runs', 'lease'],
  queryFn: () => issueAiLease('AI_RUN_GOVERNANCE'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const runsQuery = useQuery({
  queryKey: ['ai', 'runs'],
  queryFn: () => listAiRuns(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? runsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? runsQuery.error.value) : null);
const runs = computed(() => runsQuery.data.value ?? []);

const terminal = computed(() => runs.value.filter((r) => ['COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'BLOCKED'].includes(r.state)));
const waiting = computed(() => runs.value.filter((r) => r.state === 'WAITING_APPROVAL'));
const active = computed(() => runs.value.filter((r) => !['COMPLETED', 'FAILED', 'REJECTED', 'EXPIRED', 'CANCELLED', 'BLOCKED'].includes(r.state)));

function stateLabel(value: AIRunSnapshotWire['state']) {
  return ({ CREATED: '已创建', ROUTING: '路由中', RETRIEVING: '检索中', PLANNING: '规划中', WAITING_APPROVAL: '待审批', GENERATING: '生成中', VERIFYING: '核验中', READY_FOR_REVIEW: '待审阅', ACCEPTED: '已接受', REJECTED: '已驳回', EXPIRED: '已过期', RETRYING: '重试中', DEGRADED: '已降级', RECONCILING: '对账中', COMPLETED: '已完成', FAILED: '失败', BLOCKED: '阻断', CANCELLED: '已取消' } as Record<string, string>)[value] ?? value;
}
function stateClass(value: AIRunSnapshotWire['state']) {
  if (['COMPLETED', 'ACCEPTED'].includes(value)) return 'green';
  if (['FAILED', 'REJECTED', 'BLOCKED', 'EXPIRED'].includes(value)) return 'danger';
  if (['WAITING_APPROVAL', 'READY_FOR_REVIEW'].includes(value)) return 'amber';
  return 'muted';
}
function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>Agent 受控运行</h1><p>受控运行快照与事件流（/ai/runs）· 每个动作、审批、版本与停用策略可追溯</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="runsQuery.refetch()">刷新</button></div>
    </div>

    <div v-if="leaseQuery.isPending.value || runsQuery.isPending.value" class="card"><div class="card-body">正在读取 Agent 运行…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <div class="metric-grid" aria-label="Agent 运行概览">
        <div class="metric"><div class="name">运行总数</div><div class="value">{{ runs.length }}</div><div class="trend">最近 500 条</div></div>
        <div class="metric"><div class="name">进行中</div><div class="value">{{ active.length }}</div><div class="trend">非终态运行</div></div>
        <div class="metric"><div class="name">待审批</div><div class="value">{{ waiting.length }}</div><div class="trend">需人工批准</div></div>
        <div class="metric"><div class="name">已终态</div><div class="value">{{ terminal.length }}</div><div class="trend">完成/失败/驳回/过期</div></div>
      </div>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>运行列表</h2><p>受控运行快照，按创建时间倒序。</p></div></header>
          <div v-if="runs.length === 0" class="empty-state"><span>A</span><p>暂无 Agent 运行</p><small>通过 AI 助手或 Agent 目录发起运行后在此查看</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>运行 ID</th><th>状态</th><th>序号</th><th>数据水印</th><th>更新时间</th></tr></thead>
              <tbody>
                <tr v-for="run in runs" :key="run.run_id">
                  <td><code>…{{ run.run_id.slice(-8) }}</code></td>
                  <td><span class="admin-status" :class="stateClass(run.state)">{{ stateLabel(run.state) }}</span></td>
                  <td>{{ run.sequence }}</td>
                  <td><code>{{ run.data_watermark.slice(0, 10) }}…</code></td>
                  <td>{{ formatDate(run.updated_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="admin-panel">
          <header><div><h2>运行边界</h2></div></header>
          <div class="card-body">
            <div class="folder-row">患者/就诊隔离<span>按上下文租约</span></div>
            <div class="folder-row">审批<span>有副作用动作需批准</span></div>
            <div class="folder-row">预算<span>token / 时长硬限额</span></div>
            <div class="folder-row">证据<span>来源回看 + 审计哈希链</span></div>
            <RouterLink class="btn" style="width:100%;margin-top:12px" to="/agent-catalog">打开 Agent 目录</RouterLink>
            <RouterLink class="btn" style="width:100%;margin-top:8px" to="/aiops">运行治理</RouterLink>
          </div>
        </aside>
      </div>
    </template>
  </main>
</template>
