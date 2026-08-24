<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { AuditEventWire } from '../../generated/contracts';
import { issueAuditLease, listAuditEvents } from '../../api/audit';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const actionCode = ref('');
const resourceType = ref('');

const leaseQuery = useQuery({
  queryKey: ['audit', 'lease'],
  queryFn: () => issueAuditLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const eventsQuery = useQuery({
  queryKey: ['audit', 'events', actionCode, resourceType],
  queryFn: () => listAuditEvents(leaseQuery.data.value!, {
    action_code: actionCode.value.trim() || undefined,
    resource_type: resourceType.value.trim() || undefined,
  }),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? eventsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? eventsQuery.error.value) : null);
const events = computed(() => eventsQuery.data.value ?? []);

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}
function shortId(value: string | null | undefined) {
  return value ? `…${value.slice(-8)}` : '—';
}
function actionLabel(value: AuditEventWire['action_code']) {
  return value.replace(/_/g, ' ').toLowerCase();
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>管理审计与权限复核</h1><p>哈希链审计事件、幂等键与 Outbox 证据可追溯；只读，不提供删除或改写</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="eventsQuery.refetch()">刷新</button></div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || eventsQuery.isPending.value" kind="loading" message="正在读取审计事件链" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="eventsQuery.refetch()" />

    <template v-else>
      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>审计事件链</h2><p>最近 500 条 · 按发生时间倒序</p></div>
            <div class="toolbar-actions">
              <input v-model="actionCode" class="search" placeholder="动作码，如 WORKFORCE_ACCOUNT_DISABLED" aria-label="动作码筛选" />
              <input v-model="resourceType" class="search" placeholder="资源类型，如 WORKFORCE_PERSON" aria-label="资源类型筛选" />
            </div>
          </header>
          <div v-if="events.length === 0" class="empty-state"><span>审</span><p>暂无匹配的审计事件</p><small>业务写操作会同步写入哈希链审计事件</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>发生时间</th><th>动作</th><th>资源</th><th>操作者</th><th>追踪</th><th>事件哈希</th></tr></thead>
              <tbody>
                <tr v-for="event in events" :key="event.audit_event_id">
                  <td>{{ formatDate(event.occurred_at) }}</td>
                  <td><code>{{ actionLabel(event.action_code) }}</code></td>
                  <td><strong>{{ event.resource_type }}</strong><small>{{ shortId(event.resource_id) }}</small></td>
                  <td>{{ shortId(event.actor_user_id) }}</td>
                  <td><code>{{ shortId(event.trace_id) }}</code></td>
                  <td><code class="event-hash">{{ event.event_hash.slice(0, 12) }}…</code></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
        <aside class="admin-panel">
          <header><div><h2>审计链说明</h2></div></header>
          <div class="card-body">
            <p>每条审计事件包含前序哈希与事件哈希，形成不可篡改的哈希链；事件同时写入 Outbox 以投递下游。</p>
            <ul class="audit-notes">
              <li>只读视图，不提供删除、改写或重放入口</li>
              <li>患者相关事件仅保留患者引用哈希，不暴露原始标识</li>
              <li>追踪 ID 关联同一次命令的幂等键与响应</li>
            </ul>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>
