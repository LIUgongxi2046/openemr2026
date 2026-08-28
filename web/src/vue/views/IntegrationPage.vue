<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { MockInvocationResultWire } from '../../generated/contracts';
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
const issue = computed(() => (leaseQuery.error.value ?? interfacesQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? interfacesQuery.error.value) : null);

const integrationInterfaces = computed(() => (interfacesQuery.data.value ?? []).filter((i) => i.system_type.startsWith('INTEGRATION_')));
const busyCode = ref('');
const notice = ref('');
const results = ref<Record<string, MockInvocationResultWire>>({});

async function testConnection(code: string) {
  const lease = leaseQuery.data.value;
  if (!lease || busyCode.value) return;
  busyCode.value = code; notice.value = '';
  try {
    results.value[code] = await invokeMockInterface(lease, code);
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busyCode.value = '';
  }
}

function systemTypeLabel(value: string) {
  return ({ INTEGRATION_LIS: '检验 LIS', INTEGRATION_PACS: '影像 PACS', INTEGRATION_HIS: '医保 HIS', INTEGRATION_CA: '电子签名 CA', INTEGRATION_HIE: '区域平台' } as Record<string, string>)[value] ?? value;
}

const systemMeta: Record<string, { code: string; protocol: string; status: string; volume: string; errors: number; tone: string }> = {
  INTEGRATION_LIS: { code: 'LIS-CORE', protocol: 'HL7 v2 / FHIR', status: '正常', volume: '28,641', errors: 3, tone: 'green' },
  INTEGRATION_PACS: { code: 'PACS-A', protocol: 'DICOMweb / DIMSE', status: '降级', volume: '8,920', errors: 12, tone: 'amber' },
  INTEGRATION_HIS: { code: 'HIS-BILL', protocol: 'REST / MQ', status: '正常', volume: '41,205', errors: 0, tone: 'green' },
  INTEGRATION_CA: { code: 'CA-SIGN', protocol: 'HTTPS / SDK', status: '正常', volume: '2,846', errors: 1, tone: 'green' },
  INTEGRATION_HIE: { code: 'REGION-HIE', protocol: 'CDA / FHIR', status: '积压', volume: '1,218', errors: 36, tone: 'red' },
};
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>外部系统集成与互操作中心</h1><p>连接器能力、运行健康、消息积压和临床降级的统一入口</p></div>
      <div class="head-actions"><RouterLink class="btn" to="/integration-mapping">集成拓扑</RouterLink><RouterLink class="btn primary" :to="{ path: '/integration-connectors', query: { action: 'create' } }">新建连接器</RouterLink></div>
    </div>

    <div v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value" class="card"><div class="card-body">正在读取集成接口…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <section class="metric-grid integration-metrics" aria-label="集成运行指标">
        <article class="metric"><div class="name">生产连接器</div><div class="value">18</div><div class="trend">LIS/PACS/HIS/CA/设备</div></article>
        <article class="metric"><div class="name">24h 消息</div><div class="value">82,830</div><div class="trend">成功 99.86%</div></article>
        <article class="metric"><div class="name">失败/死信</div><div class="value metric-danger">52</div><div class="trend">业务阻断 3</div></article>
        <article class="metric"><div class="name">待对账</div><div class="value">17</div><div class="trend">报告/图像 12</div></article>
      </section>

      <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>

      <div class="grid integration-layout">
        <section class="card scroll-card">
          <div class="card-head">系统与运行状态 <span class="sub">三级医院仿真 · 可连接测试</span></div>
          <div v-if="integrationInterfaces.length === 0" class="card-body">暂无集成模拟接口。</div>
          <div v-else class="card-body">
            <div v-for="item in integrationInterfaces" :key="item.code" class="extension-card integration-system-row">
              <div class="integration-system-summary">
                <b>{{ systemMeta[item.system_type]?.code ?? item.code }}</b>
                <span class="status blue">{{ systemTypeLabel(item.system_type) }}</span>
                <span>{{ systemMeta[item.system_type]?.protocol }}</span>
                <span class="status" :class="systemMeta[item.system_type]?.tone">{{ systemMeta[item.system_type]?.status }}</span>
                <span>{{ systemMeta[item.system_type]?.volume }} / 24h</span>
                <span>{{ systemMeta[item.system_type]?.errors }} 异常</span>
                <button class="btn sm integration-test-button" :disabled="Boolean(busyCode)" @click="testConnection(item.code)">{{ busyCode === item.code ? '测试中…' : '连接测试' }}</button>
              </div>
              <p>{{ item.description }}</p>
              <template v-if="results[item.code]">
                <div class="notice info"><div class="notice-title">模拟响应 · 连接成功</div>{{ results[item.code].notice }}</div>
                <pre class="mock-payload">{{ JSON.stringify(results[item.code].payload, null, 2) }}</pre>
              </template>
            </div>
          </div>
        </section>

        <aside class="card scroll-card">
          <div class="card-head">互操作与消息对账</div>
          <div class="card-body">
            <div class="notice hard"><div class="notice-title">区域平台积压 36</div>CDA 回执延迟，不影响院内病历签署；共享状态保持“待确认”。</div>
            <div class="notice rule"><div class="notice-title">PACS 图像部分降级</div>报告可用，3 个 Study 的 WADO-RS 调阅超时；临床页不伪装图像完整。</div>
            <div class="folder-row">LIS 报告<span class="status green">正常</span></div>
            <div class="folder-row">PACS 报告<span class="status green">正常</span></div>
            <div class="folder-row">PACS 图像<span class="status amber">部分可用</span></div>
            <div class="folder-row">电子签名<span class="status green">正常</span></div>
            <div class="folder-row">区域共享<span class="status red">待确认</span></div>
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
