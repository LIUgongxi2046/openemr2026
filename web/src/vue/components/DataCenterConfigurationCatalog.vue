<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { ConfigurationItemWire, ConfigurationLifecycleRequestWire } from '../../generated/contracts';
import {
  defineConfiguration,
  issueConfigurationLease,
  listConfigurations,
  transitionConfiguration,
  updateConfiguration,
} from '../../api/config';
import { toClinicalIssue } from '../clinical-error';
import AdminActionDialog from './AdminActionDialog.vue';
import AdminConfirmDialog from './AdminConfirmDialog.vue';
import ClinicalPageState from './ClinicalPageState.vue';

export interface DataCenterCatalogField {
  key: string;
  label: string;
  placeholder?: string;
  kind?: 'text' | 'number' | 'textarea' | 'list' | 'select';
  options?: ReadonlyArray<{ label: string; value: string }>;
  defaultValue?: string;
}

export interface DataCenterCatalogDefinition {
  configType: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  createLabel: string;
  itemLabel: string;
  fields: ReadonlyArray<DataCenterCatalogField>;
  safeguards: ReadonlyArray<string>;
  links?: ReadonlyArray<{ label: string; to: string }>;
}

const props = defineProps<{ definition: DataCenterCatalogDefinition }>();
const route = useRoute();
const router = useRouter();
const leaseQuery = useQuery({
  queryKey: ['data-center-config', 'lease'],
  queryFn: issueConfigurationLease,
  retry: false,
  staleTime: 5 * 60_000,
  gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['data-center-config', props.definition.configType],
  queryFn: () => listConfigurations(leaseQuery.data.value!, props.definition.configType),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const items = computed(() => itemsQuery.data.value ?? []);
const activeItems = computed(() => items.value.filter((item) => item.status === 'ACTIVE'));
const draftItems = computed(() => items.value.filter((item) => item.status === 'DRAFT'));
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);

const editorOpen = ref(false);
const archiveOpen = ref(false);
const selected = ref<ConfigurationItemWire | null>(null);
const busy = ref('');
const notice = ref('');
const form = reactive({ key: '', name: '', description: '' });
const values = reactive<Record<string, string>>({});

function resetValues(item?: ConfigurationItemWire | null) {
  for (const field of props.definition.fields) {
    const value = item?.payload?.[field.key];
    values[field.key] = Array.isArray(value)
      ? value.join('、')
      : String(value ?? field.defaultValue ?? '');
  }
}

function openCreate() {
  selected.value = null;
  form.key = '';
  form.name = '';
  form.description = '';
  resetValues();
  notice.value = '';
  editorOpen.value = true;
}

watch(() => route.query.action, (action) => {
  if (action !== 'create') return;
  openCreate();
  void router.replace({ query: { ...route.query, action: undefined } });
}, { immediate: true });

function openEdit(item: ConfigurationItemWire) {
  selected.value = item;
  form.key = item.config_key;
  form.name = item.display_name;
  form.description = String(item.payload?.description ?? '');
  resetValues(item);
  notice.value = '';
  editorOpen.value = true;
}

function requestArchive(item: ConfigurationItemWire) {
  selected.value = item;
  archiveOpen.value = true;
}

function parseField(field: DataCenterCatalogField): unknown {
  const raw = values[field.key]?.trim() ?? '';
  if (field.kind === 'number') return Number(raw || 0);
  if (field.kind === 'list') return raw.split(/[、,，\n]+/).map((item) => item.trim()).filter(Boolean);
  return raw;
}

function payload() {
  return {
    ...(selected.value?.payload ?? {}),
    schema_version: 1,
    description: form.description.trim(),
    hospital_level: '三级甲等',
    organization: '江城大学附属医院',
    ...Object.fromEntries(props.definition.fields.map((field) => [field.key, parseField(field)])),
  };
}

async function save() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.key.trim() || !form.name.trim()) return;
  busy.value = 'save';
  notice.value = '';
  try {
    if (selected.value?.status === 'DRAFT') {
      await updateConfiguration(lease, selected.value.config_id, {
        display_name: form.name.trim(),
        payload: payload(),
        expected_version: selected.value.row_version,
      });
      notice.value = `${props.definition.itemLabel}草稿已更新，需重新校验后才能发布。`;
    } else if (selected.value) {
      await defineConfiguration(lease, {
        config_type: props.definition.configType,
        config_key: form.key.trim(),
        display_name: form.name.trim(),
        payload: payload(),
      });
      notice.value = `${props.definition.itemLabel}新版本草稿已创建；当前生产版本继续生效，直到新版本完成审批发布。`;
    } else {
      await defineConfiguration(lease, {
        config_type: props.definition.configType,
        config_key: form.key.trim(),
        display_name: form.name.trim(),
        payload: payload(),
      });
      notice.value = `${props.definition.itemLabel}草稿已创建，已写入审计链。`;
    }
    editorOpen.value = false;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function lifecycle(item: ConfigurationItemWire, action: ConfigurationLifecycleRequestWire['action']) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = item.config_id;
  notice.value = '';
  try {
    await transitionConfiguration(lease, item.config_id, {
      action,
      expected_version: item.row_version,
      reason: `数据中心${props.definition.itemLabel}生命周期变更并保留审计证据`,
    });
    notice.value = `${item.display_name} 已完成${actionLabel[action]}。`;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function archiveSelected() {
  const item = selected.value;
  if (!item) return;
  await lifecycle(item, 'ARCHIVE');
  archiveOpen.value = false;
}

const actionLabel: Record<ConfigurationLifecycleRequestWire['action'], string> = {
  VALIDATE: '校验', SUBMIT: '提交审批', APPROVE: '批准', PUBLISH: '发布', ROLLBACK: '回退', ARCHIVE: '停用',
};

function nextAction(item: ConfigurationItemWire): ConfigurationLifecycleRequestWire['action'] | null {
  if (item.status === 'DRAFT' && item.validation_state !== 'VALID') return 'VALIDATE';
  if (item.status === 'DRAFT') return 'SUBMIT';
  if (item.status === 'PENDING_APPROVAL') return 'APPROVE';
  if (item.status === 'APPROVED') return 'PUBLISH';
  return null;
}

function displayValue(item: ConfigurationItemWire, field: DataCenterCatalogField) {
  const value = item.payload?.[field.key];
  return Array.isArray(value) ? value.join(' · ') : String(value ?? '—');
}

function formatDate(value?: string) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}
</script>

<template>
  <section data-page-root class="content vue-native-page data-center-catalog-page">
    <div class="page-head">
      <div class="page-title"><p class="eyebrow">{{ definition.eyebrow }}</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div>
      <div class="head-actions">
        <RouterLink v-for="link in definition.links" :key="link.to" class="btn" :to="link.to">{{ link.label }}</RouterLink>
        <button class="btn" type="button" @click="itemsQuery.refetch()">刷新</button>
        <button class="btn primary" type="button" @click="openCreate">{{ definition.createLabel }}</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" :message="`正在读取${definition.itemLabel}目录`" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="itemsQuery.refetch()" />
    <template v-else>
      <section class="admin-metrics" :aria-label="`${definition.itemLabel}统计`">
        <article><span>目录总数</span><strong>{{ items.length }}</strong><small>全部非归档版本</small></article>
        <article><span>生产启用</span><strong>{{ activeItems.length }}</strong><small>实际影响新业务流程</small></article>
        <article><span>待发布草稿</span><strong>{{ draftItems.length }}</strong><small>未进入生产流量</small></article>
        <article><span>三级医院基线</span><strong>{{ items.filter((item) => item.payload?.hospital_level === '三级甲等').length }}</strong><small>配置仿真内容</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div v-if="items.length" class="connector-grid data-center-catalog-grid">
        <section v-for="item in items" :key="item.config_id" class="card connector-card">
          <div class="card-head"><code>{{ item.config_key }}</code><span class="status" :class="item.status === 'ACTIVE' ? 'green' : item.status === 'DRAFT' ? 'blue' : 'amber'">{{ item.status }}</span></div>
          <div class="card-body">
            <b>{{ item.display_name }}</b>
            <p class="meta">{{ item.payload?.description || '未填写说明' }}</p>
            <div v-for="field in definition.fields.slice(0, 5)" :key="field.key" class="folder-row"><span>{{ field.label }}</span><strong>{{ displayValue(item, field) }}</strong></div>
            <div class="folder-row"><span>更新时间</span><strong>{{ formatDate(item.updated_at) }}</strong></div>
            <div class="catalog-actions">
              <button class="btn sm" type="button" :disabled="!['DRAFT', 'ACTIVE'].includes(item.status) || Boolean(busy)" @click="openEdit(item)">{{ item.status === 'ACTIVE' ? '创建新版本' : '编辑草稿' }}</button>
              <button v-if="nextAction(item)" class="btn sm primary" type="button" :disabled="Boolean(busy)" @click="lifecycle(item, nextAction(item)!)">{{ actionLabel[nextAction(item)!] }}</button>
              <button class="btn sm danger" type="button" :disabled="item.status !== 'ACTIVE' || Boolean(busy)" @click="requestArchive(item)">停用</button>
            </div>
          </div>
        </section>
      </div>
      <div v-else class="card"><div class="card-body admin-empty">暂无有效配置，请通过右上角新建完整的三级医院仿真配置。</div></div>

      <section class="card catalog-safeguards">
        <div class="card-head">流程影响与安全门禁</div>
        <div class="card-body"><div v-for="item in definition.safeguards" :key="item" class="folder-row"><span>{{ item }}</span><strong>强制</strong></div></div>
      </section>
    </template>

    <AdminActionDialog v-model:open="editorOpen" :title="selected ? `编辑${definition.itemLabel}` : definition.createLabel" description="所有变更先保存为版本化草稿，经校验、审批和发布后才影响新的业务流程。" size="large" :busy="busy === 'save'">
      <form class="admin-form catalog-dialog-form" @submit.prevent="save">
        <label><span>配置编码</span><input v-model="form.key" required maxlength="128" :disabled="Boolean(selected)" placeholder="全院唯一编码" /></label>
        <label><span>显示名称</span><input v-model="form.name" required maxlength="256" /></label>
        <label class="full-span"><span>说明</span><textarea v-model="form.description" required /></label>
        <label v-for="field in definition.fields" :key="field.key" :class="{ 'full-span': field.kind === 'textarea' || field.kind === 'list' }">
          <span>{{ field.label }}</span>
          <textarea v-if="field.kind === 'textarea' || field.kind === 'list'" v-model="values[field.key]" required :placeholder="field.placeholder" />
          <select v-else-if="field.kind === 'select'" v-model="values[field.key]" required><option v-for="option in field.options" :key="option.value" :value="option.value">{{ option.label }}</option></select>
          <input v-else v-model="values[field.key]" :type="field.kind === 'number' ? 'number' : 'text'" required :placeholder="field.placeholder" />
        </label>
      </form>
      <template #footer="{ close }"><button class="button secondary" type="button" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" type="button" :disabled="busy === 'save'" @click="save">{{ busy === 'save' ? '保存中…' : '保存草稿' }}</button></template>
    </AdminActionDialog>

    <AdminConfirmDialog v-model:open="archiveOpen" :title="`停用${selected?.display_name ?? definition.itemLabel}`" description="停用后新流程不再选用该配置；历史消息、设备记录、研究证据和审计链继续保留。" confirm-label="确认停用" :busy="Boolean(busy)" @confirm="archiveSelected" />
  </section>
</template>

<style scoped>
.data-center-catalog-page { display: grid; align-content: start; gap: 14px; }
.data-center-catalog-page > .page-head,
.data-center-catalog-page > .admin-metrics,
.data-center-catalog-page > .admin-notice,
.data-center-catalog-page > .catalog-safeguards { margin: 0; }
.data-center-catalog-page .head-actions { gap: 10px; }
.data-center-catalog-grid { grid-template-columns: repeat(auto-fill, minmax(288px, 350px)); justify-content: start; gap: 14px; }
.data-center-catalog-grid .connector-card { padding: 0; }
.connector-card .card-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.connector-card .folder-row { gap: 14px; }
.connector-card .folder-row > span { color: var(--muted); }
.connector-card .folder-row > strong { min-width: 0; overflow-wrap: anywhere; text-align: right; }
.catalog-actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 14px; }
.catalog-safeguards { margin-top: 0; }
.catalog-dialog-form { grid-template-columns: repeat(2, minmax(0, 1fr)); padding: 0; }
.full-span { grid-column: 1 / -1; }
@media (max-width: 760px) {
  .data-center-catalog-page .page-head { height: auto; min-height: 0; flex-direction: column; align-items: stretch; gap: 10px; }
  .data-center-catalog-page .head-actions { display: flex; flex-wrap: wrap; align-items: stretch; gap: 8px; margin-left: 0; }
  .data-center-catalog-page .head-actions .btn { flex: 1 1 140px; width: auto; min-height: 36px; text-align: center; }
  .data-center-catalog-page .head-actions .btn:last-child:nth-child(odd) { flex-basis: 100%; }
  .data-center-catalog-grid, .catalog-dialog-form { grid-template-columns: minmax(0, 1fr); }
  .full-span { grid-column: auto; }
}
</style>
