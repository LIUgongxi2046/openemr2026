<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ToolRegistryWire } from '../../generated/contracts';
import { deactivateTool, issueAiLease, listTools, registerTool } from '../../api/ai-platform';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type ToolType = ToolRegistryWire['tool_type'];
const toolTypeLabels: Record<ToolType, string> = {
  API: 'API',
  FUNCTION: '函数',
  DATABASE_QUERY: '数据库查询',
  OTHER: '其他',
};

const leaseQuery = useQuery({
  queryKey: ['ai-platform', 'tool-catalog', 'lease'],
  queryFn: () => issueAiLease('AI_PLATFORM_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const toolsQuery = useQuery({
  queryKey: ['ai-platform', 'tool-catalog', 'tools'],
  queryFn: () => listTools(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? toolsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? toolsQuery.error.value) : null);
const tools = computed(() => toolsQuery.data.value ?? []);
const activeCount = computed(() => tools.value.filter((tool) => tool.status === 'ACTIVE').length);

const form = reactive({
  toolCode: '',
  toolName: '',
  toolVersion: '',
  toolType: 'API' as ToolType,
});
const busy = ref('');
const notice = ref('');

async function reload() {
  notice.value = '';
  await toolsQuery.refetch();
}

async function register() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.toolCode.trim() || !form.toolName.trim() || !form.toolVersion.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await registerTool(lease, {
      tool_code: form.toolCode.trim(),
      tool_name: form.toolName.trim(),
      tool_version: form.toolVersion.trim(),
      tool_type: form.toolType,
    });
    form.toolCode = ''; form.toolName = ''; form.toolVersion = '';
    notice.value = 'Tool 已登记，审计链与事件出箱已同步记录。';
    await toolsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(tool: ToolRegistryWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || tool.status !== 'ACTIVE') return;
  busy.value = tool.tool_registry_id; notice.value = '';
  try {
    await deactivateTool(lease, tool);
    notice.value = `Tool ${tool.tool_name} 已停用。`;
    await toolsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">AI 平台 / Tool 目录、风险与审批策略</p>
        <h1>Tool 目录</h1>
        <p>登记与停用可执行 Tool；所有变更使用幂等键、审计链与事件出箱，停用不物理删除。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || toolsQuery.isPending.value" kind="loading" message="正在读取 Tool 目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="Tool 统计">
        <article><span>Tool</span><strong>{{ tools.length }}</strong><small>全部登记</small></article>
        <article><span>有效 Tool</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>Tool 台账</h2><p>编码与版本不可变；停用保留历史语义。</p></div>
            <button class="button secondary" @click="toolsQuery.refetch()">刷新</button>
          </header>
          <div v-if="tools.length === 0" class="admin-empty" role="status">暂无 Tool，可在右侧登记。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>名称</th><th>编码</th><th>类型</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="tool in tools" :key="tool.tool_registry_id">
                  <td><strong>{{ tool.tool_name }}</strong><small>…{{ tool.tool_registry_id.slice(-8) }}</small></td>
                  <td><code>{{ tool.tool_code }}</code></td>
                  <td>{{ toolTypeLabels[tool.tool_type] }}</td>
                  <td><code>{{ tool.tool_version }}</code></td>
                  <td><span class="admin-status" :class="tool.status.toLowerCase()">{{ tool.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="tool.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(tool)">{{ busy === tool.tool_registry_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>登记 Tool</h2><p>编码、名称与版本均为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="register">
            <label><span>Tool 编码</span><input v-model="form.toolCode" maxlength="128" required placeholder="例：DRUG-INTERACTION" /></label>
            <label><span>Tool 名称</span><input v-model="form.toolName" maxlength="256" required placeholder="例：药物相互作用查询" /></label>
            <label><span>版本</span><input v-model="form.toolVersion" maxlength="64" required placeholder="例：1.0.0" /></label>
            <label><span>类型</span><select v-model="form.toolType"><option v-for="(name, type) in toolTypeLabels" :key="type" :value="type">{{ name }}</option></select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在登记…' : '登记并生效' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
