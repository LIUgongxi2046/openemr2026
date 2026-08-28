<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import type { ConfigurationItemWire, ConfigurationLifecycleRequestWire, MockInterfaceWire, MockInvocationResultWire } from '../../generated/contracts';
import { defineConfiguration, issueConfigurationLease, listConfigurations, transitionConfiguration, updateConfiguration } from '../../api/config';
import { invokeMockInterface, issueMockLease, listMockInterfaces } from '../../api/mock';
import { clinicalContext } from '../../clinical-api';
import type { SimulationWorkbenchDefinition } from '../simulation-workbenches';
import AdminActionDialog from './AdminActionDialog.vue';
import AdminConfirmDialog from './AdminConfirmDialog.vue';
import ClinicalPageState from './ClinicalPageState.vue';
import ExecutionPatientContextBar from './ExecutionPatientContextBar.vue';
import { toClinicalIssue } from '../clinical-error';

const props = defineProps<{ definition: SimulationWorkbenchDefinition }>();
const scenario = ref<'SUCCESS' | 'DEGRADED' | 'UNAVAILABLE'>('SUCCESS');
const entityValue = ref(props.definition.defaultEntity);
const selectedCode = ref('');
const selectedProfileId = ref('');
const busy = ref('');
const result = ref<MockInvocationResultWire | null>(null);
const notice = ref('');
const failure = ref<{ code: string; message: string } | null>(null);
const autoStarted = ref(false);
const editorOpen = ref(false);
const deleteOpen = ref(false);
const editing = ref<ConfigurationItemWire | null>(null);
const source = ref<ConfigurationItemWire | null>(null);
const form = reactive({
  key: '', name: '', description: '', interfaceCode: '', defaultEntity: '',
  defaultScenario: 'SUCCESS' as 'SUCCESS' | 'DEGRADED' | 'UNAVAILABLE',
  ownerDepartment: '', operatingWindow: '', timeoutMs: '5000', retryLimit: '3', recordCount: '36', manualFallback: '',
});

const leaseQuery = useQuery({ queryKey: ['mock', 'lease'], queryFn: issueMockLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const interfacesQuery = useQuery({ queryKey: ['mock', 'interfaces'], queryFn: () => listMockInterfaces(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const configLeaseQuery = useQuery({ queryKey: ['mock-profile', 'lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const profilesQuery = useQuery({ queryKey: ['mock-profile', 'items'], queryFn: () => listConfigurations(configLeaseQuery.data.value!, 'MOCK_INTERFACE_PROFILE'), enabled: () => Boolean(configLeaseQuery.data.value), retry: false });
const issue = computed(() => {
  const error = leaseQuery.error.value ?? interfacesQuery.error.value ?? configLeaseQuery.error.value ?? profilesQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});
const interfaces = computed(() => (interfacesQuery.data.value ?? []).filter((item) => item.system_type.startsWith(props.definition.systemType)));
const selected = computed<MockInterfaceWire | null>(() => interfaces.value.find((item) => item.code === selectedCode.value) ?? interfaces.value[0] ?? null);
const profiles = computed(() => (profilesQuery.data.value ?? []).filter((item) => item.payload?.workbench_id === props.definition.id));
const activeProfiles = computed(() => profiles.value.filter((item) => item.status === 'ACTIVE'));
const draftProfiles = computed(() => profiles.value.filter((item) => item.status === 'DRAFT'));
const selectedProfile = computed(() => activeProfiles.value.find((item) => item.config_id === selectedProfileId.value) ?? activeProfiles.value[0] ?? null);
const visibleResultFocus = computed(() => ['data_profile', ...props.definition.resultFocus].filter((key, index, keys) => keys.indexOf(key) === index).filter((key) =>
  result.value && Object.prototype.hasOwnProperty.call(result.value.payload, key)));
const batchRecordCount = computed(() => Number((result.value?.payload?.data_profile as Record<string, unknown> | undefined)?.record_count ?? 0));

watch(() => props.definition.id, () => {
  entityValue.value = props.definition.defaultEntity; selectedCode.value = ''; selectedProfileId.value = '';
  result.value = null; failure.value = null; notice.value = ''; autoStarted.value = false;
}, { immediate: true });
watch(interfaces, (items) => {
  if (!items.some((item) => item.code === selectedCode.value) && items[0]) selectedCode.value = props.definition.interfaceCode ?? items[0].code;
}, { immediate: true });
watch(activeProfiles, (items) => {
  if (!items.some((item) => item.config_id === selectedProfileId.value)) selectedProfileId.value = items[0]?.config_id ?? '';
}, { immediate: true });
watch(selectedProfile, (profile) => {
  if (!profile) return;
  const code = String(profile.payload?.interface_code ?? '');
  if (interfaces.value.some((item) => item.code === code)) selectedCode.value = code;
  entityValue.value = String(profile.payload?.default_entity ?? props.definition.defaultEntity);
  const configured = String(profile.payload?.default_scenario ?? 'SUCCESS');
  scenario.value = configured === 'DEGRADED' || configured === 'UNAVAILABLE' ? configured : 'SUCCESS';
}, { immediate: true });
watch([selected, () => leaseQuery.data.value, selectedProfile], ([item, lease, profile]) => {
  if (!item || !lease || !profile || autoStarted.value) return;
  autoStarted.value = true; void runScenario();
}, { immediate: true });

async function runScenario() {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || !selectedProfile.value || busy.value) return;
  busy.value = 'run'; result.value = null; failure.value = null; notice.value = '';
  try {
    result.value = await invokeMockInterface(lease, selected.value.code, {
      simulation_scenario: scenario.value, profile_key: selectedProfile.value.config_key,
      record_count: Number(selectedProfile.value.payload?.default_record_count ?? 36),
      [props.definition.entityKey]: entityValue.value.trim(), patient_id: clinicalContext.patientId, encounter_id: clinicalContext.encounterId,
    });
    notice.value = scenario.value === 'DEGRADED'
      ? '降级结果已返回；流程停在人工复核，不允许自动进入临床事实。'
      : `场景执行完成，已使用生产启用配置“${selectedProfile.value.display_name}”。`;
  } catch (error) {
    const next = toClinicalIssue(error); failure.value = next;
    notice.value = next.code === 'MOCK_DEPENDENCY_UNAVAILABLE'
      ? '外部依赖不可用已被明确呈现；请走人工降级路径。'
      : `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
function valueFor(key: string) { return result.value?.payload[key]; }

function resetForm(item?: ConfigurationItemWire | null) {
  form.interfaceCode = String(item?.payload?.interface_code ?? selected.value?.code ?? interfaces.value[0]?.code ?? '');
  form.defaultEntity = String(item?.payload?.default_entity ?? props.definition.defaultEntity);
  const configured = String(item?.payload?.default_scenario ?? 'SUCCESS');
  form.defaultScenario = configured === 'DEGRADED' || configured === 'UNAVAILABLE' ? configured : 'SUCCESS';
  form.ownerDepartment = String(item?.payload?.owner_department ?? '信息中心集成平台组');
  form.operatingWindow = String(item?.payload?.operating_window ?? '7×24 小时；变更窗口每周三 22:00–23:30');
  form.timeoutMs = String(item?.payload?.timeout_ms ?? '5000');
  form.retryLimit = String(item?.payload?.retry_limit ?? '3');
  form.recordCount = String(item?.payload?.default_record_count ?? '36');
  form.manualFallback = String(item?.payload?.manual_fallback ?? props.definition.safeguards[0] ?? '转人工队列');
}
function openCreate() {
  editing.value = null; source.value = null; form.key = `${props.definition.id}-`; form.name = '';
  form.description = `江城大学附属医院${props.definition.title}仿真配置`; resetForm(); editorOpen.value = true;
}
function openEdit(item: ConfigurationItemWire) {
  source.value = item; editing.value = item.status === 'DRAFT' ? item : null;
  form.key = item.status === 'DRAFT' ? item.config_key : `${item.config_key}-v${item.row_version + 1}`;
  form.name = item.status === 'DRAFT' ? item.display_name : `${item.display_name} 变更版`;
  form.description = String(item.payload?.description ?? ''); resetForm(item); editorOpen.value = true;
}
function requestDelete(item: ConfigurationItemWire) { source.value = item; deleteOpen.value = true; }
function payload() {
  return {
    schema_version: 1, workbench_id: props.definition.id, interface_code: form.interfaceCode,
    hospital_level: '三级甲等', organization: '江城大学附属医院', facility: '本部院区',
    description: form.description.trim(), default_entity: form.defaultEntity.trim(), default_scenario: form.defaultScenario,
    owner_department: form.ownerDepartment.trim(), operating_window: form.operatingWindow.trim(),
    timeout_ms: Number(form.timeoutMs), retry_limit: Number(form.retryLimit), manual_fallback: form.manualFallback.trim(),
    generation_method: 'DETERMINISTIC_SEEDED', generator_version: 'tertiary-business-v2',
    default_record_count: Number(form.recordCount), record_count_range: [12, 200], contains_real_phi: false,
    documentation_version: 'v1.0 / 2026-08-28',
  };
}
async function save() {
  const lease = configLeaseQuery.data.value;
  if (!lease || busy.value || !form.key.trim() || !form.name.trim()) return;
  busy.value = 'save'; notice.value = '';
  try {
    if (editing.value) {
      await updateConfiguration(lease, editing.value.config_id, { display_name: form.name.trim(), payload: payload(), expected_version: editing.value.row_version });
      notice.value = '配置草稿已更新；重新发布前不影响正在运行的流程。';
    } else {
      await defineConfiguration(lease, { config_type: 'MOCK_INTERFACE_PROFILE', config_key: form.key.trim(), display_name: form.name.trim(), payload: payload() });
      notice.value = source.value ? '已从生产配置创建可编辑的变更版草稿。' : '仿真配置草稿已创建并写入审计链。';
    }
    editorOpen.value = false; await profilesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function lifecycle(item: ConfigurationItemWire, action: ConfigurationLifecycleRequestWire['action']) {
  const lease = configLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = item.config_id; notice.value = '';
  try {
    await transitionConfiguration(lease, item.config_id, { action, expected_version: item.row_version, reason: `模拟接口${props.definition.title}配置变更并保留审计证据` });
    notice.value = `${item.display_name}已完成${actionLabels[action]}；${action === 'ARCHIVE' ? '新调用已停止使用该配置。' : '可继续下一个治理步骤。'}`;
    await profilesQuery.refetch(); if (action === 'ARCHIVE') { result.value = null; autoStarted.value = false; }
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function deleteProfile() { if (source.value) await lifecycle(source.value, 'ARCHIVE'); deleteOpen.value = false; }
const actionLabels: Record<ConfigurationLifecycleRequestWire['action'], string> = { VALIDATE: '校验', SUBMIT: '提交审批', APPROVE: '批准', PUBLISH: '发布', ROLLBACK: '回退', ARCHIVE: '删除' };
function nextAction(item: ConfigurationItemWire): ConfigurationLifecycleRequestWire['action'] | null {
  if (item.status === 'DRAFT' && item.validation_state !== 'VALID') return 'VALIDATE';
  if (item.status === 'DRAFT') return 'SUBMIT'; if (item.status === 'PENDING_APPROVAL') return 'APPROVE';
  if (item.status === 'APPROVED') return 'PUBLISH'; return null;
}
function stateLabel(item: ConfigurationItemWire) { return ({ ACTIVE: '生产启用', DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已批准' } as Record<string, string>)[item.status] ?? item.status; }
</script>

<template>
  <section data-page-root class="content vue-native-page simulation-workbench-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">模拟接口 / {{ definition.id }}</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/mock-interfaces">查看接口文档</RouterLink><button class="button primary" type="button" @click="openCreate">新建仿真配置</button></div></div>
    <ExecutionPatientContextBar />
    <div class="portal-safety"><b>三级医院业务仿真生成器</b><span>按配置生成跨院区、跨科室业务批次；不访问真实外部系统，不接收真实 PHI/凭据。</span><span class="status amber">待真实适配器</span></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value || configLeaseQuery.isPending.value || profilesQuery.isPending.value" kind="loading" message="正在加载模拟接口、文档与三级医院配置" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="profilesQuery.refetch()" />
    <template v-else>
      <section class="admin-metrics" aria-label="模拟接口配置统计"><article><span>配置版本</span><strong>{{ profiles.length }}</strong><small>当前子菜单</small></article><article><span>生产启用</span><strong>{{ activeProfiles.length }}</strong><small>直接控制场景调用</small></article><article><span>待发布草稿</span><strong>{{ draftProfiles.length }}</strong><small>不影响当前流量</small></article><article><span>医院基线</span><strong>三级甲等</strong><small>江城大学附属医院</small></article></section>
      <p v-if="notice" class="admin-notice" :class="{ danger: failure }" role="status">{{ notice }}</p>

      <section class="admin-panel profile-catalog"><header><div><h2>仿真配置与流程影响</h2><p>仅“生产启用”版本可进入运行流程；新建、编辑与删除均使用弹窗。</p></div><button class="btn primary" type="button" @click="openCreate">新建配置</button></header>
        <div v-if="profiles.length" class="profile-grid"><article v-for="profile in profiles" :key="profile.config_id" class="profile-card" :class="{ selected: profile.config_id === selectedProfile?.config_id }"><div><code>{{ profile.config_key }}</code><span class="status" :class="profile.status === 'ACTIVE' ? 'green' : profile.status === 'DRAFT' ? 'blue' : 'amber'">{{ stateLabel(profile) }}</span></div><h3>{{ profile.display_name }}</h3><p>{{ profile.payload?.description }}</p><dl><div><dt>责任科室</dt><dd>{{ profile.payload?.owner_department }}</dd></div><div><dt>默认场景</dt><dd>{{ profile.payload?.default_scenario }}</dd></div><div><dt>生成规模</dt><dd>{{ profile.payload?.default_record_count ?? 36 }} 条 / 批</dd></div><div><dt>超时 / 重试</dt><dd>{{ profile.payload?.timeout_ms }} ms / {{ profile.payload?.retry_limit }} 次</dd></div></dl><div class="profile-actions"><button v-if="profile.status === 'ACTIVE'" class="btn sm" type="button" @click="selectedProfileId = profile.config_id">用于当前流程</button><button class="btn sm" type="button" @click="openEdit(profile)">{{ profile.status === 'DRAFT' ? '编辑' : '创建变更版' }}</button><button v-if="nextAction(profile)" class="btn sm primary" type="button" :disabled="Boolean(busy)" @click="lifecycle(profile, nextAction(profile)!)">{{ actionLabels[nextAction(profile)!] }}</button><button class="btn sm danger" type="button" :disabled="Boolean(busy)" @click="requestDelete(profile)">删除</button></div></article></div>
        <div v-else class="admin-empty rich"><strong>暂无有效仿真配置</strong><p>请新建并按校验、审批、发布流程启用；无启用版本时场景严格阻断。</p><button class="button primary" @click="openCreate">新建三级医院仿真配置</button></div>
      </section>

      <section class="simulation-controls" aria-label="模拟场景参数"><label>生产启用配置<select v-model="selectedProfileId" :disabled="!activeProfiles.length"><option v-for="item in activeProfiles" :key="item.config_id" :value="item.config_id">{{ item.display_name }}</option></select></label><label>适配器<select v-model="selectedCode"><option v-for="item in interfaces" :key="item.code" :value="item.code">{{ item.display_name }}</option></select></label><label>{{ definition.entityLabel }}<input v-model="entityValue" autocomplete="off" /></label><label>运行场景<select v-model="scenario"><option value="SUCCESS">成功 · 完整响应</option><option value="DEGRADED">降级 · 部分响应</option><option value="UNAVAILABLE">不可用 · 503</option></select></label><button class="button primary run-button" type="button" :disabled="busy === 'run' || !selected || !selectedProfile" @click="runScenario">{{ busy === 'run' ? '执行中…' : '运行场景' }}</button></section>
      <div v-if="!activeProfiles.length" class="inline-notice error" role="status">没有生产启用的配置，调用流程已安全阻断。</div>
      <section class="simulation-stepper" aria-label="业务流程"><article v-for="(step,index) in definition.steps" :key="step" :class="{ complete: result, blocked: (failure && index > 0) || !activeProfiles.length }"><span>{{ index + 1 }}</span><strong>{{ step }}</strong><small>{{ !activeProfiles.length ? '配置未启用' : failure && index > 0 ? '依赖不可用，进入人工路径' : result ? '合成证据已生成' : '待执行' }}</small></article></section>
      <div class="simulation-layout">
        <section class="admin-panel"><header><div><h2>场景结果</h2><p>{{ selected?.standard_interface ?? '标准接口' }}</p></div><span v-if="result" class="admin-status" :class="result.scenario === 'DEGRADED' ? 'warning' : 'active'">{{ result.scenario }}</span></header><div v-if="failure" class="simulation-unavailable"><strong>{{ failure.code }}</strong><p>{{ failure.message }}</p><ol><li>保留当前输入和上下文</li><li>转人工工作队列</li><li>恢复后使用相同业务键幂等重放</li></ol></div><div v-else-if="!result" class="admin-empty rich"><strong>待生成确定性场景证据</strong><p>选择生产启用配置后执行。</p></div><template v-else><dl class="simulation-evidence"><div><dt>确定性键</dt><dd><code>{{ result.deterministic_key }}</code></dd></div><div><dt>请求 ID</dt><dd><code>{{ result.request_id }}</code></dd></div><div><dt>业务批次</dt><dd>{{ batchRecordCount }} 条</dd></div><div><dt>合成时间</dt><dd>{{ new Date(result.produced_at).toLocaleString('zh-CN', { hour12: false }) }}</dd></div></dl><div class="simulation-focus"><article v-for="key in visibleResultFocus" :key="key"><span>{{ key }}</span><pre>{{ JSON.stringify(valueFor(key), null, 2) }}</pre></article></div></template></section>
        <aside class="admin-panel api-documentation"><header><div><h2>接口文档与替换契约</h2><p>{{ selected?.display_name ?? '请选择适配器' }}</p></div></header><template v-if="selected"><dl class="api-facts"><div><dt>调用方式</dt><dd><code>POST /api/v1/mock-interfaces/{{ selected.code }}/invoke</code></dd></div><div><dt>业务标准</dt><dd>{{ selected.standard_interface }}</dd></div><div><dt>认证与幂等</dt><dd>Bearer 会话 + 机构/院区上下文 + Idempotency-Key</dd></div><div><dt>用途边界</dt><dd>{{ selected.description }}</dd></div></dl><details open><summary>请求 JSON Schema</summary><pre class="mock-payload">{{ JSON.stringify(selected.request_schema, null, 2) }}</pre></details><details><summary>响应 JSON Schema</summary><pre class="mock-payload">{{ JSON.stringify(selected.response_schema, null, 2) }}</pre></details><details><summary>错误码与恢复</summary><ul><li><code>422 MOCK_SCENARIO_INVALID</code>：修正参数</li><li><code>503 MOCK_DEPENDENCY_UNAVAILABLE</code>：转人工队列并幂等重放</li><li><code>404 MOCK_INTERFACE_UNKNOWN</code>：核对适配器编码</li></ul></details><section class="replacement-guide"><strong>替换真实适配器</strong><ol><li>实现同一请求/响应契约</li><li>使用 Secret 引用，不保存明文凭据</li><li>通过成功、降级、不可用和幂等测试</li><li>独立审批、分阶段发布并保留回退</li></ol><p>{{ selected.integration_doc }}</p></section><ul class="simulation-safeguards"><li v-for="item in definition.safeguards" :key="item">{{ item }}</li></ul></template></aside>
      </div>
    </template>

    <AdminActionDialog v-model:open="editorOpen" :title="editing ? '编辑仿真配置' : source ? '创建配置变更版' : '新建仿真配置'" description="配置以版本化草稿保存；通过校验、独立审批和发布后才影响新流程。" size="large" :busy="busy === 'save'"><form class="admin-form profile-dialog-form" @submit.prevent="save"><label><span>配置编码</span><input v-model="form.key" autofocus required maxlength="128" :disabled="Boolean(editing)" /></label><label><span>显示名称</span><input v-model="form.name" required maxlength="256" /></label><label class="full-span"><span>配置说明</span><textarea v-model="form.description" required /></label><label><span>标准适配器</span><select v-model="form.interfaceCode" required><option v-for="item in interfaces" :key="item.code" :value="item.code">{{ item.display_name }} · {{ item.standard_interface }}</option></select></label><label><span>默认{{ definition.entityLabel }}</span><input v-model="form.defaultEntity" required /></label><label><span>默认场景</span><select v-model="form.defaultScenario"><option value="SUCCESS">成功</option><option value="DEGRADED">降级</option><option value="UNAVAILABLE">不可用</option></select></label><label><span>每批业务记录数</span><input v-model="form.recordCount" type="number" min="12" max="200" required /></label><label><span>责任科室</span><input v-model="form.ownerDepartment" required /></label><label><span>服务时间 / 变更窗口</span><input v-model="form.operatingWindow" required /></label><label><span>超时（毫秒）</span><input v-model="form.timeoutMs" type="number" min="100" max="120000" required /></label><label><span>最大重试次数</span><input v-model="form.retryLimit" type="number" min="0" max="10" required /></label><label class="full-span"><span>人工降级与恢复路径</span><textarea v-model="form.manualFallback" required /></label></form><template #footer="{ close }"><button class="button secondary" type="button" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" type="button" :disabled="busy === 'save'" @click="save">{{ busy === 'save' ? '保存中…' : '保存草稿' }}</button></template></AdminActionDialog>
    <AdminConfirmDialog v-model:open="deleteOpen" :title="`删除${source?.display_name ?? '仿真配置'}`" description="删除后该版本立即从有效配置中移除；如果它是唯一启用版本，新调用将安全阻断。历史调用和审计证据保留。" confirm-label="确认删除" :busy="Boolean(busy)" @confirm="deleteProfile" />
  </section>
</template>

<style scoped>
.simulation-workbench-page {
  display: grid;
  gap: 18px;
  width: min(100%, 1280px);
  margin-inline: auto;
}

.simulation-workbench-page > * { min-width: 0; }
.simulation-workbench-page .page-heading,
.simulation-workbench-page .portal-safety,
.simulation-workbench-page .admin-notice { margin-bottom: 0; }
.simulation-workbench-page .page-heading { gap: 18px; }
.simulation-workbench-page .toolbar-actions { flex-wrap: wrap; gap: 10px; }
.simulation-workbench-page .admin-metrics {
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 12px;
  margin-bottom: 0;
}
.simulation-workbench-page .admin-metrics article { align-content: center; min-height: 88px; padding: 12px 14px; }
.profile-catalog > header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 18px;
  padding: 15px 16px;
}
.profile-catalog > header .btn { flex: 0 0 auto; }
.profile-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  padding: 16px;
}
.profile-card {
  display: grid;
  gap: 10px;
  min-width: 0;
  padding: 14px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
.profile-card.selected { border-color: #75a7e8; box-shadow: 0 0 0 2px #e7f1ff; }
.profile-card > div:first-child { display: flex; align-items: center; justify-content: space-between; gap: 12px; min-width: 0; }
.profile-card > div:first-child code { min-width: 0; overflow-wrap: anywhere; }
.profile-card > div:first-child .status { flex: 0 0 auto; }
.profile-card h3, .profile-card p { margin: 0; }
.profile-card p { min-height: 36px; color: #5e6f82; line-height: 1.5; }
.profile-card dl { display: grid; gap: 7px; margin: 0; }
.profile-card dl > div { display: flex; justify-content: space-between; gap: 14px; }
.profile-card dt { flex: 0 0 auto; color: var(--muted); }
.profile-card dd { min-width: 0; margin: 0; text-align: right; overflow-wrap: anywhere; }
.profile-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-top: auto;
  padding-top: 2px;
}
.profile-actions .btn { width: auto; min-width: 72px; }
.simulation-controls {
  display: grid;
  grid-template-columns: 1.2fr 1.1fr 1.2fr 1fr auto;
  gap: 14px;
  align-items: end;
  padding: 15px 16px;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: #fff;
}
.simulation-controls label { display: grid; gap: 8px; font-size: 12px; color: #667085; }
.simulation-controls input, .simulation-controls select {
  width: 100%;
  min-width: 0;
  padding: 10px 11px;
  border: 1px solid var(--line);
  border-radius: 8px;
  background: #fff;
}
.run-button { width: auto; min-width: 104px; min-height: 39px; }
.simulation-stepper { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; }
.simulation-stepper article {
  display: grid;
  grid-template-columns: 30px 1fr;
  gap: 4px 10px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: 10px;
  background: #fff;
}
.simulation-stepper article > span {
  grid-row: 1/3;
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border-radius: 50%;
  background: #eaf1fb;
  color: #245493;
  font-weight: 700;
}
.simulation-stepper small { color: #697586; }
.simulation-stepper .complete > span { background: #dcfce7; color: #166534; }
.simulation-stepper .blocked > span { background: #fee2e2; color: #991b1b; }
.simulation-layout { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(330px, .85fr); gap: 16px; align-items: start; }
.simulation-layout > .admin-panel + .admin-panel { margin-top: 0; }
.simulation-evidence { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 12px; padding: 16px; }
.simulation-evidence div { min-width: 0; }
.simulation-evidence dt, .api-facts dt { font-size: 11px; color: #697586; }
.simulation-evidence dd, .api-facts dd { margin: 6px 0; overflow-wrap: anywhere; }
.simulation-focus { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; padding: 0 16px 16px; }
.simulation-focus article { min-width: 0; padding: 12px; border: 1px solid var(--line); border-radius: 8px; background: #f8fafc; }
.simulation-focus span { font-size: 11px; color: #536273; }
.simulation-focus pre, .mock-payload { max-height: 240px; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font-size: 11px; }
.simulation-unavailable { margin: 16px; padding: 15px; border: 1px solid #fecaca; border-radius: 10px; background: #fff7f7; }
.simulation-unavailable strong { color: #b42318; }
.api-documentation { display: grid; align-content: start; }
.api-facts { display: grid; gap: 9px; margin: 0; padding: 16px; }
.api-facts > div { padding-bottom: 10px; border-bottom: 1px solid #edf1f5; }
.api-documentation details { margin: 0 16px 12px; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; }
.api-documentation summary { cursor: pointer; font-weight: 700; }
.api-documentation ul, .api-documentation ol { display: grid; gap: 9px; line-height: 1.55; }
.replacement-guide { margin: 4px 16px 14px; padding: 13px; border-radius: 9px; background: #f3f8ff; color: #42566d; }
.replacement-guide > p { margin-bottom: 0; }
.simulation-safeguards { display: grid; gap: 9px; margin: 0; padding: 0 34px 16px; }
.profile-catalog .admin-empty.rich { min-height: 190px; padding: 28px; }
.admin-notice.danger { border-color: #fecaca; background: #fff7f7; color: #b42318; }
.profile-dialog-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0; }
.full-span { grid-column: 1/-1; }

@media (max-width: 1200px) {
  .profile-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .simulation-controls { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .run-button { width: max-content; }
  .simulation-layout { grid-template-columns: 1fr; }
}

@media (max-width: 760px) {
  .simulation-workbench-page { gap: 14px; }
  .simulation-workbench-page .admin-metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .profile-grid,
  .simulation-controls,
  .simulation-evidence,
  .simulation-focus,
  .profile-dialog-form { grid-template-columns: 1fr; }
  .profile-grid, .simulation-controls { gap: 12px; padding: 14px; }
  .simulation-stepper { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .full-span { grid-column: auto; }
  .profile-catalog > header { align-items: stretch; flex-direction: column; gap: 14px; padding: 14px; }
  .profile-catalog > header .btn { align-self: flex-start; }
  .run-button { width: max-content; max-width: 100%; justify-self: start; }
}

@media (max-width: 360px) {
  .simulation-stepper { grid-template-columns: 1fr; }
}
</style>
