<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, nextTick, ref, watch } from 'vue';

import { issueAiLease, listModelDeployments } from '../../api/ai-platform';
import { createMedicalAgentRun, issueMedicalAgentCatalogLease, issueMedicalAgentRunLease, listMedicalAgentCatalog } from '../../api/medical-agents';
import type { MedicalAgentFamilyWire, MedicalAgentReleaseWire, MedicalAgentRunWire } from '../../generated/contracts';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import EvaComposerControls from '../components/EvaComposerControls.vue';
import EvaPatientPicker from '../components/EvaPatientPicker.vue';
import XiaonanAgentTeamRail from '../components/XiaonanAgentTeamRail.vue';
import { toClinicalIssue } from '../clinical-error';
import { doctorFacingAiText, doctorFacingTeamName } from '../medical-ai-terminology';
import { evaDefaultPatientContexts, useEvaClinicalContext } from '../use-eva-clinical-context';

type AuthorizationLevel = 'READ_ONLY' | 'STANDARD' | 'EXTENDED';
type ContextScope = 'RECORDS' | 'ORDERS' | 'RESULTS' | 'TASKS' | 'ATTACHMENTS';
interface TaskEvent { id: string; label: string; detail: string; status: 'running' | 'done' | 'waiting' | 'failed' }
interface ChatMessage { id: string; role: 'user' | 'assistant'; text: string; agentName?: string; events?: TaskEvent[]; runId?: string; modelName?: string }

const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const notice = ref('');
const clearConversationOpen = ref(false);
const teamCollapsed = ref(false);
const selectedMainAgentCode = ref('');
const selectedStageCode = ref('');
const selectedModelId = ref('');
const authorizationLevel = ref<AuthorizationLevel>('STANDARD');
const contextScopes = ref<ContextScope[]>(['RECORDS', 'ORDERS', 'RESULTS', 'TASKS']);
const composer = ref<HTMLTextAreaElement | null>(null);
const patient = useEvaClinicalContext();

const catalogLeaseQuery = useQuery({ queryKey: ['eva', 'catalog-lease'], queryFn: issueMedicalAgentCatalogLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const catalogQuery = useQuery({ queryKey: ['eva', 'catalog'], queryFn: () => listMedicalAgentCatalog(catalogLeaseQuery.data.value!), enabled: computed(() => Boolean(catalogLeaseQuery.data.value)), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const modelLeaseQuery = useQuery({ queryKey: ['eva', 'model-lease'], queryFn: () => issueAiLease('AI_ASSISTANT_MODEL_SELECTION'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const modelsQuery = useQuery({ queryKey: ['eva', 'models'], queryFn: () => listModelDeployments(modelLeaseQuery.data.value!), enabled: computed(() => Boolean(modelLeaseQuery.data.value)), retry: false, staleTime: 60_000 });
const runLeaseQuery = useQuery({ queryKey: computed(() => ['eva', 'run-lease', patient.current.value.patientId, patient.current.value.encounterId]), queryFn: () => issueMedicalAgentRunLease(patient.current.value.patientId, patient.current.value.encounterId), retry: false, staleTime: 5 * 60_000, gcTime: 0 });

const families = computed(() => catalogQuery.data.value ?? []);
const availableModels = computed(() => (modelsQuery.data.value ?? []).filter((model) => model.status === 'ACTIVE' && model.evaluation_status === 'APPROVED' && model.connection_status === 'READY'));
const selectedFamily = computed(() => families.value.find((family) => family.main_agent.agent_code === selectedMainAgentCode.value));
const availableStages = computed(() => selectedFamily.value?.child_agents ?? []);
const selectedChild = computed(() => availableStages.value.find((child) => child.stage_code === selectedStageCode.value));
const selectedModel = computed(() => availableModels.value.find((model) => model.model_deployment_id === selectedModelId.value));
const loading = computed(() => catalogQuery.isPending.value || runLeaseQuery.isPending.value || modelsQuery.isPending.value);
const issue = computed(() => {
  const error = catalogLeaseQuery.error.value ?? catalogQuery.error.value ?? modelLeaseQuery.error.value ?? modelsQuery.error.value ?? runLeaseQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

watch(families, (next) => { if (next.length && !next.some((family) => family.main_agent.agent_code === selectedMainAgentCode.value)) selectedMainAgentCode.value = next[0].main_agent.agent_code; }, { immediate: true });
watch(availableStages, (next) => { if (next.length && !next.some((child) => child.stage_code === selectedStageCode.value)) selectedStageCode.value = next[0].stage_code; }, { immediate: true });
watch(availableModels, (next) => { if (next.length && !next.some((model) => model.model_deployment_id === selectedModelId.value)) selectedModelId.value = next[0].model_deployment_id; }, { immediate: true });

function clinicianAgentName(name: string) { return doctorFacingTeamName(name); }
function scopeLabel(scope: ContextScope) { return ({ RECORDS: '病历文书', ORDERS: '医嘱执行', RESULTS: '检查检验', TASKS: '任务随访', ATTACHMENTS: '病历附件' } as Record<ContextScope, string>)[scope]; }
function authorizationLabel(level: AuthorizationLevel) { return ({ READ_ONLY: '只读', STANDARD: '标准', EXTENDED: '扩展' } as Record<AuthorizationLevel, string>)[level]; }

function initialEvents(agent: MedicalAgentFamilyWire, child: MedicalAgentReleaseWire): TaskEvent[] {
  return [
    { id: crypto.randomUUID(), label: 'Eva 正在规划任务', detail: `${clinicianAgentName(agent.main_agent.display_name)} · ${doctorFacingAiText(child.display_name)}`, status: 'done' },
    { id: crypto.randomUUID(), label: '读取已授权诊疗信息', detail: contextScopes.value.map(scopeLabel).join('、'), status: 'running' },
    { id: crypto.randomUUID(), label: `安排${doctorFacingAiText(child.display_name)}`, detail: doctorFacingAiText(child.current_action), status: 'waiting' },
    { id: crypto.randomUUID(), label: '调用模型与院内工具', detail: `${selectedModel.value?.display_name ?? '机构默认模型'} · ${authorizationLabel(authorizationLevel.value)}授权`, status: 'waiting' },
    { id: crypto.randomUUID(), label: '汇总并核对结果', detail: '完成后直接呈现在本次对话中', status: 'waiting' },
  ];
}

function mapRunEvents(run: MedicalAgentRunWire): TaskEvent[] {
  const labels: Record<string, string> = { RunCreated: '任务与授权范围已记录', MainAgentStarted: '主医助开始规划', ChildAgentStarted: '诊疗环节医助开始处理', ChildContributionReady: '诊疗环节结果已生成', ChildHandoffReceived: 'Eva 已接收医助结果', RunReadyForReview: '结果已完成核对', BudgetConsumptionRecorded: '本次模型用量已记录' };
  return run.events.map((event) => ({
    id: `${run.run_id}-${event.sequence}`,
    label: labels[event.event_type] ?? '任务状态已更新',
    detail: event.event_type === 'RunCreated' ? `${selectedModel.value?.display_name ?? '机构默认模型'} · ${contextScopes.value.map(scopeLabel).join('、')}` : event.event_type === 'ChildAgentStarted' ? String(event.payload.current_action ?? `运行记录 #${event.sequence}`) : `运行记录 #${event.sequence}`,
    status: 'done',
  }));
}

function runSummary(run: MedicalAgentRunWire) { return doctorFacingAiText(typeof run.output.summary === 'string' ? run.output.summary : 'Eva 已汇总医助结果，可以开始审阅。'); }

async function send() {
  const text = draft.value.trim();
  const lease = runLeaseQuery.data.value;
  const agent = selectedFamily.value;
  const child = selectedChild.value ?? availableStages.value[0];
  if (!text || !lease || !agent || !child || !selectedModelId.value || busy.value) return;
  busy.value = true; notice.value = '';
  const responseId = crypto.randomUUID();
  messages.value.push({ id: crypto.randomUUID(), role: 'user', text });
  messages.value.push({ id: responseId, role: 'assistant', text: '', agentName: 'Eva', events: initialEvents(agent, child), modelName: selectedModel.value?.display_name });
  draft.value = '';
  await nextTick();
  try {
    const run = await createMedicalAgentRun(lease, { patientId: patient.current.value.patientId, encounterId: patient.current.value.encounterId, mainAgentCode: agent.main_agent.agent_code, stageCode: child.stage_code, objective: text, modelDeploymentId: selectedModelId.value, authorizationLevel: authorizationLevel.value, contextScopes: contextScopes.value });
    const message = messages.value.find((item) => item.id === responseId)!;
    message.events = mapRunEvents(run); message.runId = run.run_id;
    message.text = `${runSummary(run)}\n\n参与医助：${run.child_runs.map((item) => doctorFacingAiText(item.display_name)).join('、') || doctorFacingAiText(child.display_name)}。本次读取 ${contextScopes.value.map(scopeLabel).join('、')}，使用${authorizationLabel(authorizationLevel.value)}授权。`;
  } catch (error) {
    const next = toClinicalIssue(error);
    const message = messages.value.find((item) => item.id === responseId)!;
    message.text = `任务未完成：${next.message}`;
    message.events = (message.events ?? []).map((event) => event.status === 'done' ? event : { ...event, status: event.status === 'running' ? 'failed' : 'waiting' });
    notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}

function selectAgent(agent: MedicalAgentFamilyWire) { selectedMainAgentCode.value = agent.main_agent.agent_code; }
function useAgentExample(example: string, agent: MedicalAgentFamilyWire, child?: MedicalAgentReleaseWire) { selectedMainAgentCode.value = agent.main_agent.agent_code; if (child) selectedStageCode.value = child.stage_code; draft.value = doctorFacingAiText(example); nextTick(() => composer.value?.focus()); }
function runChildAgent(agent: MedicalAgentFamilyWire, child: MedicalAgentReleaseWire) { useAgentExample(child.question_examples[0] ?? child.current_action, agent, child); }
function newTask() { messages.value = []; draft.value = ''; notice.value = '已创建空白医助任务。'; nextTick(() => composer.value?.focus()); }
function clearConversation() { messages.value = []; notice.value = ''; clearConversationOpen.value = false; }
function resetForPatient() { messages.value = []; draft.value = ''; notice.value = '已切换患者并创建空白任务。'; }
async function selectSearchPatient(value: Parameters<typeof patient.selectPatient>[0]) { await patient.selectPatient(value); resetForPatient(); }
function selectEncounter(value: Parameters<typeof patient.selectEncounter>[0]) { patient.selectEncounter(value); resetForPatient(); }
function selectDefault(value: Parameters<typeof patient.selectDefault>[0]) { patient.selectDefault(value); resetForPatient(); }
</script>

<template>
  <section data-page-root class="content vue-native-page xiaonan-harness-page">
    <div class="eva-workbench-titlebar">
      <div class="eva-workbench-brand"><img src="/brand/ai-medical-assistant-eva.png" alt="Eva 女性医疗智能助理" width="48" height="48" /><div><span>临床任务工作台</span><h1>AI医助 Eva</h1><p>把诊疗任务交给医助团队，执行步骤、数据范围与结果都在对话中呈现</p></div></div>
      <div class="head-actions"><button class="btn" type="button" :disabled="messages.length === 0" @click="clearConversationOpen = true">清空任务</button><button class="btn primary" type="button" :disabled="loading" @click="newTask">新建医助任务</button></div>
    </div>
    <div v-if="loading" class="card"><div class="card-body">正在连接 Eva 工作区…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">Eva 工作区暂时无法连接：{{ issue.message }}</div></div>

    <section v-else class="xiaonan-harness-shell eva-harness-shell">
      <XiaonanAgentTeamRail :agents="families" :selected-agent-code="selectedMainAgentCode" :collapsed="teamCollapsed" :busy="busy" @toggle="teamCollapsed = !teamCollapsed" @select="selectAgent" @example="useAgentExample" @run-child="runChildAgent" />
      <main class="eva-harness-main">
        <header class="eva-session-head"><div><span class="eva-live-dot" aria-hidden="true"></span><div><strong>{{ selectedFamily ? clinicianAgentName(selectedFamily.main_agent.display_name) : 'Eva 综合医助' }}</strong><small>{{ selectedChild ? doctorFacingAiText(selectedChild.display_name) : '根据任务自动选择诊疗环节医助' }}</small></div></div><span>{{ messages.length ? `${Math.ceil(messages.length / 2)} 轮任务` : '空白任务' }}</span></header>
        <section class="eva-agent-thread" aria-live="polite">
          <div v-if="messages.length === 0" class="eva-agent-empty"><img src="/brand/ai-medical-assistant-eva-workbench.png" alt="Eva 调度诊疗数据、医助团队与系统工具" /><div><strong>交给 Eva 一项完整的诊疗任务</strong><p>可从左侧选择医助或示例，也可以直接描述目标。Eva 会在回复中展示规划、数据读取、工具调用、子医助协作和结果核对。</p></div></div>
          <article v-for="message in messages" :key="message.id" class="eva-agent-message" :class="message.role">
            <header><b>{{ message.role === 'user' ? '医生' : (message.agentName || 'Eva') }}</b><span>{{ message.role === 'user' ? '任务' : message.runId ? `任务 …${message.runId.slice(-8)}` : busy ? '正在执行' : '执行结果' }}</span></header>
            <ol v-if="message.events?.length" class="eva-inline-events"><li v-for="event in message.events" :key="event.id" :class="event.status"><i>{{ event.status === 'done' ? '✓' : event.status === 'failed' ? '!' : event.status === 'running' ? '•' : '·' }}</i><span><b>{{ event.label }}</b><small>{{ event.detail }}</small></span><em>{{ event.status === 'done' ? '完成' : event.status === 'failed' ? '失败' : event.status === 'running' ? '进行中' : '等待' }}</em></li></ol>
            <p v-if="message.text">{{ message.text }}</p><p v-else-if="message.role === 'assistant'" class="eva-running-copy">Eva 正在继续处理，请稍候…</p>
          </article>
        </section>
        <form class="eva-agent-composer" @submit.prevent="send">
          <p v-if="notice" class="inline-notice" :class="notice.includes('失败') || notice.includes('HTTP') ? 'error' : 'info'" role="status">{{ notice }}</p>
          <textarea ref="composer" v-model="draft" :disabled="busy" rows="4" placeholder="描述需要完成的诊疗任务，Enter 发送，Shift+Enter 换行……" @keydown.enter.exact.prevent="send" />
          <footer><EvaComposerControls v-model:model-id="selectedModelId" v-model:authorization-level="authorizationLevel" v-model:context-scopes="contextScopes" :models="availableModels" :disabled="busy" /><button class="btn primary" type="submit" :disabled="busy || !draft.trim() || !selectedModelId">{{ busy ? 'Eva 正在执行…' : '发送任务' }}</button></footer>
        </form>
      </main>
      <EvaPatientPicker :current="patient.current.value" :defaults="evaDefaultPatientContexts" :results="patient.results.value" :encounters="patient.encounters.value" :selected-patient-id="patient.selectedPatient.value?.patient_id ?? ''" :searching="patient.searching.value" :loading-encounters="patient.loadingEncounters.value" :notice="patient.notice.value" @search="patient.search" @select-default="selectDefault" @select-patient="selectSearchPatient" @select-encounter="selectEncounter" />
    </section>
    <AdminConfirmDialog :open="clearConversationOpen" title="清空当前任务" description="将清空当前页面中的对话与处理步骤，不影响已经写入数据库的医助运行记录。" confirm-label="确认清空" @update:open="clearConversationOpen = $event" @confirm="clearConversation" />
  </section>
</template>

<style scoped>
.xiaonan-harness-page { padding-top: 0; }
.eva-workbench-titlebar { display: flex; align-items: center; gap: 14px; min-height: 74px; padding: 10px 4px 12px; }
.eva-workbench-brand { display: flex; align-items: center; gap: 11px; min-width: 0; }.eva-workbench-brand img { flex: 0 0 48px; width: 48px; height: 48px; object-fit: cover; border: 1px solid #d6e2ee; border-radius: 50%; background: #fff; }.eva-workbench-brand > div { min-width: 0; }.eva-workbench-brand span { color: #66809a; font-size: 9px; font-weight: 800; letter-spacing: .5px; }.eva-workbench-brand h1 { margin: 2px 0; color: #203b55; font-size: 20px; }.eva-workbench-brand p { margin: 0; overflow: hidden; color: #6f8295; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }.eva-workbench-titlebar .head-actions { display: flex; gap: 8px; margin-left: auto; }
.eva-harness-shell { display: grid; grid-template-columns: auto minmax(0,1fr) 248px; height: calc(100dvh - 226px); min-height: 620px; max-height: 840px; overflow: hidden; border: 1px solid #cad8e6; border-radius: 14px; background: #fff; box-shadow: 0 10px 32px rgb(23 52 80 / 9%); }
.eva-harness-main { display: grid; grid-template-rows: auto minmax(260px,1fr) auto; min-width: 0; min-height: 0; background: #fff; }
.eva-session-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; min-height: 56px; padding: 9px 14px; border-bottom: 1px solid #d8e3ef; }.eva-session-head > div { display: flex; align-items: center; gap: 8px; min-width: 0; }.eva-session-head > div > div { display: grid; gap: 2px; min-width: 0; }.eva-session-head strong { color: #2d455d; font-size: 12px; }.eva-session-head small, .eva-session-head > span { color: #758699; font-size: 8px; }.eva-live-dot { width: 9px; height: 9px; flex: 0 0 9px; border-radius: 50%; background: #14a487; box-shadow: 0 0 0 4px #dff6f1; }
.eva-agent-thread { display: grid; align-content: start; gap: 12px; min-height: 0; padding: 16px; overflow-y: auto; background: #fbfcfe; }.eva-agent-empty { display: grid; align-self: center; justify-items: center; gap: 8px; max-width: 680px; margin: auto; text-align: center; }.eva-agent-empty img { width: min(100%,520px); max-height: 230px; object-fit: contain; border-radius: 12px; mix-blend-mode: multiply; }.eva-agent-empty strong { color: #29435d; font-size: 15px; }.eva-agent-empty p { max-width: 560px; margin: 0; color: #708195; font-size: 10px; line-height: 1.65; }
.eva-agent-message { display: grid; gap: 9px; width: min(88%,720px); padding: 11px 13px; border: 1px solid #d6e1eb; border-radius: 12px; background: #fff; }.eva-agent-message.user { justify-self: end; width: min(76%,620px); border-color: #a9cbea; background: #edf6ff; }.eva-agent-message header { display: flex; justify-content: space-between; gap: 8px; }.eva-agent-message header b { color: #185b83; font-size: 10px; }.eva-agent-message header span { color: #8694a2; font-size: 8px; }.eva-agent-message > p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; color: #3c5268; font-size: 10px; line-height: 1.65; }.eva-running-copy { color: #72869a !important; }
.eva-inline-events { display: grid; gap: 1px; padding: 1px; margin: 0; overflow: hidden; border: 1px solid #dbe4ec; border-radius: 9px; background: #e7edf3; list-style: none; }.eva-inline-events li { display: grid; grid-template-columns: 22px minmax(0,1fr) auto; align-items: center; gap: 7px; padding: 8px 9px; background: #fff; }.eva-inline-events i { display: grid; place-items: center; width: 20px; height: 20px; color: #fff; border-radius: 50%; background: #8497aa; font-size: 8px; font-style: normal; }.eva-inline-events li.done i { background: #159783; }.eva-inline-events li.running i { background: #1769e0; }.eva-inline-events li.failed i { background: #c43d45; }.eva-inline-events li > span { display: grid; gap: 2px; min-width: 0; }.eva-inline-events b { overflow: hidden; color: #344d65; font-size: 9px; text-overflow: ellipsis; white-space: nowrap; }.eva-inline-events small { overflow: hidden; color: #7b8b9a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }.eva-inline-events em { color: #748596; font-size: 7px; font-style: normal; }
.eva-agent-composer { display: grid; gap: 8px; padding: 12px 14px max(12px,env(safe-area-inset-bottom)); border-top: 1px solid #d8e3ef; background: #fff; }.eva-agent-composer textarea { width: 100%; min-height: 86px; max-height: 190px; padding: 11px 12px; resize: vertical; border: 1px solid #bfcfdd; border-radius: 11px; outline: none; font: inherit; font-size: 11px; line-height: 1.55; }.eva-agent-composer textarea:focus { border-color: #4f91d5; box-shadow: 0 0 0 3px rgb(23 105 224 / 10%); }.eva-agent-composer footer { display: flex; align-items: center; gap: 10px; }.eva-agent-composer footer > :first-child { flex: 1 1 auto; min-width: 0; }.eva-agent-composer footer > button { flex: 0 0 auto; min-width: 92px; }
@media (max-width: 1100px) { .eva-harness-shell { grid-template-columns: auto minmax(0,1fr); height: auto; max-height: none; } :deep(.eva-patient-picker) { grid-column: 1 / -1; } }
@media (max-width: 720px) { .eva-workbench-titlebar { align-items: flex-start; flex-wrap: wrap; } .eva-workbench-titlebar .head-actions { width: 100%; margin-left: 0; } .eva-harness-shell { grid-template-columns: minmax(0,1fr); min-height: 0; } .eva-agent-message, .eva-agent-message.user { width: 100%; } .eva-agent-composer footer { align-items: stretch; flex-direction: column; } }
</style>
