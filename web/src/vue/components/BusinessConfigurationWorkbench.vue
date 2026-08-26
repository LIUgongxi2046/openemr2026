<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import type { ConfigurationItemWire, ConfigurationLifecycleRequestWire } from '../../generated/contracts';
import { defineConfiguration, issueConfigurationLease, listConfigurations, transitionConfiguration, updateConfiguration } from '../../api/config';
import { toClinicalIssue } from '../clinical-error';
import BusinessActionDialog from './BusinessActionDialog.vue';

type Mode = 'workflow' | 'form' | 'rule' | 'scope';
type Row = Record<string, any>;
type DialogKind = null | 'config-create' | 'config-edit' | 'config-delete' | 'row-edit' | 'row-delete';

const props = defineProps<{ mode: Mode }>();
const definitions = {
  workflow: { type: 'WORKFLOW', eyebrow: '业务配置 / 流程编排', title: '流程与状态设计器', subtitle: '配置节点、分支、角色、时限、升级、退回与补偿，并用合成病例逐步回放。', key: 'inpatient-consult-v1', name: '住院跨科会诊闭环流程' },
  form: { type: 'FORM_TEMPLATE', eyebrow: '业务配置 / 文档结构', title: '表单与病历模板设计器', subtitle: '设计字段、分组、布局、计算、可见性、签名与术语映射，并保留历史版本。', key: 'opd-record-v1', name: '门诊结构化病历模板' },
  rule: { type: 'RULE', eyebrow: '业务配置 / 规则治理', title: '规则、时限与提示设计器', subtitle: '按平台硬门、机构规则、提醒与 AI 建议分层，支持冲突分析和历史回放。', key: 'clinical-safety-rules-v1', name: '临床安全与时限规则集' },
  scope: { type: 'SCOPE', eyebrow: '业务配置 / 权限模型', title: '角色、职责与数据范围设计器', subtitle: '组合组织、科室、患者关系、班次、资源动作、职责分离和临时授权。', key: 'clinical-scope-v1', name: '临床角色与数据范围策略' },
} as const;
const definition = computed(() => definitions[props.mode]);
const leaseQuery = useQuery({ queryKey: ['business-config', 'lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 300000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: computed(() => ['business-config', definition.value.type]), queryFn: () => listConfigurations(leaseQuery.data.value!, definition.value.type), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const items = computed(() => itemsQuery.data.value ?? []);
const selected = ref<ConfigurationItemWire | null>(null);
const payload = ref<Record<string, any>>({});
const tab = ref<'design' | 'validate' | 'simulate' | 'versions'>('design');
const busy = ref('');
const notice = ref('');
const dialogKind = ref<DialogKind>(null);
const rowKey = ref('');
const rowIndex = ref(-1);
const rowDraft = ref<Row>({});
const configDraft = reactive({ key: '', name: '', description: '' });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const rows = (key: string): Row[] => Array.isArray(payload.value[key]) ? payload.value[key] : [];
const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;
const editable = computed(() => selected.value?.status === 'DRAFT');

function defaults(mode: Mode): Record<string, any> {
  if (mode === 'workflow') return { schema_version: 2, description: '覆盖申请、接收、意见、签署、审计、终态、退回与超时升级。', nodes: [
    { id: 'start', name: '发起申请', type: 'START', owner: '经治医生', minutes: 15 }, { id: 'receive', name: '科室接收', type: 'TASK', owner: '目标科室', minutes: 30 },
    { id: 'opinion', name: '专家意见', type: 'TASK', owner: '会诊专家', minutes: 120 }, { id: 'sign', name: '数字签署', type: 'SIGN', owner: '会诊专家', minutes: 20, protected: true },
    { id: 'audit', name: '审计留痕', type: 'AUDIT', owner: '系统', minutes: 1, protected: true }, { id: 'complete', name: '完成', type: 'END', owner: '系统', minutes: 1, terminal: true, protected: true },
  ], edges: [
    { from: 'start', to: 'receive', condition: '申请已提交' }, { from: 'receive', to: 'opinion', condition: '科室接收' }, { from: 'opinion', to: 'sign', condition: '意见完成' },
    { from: 'sign', to: 'audit', condition: '签名有效' }, { from: 'audit', to: 'complete', condition: '审计成功' }, { from: 'receive', to: 'start', condition: '资料不全', compensation: true },
  ], protected_nodes: ['sign', 'audit', 'complete'], timeout_policy: '30 分钟提醒，120 分钟升级科主任，240 分钟升级医务处', synthetic_case: { case_id: 'SYN-CONSULT-20260826-01', patient: '赵明远（合成）' } };
  if (mode === 'form') return { schema_version: 2, description: '结构化门诊病历，支持条件、计算、签署、打印和术语映射。', groups: [{ id: 'history', name: '病史采集', columns: 2 }, { id: 'assessment', name: '评估与计划', columns: 2 }], fields: [
    { id: 'chief_complaint', label: '主诉', type: 'TEXTAREA', group: 'history', required: true, terminology: 'SNOMED-CT' }, { id: 'pain_score', label: '疼痛评分', type: 'NUMBER', group: 'history', required: true, validation: '0 <= value <= 10' },
    { id: 'risk_level', label: '胸痛风险分层', type: 'CALCULATED', group: 'assessment', required: true, protected: true, calculation: 'pain_score >= 7 ? HIGH : MEDIUM' }, { id: 'diagnosis', label: '诊断', type: 'CODE', group: 'assessment', required: true, protected: true, terminology: 'ICD-10-CN' },
    { id: 'signature', label: '医生签名', type: 'SIGNATURE', group: 'assessment', required: true, protected: true },
  ], terminology_mapping: [{ field: 'diagnosis', system: 'ICD-10-CN' }, { field: 'chief_complaint', system: 'SNOMED-CT' }], print_template: 'A4-门诊病历-v2', sample_values: { chief_complaint: '胸痛 2 小时', pain_score: 8, diagnosis: 'I20.0 不稳定型心绞痛' } };
  if (mode === 'rule') return { schema_version: 2, description: '平台硬门、机构规则、提醒和 AI 建议分层治理。', rule_layer: 'MIXED', rules: [
    { id: 'allergy-block', name: '严重过敏处方阻断', layer: 'PLATFORM_HARD', priority: 1000, condition: '严重过敏且成分命中', action: '阻断处方并要求替代药', evidence: '国家药品不良反应监测规范', exception: '禁止例外', enabled: true },
    { id: 'pediatric-dose', name: '儿科体重剂量校验', layer: 'INSTITUTION_HARD', priority: 800, condition: '年龄<14 且已录入体重', action: '超出 mg/kg 范围时阻断', evidence: '院内儿科用药目录 2026.2', exception: '药师与上级医师双签', enabled: true },
    { id: 'consult-timeout', name: '会诊超时升级', layer: 'REMINDER', priority: 500, condition: '会诊等待>=120分钟', action: '提醒科主任并升级任务', evidence: '医疗核心制度', exception: '急救处理中可延后', enabled: true },
    { id: 'ai-summary', name: 'AI 病情摘要建议', layer: 'AI_ADVICE', priority: 100, condition: '资料完整度>=80%', action: '生成带来源的摘要候选', evidence: 'clinical-ai-golden-v1', exception: '仅供人工确认', enabled: true },
  ], conditions: ['过敏命中', '年龄与体重', '会诊等待时长'], actions: ['阻断', '升级', '提醒', '建议'], sample_case: { case_id: 'SYN-RULE-20260826-01', age: 6, weight_kg: 20, allergy: '青霉素严重过敏', order: '阿莫西林克拉维酸钾' } };
  return { schema_version: 2, description: '按角色、科室、患者关系、班次与资源状态计算最终权限。', roles: ['经治医生', '会诊医生', '护士长', '病案管理员'], data_scopes: ['本科患者', '会诊授权患者', '值班期间', '脱敏汇总'], permissions: [
    { role: '经治医生', resource: '病历草稿', action: '读写', scope: '本科患者', effect: 'ALLOW', temporary_hours: 0, sod: '签署人不能批准本人更正' },
    { role: '会诊医生', resource: '病历全文', action: '只读', scope: '会诊授权患者', effect: 'ALLOW', temporary_hours: 4, sod: '禁止导出' },
    { role: '会诊医生', resource: '批量导出', action: '导出', scope: '全部患者', effect: 'DENY', temporary_hours: 0, sod: '保护性拒绝优先' },
    { role: '护士长', resource: '护理记录', action: '审核', scope: '本病区', effect: 'ALLOW', temporary_hours: 0, sod: '作者与审核人分离' },
  ], separation_of_duties: '作者!=审批人；授权申请人!=批准人；紧急访问须事后复核', temporary_grant_hours: 4, simulation: { role: '会诊医生', resource: '病历全文', action: '读取', expected: 'ALLOW' } };
}

function selectItem(item: ConfigurationItemWire) {
  selected.value = item;
  const stored = clone(item.payload) as Record<string, any>;
  const legacy = Number(stored.schema_version ?? 1) < 2
    || (props.mode === 'workflow' && typeof stored.nodes?.[0] === 'string')
    || (props.mode === 'form' && typeof stored.fields?.[0] === 'string')
    || (props.mode === 'rule' && !Array.isArray(stored.rules))
    || (props.mode === 'scope' && !Array.isArray(stored.permissions));
  payload.value = legacy ? { ...defaults(props.mode), description: stored.description ?? defaults(props.mode).description, migrated_from_schema: stored.schema_version ?? 1 } : stored;
  tab.value = 'design';
  notice.value = legacy ? '已将旧版配置升级为完整领域模型；保存后写入数据库 Schema v2。' : '';
}

watch(items, (value) => {
  if (!value.length) { selected.value = null; payload.value = {}; return; }
  const current = value.find(item => item.config_id === selected.value?.config_id) ?? value[0];
  if (!selected.value || current.config_id !== selected.value.config_id) selectItem(current);
}, { immediate: true });
watch(() => props.mode, () => { selected.value = null; payload.value = {}; tab.value = 'design'; dialogKind.value = null; });

function openConfigCreate() {
  configDraft.key = `${definition.value.key}-${Date.now().toString().slice(-6)}`;
  configDraft.name = definition.value.name;
  configDraft.description = String(defaults(props.mode).description);
  dialogKind.value = 'config-create';
}
function openConfigEdit() {
  if (!selected.value || !editable.value) return;
  configDraft.key = selected.value.config_key;
  configDraft.name = selected.value.display_name;
  configDraft.description = String(payload.value.description ?? '');
  dialogKind.value = 'config-edit';
}
function openConfigDelete() { if (selected.value) dialogKind.value = 'config-delete'; }

function defaultRow(key: string, preset = ''): Row {
  const count = rows(key).length + 1;
  if (key === 'nodes') return { id: `${preset.toLowerCase() || 'task'}_${count}`, name: preset === 'BRANCH' ? '条件分支' : preset === 'COMPENSATION' ? '异常补偿' : '人工任务', type: preset === 'COMPENSATION' ? 'TASK' : (preset || 'TASK'), owner: '质控医生', minutes: 60, compensation: preset === 'COMPENSATION' };
  if (key === 'edges') return { from: rows('nodes')[0]?.id ?? 'start', to: rows('nodes')[1]?.id ?? '', condition: '满足业务条件', compensation: false };
  if (key === 'groups') return { id: `group_${count}`, name: '新分组', columns: 2 };
  if (key === 'fields') return { id: `custom_${count}`, label: '新字段', type: 'TEXT', group: rows('groups')[0]?.id ?? 'assessment', required: false, terminology: '' };
  if (key === 'rules') return { id: `rule-${count}`, name: '新提醒规则', layer: 'REMINDER', priority: 300, condition: '请输入条件', action: '创建待办', evidence: '待补充', exception: '允许关闭', enabled: true };
  return { role: '经治医生', resource: '临床文档', action: '只读', scope: '本科患者', effect: 'ALLOW', temporary_hours: 0, sod: '无' };
}
function openRowCreate(key: string, preset = '') {
  if (!editable.value) { notice.value = '仅草稿版本允许新增、编辑或删除；请先复制为新草稿。'; return; }
  rowKey.value = key; rowIndex.value = -1; rowDraft.value = defaultRow(key, preset); dialogKind.value = 'row-edit';
}
function openRowEdit(key: string, index: number) {
  if (!editable.value) { notice.value = '已进入生效或审批流程的版本不可直接编辑。'; return; }
  rowKey.value = key; rowIndex.value = index; rowDraft.value = clone(rows(key)[index]); dialogKind.value = 'row-edit';
}
function openRowDelete(key: string, index: number) {
  const row = rows(key)[index];
  if (!editable.value) { notice.value = '已进入生效或审批流程的版本不可直接删除。'; return; }
  if (row?.protected) { notice.value = '受保护对象不能删除，只能通过新版本停用。'; return; }
  if (key === 'groups' && rows('fields').some(field => field.group === row.id)) { notice.value = '该分组仍被字段引用，请先移动或删除相关字段。'; return; }
  rowKey.value = key; rowIndex.value = index; rowDraft.value = clone(row); dialogKind.value = 'row-delete';
}

async function persistPayload(message: string) {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || !editable.value) return;
  const result = await updateConfiguration(lease, selected.value.config_id, { display_name: selected.value.display_name, payload: payload.value, expected_version: selected.value.row_version });
  await itemsQuery.refetch(); selectItem(result); notice.value = `${message}，已写入数据库 · v${result.row_version}`;
}

async function confirmDialog() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !dialogKind.value) return;
  busy.value = 'dialog'; notice.value = '';
  try {
    if (dialogKind.value === 'config-create') {
      const nextPayload = defaults(props.mode); nextPayload.description = configDraft.description.trim();
      const result = await defineConfiguration(lease, { config_type: definition.value.type, config_key: configDraft.key.trim(), display_name: configDraft.name.trim(), payload: nextPayload });
      await itemsQuery.refetch(); selectItem(result); notice.value = '新配置已创建并写入数据库。';
    } else if (dialogKind.value === 'config-edit' && selected.value) {
      payload.value.description = configDraft.description.trim();
      const result = await updateConfiguration(lease, selected.value.config_id, { display_name: configDraft.name.trim(), payload: payload.value, expected_version: selected.value.row_version });
      await itemsQuery.refetch(); selectItem(result); notice.value = `配置基本信息已更新 · v${result.row_version}`;
    } else if (dialogKind.value === 'config-delete' && selected.value) {
      await transitionConfiguration(lease, selected.value.config_id, { action: 'ARCHIVE', expected_version: selected.value.row_version, reason: '业务配置停用归档并保留版本审计证据' });
      selected.value = null; payload.value = {}; await itemsQuery.refetch(); notice.value = '配置已归档停用，不再进入运行时生效集合。';
    } else if (dialogKind.value === 'row-edit') {
      const list = [...rows(rowKey.value)];
      if (rowIndex.value < 0) list.push(clone(rowDraft.value)); else list.splice(rowIndex.value, 1, clone(rowDraft.value));
      payload.value = { ...payload.value, [rowKey.value]: list };
      await persistPayload(rowIndex.value < 0 ? '对象已新建' : '对象已编辑');
    } else if (dialogKind.value === 'row-delete') {
      const list = [...rows(rowKey.value)]; list.splice(rowIndex.value, 1); payload.value = { ...payload.value, [rowKey.value]: list };
      await persistPayload('对象已删除');
    }
    dialogKind.value = null;
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function saveDraft() {
  if (!selected.value || !editable.value || busy.value) return;
  busy.value = 'save';
  try { await persistPayload('完整草稿已保存'); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function lifecycle(action: ConfigurationLifecycleRequestWire['action']) {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || busy.value) return;
  busy.value = action;
  try {
    const reasons: Record<string, string> = { VALIDATE: '执行领域静态校验和安全门检查', SUBMIT: '提交独立审批并固定当前候选版本', APPROVE: '独立审批人核对差异与仿真证据', PUBLISH: '发布为运行时当前生效业务配置', ROLLBACK: '运行异常回退到上一有效配置版本' };
    const result = await transitionConfiguration(lease, selected.value.config_id, { action, expected_version: selected.value.row_version, reason: reasons[action] ?? '业务配置生命周期状态变更操作' });
    await itemsQuery.refetch(); selectItem(result); notice.value = action === 'PUBLISH' ? '配置已发布，运行时流程立即读取此有效版本。' : `当前状态：${statusLabel(result.status)}`; tab.value = action === 'VALIDATE' ? 'validate' : 'versions';
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

const validation = computed(() => {
  const errors: string[] = [], warnings: string[] = [];
  if (props.mode === 'workflow') {
    const nodes = rows('nodes'), ids = nodes.map(node => String(node.id));
    if (new Set(ids).size !== ids.length) errors.push('节点 ID 重复。');
    if (!nodes.some(node => node.type === 'START')) errors.push('缺少起始节点。');
    if (!nodes.some(node => node.terminal || node.type === 'END')) errors.push('流程没有终态。');
    rows('edges').forEach(edge => { if (!ids.includes(String(edge.from)) || !ids.includes(String(edge.to))) errors.push(`连线 ${edge.from} → ${edge.to} 引用不存在节点。`); });
    nodes.filter(node => node.type !== 'START' && !node.owner).forEach(node => errors.push(`${node.name} 缺少责任角色。`));
    if (!nodes.some(node => node.protected && node.type === 'SIGN')) errors.push('缺少受保护签署节点。');
  } else if (props.mode === 'form') {
    const fields = rows('fields'), ids = fields.map(field => String(field.id));
    if (new Set(ids).size !== ids.length) errors.push('字段 ID 重复。');
    fields.filter(field => !field.label || !field.group).forEach(field => errors.push(`${field.id || '字段'} 缺少名称或分组。`));
    fields.filter(field => field.type === 'CALCULATED' && !field.calculation).forEach(field => errors.push(`${field.label} 缺少计算表达式。`));
    warnings.push('已发布或被病历引用的受保护字段只能停用，不能删除。');
  } else if (props.mode === 'rule') {
    rows('rules').filter(rule => String(rule.layer).includes('HARD') && !rule.evidence).forEach(rule => errors.push(`${rule.name} 是硬规则但缺少证据。`));
    rows('rules').filter(rule => rule.layer === 'AI_ADVICE' && String(rule.action).includes('阻断')).forEach(rule => errors.push(`${rule.name}：AI 建议不能直接阻断。`));
    warnings.push('平台硬门优先级最高，机构规则不得降级。');
  } else {
    rows('permissions').filter(permission => permission.effect === 'ALLOW' && permission.scope === '全部患者' && !permission.temporary_hours).forEach(permission => errors.push(`${permission.role} 的 ${permission.action} 是无范围高权限。`));
    rows('permissions').filter(permission => Number(permission.temporary_hours) > 24).forEach(permission => errors.push(`${permission.role} 临时授权超过 24 小时。`));
    warnings.push('职责分离与保护性 DENY 不能被临时授权绕过。');
  }
  return { errors, warnings };
});
const simulation = computed(() => {
  const source = props.mode === 'workflow' ? rows('nodes') : props.mode === 'form' ? rows('fields') : props.mode === 'rule' ? rows('rules') : rows('permissions');
  return source.map((row, index) => ({ title: row.name ?? row.label ?? `${row.role} · ${row.resource}`, detail: row.condition ?? row.type ?? `${row.action} / ${row.scope}`, result: props.mode === 'rule' && index === 0 ? '命中 · 阻断' : row.effect ?? (row.terminal ? '到达终态' : '通过') }));
});
const runtimeImpact = computed(() => {
  if (!selected.value) return '请选择一项配置。';
  const prefix = selected.value.status === 'ACTIVE' ? '运行时已生效' : '候选版本尚未影响运行时';
  if (props.mode === 'workflow') return `${prefix}：${rows('nodes').length} 个节点、${rows('edges').length} 条迁移和超时升级策略。`;
  if (props.mode === 'form') return `${prefix}：${rows('fields').filter(field => field.required).length} 个必填字段及签署/术语约束。`;
  if (props.mode === 'rule') return `${prefix}：${rows('rules').filter(rule => rule.enabled).length} 条启用规则按优先级执行。`;
  return `${prefix}：${rows('permissions').length} 条职责范围参与最终授权判定。`;
});
const statusLabel = (status: string) => ({ DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已批准', ACTIVE: '已发布', ARCHIVED: '已归档' } as Record<string, string>)[status] ?? status;
const rowLabel = (row: Row) => row.name ?? row.label ?? row.id ?? `${row.role} · ${row.resource}`;
const dialogTitle = computed(() => dialogKind.value === 'config-create' ? `新建${definition.value.title}` : dialogKind.value === 'config-edit' ? '编辑配置基本信息' : dialogKind.value === 'config-delete' ? '删除并归档配置' : dialogKind.value === 'row-delete' ? `删除${rowLabel(rowDraft.value)}` : rowIndex.value < 0 ? '新建业务对象' : `编辑${rowLabel(rowDraft.value)}`);
</script>

<template>
  <section data-page-root class="content vue-native-page bc-page">
    <div class="page-head"><div class="page-title"><p class="eyebrow">{{ definition.eyebrow }}</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div><div class="head-actions"><button class="btn" @click="tab='versions'">版本与继承</button><button class="btn" :disabled="!selected||Boolean(busy)" @click="lifecycle('VALIDATE')">静态校验</button><button class="btn primary" @click="openConfigCreate">新建配置</button></div></div>
    <div v-if="notice" class="bc-notice">{{ notice }}</div><div v-if="issue" class="bc-state error">{{ issue.code }}：{{ issue.message }}</div>
    <div class="runtime-impact" :class="{ active:selected?.status==='ACTIVE' }"><b>{{ selected?.status==='ACTIVE'?'当前运行时版本':'运行时影响' }}</b><span>{{ runtimeImpact }}</span></div>
    <div class="bc-shell"><aside class="ledger"><header><div><b>配置台账</b><small>{{ definition.type }} · {{ items.length }} 项</small></div><button title="新建配置" @click="openConfigCreate">＋</button></header><button v-for="item in items" :key="item.config_id" class="ledger-item" :class="{active:selected?.config_id===item.config_id}" @click="selectItem(item)"><b>{{ item.display_name }}</b><code>{{ item.config_key }}</code><span>{{ statusLabel(item.status) }} · v{{ item.row_version }}</span></button><div v-if="!items.length&&!itemsQuery.isPending.value" class="ledger-empty"><b>暂无配置</b><span>通过“新建配置”载入真实业务流程模板。</span></div><div v-if="leaseQuery.isPending.value||itemsQuery.isPending.value" class="ledger-loading">正在同步数据库版本…</div><div class="safety"><b>发布安全门</b><p>静态校验、仿真、职责分离、审计和回退证据缺一不可。</p></div></aside>
      <main v-if="selected" class="designer"><div class="meta"><div><span>配置名称</span><b>{{ selected.display_name }}</b></div><div><span>唯一键</span><code>{{ selected.config_key }}</code></div><em>Schema v{{ payload.schema_version??1 }}</em><div class="meta-actions"><button class="task-action" :disabled="!editable" @click="openConfigEdit">编辑</button><button class="task-action danger" @click="openConfigDelete">删除</button></div></div><nav><button :class="{active:tab==='design'}" @click="tab='design'">设计</button><button :class="{active:tab==='validate'}" @click="tab='validate'">校验 <i v-if="validation.errors.length">{{ validation.errors.length }}</i></button><button :class="{active:tab==='simulate'}" @click="tab='simulate'">合成仿真</button><button :class="{active:tab==='versions'}" @click="tab='versions'">版本</button></nav>
        <div v-if="tab==='design'" class="stage">
          <template v-if="mode==='workflow'"><aside class="tools"><b>节点组件</b><button @click="openRowCreate('nodes','TASK')">＋ 人工任务</button><button @click="openRowCreate('nodes','BRANCH')">◇ 条件分支</button><button @click="openRowCreate('nodes','COMPENSATION')">↺ 补偿节点</button><button @click="openRowCreate('edges')">＋ 状态迁移</button><small>所有新增、编辑和删除均通过弹窗完成。</small></aside><section class="canvas"><div class="canvas-head"><b>可视化流程画布</b><button @click="tab='simulate'">逐步模拟</button></div><div class="flow"><article v-for="(node,index) in rows('nodes')" :key="node.id" :class="{protected:node.protected,terminal:node.terminal}"><small>{{ node.type }}</small><b>{{ node.name }}</b><span>{{ node.owner }}</span><em>{{ node.minutes }} 分钟</em><footer><button @click="openRowEdit('nodes',index)">编辑</button><button :disabled="node.protected" @click="openRowDelete('nodes',index)">删除</button></footer></article></div><div class="edges"><div class="section-title"><b>状态迁移</b><button @click="openRowCreate('edges')">新增迁移</button></div><article v-for="(edge,index) in rows('edges')" :key="`${edge.from}-${edge.to}-${index}`"><p><code>{{ edge.from }}</code><span>到</span><code>{{ edge.to }}</code><em>{{ edge.condition }}</em><i v-if="edge.compensation">退回 / 补偿</i></p><footer><button @click="openRowEdit('edges',index)">编辑</button><button @click="openRowDelete('edges',index)">删除</button></footer></article></div></section></template>
          <template v-else-if="mode==='form'"><aside class="tools"><b>模板组件</b><button @click="openRowCreate('fields')">＋ 新建字段</button><button @click="openRowCreate('groups')">▦ 新建分组</button><small>字段、分组及删除确认均采用弹窗。</small></aside><section class="canvas"><div class="canvas-head"><b>A4 表单画布</b><button @click="tab='simulate'">样例填充</button></div><div class="form-groups"><article v-for="(group,groupIndex) in rows('groups')" :key="group.id"><header><div><b>{{ group.name }}</b><span>{{ group.columns }} 列</span></div><div><button @click="openRowEdit('groups',groupIndex)">编辑分组</button><button @click="openRowDelete('groups',groupIndex)">删除</button></div></header><div class="field-grid"><section v-for="field in rows('fields').filter(item=>item.group===group.id)" :key="field.id"><b>{{ field.label }} <i v-if="field.required">*</i></b><span>{{ field.type }}</span><em>{{ field.terminology }}</em><footer><button @click="openRowEdit('fields',rows('fields').indexOf(field))">编辑</button><button :disabled="field.protected" @click="openRowDelete('fields',rows('fields').indexOf(field))">删除</button></footer></section></div></article></div></section></template>
          <template v-else-if="mode==='rule'"><aside class="tools"><b>规则分层</b><button @click="openRowCreate('rules')">＋ 新建规则</button><span>平台硬门</span><span>机构规则</span><span>提醒</span><span>AI 建议</span><small>硬门优先，AI 建议不能直接产生临床副作用。</small></aside><section class="canvas"><div class="canvas-head"><b>规则优先级与命中路径</b><button @click="tab='simulate'">合成病例回放</button></div><div class="rule-list"><article v-for="(rule,index) in rows('rules')" :key="rule.id"><header><span>{{ rule.layer }}</span><b>{{ rule.priority }}</b></header><h3>{{ rule.name }}</h3><p><b>条件</b>{{ rule.condition }}</p><p><b>动作</b>{{ rule.action }}</p><p><b>证据</b>{{ rule.evidence }}</p><footer><em>{{ rule.enabled?'启用':'停用' }}</em><div><button @click="openRowEdit('rules',index)">编辑</button><button :disabled="rule.protected" @click="openRowDelete('rules',index)">删除</button></div></footer></article></div></section></template>
          <template v-else><aside class="tools"><b>授权模型</b><button @click="openRowCreate('permissions')">＋ 新建职责范围</button><span>组织与科室</span><span>患者关系</span><span>班次与临时授权</span><small>保护性拒绝优先，授权最长 24 小时。</small></aside><section class="canvas"><div class="canvas-head"><b>最终权限矩阵</b><button @click="tab='simulate'">模拟身份</button></div><div class="scope-table"><article v-for="(permission,index) in rows('permissions')" :key="`${permission.role}-${permission.resource}-${index}`"><div><b>{{ permission.role }}</b><span>{{ permission.resource }}</span></div><p>{{ permission.action }}</p><p>{{ permission.scope }}</p><em :class="permission.effect.toLowerCase()">{{ permission.effect }}</em><small>{{ permission.temporary_hours?`${permission.temporary_hours} 小时临时授权`:'长期职责' }}</small><footer><button @click="openRowEdit('permissions',index)">编辑</button><button @click="openRowDelete('permissions',index)">删除</button></footer></article></div></section></template>
        </div>
        <section v-else-if="tab==='validate'" class="result-panel"><header><div><p class="eyebrow">静态分析</p><h2>{{ validation.errors.length?'发现阻断项':'本地领域校验通过' }}</h2></div><button class="btn" :disabled="Boolean(busy)" @click="lifecycle('VALIDATE')">写入校验证据</button></header><ul v-if="validation.errors.length" class="errors"><li v-for="error in validation.errors" :key="error">{{ error }}</li></ul><ul class="warnings"><li v-for="warning in validation.warnings" :key="warning">{{ warning }}</li></ul></section>
        <section v-else-if="tab==='simulate'" class="result-panel"><header><div><p class="eyebrow">确定性合成数据</p><h2>流程影响回放</h2></div><span>{{ selected.status==='ACTIVE'?'读取当前生效版本':'候选草稿预演' }}</span></header><div class="simulation"><article v-for="(step,index) in simulation" :key="`${step.title}-${index}`"><span>{{ String(index+1).padStart(2,'0') }}</span><div><b>{{ step.title }}</b><p>{{ step.detail }}</p></div><em>{{ step.result }}</em></article></div></section>
        <section v-else class="result-panel"><header><div><p class="eyebrow">生命周期与运行时</p><h2>v{{ selected.row_version }} · {{ statusLabel(selected.status) }}</h2></div><span>{{ selected.updated_at?new Date(selected.updated_at).toLocaleString('zh-CN',{hour12:false}):'' }}</span></header><p class="version-note">保存形成不可变修订；发布后运行时只读取 ACTIVE 版本；归档后立即退出生效集合，历史业务继续绑定原版本。</p><div class="lifecycle-actions"><button v-if="selected.status==='DRAFT'" class="btn" :disabled="Boolean(busy)" @click="saveDraft">保存草稿</button><button v-if="selected.status==='DRAFT'&&selected.validation_state==='VALID'" class="btn primary" :disabled="Boolean(busy)" @click="lifecycle('SUBMIT')">提交审批</button><button v-if="selected.status==='PENDING_APPROVAL'" class="btn primary" :disabled="Boolean(busy)" @click="lifecycle('APPROVE')">独立审批</button><button v-if="selected.status==='APPROVED'" class="btn primary" :disabled="Boolean(busy)" @click="lifecycle('PUBLISH')">发布并影响流程</button><button v-if="selected.status==='ACTIVE'" class="btn" :disabled="Boolean(busy)" @click="lifecycle('ROLLBACK')">回退上一版本</button><button class="btn danger" :disabled="Boolean(busy)" @click="openConfigDelete">删除 / 归档</button></div></section>
      </main><main v-else class="designer-empty"><b>暂无可用配置</b><p>新建后会直接写入数据库草稿，并可继续校验、审批、发布和运行时生效。</p><button class="btn primary" @click="openConfigCreate">新建第一项配置</button></main></div>

    <BusinessActionDialog :open="Boolean(dialogKind)" :title="dialogTitle" :description="dialogKind==='config-delete'||dialogKind==='row-delete'?'删除操作会保留审计与版本证据，并从当前工作流中移除。':'所有字段在确认后一次性写入，取消不会修改当前配置。'" :confirm-label="dialogKind==='config-delete'||dialogKind==='row-delete'?'确认删除':'确认保存'" :danger="dialogKind==='config-delete'||dialogKind==='row-delete'" :busy="busy==='dialog'" width="wide" @cancel="dialogKind=null" @confirm="confirmDialog">
      <template v-if="dialogKind==='config-create'||dialogKind==='config-edit'"><div class="dialog-grid"><label>配置名称<input v-model="configDraft.name" required maxlength="120" autofocus /></label><label>唯一键<input v-model="configDraft.key" required maxlength="120" :disabled="dialogKind==='config-edit'" /></label></div><label>业务说明<textarea v-model="configDraft.description" required rows="4" /></label></template>
      <p v-else-if="dialogKind==='config-delete'" class="dialog-warning">将删除“{{ selected?.display_name }}”的当前使用入口。配置状态会变为归档，已产生的病历、任务、审计及历史版本不会被物理删除。</p>
      <p v-else-if="dialogKind==='row-delete'" class="dialog-warning">确认从当前草稿删除“{{ rowLabel(rowDraft) }}”？确认后会立即生成新的数据库修订版本。</p>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='nodes'"><div class="dialog-grid"><label>节点 ID<input v-model="rowDraft.id" required /></label><label>节点类型<select v-model="rowDraft.type"><option>START</option><option>TASK</option><option>BRANCH</option><option>SIGN</option><option>AUDIT</option><option>END</option></select></label><label>节点名称<input v-model="rowDraft.name" required /></label><label>责任角色<input v-model="rowDraft.owner" required /></label><label>办理时限（分钟）<input v-model.number="rowDraft.minutes" type="number" min="1" /></label></div><label class="dialog-check"><input v-model="rowDraft.compensation" type="checkbox" />异常退回 / 补偿节点</label></template>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='edges'"><div class="dialog-grid"><label>来源节点<select v-model="rowDraft.from"><option v-for="node in rows('nodes')" :key="node.id" :value="node.id">{{ node.name }}（{{ node.id }}）</option></select></label><label>目标节点<select v-model="rowDraft.to"><option v-for="node in rows('nodes')" :key="node.id" :value="node.id">{{ node.name }}（{{ node.id }}）</option></select></label></div><label>迁移条件<input v-model="rowDraft.condition" required /></label><label class="dialog-check"><input v-model="rowDraft.compensation" type="checkbox" />这是退回或补偿路径</label></template>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='groups'"><div class="dialog-grid"><label>分组 ID<input v-model="rowDraft.id" required /></label><label>分组名称<input v-model="rowDraft.name" required /></label><label>布局列数<select v-model.number="rowDraft.columns"><option :value="1">1 列</option><option :value="2">2 列</option><option :value="3">3 列</option></select></label></div></template>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='fields'"><div class="dialog-grid"><label>字段 ID<input v-model="rowDraft.id" required /></label><label>显示名称<input v-model="rowDraft.label" required /></label><label>字段类型<select v-model="rowDraft.type"><option>TEXT</option><option>TEXTAREA</option><option>NUMBER</option><option>CODE</option><option>CALCULATED</option><option>SIGNATURE</option></select></label><label>所属分组<select v-model="rowDraft.group"><option v-for="group in rows('groups')" :key="group.id" :value="group.id">{{ group.name }}</option></select></label><label>术语系统<input v-model="rowDraft.terminology" placeholder="如 ICD-10-CN" /></label><label>计算 / 校验表达式<input v-model="rowDraft.calculation" /></label></div><label class="dialog-check"><input v-model="rowDraft.required" type="checkbox" />必填字段</label></template>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='rules'"><div class="dialog-grid"><label>规则 ID<input v-model="rowDraft.id" required /></label><label>规则名称<input v-model="rowDraft.name" required /></label><label>规则层级<select v-model="rowDraft.layer"><option>PLATFORM_HARD</option><option>INSTITUTION_HARD</option><option>REMINDER</option><option>AI_ADVICE</option></select></label><label>优先级<input v-model.number="rowDraft.priority" type="number" min="0" /></label></div><label>命中条件<textarea v-model="rowDraft.condition" required /></label><label>执行动作<textarea v-model="rowDraft.action" required /></label><div class="dialog-grid"><label>证据来源<input v-model="rowDraft.evidence" /></label><label>例外策略<input v-model="rowDraft.exception" /></label></div><label class="dialog-check"><input v-model="rowDraft.enabled" type="checkbox" />启用规则</label></template>
      <template v-else-if="dialogKind==='row-edit'&&rowKey==='permissions'"><div class="dialog-grid"><label>角色<input v-model="rowDraft.role" required /></label><label>资源<input v-model="rowDraft.resource" required /></label><label>动作<input v-model="rowDraft.action" required /></label><label>数据范围<input v-model="rowDraft.scope" required /></label><label>授权效果<select v-model="rowDraft.effect"><option>ALLOW</option><option>DENY</option></select></label><label>临时授权（小时）<input v-model.number="rowDraft.temporary_hours" type="number" min="0" max="24" /></label></div><label>职责分离约束<input v-model="rowDraft.sod" required /></label></template>
    </BusinessActionDialog>
  </section>
</template>

<style scoped>
.bc-page{color:#17283a}.page-head{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin-bottom:16px}.page-title h1{margin:2px 0 4px;font-size:23px}.page-title>p:last-child{margin:0;color:#647488;font-size:12px}.eyebrow{margin:0;color:#2673ad;font-size:10px;font-weight:700}.head-actions,.meta-actions,.lifecycle-actions{display:flex;flex-wrap:wrap;gap:10px}.bc-notice,.bc-state,.runtime-impact{margin-bottom:14px;padding:12px 14px;border:1px solid #bbd9ec;border-radius:8px;background:#eef7fd;color:#19567e;font-size:12px}.runtime-impact{display:flex;gap:12px;align-items:center;border-color:#d9e2e9;background:#f8fafb;color:#536477}.runtime-impact.active{border-color:#afd9bf;background:#edf9f2;color:#236a42}.runtime-impact b{white-space:nowrap}.bc-shell{display:grid;grid-template-columns:245px minmax(0,1fr);min-height:680px;border:1px solid #d9e2e9;border-radius:11px;overflow:hidden;background:#fff}.ledger{display:flex;flex-direction:column;gap:9px;padding:14px;border-right:1px solid #d9e2e9;background:#f7f9fb}.ledger header{display:flex;justify-content:space-between;gap:10px}.ledger header>div{display:grid;gap:3px}.ledger header small,.ledger-empty span{color:#687789;font-size:10px}.ledger header>button{width:34px;height:34px;border:1px solid #cbd8e1;border-radius:8px;background:#fff;color:#1769aa;font-size:20px}.ledger-item{display:grid;gap:5px;padding:12px;border:1px solid transparent;border-radius:8px;background:transparent;text-align:left;color:inherit}.ledger-item.active{border-color:#9fc6df;background:#fff}.ledger-item code{color:#627287;font-size:10px}.ledger-item span{font-size:10px;color:#50718a}.ledger-empty{display:grid;gap:6px;padding:18px 12px;text-align:center}.ledger-loading{padding:12px;color:#647488;font-size:11px}.safety{margin-top:auto;padding-top:14px;border-top:1px solid #dce5eb}.safety p{margin:6px 0 0;color:#657487;font-size:10px;line-height:1.6}.designer{min-width:0}.designer-empty{display:grid;place-content:center;justify-items:center;gap:10px;padding:30px;text-align:center}.designer-empty p{max-width:480px;color:#657487;font-size:12px}.meta{display:grid;grid-template-columns:minmax(200px,1fr) minmax(200px,1fr) auto auto;gap:16px;align-items:end;padding:14px 16px;border-bottom:1px solid #dce5eb}.meta>div:not(.meta-actions){display:grid;gap:5px}.meta span{color:#657487;font-size:10px}.meta b,.meta code{font-size:12px}.meta>em{align-self:center;padding:5px 8px;border-radius:10px;background:#f0f4f7;color:#607083;font-size:9px;font-style:normal}.designer>nav{display:flex;gap:4px;padding:0 16px;border-bottom:1px solid #dce5eb}.designer>nav button{padding:12px 14px;border:0;border-bottom:2px solid transparent;background:transparent;color:#536477}.designer>nav button.active{border-color:#1769aa;color:#1769aa;font-weight:700}.designer>nav i{padding:1px 5px;border-radius:8px;background:#b63232;color:#fff;font-style:normal}.stage{display:grid;grid-template-columns:145px minmax(0,1fr);min-height:550px;background:#fbfcfd}.tools{display:flex;flex-direction:column;gap:10px;padding:14px;border-right:1px solid #dce5eb;background:#f7f9fb}.tools button,.tools>span{padding:10px;border:1px solid #d1dce4;border-radius:7px;background:#fff;text-align:left;color:#27394b}.tools small{margin-top:8px;color:#657487;font-size:10px;line-height:1.5}.canvas{min-width:0;padding:14px;background-image:radial-gradient(#dce5eb .7px,transparent .7px);background-size:13px 13px}.canvas-head,.section-title{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:12px;padding:11px 12px;border:1px solid #dce5eb;border-radius:8px;background:#fff}.canvas-head button,.section-title button,.flow footer button,.edges footer button,.form-groups button,.rule-list button,.scope-table button{border:0;background:transparent;color:#1769aa;font-size:10px;cursor:pointer}.flow{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:12px}.flow>article{display:grid;gap:5px;padding:12px;border:1px solid #cfdbe4;border-radius:8px;background:#fff;box-shadow:0 2px 5px rgba(34,58,78,.05)}.flow>article.protected{border-color:#dec788;background:#fffaf0}.flow>article.terminal{border-color:#acd5bc;background:#f2faf5}.flow small,.flow span,.flow em{font-size:9px;color:#667588}.flow em{font-style:normal}.flow footer,.edges footer,.field-grid footer,.rule-list footer,.scope-table footer{display:flex;justify-content:flex-end;gap:10px;margin-top:5px;padding-top:7px;border-top:1px solid #edf1f4}.edges{margin-top:16px;padding:12px;border:1px solid #dce5eb;border-radius:9px;background:#fff}.edges .section-title{margin:0 0 4px;padding:4px 0;border:0}.edges>article{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid #edf1f4}.edges p{display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin:0;font-size:10px}.edges em{color:#526477;font-style:normal}.edges i{color:#a15d24;font-style:normal}.form-groups{display:grid;gap:14px}.form-groups>article{padding:13px;border:1px solid #dce5eb;border-radius:9px;background:#fff}.form-groups>article>header{display:flex;justify-content:space-between;gap:14px;margin-bottom:11px}.form-groups header>div{display:flex;gap:10px;align-items:center}.form-groups header span{color:#657487;font-size:10px}.field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.field-grid>section{display:grid;gap:5px;padding:11px;border:1px solid #d8e2e9;border-radius:7px}.field-grid span,.field-grid em{font-size:9px;color:#657487}.field-grid em{font-style:normal}.field-grid i{color:#b63232}.rule-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.rule-list>article{padding:13px;border:1px solid #dce5eb;border-radius:9px;background:#fff}.rule-list header{display:flex;justify-content:space-between;color:#1769aa;font-size:10px}.rule-list h3{margin:9px 0;font-size:13px}.rule-list p{display:grid;grid-template-columns:40px 1fr;gap:8px;margin:6px 0;color:#657487;font-size:10px}.rule-list p b{color:#25384b}.rule-list footer{justify-content:space-between}.rule-list footer em{font-size:10px;color:#28764a;font-style:normal}.scope-table{display:grid;gap:9px}.scope-table>article{display:grid;grid-template-columns:1.2fr .7fr 1fr auto 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid #dce5eb;border-radius:8px;background:#fff}.scope-table>article>div{display:grid;gap:3px}.scope-table span,.scope-table p,.scope-table small{margin:0;color:#657487;font-size:10px}.scope-table em{padding:4px 7px;border-radius:9px;font-size:9px;font-style:normal}.scope-table em.allow{background:#e8f7ef;color:#267249}.scope-table em.deny{background:#fdeaea;color:#a43131}.scope-table footer{margin:0;padding:0;border:0}.result-panel{display:grid;gap:16px;padding:20px}.result-panel>header{display:flex;justify-content:space-between;gap:16px;align-items:flex-start}.result-panel h2{margin:3px 0 0}.result-panel>header>span{color:#657487;font-size:11px}.result-panel ul{margin:0;padding:14px 14px 14px 32px;border-radius:8px;font-size:12px}.errors{background:#fff0f0;color:#972e2e}.warnings{background:#fff8e8;color:#795d1d}.simulation{display:grid;gap:9px}.simulation article{display:grid;grid-template-columns:34px 1fr auto;gap:12px;align-items:center;padding:12px;border:1px solid #dce5eb;border-radius:8px}.simulation article>span{color:#1769aa;font-weight:700}.simulation p{margin:4px 0 0;color:#657487;font-size:10px}.simulation em{color:#28764a;font-size:10px;font-style:normal}.version-note{margin:0;padding:14px;border-radius:8px;background:#f2f6f8;color:#536477;font-size:12px;line-height:1.6}.task-action{padding:6px 9px;border:1px solid #cbd8e1;border-radius:6px;background:#fff;color:#1769aa}.task-action.danger,.btn.danger{color:#a43131}.task-action:disabled{opacity:.45}.btn{padding:9px 13px;border:1px solid #cbd8e1;border-radius:7px;background:#fff;color:#294052}.btn.primary{border-color:#1769aa;background:#1769aa;color:#fff}
@media(max-width:1050px){.meta{grid-template-columns:1fr 1fr}.scope-table>article{grid-template-columns:1fr 1fr 1fr}.stage{grid-template-columns:130px minmax(0,1fr)}}
@media(max-width:760px){.page-head{display:grid}.bc-shell{grid-template-columns:1fr}.ledger{max-height:260px;border-right:0;border-bottom:1px solid #d9e2e9}.stage{grid-template-columns:1fr}.tools{border-right:0;border-bottom:1px solid #dce5eb}.field-grid,.rule-list{grid-template-columns:1fr}.meta{grid-template-columns:1fr}.scope-table>article{grid-template-columns:1fr 1fr}}
</style>
