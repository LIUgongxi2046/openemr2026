<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';

import type { ConfigurationItemWire, ConfigurationLifecycleRequestWire } from '../../generated/contracts';
import {
  defineConfiguration,
  issueConfigurationLease,
  listConfigurations,
  transitionConfiguration,
  updateConfiguration,
} from '../../api/config';
import type { ConfigurationFieldDefinition, ConfigurationStudioDefinition } from '../configuration-studios';
import { toClinicalIssue } from '../clinical-error';

const props = defineProps<{ definition: ConfigurationStudioDefinition }>();
const leaseQuery = useQuery({
  queryKey: ['config', 'lease'],
  queryFn: () => issueConfigurationLease(),
  retry: false,
  staleTime: 5 * 60_000,
  gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['config', 'items', props.definition.configType],
  queryFn: () => listConfigurations(leaseQuery.data.value!, props.definition.configType),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value)
  : null);
const items = computed(() => itemsQuery.data.value ?? []);
const selected = ref<ConfigurationItemWire | null>(null);
const form = reactive({ name: '', key: '', description: '' });
const values = reactive<Record<string, string>>(Object.fromEntries(
  props.definition.fields.map((item) => [item.key, item.defaultValue]),
));
const reason = ref('完成配置生命周期操作');
const busy = ref('');
const notice = ref('');

const statusLabel: Readonly<Record<string, string>> = Object.freeze({
  DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已批准', ACTIVE: '已发布', ARCHIVED: '已归档',
});
const validationLabel: Readonly<Record<string, string>> = Object.freeze({
  NOT_VALIDATED: '未校验', VALID: '校验通过', INVALID: '校验失败',
});

const previewEntries = computed(() => props.definition.fields.map((field) => ({
  label: field.label,
  values: previewValues(field, selected.value?.payload?.[field.key] ?? parseValue(field, values[field.key] ?? '')),
})));

function parseValue(field: ConfigurationFieldDefinition, raw: string): unknown {
  if (field.kind === 'list') return raw.split(/[,\n，]+/).map((item) => item.trim()).filter(Boolean);
  if (field.kind === 'number') return Number(raw);
  if (field.kind === 'boolean') return raw === 'true';
  return raw.trim();
}

function previewValues(field: ConfigurationFieldDefinition, value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String);
  if (field.kind === 'textarea') return String(value ?? '').split(/[;；\n]+/).map((item) => item.trim()).filter(Boolean);
  return [String(value ?? '—')];
}

function payload(): Record<string, unknown> {
  return {
    schema_version: 1,
    description: form.description.trim(),
    ...Object.fromEntries(props.definition.fields.map((field) => [field.key, parseValue(field, values[field.key] ?? '')])),
  };
}

function selectItem(item: ConfigurationItemWire) {
  selected.value = item;
  form.name = item.display_name;
  form.key = item.config_key;
  form.description = String(item.payload?.description ?? '');
  for (const field of props.definition.fields) {
    const value = item.payload?.[field.key];
    values[field.key] = Array.isArray(value) ? value.join(', ') : String(value ?? field.defaultValue);
  }
  notice.value = '';
}

function resetDraft() {
  selected.value = null;
  form.name = '';
  form.key = '';
  form.description = '';
  for (const field of props.definition.fields) values[field.key] = field.defaultValue;
  notice.value = '';
}

async function save() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.name.trim() || !form.key.trim()) return;
  busy.value = 'save'; notice.value = '';
  try {
    const result = selected.value
      ? await updateConfiguration(lease, selected.value.config_id, {
          display_name: form.name.trim(), payload: payload(), expected_version: selected.value.row_version,
        })
      : await defineConfiguration(lease, {
          config_type: props.definition.configType,
          config_key: form.key.trim(),
          display_name: form.name.trim(),
          payload: payload(),
        });
    selectItem(result);
    notice.value = selected.value?.row_version === 1 ? '已创建版本化草稿。' : '草稿已保存，校验状态已重置。';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function lifecycle(action: ConfigurationLifecycleRequestWire['action']) {
  const lease = leaseQuery.data.value;
  const item = selected.value;
  if (!lease || !item || busy.value) return;
  busy.value = action; notice.value = '';
  try {
    const result = await transitionConfiguration(lease, item.config_id, {
      action, expected_version: item.row_version, reason: reason.value.trim(),
    });
    selectItem(result);
    notice.value = `${action} 已完成，当前版本 v${result.row_version}。`;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}
</script>

<template>
  <section data-page-root class="content vue-native-page config-studio">
    <div class="page-head">
      <div class="page-title"><p class="eyebrow">配置生命周期 / 结构化领域工作台</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div>
      <div class="head-actions">
        <button class="btn" type="button" @click="itemsQuery.refetch()">刷新</button>
        <button class="btn primary" type="button" @click="resetDraft">新建草稿</button>
      </div>
    </div>

    <div class="inline-notice config-safety" role="note">
      <strong>安全契约</strong><span>{{ definition.safetyNote }}</span>
    </div>
    <div v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" class="card"><div class="card-body">正在读取配置版本…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>
    <template v-else>
      <div v-if="notice" class="inline-notice" role="status">{{ notice }}</div>
      <div class="config-studio-layout">
        <section class="card config-list-panel">
          <div class="card-head"><div><h2>版本台账</h2><p>{{ definition.configType }} · 全程审计 + Outbox</p></div><span class="status">{{ items.length }} 项</span></div>
          <div v-if="items.length === 0" class="empty-state"><span>配</span><p>暂无配置草稿</p><small>从右侧结构化编辑器创建</small></div>
          <div v-else class="table-wrap">
            <table class="table">
              <thead><tr><th>名称 / 键</th><th>生命周期</th><th>版本</th><th>更新</th></tr></thead>
              <tbody>
                <tr v-for="item in items" :key="item.config_id" :class="{ selected: selected?.config_id === item.config_id }" @click="selectItem(item)">
                  <td><button class="config-row-button" type="button" @click.stop="selectItem(item)"><strong>{{ item.display_name }}</strong><code>{{ item.config_key }}</code></button></td>
                  <td><span class="status" :class="item.status === 'ACTIVE' ? 'ok' : item.validation_state === 'INVALID' ? 'critical' : ''">{{ statusLabel[item.status] }}</span><small>{{ validationLabel[item.validation_state] }}</small></td>
                  <td>v{{ item.row_version }}</td><td>{{ formatDate(item.updated_at) }}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="card config-editor-panel">
          <div class="card-head"><div><h2>{{ selected ? '编辑草稿' : '创建配置' }}</h2><p>版本化 Schema v1；发布后仅能通过回退恢复</p></div><span v-if="selected" class="status">v{{ selected.row_version }}</span></div>
          <form class="config-form" @submit.prevent="save">
            <div class="config-core-fields">
              <label><span>名称</span><input v-model="form.name" required :disabled="Boolean(selected && selected.status !== 'DRAFT')" /></label>
              <label><span>唯一键</span><input v-model="form.key" required :placeholder="definition.keyPlaceholder" :disabled="Boolean(selected)" /></label>
            </div>
            <label><span>说明</span><textarea v-model="form.description" rows="2" :disabled="Boolean(selected && selected.status !== 'DRAFT')" /></label>
            <div class="config-field-grid">
              <label v-for="field in definition.fields" :key="field.key">
                <span>{{ field.label }} <code>{{ field.key }}</code></span>
                <select v-if="field.kind === 'boolean'" v-model="values[field.key]" :disabled="Boolean(selected && selected.status !== 'DRAFT')"><option value="true">是</option><option value="false">否</option></select>
                <textarea v-else-if="field.kind === 'textarea' || field.kind === 'list'" v-model="values[field.key]" rows="3" :placeholder="field.placeholder" :disabled="Boolean(selected && selected.status !== 'DRAFT')" />
                <input v-else v-model="values[field.key]" :type="field.kind === 'number' ? 'number' : 'text'" :min="field.minimum" :max="field.maximum" :placeholder="field.placeholder" :disabled="Boolean(selected && selected.status !== 'DRAFT')" />
              </label>
            </div>
            <button class="button primary full" :disabled="Boolean(busy) || Boolean(selected && selected.status !== 'DRAFT')">{{ busy === 'save' ? '保存中…' : selected ? '保存新版本' : '创建版本化草稿' }}</button>
          </form>
        </section>
      </div>

      <div class="config-studio-lower">
        <section class="card config-preview">
          <div class="card-head"><div><h2>{{ definition.previewTitle }}</h2><p>当前草稿的可视化语义预览</p></div><span class="status">合成预览</span></div>
          <div class="config-preview-board">
            <article v-for="entry in previewEntries" :key="entry.label"><strong>{{ entry.label }}</strong><div><span v-for="value in entry.values" :key="value">{{ value }}</span></div></article>
          </div>
        </section>

        <section class="card config-lifecycle">
          <div class="card-head"><div><h2>校验、审批、发布与回退</h2><p>每一步都使用幂等键、乐观锁、审计链和 Outbox</p></div></div>
          <label><span>操作原因</span><input v-model="reason" minlength="8" maxlength="500" /></label>
          <div v-if="selected" class="lifecycle-summary">
            <span>状态 <strong>{{ statusLabel[selected.status] }}</strong></span>
            <span>校验 <strong>{{ validationLabel[selected.validation_state] }}</strong></span>
            <span>审批 <strong>{{ selected.approval_state }}</strong></span>
            <span>发布 <strong>{{ formatDate(selected.published_at) }}</strong></span>
          </div>
          <ul v-if="selected?.validation_errors?.length" class="validation-errors"><li v-for="error in selected.validation_errors" :key="error">{{ error }}</li></ul>
          <div class="toolbar-actions lifecycle-actions">
            <button class="button secondary" type="button" :disabled="!selected || selected.status !== 'DRAFT' || Boolean(busy)" @click="lifecycle('VALIDATE')">执行静态校验</button>
            <button class="button secondary" type="button" :disabled="!selected || selected.status !== 'DRAFT' || Boolean(busy)" @click="lifecycle('SUBMIT')">提交审批</button>
            <button class="button secondary" type="button" :disabled="!selected || selected.status !== 'PENDING_APPROVAL' || Boolean(busy)" @click="lifecycle('APPROVE')">职责分离批准</button>
            <button class="button primary" type="button" :disabled="!selected || selected.status !== 'APPROVED' || Boolean(busy)" @click="lifecycle('PUBLISH')">发布</button>
            <button class="button danger" type="button" :disabled="!selected || selected.status !== 'ACTIVE' || Boolean(busy)" @click="lifecycle('ROLLBACK')">回退上一版本</button>
          </div>
          <p class="lifecycle-footnote">作者不能批准自己的配置；开发合成身份如只有一人，批准会安全失败关闭。</p>
        </section>
      </div>
    </template>
  </section>
</template>

<style scoped>
.config-safety{display:flex;gap:12px;align-items:flex-start;margin-bottom:16px}.config-safety span{line-height:1.55}.config-studio-layout{display:grid;grid-template-columns:minmax(420px,.85fr) minmax(520px,1.15fr);gap:16px}.config-list-panel,.config-editor-panel,.config-preview,.config-lifecycle{min-width:0}.config-row-button{display:grid;gap:4px;border:0;background:none;padding:0;text-align:left;color:inherit;cursor:pointer}.config-row-button code{font-size:11px;color:var(--muted)}.table tbody tr{cursor:pointer}.table tbody tr.selected{background:color-mix(in srgb,var(--blue) 8%,white)}.table td small{display:block;margin-top:4px;color:var(--muted)}.config-form,.config-lifecycle{display:grid;gap:14px;padding:16px}.config-form label,.config-lifecycle label{display:grid;gap:6px;font-size:13px}.config-form label>span,.config-lifecycle label>span{font-weight:700}.config-form code{font-weight:400;color:var(--muted)}.config-core-fields,.config-field-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.config-field-grid label:has(textarea){grid-column:auto}.config-studio-lower{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:16px}.config-preview-board{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:16px}.config-preview-board article{border:1px solid var(--border);border-radius:var(--r);padding:12px;background:var(--card)}.config-preview-board article>div{display:flex;gap:6px;flex-wrap:wrap;margin-top:8px}.config-preview-board span{border:1px solid color-mix(in srgb,var(--blue) 25%,var(--border));background:color-mix(in srgb,var(--blue) 7%,white);border-radius:999px;padding:4px 8px;font-size:12px}.lifecycle-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}.lifecycle-summary span{display:grid;gap:4px;border:1px solid var(--border);border-radius:var(--r);padding:10px;color:var(--muted)}.lifecycle-summary strong{color:var(--text)}.lifecycle-actions{flex-wrap:wrap}.validation-errors{margin:0;padding:12px 12px 12px 32px;border:1px solid var(--red);border-radius:var(--r);color:var(--red)}.lifecycle-footnote{margin:0;color:var(--muted);font-size:12px;line-height:1.6}.button.danger{border-color:var(--red);color:var(--red);background:white}@media(max-width:1100px){.config-studio-layout,.config-studio-lower{grid-template-columns:1fr}}@media(max-width:700px){.config-core-fields,.config-field-grid,.config-preview-board,.lifecycle-summary{grid-template-columns:1fr}}
</style>
