<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ConfigurationItemWire } from '../../generated/contracts';
import { defineConfiguration, issueConfigurationLease, listConfigurations, transitionConfiguration, updateConfiguration } from '../../api/config';
import type { QualityOperationModuleId } from '../quality-operations';
import { qualityOperation } from '../quality-operations';
import { toClinicalIssue } from '../clinical-error';
import AdminActionDialog from './AdminActionDialog.vue';
import AdminConfirmDialog from './AdminConfirmDialog.vue';
import ClinicalPageState from './ClinicalPageState.vue';

const props = withDefaults(defineProps<{ moduleId: QualityOperationModuleId; itemId?: string }>(), { itemId: '' });
const route = useRoute(); const router = useRouter();
const definition = computed(() => qualityOperation(props.moduleId));
const leaseQuery = useQuery({
  queryKey: ['quality-operations', props.moduleId, 'lease'],
  queryFn: issueConfigurationLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['quality-operations', props.moduleId],
  queryFn: () => listConfigurations(leaseQuery.data.value!, definition.value.configType),
  enabled: () => Boolean(leaseQuery.data.value), retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const visibleItems = computed(() => props.itemId
  ? items.value.filter((item) => item.config_id === props.itemId)
  : items.value);
const terminalStatuses = computed(() => new Set(definition.value.statuses.filter((item) => item.terminal).map((item) => item.value)));
const openItems = computed(() => items.value.filter((item) => !terminalStatuses.value.has(text(item, 'workflow_status'))));
const blockingItems = computed(() => openItems.value.filter((item) => text(item, 'severity') === 'BLOCKING'));
const overdueItems = computed(() => openItems.value.filter((item) => {
  const dueAt = text(item, 'due_at', '');
  return dueAt ? new Date(dueAt).getTime() < Date.now() : false;
}));
const closedRate = computed(() => items.value.length
  ? Math.round(((items.value.length - openItems.value.length) / items.value.length) * 1000) / 10 : 0);

const editorOpen = ref(false);
const deleteOpen = ref(false);
const editing = ref<ConfigurationItemWire | null>(null);
const deleting = ref<ConfigurationItemWire | null>(null);
const busy = ref('');
const notice = ref('');
const form = reactive({
  key: '', name: '', owner: '', scope: '', severity: 'WARNING', workflowStatus: '',
  dueAt: '', score: 80, description: '', flowImpact: '',
});

function text(item: ConfigurationItemWire, key: string, fallback = '—') {
  const value = (item.payload as Record<string, unknown> | undefined)?.[key];
  return value == null || value === '' ? fallback : String(value);
}
function number(item: ConfigurationItemWire, key: string) {
  const value = Number((item.payload as Record<string, unknown> | undefined)?.[key]);
  return Number.isFinite(value) ? value : 0;
}
function statusLabel(value: string) {
  return definition.value.statuses.find((item) => item.value === value)?.label ?? value;
}
function statusTone(value: string) {
  if (terminalStatuses.value.has(value)) return 'active';
  if (value === 'BLOCKED' || value === 'GAP' || value === 'REPORTED' || value === 'REVOKED') return 'danger';
  return 'warning';
}
function dueDisplay(value: string) {
  if (!value || value === '—') return '未设置';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}
function toLocalInput(value: string) {
  if (!value || value === '—') return '';
  const date = new Date(value); const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function defaultDueAt() {
  const date = new Date(Date.now() + 7 * 24 * 60 * 60_000); const offset = date.getTimezoneOffset() * 60_000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}
function resetForm(item?: ConfigurationItemWire | null) {
  editing.value = item ?? null;
  form.key = item?.config_key ?? `${definition.value.codePrefix}-${new Date().toISOString().replace(/\D/g, '').slice(2, 12)}`;
  form.name = item?.display_name ?? '';
  form.owner = item ? text(item, 'owner', '') : '';
  form.scope = item ? text(item, 'scope', '') : '';
  form.severity = item ? text(item, 'severity', 'WARNING') : 'WARNING';
  form.workflowStatus = item ? text(item, 'workflow_status', definition.value.statuses[0].value) : definition.value.statuses[0].value;
  form.dueAt = item ? toLocalInput(text(item, 'due_at', '')) : defaultDueAt();
  form.score = item ? number(item, 'score') : 80;
  form.description = item ? text(item, 'description', '') : '';
  form.flowImpact = item ? text(item, 'flow_impact', definition.value.flowImpact) : definition.value.flowImpact;
}
function openCreate() { resetForm(); notice.value = ''; editorOpen.value = true; }
function openEdit(item: ConfigurationItemWire) { resetForm(item); notice.value = ''; editorOpen.value = true; }
function requestDelete(item: ConfigurationItemWire) { deleting.value = item; deleteOpen.value = true; }
function payload() {
  return {
    schema_version: 1, module_id: definition.value.id, owner: form.owner.trim(), scope: form.scope.trim(),
    severity: form.severity, workflow_status: form.workflowStatus,
    due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    score: Number(form.score), description: form.description.trim(), flow_impact: form.flowImpact.trim(),
  };
}
async function save() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.key.trim() || !form.name.trim() || !form.owner.trim() || !form.scope.trim() || !form.description.trim()) return;
  busy.value = 'save'; notice.value = '';
  try {
    if (editing.value) {
      await updateConfiguration(lease, editing.value.config_id, {
        display_name: form.name.trim(), payload: payload(), expected_version: editing.value.row_version,
      });
      notice.value = `${definition.value.itemLabel}已更新；状态、时限和风险已重新计入当前流程。`;
    } else {
      await defineConfiguration(lease, {
        config_type: definition.value.configType, config_key: form.key.trim().toUpperCase(),
        display_name: form.name.trim(), payload: payload(),
      });
      notice.value = `${definition.value.itemLabel}已新建并进入审计链与工作队列。`;
    }
    editorOpen.value = false; await itemsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function deleteItem() {
  const lease = leaseQuery.data.value; const item = deleting.value;
  if (!lease || !item || busy.value) return;
  busy.value = 'delete'; notice.value = '';
  try {
    await transitionConfiguration(lease, item.config_id, {
      action: 'ARCHIVE', expected_version: item.row_version,
      reason: `${definition.value.itemLabel}逻辑删除并保留完整审计与流程证据`,
    });
    notice.value = `${definition.value.itemLabel}已逻辑删除；历史证据保留，当前风险与流程指标已重新计算。`;
    deleteOpen.value = false; deleting.value = null; await itemsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
watch(() => route.query.create, (value) => {
  if (value !== '1') return;
  openCreate();
  void router.replace({ query: { ...route.query, create: undefined } });
}, { immediate: true });
</script>

<template>
  <section class="quality-operations" :data-quality-module="moduleId">
    <section class="quality-flow" aria-label="质量闭环流程">
      <article v-for="(step, index) in definition.workflow" :key="step"><span>{{ index + 1 }}</span><strong>{{ step }}</strong></article>
    </section>
    <section class="admin-metrics quality-operation-metrics" aria-label="质量工作项统计">
      <article><span>全部{{ definition.itemLabel }}</span><strong>{{ items.length }}</strong><small>逻辑删除不计入</small></article>
      <article><span>开放队列</span><strong>{{ openItems.length }}</strong><small>直接影响当前流程</small></article>
      <article><span>阻断 / 逾期</span><strong>{{ blockingItems.length }} / {{ overdueItems.length }}</strong><small>进入风险升级</small></article>
      <article><span>闭环率</span><strong>{{ closedRate }}%</strong><small>按当前台账实时计算</small></article>
    </section>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取质量流程台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="itemsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" :class="{ danger: notice.includes('：') }" role="status">{{ notice }}</p>
      <div class="portal-safety quality-impact"><b>流程影响</b><span>{{ definition.flowImpact }}</span><span class="status" :class="blockingItems.length ? 'red' : 'green'">{{ blockingItems.length ? `${blockingItems.length} 项阻断` : '当前无阻断' }}</span></div>
      <section class="admin-panel quality-operation-table">
        <header><div><h2>{{ definition.title }}</h2><p>{{ definition.description }}</p></div><div class="toolbar-actions"><button class="button secondary" type="button" @click="itemsQuery.refetch()">刷新</button><button class="button primary" type="button" @click="openCreate">新建{{ definition.itemLabel }}</button></div></header>
        <div v-if="!visibleItems.length" class="admin-empty rich"><strong>{{ itemId ? `未找到${definition.itemLabel}` : `暂无${definition.itemLabel}` }}</strong><p>{{ itemId ? '该记录可能已退出当前工作队列。' : '新建后将进入工作队列，并实时影响风险、逾期和闭环指标。' }}</p><button v-if="!itemId" class="button primary" type="button" @click="openCreate">新建{{ definition.itemLabel }}</button></div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>编码 / 名称</th><th>责任人与范围</th><th>风险 / 分值</th><th>流程状态</th><th>完成时限</th><th>操作</th></tr></thead><tbody>
          <tr v-for="item in visibleItems" :key="item.config_id">
            <td><RouterLink :to="`${definition.routeBase}/${item.config_id}`"><strong>{{ item.display_name }}</strong></RouterLink><small><code>{{ item.config_key }}</code> · v{{ item.row_version }}</small></td>
            <td>{{ text(item, 'owner') }}<small>{{ text(item, 'scope') }}</small></td>
            <td><span class="admin-status" :class="text(item, 'severity').toLowerCase()">{{ text(item, 'severity') }}</span><small>评分 {{ number(item, 'score') }}</small></td>
            <td><span class="admin-status" :class="statusTone(text(item, 'workflow_status'))">{{ statusLabel(text(item, 'workflow_status')) }}</span><small>{{ text(item, 'flow_impact') }}</small></td>
            <td>{{ dueDisplay(text(item, 'due_at', '')) }}</td>
            <td class="admin-actions"><button class="task-action" type="button" @click="openEdit(item)">编辑</button><button class="task-action danger" type="button" @click="requestDelete(item)">删除</button></td>
          </tr>
        </tbody></table></div>
      </section>
    </template>

    <AdminActionDialog v-model:open="editorOpen" :title="editing ? `编辑${definition.itemLabel}` : `新建${definition.itemLabel}`" description="状态、责任人、时限与风险会直接参与工作队列和质量指标计算；保存后进入审计哈希链。" size="large" :busy="busy === 'save'">
      <form class="admin-form quality-dialog-form" @submit.prevent="save">
        <label><span>业务编码</span><input v-model="form.key" required maxlength="128" :disabled="Boolean(editing)" /></label>
        <label><span>名称</span><input v-model="form.name" required maxlength="256" /></label>
        <label><span>责任人 / 责任科室</span><input v-model="form.owner" required maxlength="128" /></label>
        <label><span>适用范围</span><input v-model="form.scope" required maxlength="256" /></label>
        <label><span>风险等级</span><select v-model="form.severity"><option value="INFO">提示</option><option value="WARNING">警告</option><option value="BLOCKING">阻断</option></select></label>
        <label><span>流程状态</span><select v-model="form.workflowStatus"><option v-for="status in definition.statuses" :key="status.value" :value="status.value">{{ status.label }}</option></select></label>
        <label><span>完成时限</span><input v-model="form.dueAt" type="datetime-local" required /></label>
        <label><span>质量评分</span><input v-model.number="form.score" type="number" min="0" max="100" step="1" required /></label>
        <label class="full-span"><span>问题 / 证据说明</span><textarea v-model="form.description" required maxlength="2000" rows="3" /></label>
        <label class="full-span"><span>流程影响与处置动作</span><textarea v-model="form.flowImpact" required maxlength="1000" rows="3" /></label>
      </form>
      <template #footer="{ close }"><button class="button secondary" type="button" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" type="button" :disabled="busy === 'save'" @click="save">{{ busy === 'save' ? '保存中…' : '保存并影响流程' }}</button></template>
    </AdminActionDialog>
    <AdminConfirmDialog v-model:open="deleteOpen" :title="`删除${deleting?.display_name ?? definition.itemLabel}`" description="采用带审计的逻辑删除：该记录会立即退出当前工作队列和指标计算，但历史版本、审计哈希与 Outbox 证据永久保留。" confirm-label="确认删除" :busy="busy === 'delete'" @confirm="deleteItem" />
  </section>
</template>

<style scoped>
.quality-operations{display:grid;gap:14px;margin-top:14px}.quality-flow{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}.quality-flow article{display:flex;align-items:center;gap:9px;padding:12px;border:1px solid var(--line);border-radius:9px;background:#fff}.quality-flow article span{display:grid;place-items:center;width:28px;height:28px;border-radius:50%;background:#eaf1fb;color:#245493;font-weight:800}.quality-operation-metrics{margin:0}.quality-impact{margin:0}.quality-operation-table>header{align-items:flex-start}.quality-operation-table .toolbar-actions{flex-wrap:wrap}.quality-operation-table td small{display:block;margin-top:4px;color:#667085;line-height:1.4}.quality-operation-table td.admin-actions{min-width:138px}.quality-dialog-form{grid-template-columns:repeat(2,minmax(0,1fr));padding:0}.full-span{grid-column:1/-1}.admin-notice.danger{border-color:#fecaca;background:#fff7f7;color:#b42318}@media(max-width:900px){.quality-flow,.quality-operation-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:640px){.quality-flow,.quality-operation-metrics,.quality-dialog-form{grid-template-columns:1fr}.full-span{grid-column:auto}.quality-impact{align-items:flex-start;flex-direction:column}.quality-impact .status{margin-left:0}}
</style>
