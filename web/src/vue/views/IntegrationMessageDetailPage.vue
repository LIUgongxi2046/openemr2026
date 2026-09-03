<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { IntegrationMessageWire } from '../../generated/contracts';
import { issueIntegrationLease, listIntegrationMessages, listIntegrationReconciliations, reconcileIntegrationMessage } from '../../api/integration';
import { toClinicalIssue } from '../clinical-error';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const route = useRoute();
const messageId = computed(() => String(route.params.messageId ?? ''));
const busy = ref(false);
const notice = ref('');

const leaseQuery = useQuery({
  queryKey: ['integration-message-detail', 'lease'], queryFn: issueIntegrationLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const messagesQuery = useQuery({
  queryKey: ['integration-message-detail', 'messages'],
  queryFn: () => listIntegrationMessages(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const reconciliationsQuery = useQuery({
  queryKey: ['integration-message-detail', 'reconciliations'],
  queryFn: () => listIntegrationReconciliations(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});

const message = computed<IntegrationMessageWire | null>(() =>
  (messagesQuery.data.value ?? []).find((item) => item.message_id === messageId.value) ?? null);
const reconciliation = computed(() => {
  if (!message.value) return null;
  return (reconciliationsQuery.data.value ?? []).find((item) =>
    item.connector_code === message.value!.connector_code) ?? null;
});
const issue = computed(() => {
  const error = leaseQuery.error.value ?? messagesQuery.error.value ?? reconciliationsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

const statusLabels: Record<IntegrationMessageWire['message_status'], string> = {
  PENDING: '待对账', DELIVERED: '已送达', RECONCILED: '已对账', FAILED: '失败',
};

function formatDate(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
}

async function reconcile() {
  const lease = leaseQuery.data.value;
  if (!lease || !message.value || busy.value) return;
  busy.value = true; notice.value = '';
  try {
    await reconcileIntegrationMessage(lease, message.value.message_id);
    notice.value = '该消息已对账，对账窗口已重新汇总。';
    await Promise.all([messagesQuery.refetch(), reconciliationsQuery.refetch()]);
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 集成平台 / 消息详情</p>
        <h1>集成消息详情</h1>
        <p>追踪号与业务对象由服务端持久化；本页只读展示对账所需的元数据，不展示脱敏消息正文。</p>
      </div>
      <div class="toolbar-actions">
        <RouterLink class="button secondary" to="/integration-messages">返回消息台账</RouterLink>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || messagesQuery.isPending.value" kind="loading" message="正在读取消息详情" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="messagesQuery.refetch()" />
    <ClinicalPageState v-else-if="!message" kind="empty" message="未找到该消息，可能已被清理或无权访问。" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-metrics">
        <article><span>连接器</span><strong>{{ message.connector_code }}</strong><small>接口 {{ message.interface_code }}</small></article>
        <article><span>方向</span><strong>{{ message.direction }}</strong><small>INBOUND / OUTBOUND</small></article>
        <article><span>状态</span><strong>{{ statusLabels[message.message_status] }}</strong><small>…{{ message.trace_id.slice(-8) }}</small></article>
        <article><span>发生时间</span><strong>{{ formatDate(message.occurred_at) }}</strong><small>行版本 v{{ message.row_version }}</small></article>
      </section>

      <section class="admin-panel">
        <header><div><h2>消息字段</h2><p>业务对象与业务键用于对账和幂等去重。</p></div>
          <button v-if="message.message_status !== 'RECONCILED' && message.message_status !== 'FAILED'" class="button primary" :disabled="busy" @click="reconcile">完成对账</button>
        </header>
        <div class="detail-grid">
          <div class="folder-row"><span>业务对象</span><strong>{{ message.business_object }}</strong></div>
          <div class="folder-row"><span>业务键</span><strong><code>{{ message.business_key ?? '—' }}</code></strong></div>
          <div class="folder-row"><span>追踪号</span><strong><code>{{ message.trace_id }}</code></strong></div>
          <div class="folder-row"><span>异常说明</span><strong>{{ message.error_detail ?? '—' }}</strong></div>
          <div class="folder-row"><span>创建时间</span><strong>{{ formatDate(message.created_at) }}</strong></div>
        </div>
      </section>

      <section v-if="reconciliation" class="admin-panel">
        <header><div><h2>所属对账窗口</h2><p>{{ reconciliation.connector_code }} · 自然日窗口</p></div>
          <span class="status" :class="reconciliation.status === 'RECONCILED' ? 'green' : 'amber'">{{ reconciliation.status === 'RECONCILED' ? '已对账' : '开放' }}</span>
        </header>
        <div class="detail-grid">
          <div class="folder-row"><span>发送</span><strong>{{ reconciliation.sent_count }}</strong></div>
          <div class="folder-row"><span>送达</span><strong>{{ reconciliation.delivered_count }}</strong></div>
          <div class="folder-row"><span>失败</span><strong>{{ reconciliation.error_count }}</strong></div>
          <div class="folder-row"><span>待对账</span><strong>{{ reconciliation.pending_count }}</strong></div>
        </div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.detail-grid { padding: 4px 15px 15px; }
.detail-grid .folder-row { gap: 14px; }
.detail-grid .folder-row strong { max-width: 70%; overflow-wrap: anywhere; text-align: right; }
</style>
