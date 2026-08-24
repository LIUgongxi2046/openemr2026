<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { AgentRegistryWire } from '../../generated/contracts';
import { deactivateAgent, issueAiLease, listAgents, registerAgent } from '../../api/ai-platform';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['ai-platform', 'agent-catalog', 'lease'],
  queryFn: () => issueAiLease('AI_PLATFORM_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const agentsQuery = useQuery({
  queryKey: ['ai-platform', 'agent-catalog', 'agents'],
  queryFn: () => listAgents(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? agentsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? agentsQuery.error.value) : null);
const agents = computed(() => agentsQuery.data.value ?? []);
const activeCount = computed(() => agents.value.filter((agent) => agent.status === 'ACTIVE').length);

const form = reactive({ agentCode: '', agentName: '', agentVersion: '' });
const busy = ref('');
const notice = ref('');

async function reload() {
  notice.value = '';
  await agentsQuery.refetch();
}

async function register() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.agentCode.trim() || !form.agentName.trim() || !form.agentVersion.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await registerAgent(lease, {
      agent_code: form.agentCode.trim(),
      agent_name: form.agentName.trim(),
      agent_version: form.agentVersion.trim(),
    });
    form.agentCode = ''; form.agentName = ''; form.agentVersion = '';
    notice.value = 'Agent 已登记，审计链与事件出箱已同步记录。';
    await agentsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(agent: AgentRegistryWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || agent.status !== 'ACTIVE') return;
  busy.value = agent.agent_registry_id; notice.value = '';
  try {
    await deactivateAgent(lease, agent);
    notice.value = `Agent ${agent.agent_name} 已停用。`;
    await agentsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">AI 平台 / Agent 目录与定义编辑器</p>
        <h1>Agent 目录</h1>
        <p>登记与停用可执行 Agent；所有变更使用幂等键、审计链与事件出箱，停用不物理删除。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || agentsQuery.isPending.value" kind="loading" message="正在读取 Agent 目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="Agent 统计">
        <article><span>Agent</span><strong>{{ agents.length }}</strong><small>全部登记</small></article>
        <article><span>有效 Agent</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>Agent 台账</h2><p>编码与版本不可变；停用保留历史语义。</p></div>
            <button class="button secondary" @click="agentsQuery.refetch()">刷新</button>
          </header>
          <div v-if="agents.length === 0" class="admin-empty" role="status">暂无 Agent，可在右侧登记。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>名称</th><th>编码</th><th>版本</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="agent in agents" :key="agent.agent_registry_id">
                  <td><strong>{{ agent.agent_name }}</strong><small>…{{ agent.agent_registry_id.slice(-8) }}</small></td>
                  <td><code>{{ agent.agent_code }}</code></td>
                  <td><code>{{ agent.agent_version }}</code></td>
                  <td><span class="admin-status" :class="agent.status.toLowerCase()">{{ agent.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="agent.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(agent)">{{ busy === agent.agent_registry_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>登记 Agent</h2><p>编码、名称与版本均为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="register">
            <label><span>Agent 编码</span><input v-model="form.agentCode" maxlength="128" required placeholder="例：TRIAGE-AGENT" /></label>
            <label><span>Agent 名称</span><input v-model="form.agentName" maxlength="256" required placeholder="例：分诊建议 Agent" /></label>
            <label><span>版本</span><input v-model="form.agentVersion" maxlength="64" required placeholder="例：1.0.0" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在登记…' : '登记并生效' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
