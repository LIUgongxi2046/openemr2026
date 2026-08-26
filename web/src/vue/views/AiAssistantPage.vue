<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { clinicalContext } from '../../clinical-api';
import { issueAssistantFacilityLease, streamAssistantResponse } from '../../api/assistant';
import {
  createMedicalAgentRun,
  issueMedicalAgentCatalogLease,
  issueMedicalAgentRunLease,
  listMedicalAgentCatalog,
} from '../../api/medical-agents';
import type { MedicalAgentChildRunWire, MedicalAgentRunWire } from '../../generated/contracts';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import { toClinicalIssue } from '../clinical-error';
import { doctorFacingAiText, doctorFacingTeamName } from '../medical-ai-terminology';

interface ChatMessage { role: 'user' | 'assistant'; text: string; }

const leaseQuery = useQuery({
  queryKey: ['assistant', 'lease'],
  queryFn: () => issueAssistantFacilityLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const issue = computed(() => leaseQuery.error.value ? toClinicalIssue(leaseQuery.error.value) : null);

const messages = ref<ChatMessage[]>([]);
const draft = ref('');
const busy = ref(false);
const notice = ref('');
const collaborationNotice = ref('');
const collaborationBusy = ref(false);
const taskDialogOpen = ref(false);
const clearConversationOpen = ref(false);
const collaborationContext = ref<'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT'>('OUTPATIENT');
const selectedMainAgentCode = ref('');
const selectedStageCode = ref('');
const objective = ref('整理当前诊疗环节的关键事实、变化、缺口和待确认问题');
const latestRun = ref<MedicalAgentRunWire | null>(null);
const collaborationContexts = computed(() => [
  { code: 'OUTPATIENT' as const, label: '门诊接诊', patientId: clinicalContext.patientId, encounterId: clinicalContext.encounterId },
  { code: 'EMERGENCY' as const, label: '急诊抢救', patientId: clinicalContext.emergencyPatientId, encounterId: clinicalContext.emergencyEncounterId },
  { code: 'INPATIENT' as const, label: '住院日常', patientId: clinicalContext.inpatientPatientId, encounterId: clinicalContext.inpatientEncounterId },
]);
const selectedCollaborationContext = computed(() => collaborationContexts.value.find(
  (item) => item.code === collaborationContext.value,
)!);

const catalogLeaseQuery = useQuery({
  queryKey: ['medical-agent', 'catalog-lease'],
  queryFn: issueMedicalAgentCatalogLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const catalogQuery = useQuery({
  queryKey: ['medical-agent', 'catalog'],
  queryFn: () => listMedicalAgentCatalog(catalogLeaseQuery.data.value!),
  enabled: computed(() => Boolean(catalogLeaseQuery.data.value)),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const runLeaseQuery = useQuery({
  queryKey: computed(() => ['medical-agent', 'run-lease', selectedCollaborationContext.value.patientId, selectedCollaborationContext.value.encounterId]),
  queryFn: () => issueMedicalAgentRunLease(selectedCollaborationContext.value.patientId, selectedCollaborationContext.value.encounterId),
  enabled: computed(() => Boolean(selectedCollaborationContext.value.patientId && selectedCollaborationContext.value.encounterId)),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const families = computed(() => catalogQuery.data.value ?? []);
const selectedFamily = computed(() => families.value.find(
  (family) => family.main_agent.agent_code === selectedMainAgentCode.value,
));
const availableStages = computed(() => selectedFamily.value?.child_agents ?? []);
const selectedChild = computed(() => availableStages.value.find((child) => child.stage_code === selectedStageCode.value));

watch(families, (next) => {
  if (!next.length) return;
  if (!next.some((family) => family.main_agent.agent_code === selectedMainAgentCode.value)) {
    selectedMainAgentCode.value = next[0].main_agent.agent_code;
  }
}, { immediate: true });

watch(availableStages, (next) => {
  if (!next.length) return;
  if (!next.some((child) => child.stage_code === selectedStageCode.value)) {
    selectedStageCode.value = next[0].stage_code;
  }
}, { immediate: true });

async function send() {
  const lease = leaseQuery.data.value;
  const text = draft.value.trim();
  if (!lease || busy.value || !text) return;
  busy.value = true; notice.value = '';
  messages.value.push({ role: 'user', text });
  draft.value = '';
  try {
    const chunks = await streamAssistantResponse(lease, text);
    const reply = chunks
      .filter((chunk) => chunk.event === 'delta')
      .map((chunk) => chunk.data)
      .join('\n');
    messages.value.push({ role: 'assistant', text: reply || '（无回复）' });
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
    messages.value.push({ role: 'assistant', text: `请求失败：${next.message}` });
  } finally {
    busy.value = false;
  }
}

async function runCollaboration() {
  const lease = runLeaseQuery.data.value;
  if (!lease || !selectedMainAgentCode.value || !selectedStageCode.value || collaborationBusy.value) return;
  collaborationBusy.value = true;
  collaborationNotice.value = '';
  try {
    latestRun.value = await createMedicalAgentRun(lease, {
      patientId: selectedCollaborationContext.value.patientId,
      encounterId: selectedCollaborationContext.value.encounterId,
      mainAgentCode: selectedMainAgentCode.value,
      stageCode: selectedStageCode.value,
      objective: objective.value,
    });
    taskDialogOpen.value = false;
  } catch (error) {
    const next = toClinicalIssue(error);
    collaborationNotice.value = `${next.code}：${next.message}`;
  } finally {
    collaborationBusy.value = false;
  }
}

function runSummary(run: MedicalAgentRunWire): string {
  return doctorFacingAiText(typeof run.output.summary === 'string' ? run.output.summary : '小南已汇总各医助的结果，可以开始查看。');
}

function childSummary(child: MedicalAgentChildRunWire): string {
  return doctorFacingAiText(typeof child.contribution.summary === 'string' ? child.contribution.summary : '医助已提交处理结果。');
}

function clinicianAgentName(name: string) {
  return doctorFacingTeamName(name);
}

function agentNameForCode(code: string) {
  const family = families.value.find((item) => item.main_agent.agent_code === code);
  return family ? `${clinicianAgentName(family.main_agent.display_name)}医助团队` : '小南医助团队';
}

function runStateLabel(state: string) {
  return ({ WAITING_FOR_REVIEW: '协作结果已就绪', COMPLETED: '协作已完成', RUNNING: '协作处理中' } as Record<string, string>)[state] ?? '协作处理中';
}

function eventLabel(eventType: string) {
  return ({
    RunCreated: '已接收任务',
    MainAgentStarted: '小南开始协调',
    ChildAgentStarted: '医助开始处理',
    ChildContributionReady: '医助提交结果',
    ChildHandoffReceived: '小南收到协作结果',
    RunReadyForReview: '协作结果已就绪',
  } as Record<string, string>)[eventType] ?? '协作进度已更新';
}

function childFacts(child: MedicalAgentChildRunWire): string[] {
  return Array.isArray(child.contribution.facts)
    ? child.contribution.facts.filter((value): value is string => typeof value === 'string')
    : [];
}

function useChatExample(example: string) {
  draft.value = doctorFacingAiText(example);
}

function useMainAgentExample(example: string) {
  objective.value = doctorFacingAiText(example);
  taskDialogOpen.value = true;
}

function useChildAgentExample(example: string) {
  objective.value = doctorFacingAiText(example);
  taskDialogOpen.value = true;
}

function clearConversation() {
  messages.value = [];
  notice.value = '';
  clearConversationOpen.value = false;
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title xiaonan-page-title"><img src="/brand/ai-medical-assistant-xiaonan.png" alt="" width="58" height="58" /><div><h1>AI医助小南</h1><p>围绕当前诊疗场景持续协助，支持任务分工、进度汇总和结果回看</p></div></div>
      <div class="head-actions"><button class="btn" type="button" :disabled="messages.length === 0" @click="clearConversationOpen = true">清空对话</button></div>
    </div>

    <div v-if="leaseQuery.isPending.value" class="card"><div class="card-body">正在连接当前工作场景…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">当前工作场景暂时无法连接：{{ issue.message }}</div></div>

    <div v-else class="grid ai-workspace-layout">
      <aside class="card">
        <div class="card-head">当前协作范围</div>
        <div class="card-body">
          <div class="notice info"><div class="notice-title">已连接当前页面</div>小南会围绕医生正在处理的场景提供问答、整理和任务协助。</div>
          <div class="folder-row">当前场景<span>医院管理工作台</span></div>
          <div class="folder-row">可以协助<span>问答 · 整理 · 草稿</span></div>
          <div class="folder-row">协作状态<span>已就绪</span></div>
        </div>
      </aside>

      <section class="card ai-conversation">
        <div class="card-head">与AI医助小南协作 <span class="status green">当前页面已连接</span></div>
        <div class="ai-thread">
          <div v-if="messages.length === 0" class="ai-message assistant">
            <b>AI医助小南已就绪</b>
            <p>直接输入问题或任务，小南会结合当前工作场景给出清晰、可继续处理的结果。</p>
            <div class="xiaonan-starter-examples" aria-label="小南提问示例">
              <span>可以这样问</span>
              <button type="button" @click="useChatExample('请总结当前患者本次就诊的关键问题和待确认事项。')">总结本次就诊</button>
              <button type="button" @click="useChatExample('请根据当前已确认信息起草病历草稿，缺失内容单独列出。')">起草病历草稿</button>
              <button type="button" @click="useChatExample('请检查当前病历是否存在前后矛盾、关键缺项或时间顺序问题。')">检查病历缺项</button>
            </div>
          </div>
          <div v-for="(message, index) in messages" :key="index" class="ai-message" :class="message.role">
            <p>{{ message.text }}</p>
          </div>
        </div>
        <div class="ai-prompt-box">
          <div v-if="notice" class="inline-notice error" role="status">{{ notice }}</div>
          <textarea v-model="draft" :disabled="busy" placeholder="询问当前患者，或要求生成可核验的草稿……" @keydown.enter.exact.prevent="send" />
          <div>
            <button class="btn" type="button" :disabled="busy" @click="draft = ''">清空</button>
            <button class="btn primary" type="button" :disabled="busy || !draft.trim()" @click="send">{{ busy ? '正在生成…' : '发送' }}</button>
          </div>
        </div>
      </section>
    </div>

    <section class="card medical-agent-collaboration">
      <div class="card-head"><div>小南医助团队 <span class="status blue">医助进度实时可见</span></div><button class="btn primary" type="button" :disabled="catalogQuery.isPending.value || runLeaseQuery.isPending.value" @click="taskDialogOpen = true">新建医助任务</button></div>
      <div class="card-body">
        <div v-if="catalogQuery.isPending.value || runLeaseQuery.isPending.value" class="notice info">正在连接协作团队和当前就诊…</div>
        <div v-else-if="catalogQuery.error.value || runLeaseQuery.error.value" class="notice error">当前协作信息暂时不可用，请确认已选择患者和就诊。</div>
        <template v-else>
          <p v-if="selectedFamily" class="medical-agent-boundary"><b>{{ clinicianAgentName(selectedFamily.main_agent.display_name) }}医助团队</b>包含 {{ selectedFamily.child_agents.length }} 位医助，小南将持续汇总进度和结果。</p>
          <section v-if="selectedFamily" class="medical-agent-question-examples" aria-labelledby="medical-agent-example-title">
            <div><b id="medical-agent-example-title">医生提问示例</b><span>点击示例即可填入“希望完成什么”，仍可继续修改。</span></div>
            <article>
              <strong>{{ clinicianAgentName(selectedFamily.main_agent.display_name) }}医助团队</strong>
              <button v-for="example in selectedFamily.main_agent.question_examples" :key="example" type="button" @click="useMainAgentExample(example)">{{ doctorFacingAiText(example) }}</button>
            </article>
            <article v-if="selectedChild">
              <strong>{{ doctorFacingAiText(selectedChild.display_name) }}</strong>
              <button v-for="example in selectedChild.question_examples" :key="example" type="button" @click="useChildAgentExample(example)">{{ doctorFacingAiText(example) }}</button>
            </article>
          </section>
          <p v-if="collaborationNotice" class="inline-notice error" role="status">{{ collaborationNotice }}</p>
        </template>

        <div v-if="latestRun" class="medical-agent-run-result" aria-live="polite">
          <header>
            <div><span class="status green">{{ runStateLabel(latestRun.state) }}</span><b>{{ agentNameForCode(latestRun.root_agent_code) }}</b></div>
            <p>{{ runSummary(latestRun) }}</p>
          </header>
          <div class="medical-agent-child-grid">
            <article v-for="child in latestRun.child_runs" :key="child.child_run_id" class="medical-agent-child-card">
              <div><span class="status" :class="child.state === 'COMPLETED' ? 'green' : 'yellow'">{{ child.state === 'COMPLETED' ? '已完成' : '处理中' }}</span><b>{{ doctorFacingAiText(child.display_name) }}</b></div>
              <p class="medical-agent-role">{{ doctorFacingAiText(child.display_role) }}</p>
              <p>{{ doctorFacingAiText(child.current_action) }}</p>
              <strong>{{ doctorFacingAiText(child.contribution_label) }}</strong>
              <p>{{ childSummary(child) }}</p>
              <ul><li v-for="fact in childFacts(child)" :key="fact">{{ fact }}</li></ul>
              <footer>{{ child.source_references.length }} 个参考来源 · 已交由小南汇总</footer>
            </article>
          </div>
          <details>
            <summary>查看协作过程（{{ latestRun.events.length }}）</summary>
            <ol class="medical-agent-events"><li v-for="event in latestRun.events" :key="event.sequence"><b>{{ eventLabel(event.event_type) }}</b></li></ol>
          </details>
        </div>
      </div>
    </section>

    <AdminActionDialog v-model:open="taskDialogOpen" title="新建医助任务" description="选择当前诊疗场景和专业医助，小南会协调子医助并实时汇总进度。" size="large" :busy="collaborationBusy">
      <form class="admin-form ai-center-dialog-form" @submit.prevent="runCollaboration">
        <label><span>诊疗场景</span><select v-model="collaborationContext"><option v-for="item in collaborationContexts" :key="item.code" :value="item.code">{{ item.label }}</option></select></label>
        <label><span>医助团队</span><select v-model="selectedMainAgentCode"><option v-for="family in families" :key="family.main_agent.agent_code" :value="family.main_agent.agent_code">{{ clinicianAgentName(family.main_agent.display_name) }}</option></select></label>
        <label><span>诊疗环节医助</span><select v-model="selectedStageCode"><option v-for="child in availableStages" :key="child.agent_code" :value="child.stage_code">{{ doctorFacingAiText(child.display_name) }}</option></select></label>
        <label class="medical-agent-objective"><span>希望完成什么</span><textarea v-model="objective" maxlength="1024" rows="4" required /></label>
        <p v-if="collaborationNotice" class="inline-notice error" role="status">{{ collaborationNotice }}</p>
        <div class="admin-form-actions"><button class="button secondary" type="button" :disabled="collaborationBusy" @click="taskDialogOpen = false">取消</button><button class="button primary" :disabled="collaborationBusy || objective.trim().length < 2">{{ collaborationBusy ? '医助正在处理…' : '开始协作' }}</button></div>
      </form>
    </AdminActionDialog>
    <AdminConfirmDialog :open="clearConversationOpen" title="清空当前对话" description="清空后，本页当前展示的对话将被移除；已经发起的医助任务和运行记录不受影响。" confirm-label="确认清空" @update:open="clearConversationOpen = $event" @confirm="clearConversation"><div class="admin-impact-grid"><div><span>对话消息</span><b>{{ messages.length }} 条</b></div><div><span>医助任务</span><b>继续保留</b></div></div></AdminConfirmDialog>
  </section>
</template>

<style scoped>
.medical-agent-collaboration { margin-top: 18px; }
.medical-agent-command-grid { display: grid; grid-template-columns: minmax(150px, .8fr) minmax(210px, 1fr) minmax(240px, 1.2fr) 2fr auto; gap: 12px; align-items: end; }
.medical-agent-command-grid label { display: grid; gap: 6px; color: var(--muted, #526579); font-size: 13px; }
.medical-agent-command-grid select, .medical-agent-command-grid input { min-height: 40px; border: 1px solid var(--line, #d8e0e8); border-radius: 8px; padding: 0 10px; background: #fff; }
.medical-agent-boundary { margin: 14px 0 0; padding: 10px 12px; border-radius: 8px; background: #f4f8fb; }
.xiaonan-starter-examples { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 12px; }
.xiaonan-starter-examples span { flex-basis: 100%; color: #087c75; font-size: 12px; font-weight: 700; }
.xiaonan-starter-examples button, .medical-agent-question-examples button { padding: 7px 10px; text-align: left; color: #175f72; border: 1px solid #bcded9; border-radius: 999px; background: #f3fbfa; cursor: pointer; }
.xiaonan-starter-examples button:hover, .medical-agent-question-examples button:hover { border-color: #15988d; background: #e8f7f4; }
.medical-agent-question-examples { display: grid; gap: 10px; margin-top: 12px; padding: 14px; border: 1px solid #d8e7e4; border-radius: 10px; background: #fbfefd; }
.medical-agent-question-examples > div { display: flex; justify-content: space-between; gap: 12px; }
.medical-agent-question-examples > div span { color: #66798b; font-size: 12px; }
.medical-agent-question-examples article { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.medical-agent-question-examples article strong { min-width: 170px; color: #31465a; font-size: 13px; }
.medical-agent-run-result { margin-top: 18px; border-top: 1px solid var(--line, #d8e0e8); padding-top: 16px; }
.medical-agent-run-result > header div { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.medical-agent-run-result > header small { color: var(--muted, #526579); }
.medical-agent-child-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px; margin: 14px 0; }
.medical-agent-child-card { border: 1px solid #d8e4ec; border-radius: 12px; padding: 14px; background: #fff; box-shadow: 0 4px 14px rgb(15 55 78 / 6%); }
.medical-agent-child-card > div { display: flex; gap: 8px; align-items: center; }
.medical-agent-child-card p { margin: 7px 0; }
.medical-agent-child-card .medical-agent-role { color: #087c75; font-weight: 700; }
.medical-agent-child-card ul { margin: 8px 0; padding-left: 20px; }
.medical-agent-child-card footer { margin-top: 10px; color: var(--muted, #526579); font-size: 12px; }
.medical-agent-events { display: grid; gap: 6px; padding-left: 24px; }
@media (max-width: 900px) { .medical-agent-command-grid { grid-template-columns: 1fr; } }
</style>
