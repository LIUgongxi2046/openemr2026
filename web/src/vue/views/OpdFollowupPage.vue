<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { OutpatientFollowupWire } from '../../generated/contracts';
import {
  clinicalContext,
  finishCurrentOutpatientEncounter,
  issueDiagnosisLease,
  issueDocumentLease,
  issueOrderLease,
  issueResultLease,
  listClinicalDiagnoses,
  listClinicalOrders,
  listClinicalResults,
  loadCurrentOutpatientEncounter,
  loadEncounterDocuments,
} from '../../clinical-api';
import {
  cancelOutpatientFollowup,
  completeOutpatientFollowup,
  createOutpatientFollowup,
  issueFollowupEncounterLease,
  issueFollowupPatientLease,
  listOutpatientFollowups,
  updateOutpatientFollowup,
} from '../../api/outpatient-followup';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLease = useQuery({
  queryKey: ['outpatient', 'followup', 'patient-lease', clinicalContext.patientId],
  queryFn: () => issueFollowupPatientLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = useQuery({
  queryKey: ['outpatient', 'followup', 'encounter-lease', clinicalContext.patientId, clinicalContext.encounterId],
  queryFn: () => issueFollowupEncounterLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const followupsQuery = useQuery({
  queryKey: ['outpatient', 'followups', clinicalContext.patientId],
  queryFn: () => listOutpatientFollowups(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const encounterQuery = useQuery({
  queryKey: ['outpatient', 'encounter', clinicalContext.patientId, clinicalContext.encounterId],
  queryFn: () => loadCurrentOutpatientEncounter(encounterLease.data.value!),
  enabled: () => Boolean(encounterLease.data.value), retry: false,
});
const issue = computed(() => [patientLease.error.value, encounterLease.error.value, followupsQuery.error.value, encounterQuery.error.value].find(Boolean)
  ? toClinicalIssue([patientLease.error.value, encounterLease.error.value, followupsQuery.error.value, encounterQuery.error.value].find(Boolean)) : null);
const followups = computed(() => followupsQuery.data.value ?? []);
const pending = computed(() => followups.value.filter((f) => f.status === 'PENDING'));

const form = reactive({ followupType: 'FOLLOWUP', content: '', dueAt: '' });
const busy = ref('');
const notice = ref('');
const createOpen = ref(false);
const editTarget = ref<OutpatientFollowupWire | null>(null);
const completeTarget = ref<OutpatientFollowupWire | null>(null);
const completeOutcome = ref('');
const cancelTarget = ref<OutpatientFollowupWire | null>(null);
const cancelReason = ref('');
const closureOpen = ref(false);
const closureReason = ref('门诊诊疗已完成，已交代用药、复诊及红旗症状');
const closureChecks = ref<Array<{ key: string; label: string; passed: boolean; detail: string }>>([]);
const closureReady = computed(() => closureChecks.value.length === 4 && closureChecks.value.every((item) => item.passed));

function typeLabel(value: OutpatientFollowupWire['followup_type']) {
  return value === 'EDUCATION' ? '健康教育' : value === 'REVISIT' ? '复诊' : '随访';
}
function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function create() {
  const lease = encounterLease.data.value;
  if (!lease || busy.value || !form.content.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createOutpatientFollowup(lease, {
      followup_type: form.followupType,
      content: form.content.trim(),
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    });
    form.content = ''; form.dueAt = '';
    createOpen.value = false;
    notice.value = '随访已登记（幂等 + 审计 + Outbox）。';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginCreate() {
  editTarget.value = null;
  form.followupType = 'FOLLOWUP'; form.content = ''; form.dueAt = '';
  createOpen.value = true;
}

function beginEdit(followup: OutpatientFollowupWire) {
  editTarget.value = followup;
  form.followupType = followup.followup_type;
  form.content = followup.content ?? '';
  form.dueAt = followup.due_at ? new Date(new Date(followup.due_at).getTime() - new Date(followup.due_at).getTimezoneOffset() * 60_000).toISOString().slice(0, 16) : '';
  createOpen.value = true;
}

async function saveEdit() {
  const lease = encounterLease.data.value;
  const target = editTarget.value;
  if (!lease || !target || busy.value || !form.content.trim()) return;
  busy.value = `edit:${target.followup_id}`; notice.value = '';
  try {
    await updateOutpatientFollowup(lease, target, {
      followup_type: form.followupType,
      content: form.content.trim(),
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    });
    createOpen.value = false; editTarget.value = null;
    notice.value = '随访计划已更新，版本号和审计证据已同步递增。';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function cancel() {
  const lease = encounterLease.data.value;
  const target = cancelTarget.value;
  if (!lease || !target || busy.value || cancelReason.value.trim().length < 2) return;
  busy.value = `cancel:${target.followup_id}`; notice.value = '';
  try {
    await cancelOutpatientFollowup(lease, target, cancelReason.value.trim());
    cancelTarget.value = null; cancelReason.value = '';
    notice.value = '随访计划已逻辑删除（取消），不再进入待办，历史证据保留。';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginComplete(followup: OutpatientFollowupWire) {
  completeTarget.value = followup;
  completeOutcome.value = '';
}

async function complete() {
  const followup = completeTarget.value;
  const lease = encounterLease.data.value;
  if (!lease || !followup || busy.value || !completeOutcome.value.trim()) return;
  busy.value = `complete:${followup.followup_id}`; notice.value = '';
  try {
    await completeOutpatientFollowup(lease, followup, completeOutcome.value.trim());
    notice.value = '随访已完成，结局留痕。';
    completeTarget.value = null; completeOutcome.value = '';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function assessClosure() {
  if (busy.value) return;
  busy.value = 'assess-closure'; notice.value = '';
  try {
    const [documentLease, diagnosisLease, orderLease, resultLease] = await Promise.all([
      issueDocumentLease(), issueDiagnosisLease(), issueOrderLease('outpatient'), issueResultLease('outpatient'),
    ]);
    const [documents, diagnoses, orders, results] = await Promise.all([
      loadEncounterDocuments(documentLease), listClinicalDiagnoses(diagnosisLease),
      listClinicalOrders(orderLease, 'outpatient'), listClinicalResults(resultLease, 'outpatient'),
    ]);
    const unsignedOrders = orders.filter((order) => ['DRAFT', 'VALIDATING'].includes(order.status));
    const openCriticalValues = results.flatMap((result) => result.critical_values)
      .filter((critical) => critical.state !== 'DISPOSED');
    closureChecks.value = [
      { key: 'document', label: '门诊病历已签署', passed: documents.some((item) => ['SIGNED', 'CORRECTED'].includes(item.status)), detail: `${documents.length} 份就诊文书` },
      { key: 'diagnosis', label: '主诊断已确认', passed: diagnoses.some((item) => item.diagnosis_role === 'PRIMARY' && item.status === 'CONFIRMED'), detail: `${diagnoses.filter((item) => item.status === 'CONFIRMED').length} 条已确认诊断` },
      { key: 'orders', label: '无未签署医嘱', passed: unsignedOrders.length === 0, detail: unsignedOrders.length ? `${unsignedOrders.length} 条草稿/校验中医嘱` : '医嘱门禁通过' },
      { key: 'critical', label: '危急值全部闭环', passed: openCriticalValues.length === 0, detail: openCriticalValues.length ? `${openCriticalValues.length} 条待处置` : '无开放危急值' },
    ];
    closureOpen.value = true;
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function finishEncounter() {
  const lease = encounterLease.data.value;
  const encounter = encounterQuery.data.value;
  if (!lease || !encounter || !closureReady.value || closureReason.value.trim().length < 4 || busy.value) return;
  busy.value = 'finish-encounter'; notice.value = '';
  try {
    await finishCurrentOutpatientEncounter(lease, encounter, closureReason.value);
    await encounterQuery.refetch();
    closureOpen.value = false;
    notice.value = '门诊就诊已终诊结案（FINISHED），状态事件、审计与 Outbox 已同步留痕。';
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>门诊随访与终诊</h1><p>教育、复诊与随访登记；结局闭环由真实随访记录驱动</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="followupsQuery.refetch()">刷新</button><button class="btn" type="button" :disabled="encounterQuery.data.value?.status === 'FINISHED' || Boolean(busy)" @click="assessClosure">终诊结案</button><button class="btn primary" type="button" @click="beginCreate">登记随访</button></div>
    </div>

    <div v-if="patientLease.isPending.value || encounterLease.isPending.value || followupsQuery.isPending.value || encounterQuery.isPending.value" class="card"><div class="card-body">正在读取随访与就诊状态…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <div class="metric-grid" aria-label="随访指标">
        <div class="metric"><div class="name">随访记录</div><div class="value">{{ followups.length }}</div><div class="trend">当前患者</div></div>
        <div class="metric"><div class="name">待完成随访</div><div class="value">{{ pending.length }}</div><div class="trend">状态 PENDING</div></div>
        <div class="metric"><div class="name">已完成</div><div class="value">{{ followups.filter((f) => f.status === 'COMPLETED').length }}</div><div class="trend">结局留痕</div></div>
        <div class="metric"><div class="name">就诊状态</div><div class="value">{{ encounterQuery.data.value?.status === 'FINISHED' ? '已终诊' : '诊疗中' }}</div><div class="trend">{{ encounterQuery.data.value?.status || '—' }}</div></div>
      </div>

      <div v-if="notice" class="inline-notice" role="status">{{ notice }}</div>

      <section class="admin-panel">
          <header><div><h2>随访记录</h2><p>按患者聚合，结局不可改写。</p></div></header>
          <div v-if="followups.length === 0" class="empty-state"><span>随</span><p>暂无随访记录</p><small>在右侧登记</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>类型</th><th>内容</th><th>状态</th><th>计划时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="followup in followups" :key="followup.followup_id">
                  <td><span class="admin-status muted">{{ typeLabel(followup.followup_type) }}</span></td>
                  <td><strong>{{ followup.content }}</strong><small v-if="followup.outcome">{{ followup.outcome }}</small></td>
                  <td><span class="admin-status" :class="followup.status === 'COMPLETED' ? 'green' : followup.status === 'CANCELLED' ? 'muted' : 'amber'">{{ followup.status === 'COMPLETED' ? '已完成' : followup.status === 'CANCELLED' ? '已取消' : '待完成' }}</span></td>
                  <td>{{ formatDate(followup.due_at) }}</td>
                  <td><span v-if="followup.status === 'PENDING'" class="inline-actions"><button class="task-action" :disabled="Boolean(busy)" @click="beginEdit(followup)">编辑</button><button class="task-action" :disabled="Boolean(busy)" @click="beginComplete(followup)">{{ busy === `complete:${followup.followup_id}` ? '处理中…' : '填写结局' }}</button><button class="task-action danger" :disabled="Boolean(busy)" @click="cancelTarget = followup">删除</button></span></td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <BusinessActionDialog :open="createOpen" :title="editTarget ? '编辑随访计划' : '登记随访计划'" description="教育、复诊与随访计划将进入待办状态，并影响终诊闭环。" eyebrow="门诊随访终诊" :confirm-label="editTarget ? '保存修改' : '登记随访'" :busy="busy === 'create' || busy.startsWith('edit:')" width="wide" @cancel="createOpen = false; editTarget = null" @confirm="editTarget ? saveEdit() : create()">
          <div class="admin-form">
            <label><span>类型</span><select v-model="form.followupType"><option value="EDUCATION">健康教育</option><option value="REVISIT">复诊</option><option value="FOLLOWUP">随访</option></select></label>
            <label><span>内容</span><textarea v-model="form.content" rows="3" required placeholder="说明随访目标、观察指标、异常触发条件与责任人" /></label>
            <label><span>计划时间（可选）</span><input v-model="form.dueAt" type="datetime-local" /></label>
          </div>
      </BusinessActionDialog>

      <BusinessActionDialog :open="Boolean(completeTarget)" title="填写随访结局" description="结局确认后会将随访从待完成推进为已完成，不可静默覆盖。" eyebrow="门诊随访终诊" confirm-label="完成随访并留痕" :busy="Boolean(busy)" width="wide" @cancel="completeTarget = null" @confirm="complete"><p class="dialog-warning">{{ completeTarget?.content }}</p><label>随访结局<textarea v-model="completeOutcome" required minlength="2" maxlength="2000" rows="4" placeholder="记录患者反馈、复评结果、后续计划和红旗症状交代" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="Boolean(cancelTarget)" title="删除随访计划" description="医疗记录不做物理删除；确认后转为已取消，并立即退出待办闭环。" eyebrow="门诊随访终诊" confirm-label="确认删除并取消" danger :busy="busy.startsWith('cancel:')" @cancel="cancelTarget = null; cancelReason = ''" @confirm="cancel"><p class="dialog-warning">{{ cancelTarget?.content }}</p><label>删除原因<textarea v-model="cancelReason" required minlength="2" maxlength="1000" rows="3" placeholder="必填，将写入审计证据" /></label></BusinessActionDialog>
      <BusinessActionDialog :open="closureOpen" title="门诊终诊结案" description="结案将真实推进就诊状态机至 FINISHED；后端会再次强制校验全部临床门禁。" eyebrow="门诊随访终诊" confirm-label="确认终诊并结案" danger :busy="busy === 'finish-encounter'" :confirm-disabled="!closureReady || closureReason.trim().length < 4" width="wide" @cancel="closureOpen = false" @confirm="finishEncounter"><div class="closure-check-list"><div v-for="check in closureChecks" :key="check.key" :class="['closure-check', { passed: check.passed }]"><b>{{ check.passed ? '✓' : '!' }}</b><span><strong>{{ check.label }}</strong><small>{{ check.detail }}</small></span></div></div><p v-if="!closureReady" class="dialog-warning">门禁未全部通过，系统不会允许终诊。请返回对应页面完成处理后重新评估。</p><label>终诊说明<textarea v-model="closureReason" required minlength="4" maxlength="1000" rows="3" placeholder="记录已交代用药、复诊计划、红旗症状与患者理解情况" /></label></BusinessActionDialog>
    </template>
  </section>
</template>

<style scoped>
.closure-check-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.closure-check{display:grid;grid-template-columns:28px minmax(0,1fr);align-items:center;gap:9px;padding:11px;border:1px solid #efc7c7;border-radius:9px;background:#fff5f5}.closure-check>b{display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:#b83232;color:#fff}.closure-check span{display:grid;gap:3px}.closure-check strong{color:#6f2929;font-size:12px}.closure-check small{color:#8d6262;font-size:10px}.closure-check.passed{border-color:#b9dfd3;background:#f0fbf7}.closure-check.passed>b{background:#16866d}.closure-check.passed strong{color:#176956}.closure-check.passed small{color:#557b70}@media(max-width:620px){.closure-check-list{grid-template-columns:1fr}}
</style>
