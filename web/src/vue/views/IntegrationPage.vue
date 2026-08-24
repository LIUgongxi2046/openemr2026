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
  return ({ INTEGRATION_LIS: '检验 LIS', INTEGRATION_PACS: '影像 PACS', INTEGRATION_HIS: '医保 HIS', INTEGRATION_CA: '电子签名 CA' } as Record<string, string>)[value] ?? value;
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>外部系统集成与互操作中心</h1><p>LIS、PACS、HIS 医保、CA 电子签名的统一接入 · 当前为模拟接口，待真实适配器接入后替换</p></div>
      <div class="head-actions"><RouterLink class="btn" to="/mock-interfaces">查看全部模拟接口</RouterLink></div>
    </div>

    <div v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value" class="card"><div class="card-body">正在读取集成接口…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <div class="portal-safety">
        <b>集成边界</b>
        <span>本页所有「连接测试」均调用模拟接口返回确定性合成数据，不访问任何真实外部系统，也不进入真实临床事实。</span>
        <span class="status amber">模拟适配器</span>
      </div>

      <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>

      <div class="grid integration-layout">
        <section class="card scroll-card">
          <div class="card-head">集成接口 <span class="sub">模拟 · 可连接测试</span></div>
          <div v-if="integrationInterfaces.length === 0" class="card-body">暂无集成模拟接口。</div>
          <div v-else class="card-body">
            <div v-for="item in integrationInterfaces" :key="item.code" class="extension-card">
              <div style="display:flex;align-items:center;gap:8px">
                <b>{{ item.display_name }}</b>
                <span class="status blue">{{ systemTypeLabel(item.system_type) }}</span>
                <button class="btn sm" style="margin-left:auto" :disabled="Boolean(busyCode)" @click="testConnection(item.code)">{{ busyCode === item.code ? '测试中…' : '连接测试' }}</button>
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
            <div class="notice rule"><div class="notice-title">待真实适配器</div>连接器配置、消息追踪与对账在真实 LIS/PACS/HIS/CA 适配器接入后启用；当前用模拟接口验证交互契约。</div>
            <div class="section-title">模拟接口覆盖</div>
            <div class="folder-row">检验 LIS<span>LIS_RESULTS</span></div>
            <div class="folder-row">影像 PACS<span>PACS_IMAGES</span></div>
            <div class="folder-row">医保 HIS<span>HIS_INSURANCE</span></div>
            <div class="folder-row">电子签名 CA<span>CA_TIMESTAMP</span></div>
            <RouterLink class="btn" style="width:100%;margin-top:12px" to="/mock-interfaces">打开模拟接口控制台</RouterLink>
          </div>
        </aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.mock-payload { margin: 8px 0 0; padding: 10px; max-height: 260px; overflow: auto; color: #26384d; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.integration-layout { grid-template-columns: minmax(0, 1fr) 330px; }
</style>
