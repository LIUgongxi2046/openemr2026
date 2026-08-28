<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { ConfigurationItemWire, MockInvocationResultWire } from '../../generated/contracts';
import { issueConfigurationLease, listConfigurations } from '../../api/config';
import { invokeMockInterface, issueMockLease, listMockInterfaces } from '../../api/mock';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['mock', 'lease'],
  queryFn: () => issueMockLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const interfacesQuery = useQuery({
  queryKey: ['mock', 'interfaces'],
  queryFn: () => listMockInterfaces(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const configLeaseQuery = useQuery({
  queryKey: ['integration', 'config-lease'], queryFn: issueConfigurationLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const connectorsQuery = useQuery({
  queryKey: ['integration', 'connectors'],
  queryFn: () => listConfigurations(configLeaseQuery.data.value!, 'INTEGRATION_CONNECTOR'),
  enabled: () => Boolean(configLeaseQuery.data.value), retry: false,
});
const incidentsQuery = useQuery({
  queryKey: ['integration', 'incidents'],
  queryFn: () => listConfigurations(configLeaseQuery.data.value!, 'INTEGRATION_INCIDENT'),
  enabled: () => Boolean(configLeaseQuery.data.value), retry: false,
});
const issue = computed(() => {
  const error = leaseQuery.error.value ?? interfacesQuery.error.value ?? configLeaseQuery.error.value
    ?? connectorsQuery.error.value ?? incidentsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

const integrationInterfaces = computed(() => (interfacesQuery.data.value ?? [])
  .filter((item) => item.system_type.startsWith('INTEGRATION_')));
const connectors = computed(() => (connectorsQuery.data.value ?? []).filter((item) => item.status === 'ACTIVE'));
const incidents = computed(() => (incidentsQuery.data.value ?? []).filter((item) => item.status === 'ACTIVE'));
const busyCode = ref('');
const notice = ref('');
const results = ref<Record<string, MockInvocationResultWire>>({});

function text(item: ConfigurationItemWire, key: string, fallback = '—') {
  const value = item.payload?.[key];
  return typeof value === 'string' && value.trim() ? value : fallback;
}
function number(item: ConfigurationItemWire, key: string) {
  const value = Number(item.payload?.[key] ?? 0);
  return Number.isFinite(value) ? value : 0;
}
function interfaceFor(item: ConfigurationItemWire) {
  const expected = `INTEGRATION_${text(item, 'system_type', '')}`;
  return integrationInterfaces.value.find((candidate) => candidate.system_type === expected);
}
async function testConnection(item: ConfigurationItemWire) {
  const lease = leaseQuery.data.value;
  const mock = interfaceFor(item);
  if (!lease || !mock || busyCode.value) return;
  busyCode.value = item.config_key; notice.value = '';
  try {
    results.value[item.config_key] = await invokeMockInterface(lease, mock.code);
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busyCode.value = '';
  }
}

function systemTypeLabel(value: string) {
  return ({ LIS: '检验 LIS', PACS: '影像 PACS', HIS: '费用医保 HIS', CA: '电子签名 CA', HIE: '区域平台', PHARMACY: '药品管理', BLOOD_BANK: '临床输血', PATHOLOGY: '病理系统', ANESTHESIA: '麻醉手术', IOMT: '医疗设备' } as Record<string, string>)[value] ?? value;
}
function statusLabel(item: ConfigurationItemWire) {
  return ({ HEALTHY: '正常', DEGRADED: '降级', BACKLOG: '积压', OFFLINE: '离线' } as Record<string, string>)[text(item, 'operational_status')] ?? text(item, 'operational_status');
}
function statusTone(item: ConfigurationItemWire) {
  return ({ HEALTHY: 'green', DEGRADED: 'amber', BACKLOG: 'red', OFFLINE: 'red' } as Record<string, string>)[text(item, 'operational_status')] ?? 'blue';
}
const messageVolume = computed(() => connectors.value.reduce((sum, item) => sum + number(item, 'message_volume_24h'), 0));
const errorCount = computed(() => connectors.value.reduce((sum, item) => sum + number(item, 'error_count_24h'), 0));
const pendingCount = computed(() => connectors.value.reduce((sum, item) => sum + number(item, 'pending_reconciliation'), 0));
const blockingCount = computed(() => connectors.value.reduce((sum, item) => sum + number(item, 'business_blocking'), 0));
const successRate = computed(() => messageVolume.value > 0
  ? ((messageVolume.value - errorCount.value) / messageVolume.value * 100).toFixed(2) : '—');
const formatInteger = (value: number) => new Intl.NumberFormat('zh-CN').format(value);
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>外部系统集成与互操作中心</h1><p>连接器能力、运行健康、消息积压和临床降级的统一入口</p></div>
      <div class="head-actions"><RouterLink class="btn" to="/integration-mapping">集成拓扑</RouterLink><RouterLink class="btn primary" :to="{ path: '/integration-connectors', query: { action: 'create' } }">新建连接器</RouterLink></div>
    </div>

    <div v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value || configLeaseQuery.isPending.value || connectorsQuery.isPending.value || incidentsQuery.isPending.value" class="card"><div class="card-body">正在读取集成接口与运行台账…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <section class="metric-grid integration-metrics" aria-label="集成运行指标">
        <article class="metric"><div class="name">生产连接器</div><div class="value">{{ connectors.length }}</div><div class="trend">来自已发布连接器目录</div></article>
        <article class="metric"><div class="name">24h 消息</div><div class="value">{{ formatInteger(messageVolume) }}</div><div class="trend">成功 {{ successRate }}%</div></article>
        <article class="metric"><div class="name">失败/死信</div><div class="value metric-danger">{{ formatInteger(errorCount) }}</div><div class="trend">业务阻断 {{ blockingCount }}</div></article>
        <article class="metric"><div class="name">待对账</div><div class="value">{{ pendingCount }}</div><div class="trend">开放差异工单 {{ incidents.length }}</div></article>
      </section>

      <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>

      <div class="grid integration-layout">
        <section class="card scroll-card">
          <div class="card-head">系统与运行状态 <span class="sub">三级医院仿真 · 可连接测试</span></div>
          <div v-if="connectors.length === 0" class="card-body">暂无已发布连接器。</div>
          <div v-else class="card-body">
            <div v-for="item in connectors" :key="item.config_id" class="extension-card integration-system-row">
              <div class="integration-system-summary">
                <b>{{ item.display_name }}</b>
                <span class="status blue">{{ systemTypeLabel(text(item, 'system_type')) }}</span>
                <span>{{ text(item, 'protocol') }}</span>
                <span class="status" :class="statusTone(item)">{{ statusLabel(item) }}</span>
                <span>{{ formatInteger(number(item, 'message_volume_24h')) }} / 24h</span>
                <span>{{ number(item, 'error_count_24h') }} 异常</span>
                <button class="btn sm integration-test-button" :disabled="Boolean(busyCode) || !interfaceFor(item)" @click="testConnection(item)">{{ busyCode === item.config_key ? '测试中…' : interfaceFor(item) ? '连接测试' : '无模拟端点' }}</button>
              </div>
              <p>{{ text(item, 'description') }}</p>
              <template v-if="results[item.config_key]">
                <div class="notice info"><div class="notice-title">模拟响应 · 连接成功</div>{{ results[item.config_key].notice }}</div>
                <pre class="mock-payload">{{ JSON.stringify(results[item.config_key].payload, null, 2) }}</pre>
              </template>
            </div>
          </div>
        </section>

        <aside class="card scroll-card">
          <div class="card-head">互操作与消息对账</div>
          <div class="card-body">
            <div v-if="incidents.length === 0" class="admin-empty">当前没有开放差异工单。</div>
            <div v-for="incident in incidents.slice(0, 4)" :key="incident.config_id" class="notice" :class="text(incident, 'result') === 'RECOVERED' ? 'info' : 'hard'">
              <div class="notice-title">{{ incident.display_name }}</div>{{ text(incident, 'clinical_impact') }}
            </div>
            <div v-for="connector in connectors" :key="`status-${connector.config_id}`" class="folder-row">{{ connector.display_name }}<span class="status" :class="statusTone(connector)">{{ statusLabel(connector) }}</span></div>
            <RouterLink class="btn" style="width:100%;margin-top:12px" to="/integration-messages">查看异常消息</RouterLink>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.mock-payload { margin: 8px 0 0; padding: 10px; max-height: 260px; overflow: auto; color: #26384d; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.integration-layout { grid-template-columns: minmax(0, 1fr) 330px; align-items: start; }
.integration-layout > .scroll-card { height: auto; max-height: none; overflow: visible; }
.integration-metrics { margin-bottom: 14px; }
.metric-danger { color: var(--red); }
.head-actions { gap: 10px; }
.integration-system-summary { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 10px; }
.integration-system-summary > span:not(.status) { color: var(--muted); font-size: 10px; }
.integration-test-button { margin-left: auto; }
@media (max-width: 960px) { .integration-layout { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 700px) {
  .page-head { height: auto; min-height: 0; flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 14px; }
  .head-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-left: 0; }
  .head-actions .btn { flex: 1 1 140px; width: auto; min-height: 36px; text-align: center; }
  .integration-test-button { margin-left: 0; width: 100%; }
}
</style>
