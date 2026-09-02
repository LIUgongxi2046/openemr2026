<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { QualityGovernanceRecordWire } from '../../generated/contracts';
import { issueConfigurationLease } from '../../api/config';
import {
  createQualityGovernanceAgentProposal,
  createQualityGovernanceRecord,
  listQualityGovernanceAgentProposals,
  listQualityGovernanceRecords,
  updateQualityGovernanceRecord,
  voidQualityGovernanceRecord,
} from '../../api/quality-governance';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import {
  qualityGovernanceDepthDefinitions,
  qualityGovernanceKindByLevel,
  qualityGovernanceLevelLabel,
} from '../quality-governance-depth';
import type { QualityGovernanceDepthModuleId } from '../quality-governance-depth';

const props = defineProps<{ moduleId: QualityGovernanceDepthModuleId; parentId: string; level: number }>();
const route = useRoute(); const router = useRouter();
const definition = computed(() => qualityGovernanceDepthDefinitions[props.moduleId]);
const kind = computed(() => qualityGovernanceKindByLevel[props.level]);
const parentPath = computed(() => `${definition.value.collectionPath}/${props.parentId}`);
const depthPath = (level: number) => `${parentPath.value}/${({ 5: 'actions', 6: 'evidence', 7: 'reviews' } as Record<number, string>)[level]}`;
const archiveModule = computed(() => props.moduleId === 'archive-assets');

const leaseQuery = useQuery({ queryKey: ['quality-governance-depth', props.moduleId, props.parentId, 'lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const ready = computed(() => Boolean(leaseQuery.data.value));
const recordsQuery = useQuery({
  queryKey: ['quality-governance-depth', props.moduleId, props.parentId, props.level],
  queryFn: () => listQualityGovernanceRecords(leaseQuery.data.value!, definition.value.moduleCode, props.parentId, kind.value),
  enabled: ready, retry: false, staleTime: 0, gcTime: 0,
});
const proposalsQuery = useQuery({
  queryKey: ['quality-governance-depth', props.moduleId, props.parentId, 'agent-proposals'],
  queryFn: () => listQualityGovernanceAgentProposals(leaseQuery.data.value!, definition.value.moduleCode, props.parentId),
  enabled: () => ready.value && props.level === 7, retry: false, staleTime: 0, gcTime: 0,
});
const records = computed(() => recordsQuery.data.value ?? []);
const proposals = computed(() => proposalsQuery.data.value ?? []);
const openRecords = computed(() => records.value.filter((item) => !['VERIFIED', 'CLOSED'].includes(item.status)));
const overdue = computed(() => openRecords.value.filter((item) => item.due_at && new Date(item.due_at).getTime() < Date.now()));
const issue = computed(() => {
  const error = leaseQuery.error.value ?? recordsQuery.error.value ?? proposalsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

const editorOpen = ref(false); const deleteOpen = ref(false); const editing = ref<QualityGovernanceRecordWire | null>(null); const deleting = ref<QualityGovernanceRecordWire | null>(null);
const busy = ref(''); const notice = ref('');
const form = reactive({ code: '', title: '', owner: '', status: 'OPEN', dueAt: '', description: '', evidenceUri: '', evidenceHash: '', policyBasis: '', sourceReference: '', decisionBasis: '' });
const statusOptions = computed(() => kind.value === 'ACTION'
  ? [['OPEN', '待处理'], ['IN_PROGRESS', '整改中'], ['READY', '待复核'], ['REJECTED', '已驳回'], ['CLOSED', '已关闭']]
  : [['READY', '待验证'], ['VERIFIED', '已验证'], ['REJECTED', '已驳回'], ['CLOSED', '已关闭']]);

function textPayload(item: QualityGovernanceRecordWire, key: string) { const value = item.payload[key]; return value == null ? '' : String(value); }
function localDate(value?: string | null) { if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function defaultDue() { const date = new Date(Date.now() + 3 * 86400_000); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16); }
function reset(item?: QualityGovernanceRecordWire | null) {
  editing.value = item ?? null;
  form.code = item?.record_code ?? `${kind.value}-${new Date().toISOString().replace(/\D/g, '').slice(2, 12)}`;
  form.title = item?.title ?? ''; form.owner = item?.owner ?? '';
  form.status = item?.status ?? (kind.value === 'ACTION' ? 'OPEN' : 'READY');
  form.dueAt = localDate(item?.due_at) || defaultDue(); form.description = item?.description ?? '';
  form.evidenceUri = item?.evidence_uri ?? ''; form.evidenceHash = item?.evidence_hash ?? '';
  form.policyBasis = item ? textPayload(item, 'china_policy_basis') : definition.value.chinaPolicyOptions[0];
  form.sourceReference = item ? textPayload(item, 'source_reference') : `${definition.value.parentLabel}:${props.parentId}`;
  form.decisionBasis = item ? textPayload(item, 'decision_basis') : '';
}
function openCreate() { reset(); notice.value = ''; editorOpen.value = true; }
function openEdit(item: QualityGovernanceRecordWire) { reset(item); notice.value = ''; editorOpen.value = true; }
function requestDelete(item: QualityGovernanceRecordWire) { deleting.value = item; deleteOpen.value = true; }
function valid() {
  if (![form.code, form.title, form.owner, form.description, form.policyBasis, form.sourceReference].every((value) => value.trim())) return false;
  if (kind.value === 'EVIDENCE' && !form.evidenceUri.trim() && !form.evidenceHash.trim()) return false;
  if (form.evidenceHash && !/^[0-9a-f]{64}$/.test(form.evidenceHash.trim())) return false;
  return kind.value !== 'REVIEW' || form.decisionBasis.trim().length >= 4;
}
async function save() {
  const lease = leaseQuery.data.value; if (!lease || busy.value || !valid()) return;
  busy.value = 'save'; notice.value = '';
  const values = {
    title: form.title.trim(), owner: form.owner.trim(), status: form.status as never,
    due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    description: form.description.trim(), evidence_uri: form.evidenceUri.trim() || null,
    evidence_hash: form.evidenceHash.trim() || null,
    payload: { schema_version: 1, china_policy_basis: form.policyBasis, source_reference: form.sourceReference.trim(), decision_basis: form.decisionBasis.trim() || null, human_confirmation_required: true, agent_write_allowed: false },
  };
  try {
    if (editing.value) await updateQualityGovernanceRecord(lease, definition.value.moduleCode, props.parentId, editing.value.quality_governance_record_id, { ...values, expected_version: editing.value.row_version });
    else await createQualityGovernanceRecord(lease, definition.value.moduleCode, props.parentId, { ...values, record_kind: kind.value, record_code: form.code.trim().toUpperCase() });
    notice.value = editing.value ? '记录已更新，版本、审计和流程状态已同步。' : '记录已写入质量治理链。';
    editorOpen.value = false; await recordsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function remove() {
  const lease = leaseQuery.data.value; const record = deleting.value; if (!lease || !record || busy.value) return;
  busy.value = 'delete'; notice.value = '';
  try {
    await voidQualityGovernanceRecord(lease, definition.value.moduleCode, props.parentId, record, '用户在质量治理页面确认逻辑作废，保留完整审计证据');
    notice.value = '记录已逻辑作废，不再参与当前指标计算。'; deleteOpen.value = false; deleting.value = null; await recordsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function generateAdvice() {
  const lease = leaseQuery.data.value; if (!lease || busy.value) return; busy.value = 'agent'; notice.value = '';
  try { await createQualityGovernanceAgentProposal(lease, definition.value.moduleCode, props.parentId); notice.value = 'Agent 候选建议已按当前证据水位生成，未修改任何质量事实。'; await proposalsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '未设置'; }
function statusLabel(value: string) { return statusOptions.value.find(([code]) => code === value)?.[1] ?? value; }
async function reload() { await Promise.all([recordsQuery.refetch(), ...(props.level === 7 ? [proposalsQuery.refetch()] : [])]); }
watch(() => route.query.create, (value) => { if (value === '1') { openCreate(); void router.replace({ query: { ...route.query, create: undefined } }); } }, { immediate: true });
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page quality-depth-page">
    <nav class="quality-breadcrumb" aria-label="业务纵深导航"><RouterLink :to="archiveModule ? '/archive-assets' : '/quality-center'">{{ archiveModule ? '病案资产中心' : '医疗质量中心' }}</RouterLink><span>/</span><RouterLink :to="definition.collectionPath">{{ definition.title }}</RouterLink><span>/</span><RouterLink :to="parentPath">{{ definition.parentLabel }} L4</RouterLink><span>/</span><b>{{ qualityGovernanceLevelLabel[level] }}</b></nav>
    <div class="page-heading admin-heading"><div><p class="eyebrow">{{ archiveModule ? '病案资产治理' : '医疗质量治理' }} / {{ qualityGovernanceLevelLabel[level] }}</p><h1>{{ definition.title }}·{{ qualityGovernanceLevelLabel[level].slice(3) }}</h1><p>所有记录绑定父业务对象、机构、院区和版本，作废不删除证据。</p></div><div class="toolbar-actions"><button class="button secondary" type="button" @click="reload">刷新</button><button class="button primary" type="button" @click="openCreate">新建{{ qualityGovernanceLevelLabel[level].slice(3) }}</button></div></div>
    <nav class="depth-nav" aria-label="五到七级质量治理页面"><RouterLink :to="definition.collectionPath">L3 台账</RouterLink><RouterLink :to="parentPath">L4 对象详情</RouterLink><RouterLink :to="depthPath(5)">L5 整改动作</RouterLink><RouterLink :to="depthPath(6)">L6 证据束</RouterLink><RouterLink :to="depthPath(7)">L7 复核 / Agent</RouterLink></nav>
    <section class="admin-metrics"><article><span>当前记录</span><strong>{{ records.length }}</strong><small>不含已作废</small></article><article><span>开放项</span><strong>{{ openRecords.length }}</strong><small>影响当前流程</small></article><article><span>逾期项</span><strong>{{ overdue.length }}</strong><small>需要升级处理</small></article><article><span>证据边界</span><strong>{{ kind }}</strong><small>L{{ level }} 服务端强约束</small></article></section>
    <ClinicalPageState v-if="leaseQuery.isPending.value || recordsQuery.isPending.value" kind="loading" message="正在读取质量治理证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else>
      <p v-if="notice" class="admin-notice" :class="{ danger: notice.includes('：') }" role="status">{{ notice }}</p>
      <section class="admin-panel"><header><div><h2>{{ qualityGovernanceLevelLabel[level] }}</h2><p>父对象 <code>{{ parentId }}</code></p></div></header><div v-if="!records.length" class="admin-empty rich"><strong>当前层级暂无真实记录</strong><p>系统不用预设文案伪造完成状态。</p><button class="button primary" type="button" @click="openCreate">新建记录</button></div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>编码 / 标题</th><th>责任人</th><th>依据 / 来源</th><th>状态</th><th>时限</th><th>版本</th><th>操作</th></tr></thead><tbody><tr v-for="item in records" :key="item.quality_governance_record_id"><td><b>{{ item.title }}</b><small><code>{{ item.record_code }}</code></small></td><td>{{ item.owner }}</td><td>{{ textPayload(item, 'china_policy_basis') }}<small>{{ textPayload(item, 'source_reference') }}</small></td><td><span class="admin-status" :class="['VERIFIED','CLOSED'].includes(item.status) ? 'active' : item.status === 'REJECTED' ? 'danger' : 'warning'">{{ statusLabel(item.status) }}</span></td><td>{{ formatDate(item.due_at) }}</td><td>v{{ item.row_version }}</td><td class="admin-actions"><button class="task-action" type="button" @click="openEdit(item)">编辑</button><button class="task-action danger" type="button" @click="requestDelete(item)">作废</button></td></tr></tbody></table></div></section>
      <section v-if="level === 7" class="admin-panel agent-proposals"><header><div><h2>质量 Agent 候选建议</h2><p>确定性规则生成；只读证据、人工复核、禁止自动写入业务结论。</p></div><button class="button primary" type="button" :disabled="busy === 'agent'" @click="generateAdvice">{{ busy === 'agent' ? '生成中…' : '按当前证据生成建议' }}</button></header><div v-if="!proposals.length" class="admin-empty">尚未生成候选建议。</div><div v-else class="proposal-list"><article v-for="item in proposals" :key="item.quality_governance_agent_proposal_id"><header><b>{{ item.risk_level }} 风险</b><span>{{ formatDate(item.created_at) }} · {{ item.model_policy }}</span></header><p>{{ item.summary }}</p><ol><li v-for="action in item.prioritized_actions" :key="action">{{ action }}</li></ol><small>证据水位 <code>{{ item.evidence_watermark }}</code> · 人工复核 {{ item.human_review_state }}</small></article></div></section>
    </template>

    <AdminActionDialog v-model:open="editorOpen" :title="editing ? `编辑${qualityGovernanceLevelLabel[level].slice(3)}` : `新建${qualityGovernanceLevelLabel[level].slice(3)}`" description="保存后会写入数据库、审计哈希链和 Outbox，并影响开放/逾期/闭环指标。" size="large" :busy="busy === 'save'">
      <form class="admin-form depth-form" @submit.prevent="save"><label><span>业务编码</span><input v-model="form.code" required maxlength="96" :disabled="Boolean(editing)" /></label><label><span>标题</span><input v-model="form.title" required maxlength="256" /></label><label><span>责任人 / 复核角色</span><input v-model="form.owner" required maxlength="128" /></label><label><span>流程状态</span><select v-model="form.status"><option v-for="option in statusOptions" :key="option[0]" :value="option[0]">{{ option[1] }}</option></select></label><label><span>中国医疗制度依据</span><select v-model="form.policyBasis"><option v-for="item in definition.chinaPolicyOptions" :key="item" :value="item">{{ item }}</option></select></label><label><span>完成时限</span><input v-model="form.dueAt" type="datetime-local" /></label><label class="full-span"><span>权威来源引用</span><input v-model="form.sourceReference" required maxlength="1000" placeholder="例：document://文书版本或父业务对象" /></label><label v-if="kind === 'EVIDENCE'" class="full-span"><span>证据 URI（与 SHA-256 至少一项）</span><input v-model="form.evidenceUri" maxlength="1000" placeholder="document://... / archive://... / https://..." /></label><label v-if="kind === 'EVIDENCE'" class="full-span"><span>证据 SHA-256</span><input v-model="form.evidenceHash" maxlength="64" pattern="[0-9a-f]{64}" placeholder="64 位小写十六进制" /></label><label class="full-span"><span>处置 / 证据说明</span><textarea v-model="form.description" required maxlength="2000" rows="3" /></label><label v-if="kind === 'REVIEW'" class="full-span"><span>独立复核依据</span><textarea v-model="form.decisionBasis" required maxlength="1000" rows="3" placeholder="说明通过或驳回依据，不得仅写“已复核”" /></label></form>
      <template #footer="{ close }"><button class="button secondary" type="button" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" type="button" :disabled="busy === 'save' || !valid()" @click="save">{{ busy === 'save' ? '保存中…' : '保存并影响流程' }}</button></template>
    </AdminActionDialog>
    <AdminConfirmDialog v-model:open="deleteOpen" :title="`作废${deleting?.title ?? '质量治理记录'}`" description="采用逻辑作废：当前指标立即重算，原始版本、审计哈希和 Outbox 证据保留。" confirm-label="确认作废" :busy="busy === 'delete'" @confirm="remove" />
  </section>
</template>

<style scoped>
.quality-depth-page{display:grid;gap:14px}.quality-breadcrumb{display:flex;align-items:center;gap:8px;color:#667085;font-size:12px}.quality-breadcrumb a{color:#245493;text-decoration:none}.depth-nav{display:flex;gap:8px;overflow:auto}.depth-nav a{flex:0 0 auto;padding:8px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;color:#42627c;text-decoration:none}.depth-nav a.router-link-active{border-color:var(--blue);background:#eef6ff;color:var(--blue);font-weight:800}.admin-table td small{display:block;margin-top:4px;color:var(--muted)}.admin-actions{min-width:120px}.depth-form{grid-template-columns:repeat(2,minmax(0,1fr));padding:0}.full-span{grid-column:1/-1}.proposal-list{display:grid;gap:10px;padding:14px}.proposal-list article{padding:13px;border:1px solid var(--line);border-radius:9px;background:#fbfdff}.proposal-list article header{display:flex;justify-content:space-between;gap:10px}.proposal-list p{line-height:1.6}.proposal-list ol{display:grid;gap:5px;padding-left:20px}.proposal-list small{display:block;color:var(--muted);overflow-wrap:anywhere}.admin-notice.danger{border-color:#fecaca;background:#fff7f7;color:#b42318}@media(max-width:680px){.depth-form{grid-template-columns:1fr}.full-span{grid-column:auto}}
</style>
