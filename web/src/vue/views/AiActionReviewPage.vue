<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ActionApprovalWire } from '../../generated/contracts';
import {
  createActionExecution, decideActionApproval, issueAssistantEncounterLease, issueAssistantPatientLease,
  listActionApprovals, listActionExecutions, proposeActionApproval, settleActionExecution,
} from '../../api/assistant';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLeaseQuery = useQuery({ queryKey: ['assistant', 'action', 'patient-lease'], queryFn: () => issueAssistantPatientLease('ACTION_REVIEW'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const patientLease = computed(() => patientLeaseQuery.data.value);
const encounterLeaseQuery = useQuery({ queryKey: ['assistant', 'action', 'encounter-lease'], queryFn: () => issueAssistantEncounterLease('ACTION_REVIEW'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const encounterLease = computed(() => encounterLeaseQuery.data.value);
const approvalsQuery = useQuery({ queryKey: ['assistant', 'action', 'approvals'], queryFn: () => listActionApprovals(patientLease.value!), enabled: () => Boolean(patientLease.value), retry: false });
const issue = computed(() => (patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? approvalsQuery.error.value) ? toClinicalIssue(patientLeaseQuery.error.value ?? encounterLeaseQuery.error.value ?? approvalsQuery.error.value) : null);
const approvals = computed(() => approvalsQuery.data.value ?? []);
const form = reactive({ actionType: 'ORDER_MEDICATION', summary: '' });
const busy = ref(false);
const notice = ref('');
const selectedId = ref('');
const executionsQuery = useQuery({ queryKey: ['assistant', 'action', 'executions', selectedId], queryFn: () => listActionExecutions(patientLease.value!, selectedId.value), enabled: () => Boolean(patientLease.value && selectedId.value), retry: false });
const executions = computed(() => executionsQuery.data.value ?? []);

function statusLabel(s: string) { const m: Record<string, string> = { PROPOSED: '待审批', APPROVED: '已批准', REJECTED: '已拒绝' }; return m[s] ?? s; }

async function propose() {
  const lease = encounterLease.value;
  if (!lease || busy.value || !form.summary.trim()) return;
  busy.value = true; notice.value = '';
  try {
    await proposeActionApproval(lease, { action_type: form.actionType, proposed_action_summary: form.summary.trim(), proposed_at: new Date().toISOString() });
    form.summary = ''; notice.value = '动作已提议，等待独立审批。'; await approvalsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
async function decide(approval: ActionApprovalWire, decision: 'APPROVE' | 'REJECT') {
  const lease = encounterLease.value;
  if (!lease || busy.value) return;
  busy.value = true; notice.value = '';
  try { await decideActionApproval(lease, approval, decision); notice.value = `动作已${decision === 'APPROVE' ? '批准' : '拒绝'}。`; await approvalsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
async function execute(approval: ActionApprovalWire) {
  const lease = patientLease.value;
  if (!lease || busy.value) return;
  busy.value = true; notice.value = '';
  try { await createActionExecution(lease, approval.action_approval_id); notice.value = '执行核验已创建。'; await executionsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
async function settle(executionId: string, outcome: 'SUCCEEDED' | 'FAILED') {
  const lease = patientLease.value;
  const execution = executions.value.find((e) => e.execution_id === executionId);
  if (!lease || busy.value || !execution) return;
  busy.value = true; notice.value = '';
  try { await settleActionExecution(lease, execution, outcome, outcome === 'SUCCEEDED' ? '执行成功' : '执行失败原因'); notice.value = `执行已${outcome === 'SUCCEEDED' ? '成功' : '失败（附原因）'}。`; await executionsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">AI 平台 / 治理</p><h1>动作审批与执行核验</h1><p>AI 提出的高风险动作需独立审批（人机分离），执行核验仅允许已批准动作、失败必附原因。</p></div></div>
    <ClinicalPageState v-if="patientLeaseQuery.isPending.value || encounterLeaseQuery.isPending.value || approvalsQuery.isPending.value" kind="loading" message="正在读取动作审批" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="approvalsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>动作审批台账</h2><p>提议人与审批人分离。</p></div><button class="button secondary" @click="approvalsQuery.refetch()">刷新</button></header>
          <div v-if="!approvals.length" class="admin-empty">暂无动作提案。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>动作</th><th>摘要</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="approval in approvals" :key="approval.action_approval_id">
              <td><strong>{{ approval.action_type }}</strong><small>…{{ approval.action_approval_id.slice(-8) }}</small></td>
              <td>{{ approval.proposed_action_summary }}</td>
              <td><span class="admin-status" :class="approval.status.toLowerCase()">{{ statusLabel(approval.status) }}</span></td>
              <td>
                <button v-if="approval.status === 'PROPOSED'" class="task-action" :disabled="busy" @click="decide(approval, 'APPROVE')">批准</button>
                <button v-if="approval.status === 'PROPOSED'" class="task-action danger" :disabled="busy" @click="decide(approval, 'REJECT')">拒绝</button>
                <button v-if="approval.status === 'APPROVED'" class="task-action" :disabled="busy" @click="selectedId = approval.action_approval_id; execute(approval)">执行</button>
              </td>
            </tr>
          </tbody></table></div>
          <div v-if="selectedId" class="admin-panel" style="margin-top:14px">
            <header><div><h2>执行核验</h2><p>仅已批准动作可执行。</p></div></header>
            <div v-if="!executions.length" class="admin-empty">暂无执行核验。</div>
            <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>状态</th><th>执行人</th><th>结果说明</th><th>操作</th></tr></thead><tbody>
              <tr v-for="execution in executions" :key="execution.execution_id">
                <td><span class="admin-status">{{ execution.execution_status }}</span></td>
                <td><code>{{ execution.executed_by ? `…${execution.executed_by.slice(-8)}` : '—' }}</code></td>
                <td>{{ execution.result_note ?? '—' }}</td>
                <td>
                  <button v-if="execution.execution_status === 'PENDING'" class="task-action" :disabled="busy" @click="settle(execution.execution_id, 'SUCCEEDED')">成功</button>
                  <button v-if="execution.execution_status === 'PENDING'" class="task-action danger" :disabled="busy" @click="settle(execution.execution_id, 'FAILED')">失败</button>
                </td>
              </tr>
            </tbody></table></div>
          </div>
        </section>
        <section class="admin-panel admin-form-panel"><header><div><h2>提议动作</h2><p>动作类型与摘要必填。</p></div></header>
          <form class="admin-form" @submit.prevent="propose">
            <label><span>动作类型</span><select v-model="form.actionType"><option value="ORDER_MEDICATION">开药</option><option value="ORDER_LAB">开检验</option><option value="ORDER_IMAGING">开影像</option><option value="DOCUMENT_SIGN">签署</option><option value="OTHER">其他</option></select></label>
            <label><span>动作摘要</span><textarea v-model="form.summary" rows="3" required /></label>
            <button class="button primary full" :disabled="busy || !form.summary.trim()">提议动作</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
