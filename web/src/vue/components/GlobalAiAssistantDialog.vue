<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, nextTick, ref, watch } from 'vue';

import { issueContextLease } from '../../clinical-api';
import { streamAssistantResponse } from '../../api/assistant';
import {
  createMedicalAgentRun,
  issueMedicalAgentCatalogLease,
  issueMedicalAgentRunLease,
  listMedicalAgentCatalog,
} from '../../api/medical-agents';
import type { MedicalAgentFamilyWire, MedicalAgentReleaseWire } from '../../generated/contracts';
import { toClinicalIssue } from '../clinical-error';
import { doctorFacingAiText, doctorFacingTeamName } from '../medical-ai-terminology';

interface ChatMessage { role: 'user' | 'assistant'; text: string; agentName?: string }

const props = defineProps<{
  open: boolean;
  mode: 'center' | 'side';
  routeId: string;
  contextLabel: string;
  patientId: string | null;
  encounterId: string | null;
  taskId: string | null;
}>();
const emit = defineEmits<{ close: []; 'mode-change': [mode: 'center' | 'side'] }>();

const dialog = ref<HTMLDialogElement | null>(null);
const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const notice = ref('');
const selectedAgentCode = ref('');
const contextKey = computed(() => [props.routeId, props.patientId, props.encounterId, props.taskId].join(':'));
const leaseQuery = useQuery({
  queryKey: computed(() => ['global-assistant', 'lease', contextKey.value]),
  queryFn: () => issueContextLease(props.patientId, props.encounterId, 'AI_ASSISTANT'),
  enabled: computed(() => props.open), retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const agentQuery = useQuery({
  queryKey: ['global-assistant', 'medical-agent-families'],
  queryFn: async () => {
    const lease = await issueMedicalAgentCatalogLease();
    return listMedicalAgentCatalog(lease);
  },
  enabled: computed(() => props.open), retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const issue = computed(() => leaseQuery.error.value ? toClinicalIssue(leaseQuery.error.value) : null);
const agentIssue = computed(() => agentQuery.error.value ? toClinicalIssue(agentQuery.error.value) : null);
const agents = computed(() => agentQuery.data.value ?? []);
const childAgentCount = computed(() => agents.value.reduce((count, family) => count + family.child_agents.length, 0));
const selectedAgent = computed(() => agents.value.find(
  (family) => family.main_agent.agent_code === selectedAgentCode.value,
));

function clinicianAgentName(name: string) {
  return doctorFacingTeamName(name);
}

function clinicianAgentDescription(description: string) {
  return doctorFacingAiText(description).replaceAll('候选', '草稿');
}

watch([() => props.open, () => props.mode], async ([open, mode]) => {
  await nextTick();
  const element = dialog.value;
  if (!element) return;
  if (mode === 'center' && open && !element.open) element.showModal();
  if (!open && element.open) element.close();
}, { immediate: true });

watch(agents, (next) => {
  if (next.length && !next.some((family) => family.main_agent.agent_code === selectedAgentCode.value)) {
    selectedAgentCode.value = next[0].main_agent.agent_code;
  }
}, { immediate: true });

watch(contextKey, () => {
  messages.value = [];
  draft.value = '';
  notice.value = '';
});

function requestClose() { emit('close'); }
function changeMode(mode: 'center' | 'side') { if (mode !== props.mode) emit('mode-change', mode); }
function cancel(event: Event) { event.preventDefault(); requestClose(); }
function closed() { if (props.open) requestClose(); }

async function send(
  messageOverride?: string,
  agentOverride?: MedicalAgentFamilyWire,
  childOverride?: MedicalAgentReleaseWire,
) {
  const lease = leaseQuery.data.value;
  const text = (messageOverride ?? draft.value).trim();
  const agent = agentOverride ?? selectedAgent.value;
  if (!lease || busy.value || !text) return;
  busy.value = true;
  notice.value = '';
  if (agent) selectedAgentCode.value = agent.main_agent.agent_code;
    const displayName = doctorFacingAiText(childOverride?.display_name ?? agent?.main_agent.display_name);
  messages.value.push({ role: 'user', text, agentName: displayName });
  draft.value = '';
  try {
    const agentContext = agent
      ? `选定主 agent_code=${agent.main_agent.agent_code}, agent_name=${agent.main_agent.display_name}, agent_version=${agent.main_agent.release_version}`
        + `${childOverride ? `，子 agent_code=${childOverride.agent_code}, stage_code=${childOverride.stage_code}, child_action=${childOverride.current_action}` : ''}`
        + `。安全边界：${agent.main_agent.autonomy_level} 候选制，不自动写入临床事实。`
      : '未指定专用 Agent，按AI医助小南通用边界处理。';
    const contextualMessage = `当前页面 route_id=${props.routeId}${props.taskId ? `, task_id=${props.taskId}` : ''}。${agentContext} 用户任务：${text}`;
    const chunks = await streamAssistantResponse(lease, contextualMessage, props.patientId, props.encounterId);
    const reply = chunks.filter((chunk) => chunk.event === 'delta').map((chunk) => chunk.data).join('\n');
    messages.value.push({ role: 'assistant', text: reply || '（无回复）', agentName: displayName });
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
    messages.value.push({ role: 'assistant', text: `请求失败：${next.message}`, agentName: displayName });
  } finally { busy.value = false; }
}

function selectAgent(agent: MedicalAgentFamilyWire) { selectedAgentCode.value = agent.main_agent.agent_code; }

async function runChildAgent(agent: MedicalAgentFamilyWire, child: MedicalAgentReleaseWire) {
  selectedAgentCode.value = agent.main_agent.agent_code;
  if (!props.patientId || !props.encounterId) {
    await send(child.current_action, agent, child);
    return;
  }
  if (busy.value) return;
  busy.value = true;
  notice.value = '';
    messages.value.push({ role: 'user', text: child.current_action, agentName: doctorFacingAiText(child.display_name) });
  try {
    const runLease = await issueMedicalAgentRunLease(props.patientId, props.encounterId);
    const run = await createMedicalAgentRun(runLease, {
      patientId: props.patientId,
      encounterId: props.encounterId,
      mainAgentCode: agent.main_agent.agent_code,
      stageCode: child.stage_code,
      objective: child.current_action,
      targetType: 'ENCOUNTER',
      targetId: props.encounterId,
    });
    const contributors = run.child_runs.map((item) => doctorFacingAiText(item.display_name)).join('、');
    const summary = typeof run.output.summary === 'string'
      ? run.output.summary : '主 Agent 已汇总子 Agent 贡献，等待人工审阅。';
    messages.value.push({
      role: 'assistant',
      text: `${doctorFacingAiText(summary)}\n参与医助：${contributors || doctorFacingAiText(child.display_name)}。\n进度：${run.state === 'WAITING_FOR_REVIEW' ? '结果待医生查看' : '处理中'}；共 ${run.events.length} 条处理记录。`,
      agentName: clinicianAgentName(agent.main_agent.display_name),
    });
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
    messages.value.push({ role: 'assistant', text: `医助协同失败：${next.message}`, agentName: doctorFacingAiText(child.display_name) });
  } finally { busy.value = false; }
}
</script>

<template>
  <Teleport to="body">
    <dialog v-if="mode === 'center'" ref="dialog" class="global-ai-dialog" aria-labelledby="global-ai-dialog-title" aria-describedby="global-ai-dialog-context" @cancel="cancel" @close="closed">
      <div class="global-ai-dialog-shell">
        <header>
          <img class="global-ai-mascot" src="/brand/ai-medical-assistant-xiaonan.png" alt="" width="52" height="52" />
          <div class="global-ai-heading"><span>随诊协助 · 当前页面已连接</span><h2 id="global-ai-dialog-title">AI医助小南</h2><p id="global-ai-dialog-context">{{ contextLabel }}<template v-if="taskId"> · 当前任务已连接</template></p></div>
          <b class="global-ai-agent-count" :aria-label="`${agents.length} 个医助团队，${childAgentCount} 位医助`">{{ agents.length }} 组 · {{ childAgentCount }} 位医助</b>
          <div class="global-ai-mode-switch" role="group" aria-label="AI医助小南窗口模式"><button type="button" class="active" aria-pressed="true" @click="changeMode('center')">中窗</button><button type="button" aria-pressed="false" @click="changeMode('side')">右侧窗</button></div>
          <button class="global-ai-close" type="button" aria-label="关闭AI医助小南" @click="requestClose">×</button>
        </header>

        <section class="global-ai-agents" aria-labelledby="global-ai-agent-title">
          <div class="global-ai-section-heading"><div><strong id="global-ai-agent-title">选择医助团队</strong><span>选择诊疗任务，小南会展示每位医助的进度</span></div></div>
          <div v-if="agentQuery.isPending.value" class="global-ai-agent-state">正在读取协作团队…</div>
          <div v-else-if="agentIssue" class="global-ai-agent-state error">协作团队暂时不可用：{{ agentIssue.code }}</div>
          <div v-else-if="agents.length === 0" class="global-ai-agent-state">当前没有可用的协作团队。</div>
          <div v-else class="global-ai-agent-grid">
            <article v-for="agent in agents" :key="agent.main_agent.agent_code" :class="{ selected: selectedAgentCode === agent.main_agent.agent_code }">
              <button class="global-ai-agent-main" type="button" :aria-pressed="selectedAgentCode === agent.main_agent.agent_code" @click="selectAgent(agent)"><span><b>{{ clinicianAgentName(agent.main_agent.display_name) }}</b><small>{{ clinicianAgentDescription(agent.main_agent.description) }}</small></span><em>{{ agent.child_agents.length }} 位</em></button>
              <dl><div><dt>当前进度</dt><dd>{{ doctorFacingAiText(agent.main_agent.current_action) }}</dd></div></dl>
            </article>
          </div>
          <div v-if="selectedAgent" class="global-ai-child-strip" aria-label="专科医助任务">
            <div><b>{{ clinicianAgentName(selectedAgent.main_agent.display_name) }}医助团队 · {{ selectedAgent.child_agents.length }} 位医助</b><span>选择任务后，小南会汇总进度和结果</span></div>
            <button v-for="child in selectedAgent.child_agents" :key="child.agent_code" type="button" :disabled="busy || !leaseQuery.data.value" @click="runChildAgent(selectedAgent, child)"><span>{{ doctorFacingAiText(child.display_name) }}</span><small>{{ doctorFacingAiText(child.current_action) }}</small></button>
          </div>
        </section>

        <section class="global-ai-thread" aria-live="polite">
          <div v-if="leaseQuery.isPending.value" class="global-ai-empty">正在连接当前页面…</div>
          <div v-else-if="issue" class="global-ai-empty error">当前页面暂时无法连接：{{ issue.message }}</div>
          <div v-else-if="messages.length === 0" class="global-ai-empty compact"><strong>小南已准备好</strong><p>请选择上方协作任务，或直接输入希望小南协助的内容。</p></div>
          <article v-for="(message, index) in messages" :key="index" class="global-ai-message" :class="message.role"><b>{{ message.role === 'user' ? '你' : (message.agentName || 'AI医助小南') }}</b><p>{{ message.text }}</p></article>
        </section>

        <form class="global-ai-composer" @submit.prevent="send()">
          <p v-if="notice" role="status" class="inline-notice error">{{ notice }}</p>
          <div class="global-ai-composer-context"><label for="global-ai-agent-select">医助团队</label><select id="global-ai-agent-select" v-model="selectedAgentCode"><option value="">小南综合协助</option><option v-for="agent in agents" :key="agent.main_agent.agent_code" :value="agent.main_agent.agent_code">{{ clinicianAgentName(agent.main_agent.display_name) }}</option></select></div>
          <label for="global-ai-draft">告诉小南需要协助什么</label>
          <textarea id="global-ai-draft" v-model="draft" :disabled="busy || !leaseQuery.data.value" rows="3" placeholder="例如：整理当前患者的会诊要点…" @keydown.enter.exact.prevent="send()" />
          <div class="global-ai-composer-actions"><RouterLink class="btn" to="/ai-assistant" @click="requestClose">打开小南工作台</RouterLink><button class="btn primary" type="submit" :disabled="busy || !draft.trim() || !leaseQuery.data.value">{{ busy ? '小南正在处理…' : '开始协助' }}</button></div>
        </form>
      </div>
    </dialog>
    <aside v-else class="global-ai-side-panel" role="dialog" aria-modal="false" aria-labelledby="global-ai-side-title" aria-describedby="global-ai-side-context">
      <div class="global-ai-dialog-shell">
        <header>
          <img class="global-ai-mascot" src="/brand/ai-medical-assistant-xiaonan.png" alt="" width="52" height="52" />
          <div class="global-ai-heading"><span>随诊协助 · 原页面可继续操作</span><h2 id="global-ai-side-title">AI医助小南</h2><p id="global-ai-side-context">{{ contextLabel }}<template v-if="taskId"> · 当前任务已连接</template></p></div>
          <b class="global-ai-agent-count" :aria-label="`${agents.length} 个医助团队，${childAgentCount} 位医助`">{{ agents.length }} 组 · {{ childAgentCount }} 位医助</b>
          <div class="global-ai-mode-switch" role="group" aria-label="AI医助小南窗口模式"><button type="button" aria-pressed="false" @click="changeMode('center')">中窗</button><button type="button" class="active" aria-pressed="true" @click="changeMode('side')">右侧窗</button></div>
          <button class="global-ai-close" type="button" aria-label="关闭AI医助小南" @click="requestClose">×</button>
        </header>

        <section class="global-ai-agents" aria-labelledby="global-ai-side-agent-title">
          <div class="global-ai-section-heading"><div><strong id="global-ai-side-agent-title">选择医助团队</strong><span>选择诊疗任务，小南会展示每位医助的进度</span></div></div>
          <div v-if="agentQuery.isPending.value" class="global-ai-agent-state">正在读取协作团队…</div>
          <div v-else-if="agentIssue" class="global-ai-agent-state error">协作团队暂时不可用：{{ agentIssue.code }}</div>
          <div v-else-if="agents.length === 0" class="global-ai-agent-state">当前没有可用的协作团队。</div>
          <div v-else class="global-ai-agent-grid">
            <article v-for="agent in agents" :key="agent.main_agent.agent_code" :class="{ selected: selectedAgentCode === agent.main_agent.agent_code }">
              <button class="global-ai-agent-main" type="button" :aria-pressed="selectedAgentCode === agent.main_agent.agent_code" @click="selectAgent(agent)"><span><b>{{ clinicianAgentName(agent.main_agent.display_name) }}</b><small>{{ clinicianAgentDescription(agent.main_agent.description) }}</small></span><em>{{ agent.child_agents.length }} 位</em></button>
              <dl><div><dt>当前进度</dt><dd>{{ doctorFacingAiText(agent.main_agent.current_action) }}</dd></div></dl>
            </article>
          </div>
          <div v-if="selectedAgent" class="global-ai-child-strip" aria-label="专科医助任务">
            <div><b>{{ clinicianAgentName(selectedAgent.main_agent.display_name) }}医助团队 · {{ selectedAgent.child_agents.length }} 位医助</b><span>选择任务后，小南会汇总进度和结果</span></div>
            <button v-for="child in selectedAgent.child_agents" :key="child.agent_code" type="button" :disabled="busy || !leaseQuery.data.value" @click="runChildAgent(selectedAgent, child)"><span>{{ doctorFacingAiText(child.display_name) }}</span><small>{{ doctorFacingAiText(child.current_action) }}</small></button>
          </div>
        </section>

        <section class="global-ai-thread" aria-live="polite">
          <div v-if="leaseQuery.isPending.value" class="global-ai-empty">正在连接当前页面…</div>
          <div v-else-if="issue" class="global-ai-empty error">当前页面暂时无法连接：{{ issue.message }}</div>
          <div v-else-if="messages.length === 0" class="global-ai-empty compact"><strong>小南已准备好</strong><p>请选择上方协作任务，或直接输入希望小南协助的内容。</p></div>
          <article v-for="(message, index) in messages" :key="index" class="global-ai-message" :class="message.role"><b>{{ message.role === 'user' ? '你' : (message.agentName || 'AI医助小南') }}</b><p>{{ message.text }}</p></article>
        </section>

        <form class="global-ai-composer" @submit.prevent="send()">
          <p v-if="notice" role="status" class="inline-notice error">{{ notice }}</p>
          <div class="global-ai-composer-context"><label for="global-ai-side-agent-select">医助团队</label><select id="global-ai-side-agent-select" v-model="selectedAgentCode"><option value="">小南综合协助</option><option v-for="agent in agents" :key="agent.main_agent.agent_code" :value="agent.main_agent.agent_code">{{ clinicianAgentName(agent.main_agent.display_name) }}</option></select></div>
          <label for="global-ai-side-draft">告诉小南需要协助什么</label>
          <textarea id="global-ai-side-draft" v-model="draft" :disabled="busy || !leaseQuery.data.value" rows="3" placeholder="例如：整理当前患者的会诊要点…" @keydown.enter.exact.prevent="send()" />
          <div class="global-ai-composer-actions"><RouterLink class="btn" to="/ai-assistant" @click="requestClose">打开小南工作台</RouterLink><button class="btn primary" type="submit" :disabled="busy || !draft.trim() || !leaseQuery.data.value">{{ busy ? '小南正在处理…' : '开始协助' }}</button></div>
        </form>
      </div>
    </aside>
  </Teleport>
</template>
