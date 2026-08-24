<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { MockInterfaceWire, MockInvocationResultWire } from '../../generated/contracts';
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

const selected = ref<MockInterfaceWire | null>(null);
const busyCode = ref('');
const notice = ref('');
const lastResult = ref<MockInvocationResultWire | null>(null);

async function invoke(code: string) {
  const lease = leaseQuery.data.value;
  if (!lease || busyCode.value) return;
  busyCode.value = code; notice.value = '';
  try {
    lastResult.value = await invokeMockInterface(lease, code);
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busyCode.value = '';
  }
}

function select(item: MockInterfaceWire) {
  selected.value = item;
  lastResult.value = null;
}

function systemTypeLabel(value: string) {
  return ({ INTEGRATION_LIS: '检验 LIS', INTEGRATION_PACS: '影像 PACS', INTEGRATION_HIS: '医保 HIS', INTEGRATION_CA: '电子签名 CA', MODEL: '模型', DEVICE: '设备', DICTATION: '语音', IDENTITY: '身份 IdP', ARCHIVE_SCAN: '扫描', ARCHIVE_STORAGE: '存储', PATHOLOGY: '病理', ANESTHESIA: '麻醉', THERAPY: '治疗' } as Record<string, string>)[value] ?? value;
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>模拟接口</h1><p>依赖外部系统的接口统一注册：确定性合成数据 + 对接标准接口 + 对接文档 · 仅供 dev-synthetic 验证，不进入真实临床事实</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="interfacesQuery.refetch()">刷新</button></div>
    </div>

    <div v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value" class="card"><div class="card-body">正在读取模拟接口注册表…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <div class="metric-grid" aria-label="模拟接口概览">
        <div class="metric"><div class="name">已注册接口</div><div class="value">{{ interfacesQuery.data.value?.length ?? 0 }}</div><div class="trend">确定性合成 handler</div></div>
        <div class="metric"><div class="name">系统类型</div><div class="value">{{ new Set(interfacesQuery.data.value?.map((i) => i.system_type)).size }}</div><div class="trend">LIS/PACS/HIS/CA/模型/设备/语音/IdP/扫描/存储/病理/麻醉/治疗</div></div>
        <div class="metric"><div class="name">对接标准接口</div><div class="value">13</div><div class="trend">每个接口含协议名 + 请求/响应 schema + 文档</div></div>
        <div class="metric"><div class="name">替换方式</div><div class="value">契约</div><div class="trend">真实适配器实现同一契约即可替换 mock</div></div>
      </div>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>模拟接口注册表</h2><p>点选接口查看对接标准与文档，点「调用」触发合成 handler。</p></div></header>
          <div class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>接口</th><th>系统类型</th><th>对接标准</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="item in interfacesQuery.data.value ?? []" :key="item.code" :class="{ 'selected-row': selected?.code === item.code }">
                  <td><button class="link-button" @click="select(item)"><strong>{{ item.display_name }}</strong><small><code>{{ item.code }}</code></small></button></td>
                  <td><span class="admin-status muted">{{ systemTypeLabel(item.system_type) }}</span></td>
                  <td>{{ item.standard_interface ?? '—' }}</td>
                  <td><button class="task-action" :disabled="Boolean(busyCode)" @click="invoke(item.code)">{{ busyCode === item.code ? '调用中…' : '调用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <aside class="admin-panel">
          <header><div><h2>对接标准接口</h2><p>{{ selected ? selected.display_name : '从左侧点选接口查看' }}</p></div></header>
          <div v-if="!selected" class="empty-state"><span>⇄</span><p>尚未选择接口</p><small>点选左侧接口查看对接标准与文档</small></div>
          <div v-else class="card-body">
            <div class="folder-row">对接标准<span><code>{{ selected.standard_interface ?? '—' }}</code></span></div>
            <div class="section-title">标准请求 schema</div>
            <pre class="mock-payload">{{ JSON.stringify(selected.request_schema ?? {}, null, 2) }}</pre>
            <div class="section-title">标准响应 schema</div>
            <pre class="mock-payload">{{ JSON.stringify(selected.response_schema ?? {}, null, 2) }}</pre>
            <div class="section-title">对接文档</div>
            <div class="notice info"><div class="notice-title">如何替换真实适配器</div>{{ selected.integration_doc ?? '—' }}</div>
          </div>
        </aside>
      </div>

      <section v-if="lastResult" class="admin-panel" style="margin-top:14px">
        <header><div><h2>最近调用结果</h2><p>接口 {{ lastResult.mock_interface_code }} 的确定性合成响应。</p></div></header>
        <div class="card-body">
          <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>
          <div class="folder-row">请求 ID<span><code>…{{ lastResult.request_id.slice(-8) }}</code></span></div>
          <div class="folder-row">产生时间<span>{{ new Date(lastResult.produced_at).toLocaleString('zh-CN', { hour12: false }) }}</span></div>
          <div class="notice info" style="margin-top:12px"><div class="notice-title">提示</div>{{ lastResult.notice }}</div>
          <pre class="mock-payload">{{ JSON.stringify(lastResult.payload, null, 2) }}</pre>
        </div>
      </section>
    </template>
  </main>
</template>

<style scoped>
.mock-payload { margin: 8px 0 0; padding: 12px; max-height: 280px; overflow: auto; color: #26384d; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; font-size: 11px; line-height: 1.6; white-space: pre-wrap; word-break: break-all; }
.link-button { padding: 0; border: 0; background: transparent; text-align: left; cursor: pointer; }
.selected-row td { background: #f0f6ff; }
</style>
