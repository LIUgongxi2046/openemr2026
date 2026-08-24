<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { ClinicalTaskWire } from '../../generated/contracts';
import { clinicalContext, collaborateClinicalTask, commandClinicalTask, issueClinicalTaskLease, listClinicalTasks } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const mode = ref<'outpatient' | 'inpatient'>('outpatient'); const busy = ref<string | null>(null); const notice = ref('');
const risk = ref<'ALL' | ClinicalTaskWire['risk_level']>('ALL'); const search = ref('');
const collaborationTaskId = ref<string | null>(null); const collaborationReason = ref('临床班次与时限要求');
const tasksQuery = useQuery({ queryKey: ['clinical', 'tasks', mode], queryFn: async () => { const lease = await issueClinicalTaskLease(mode.value); return { lease, tasks: await listClinicalTasks(lease, mode.value) }; }, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => tasksQuery.error.value ? toClinicalIssue(tasksQuery.error.value) : null);
const tasks = computed(() => tasksQuery.data.value?.tasks ?? []);
const filtered = computed(() => tasks.value.filter((task) => { const needle = search.value.trim().toLowerCase(); return (risk.value === 'ALL' || task.risk_level === risk.value) && (!needle || `${task.title} ${task.task_type} ${task.source_type}`.toLowerCase().includes(needle)); }));
const open = computed(() => tasks.value.filter((task) => !['COMPLETED', 'WITHDRAWN', 'EXPIRED'].includes(task.state)));
const critical = computed(() => open.value.filter((task) => task.risk_level === 'CRITICAL'));
const overdue = computed(() => open.value.filter((task) => task.due_at && new Date(task.due_at).getTime() < Date.now()));
async function run(key: string, action: () => Promise<void>, success: string) { if (busy.value || !tasksQuery.data.value) return; busy.value = key; notice.value = ''; try { await action(); await tasksQuery.refetch(); notice.value = success; } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = null; } }
function command(task: ClinicalTaskWire, action: 'views' | 'claims') { const data = tasksQuery.data.value; if (!data) return; void run(`${action}:${task.task_id}`, async () => { await commandClinicalTask(data.lease, mode.value, task, action); }, action === 'views' ? '任务已标记查看，但来源业务仍未完成' : '任务已接手；完成状态仍由来源业务事实确认'); }
function collaborate(task: ClinicalTaskWire, action: 'delegations' | 'transfers' | 'escalations') { const data = tasksQuery.data.value; if (!data || !clinicalContext.collaboratorUserId || collaborationReason.value.trim().length < 2) return; const messages = { delegations: '任务已限时委托，来源业务仍未完成', transfers: '任务责任已转派，原责任链已保留', escalations: '任务已显式升级，需目标人员接手且回来源闭环' }; void run(`${action}:${task.task_id}`, async () => { await collaborateClinicalTask(data.lease, mode.value, task, action, clinicalContext.collaboratorUserId, collaborationReason.value.trim()); collaborationTaskId.value = null; }, messages[action]); }
function riskLabel(value: ClinicalTaskWire['risk_level']) { return value === 'CRITICAL' ? '危急' : value === 'HIGH' ? '高风险' : '常规'; }
function stateLabel(value: ClinicalTaskWire['state']) { return ({ PENDING: '待处理', ASSIGNED: '已分派', DELIVERED: '已送达', VIEWED: '已查看', CLAIMED: '已接手', IN_PROGRESS: '处理中', COMPLETED: '已完成', WITHDRAWN: '已撤回', EXPIRED: '已过期', ESCALATED: '已升级' } as Record<string, string>)[value] || value; }
function isAssignee(task: ClinicalTaskWire) { return !task.assigned_user_id || task.assigned_user_id === clinicalContext.userId; }
function canCollaborate(task: ClinicalTaskWire) { return task.claimed_by === clinicalContext.userId && ['CLAIMED', 'IN_PROGRESS'].includes(task.state); }
function isOverdue(task: ClinicalTaskWire) { return Boolean(task.due_at && new Date(task.due_at).getTime() < Date.now() && !['COMPLETED','WITHDRAWN','EXPIRED'].includes(task.state)); }
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value)); }
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>统一临床任务中心</h1><p>统一呈现风险、责任、时限与来源 · 查看通知不等于完成任务，临床终态只能由来源业务确认</p></div>
      <div class="head-actions"><div class="task-domain-switch" role="group" aria-label="工作域"><button :class="{ active: mode === 'outpatient' }" @click="mode = 'outpatient'">门诊</button><button :class="{ active: mode === 'inpatient' }" @click="mode = 'inpatient'">住院</button></div></div>
    </div>
    <div class="metric-grid" aria-label="任务指标">
      <div class="metric"><div class="name">当前未闭环</div><div class="value">{{ open.length }}</div><div class="trend">来源状态实时同步</div></div>
      <div class="metric"><div class="name">危急/高风险</div><div class="value" :class="{ 'danger-text': critical.length > 0 }">{{ critical.length }}</div><div class="trend">不可普通批量完成</div></div>
      <div class="metric"><div class="name">已逾期</div><div class="value" :class="{ 'danger-text': overdue.length > 0 }">{{ overdue.length }}</div><div class="trend">需升级但不伪造终态</div></div>
      <div class="metric"><div class="name">已完成</div><div class="value">{{ tasks.filter((task) => task.state === 'COMPLETED').length }}</div><div class="trend">均有来源业务证据</div></div>
    </div>
    <section class="task-filters"><label>风险<select v-model="risk"><option value="ALL">全部风险</option><option value="CRITICAL">危急</option><option value="HIGH">高风险</option><option value="ROUTINE">常规</option></select></label><label class="task-search">搜索<input v-model="search" placeholder="任务、来源或类型" /></label><button class="button secondary" @click="tasksQuery.refetch()">刷新来源状态</button></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div><ClinicalPageState v-if="tasksQuery.isPending.value" kind="loading" message="正在汇聚当前工作域任务" /><ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="tasksQuery.refetch()" />
    <section v-else class="clinical-task-list"><div v-if="filtered.length === 0" class="empty-state task-empty"><span>✓</span><p>当前筛选范围无任务</p><small>来源系统新增任务后将按幂等键汇聚。</small></div><article v-for="task in filtered" :key="task.task_id" class="clinical-task-card" :class="task.risk_level.toLowerCase()"><header><div><span class="task-risk" :class="task.risk_level.toLowerCase()">{{ riskLabel(task.risk_level) }}</span><strong>{{ task.title }}</strong><small>{{ task.task_type }} · 来源 {{ task.source_type }} …{{ task.source_id.slice(-8) }}</small></div><span class="task-state" :class="task.state.toLowerCase()">{{ stateLabel(task.state) }}</span></header><div class="clinical-task-body"><dl><div><dt>业务状态</dt><dd>{{ task.business_state }}</dd></div><div><dt>责任状态</dt><dd>{{ task.claimed_by ? `已由 …${task.claimed_by.slice(-6)} 接手` : task.assigned_user_id ? `已分派 …${task.assigned_user_id.slice(-6)}，待接手` : '待接手' }}</dd></div><div><dt>时限</dt><dd :class="{ overdue: isOverdue(task) }">{{ task.due_at ? formatDate(task.due_at) : '按来源业务' }}</dd></div><div><dt>任务版本</dt><dd>v{{ task.row_version }} · {{ task.data_watermark.slice(0, 10) }}…</dd></div></dl></div>
      <footer><span>{{ task.risk_level === 'CRITICAL' ? '必须回来源完成高风险核验' : '来源业务状态是完成依据' }}</span><div class="toolbar-actions"><button v-if="['PENDING','ASSIGNED','DELIVERED'].includes(task.state) && isAssignee(task)" class="button secondary" :disabled="busy === `views:${task.task_id}`" @click="command(task, 'views')">标记查看</button><button v-if="['PENDING','ASSIGNED','DELIVERED','VIEWED','ESCALATED'].includes(task.state) && isAssignee(task)" class="button secondary" :disabled="busy === `claims:${task.task_id}`" @click="command(task, 'claims')">接手任务</button><a class="button primary task-source-link" :href="task.source_route">回到来源处理</a></div></footer>
      <details v-if="canCollaborate(task)" class="task-collaboration" :open="collaborationTaskId === task.task_id" @toggle="collaborationTaskId = task.task_id"><summary>责任协作：委托、转派或升级</summary><div><label>目标人员<input :value="developmentCopy.collaboratorName" readonly /></label><label class="wide">原因<input v-model="collaborationReason" /></label><div class="toolbar-actions wide"><button class="button secondary" :disabled="Boolean(busy) || collaborationReason.trim().length < 2" @click="collaborate(task, 'delegations')">委托 8 小时</button><button v-if="task.state === 'CLAIMED'" class="button secondary" :disabled="Boolean(busy) || collaborationReason.trim().length < 2" @click="collaborate(task, 'transfers')">直接转派</button><button class="button danger" :disabled="Boolean(busy) || collaborationReason.trim().length < 2" @click="collaborate(task, 'escalations')">升级处理</button></div></div></details></article></section>
  </main>
</template>
