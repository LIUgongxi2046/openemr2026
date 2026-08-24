<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DocumentTemplateCreateRequestWire, DocumentTemplateWire } from '../../generated/contracts';
import {
  clinicalContext, createDocumentTemplate, createDocumentTemplateVersion,
  deactivateDocumentTemplate, loadDocumentTemplates, publishDocumentTemplateVersion,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type Scope = 'GLOBAL' | 'ORGANIZATION' | 'FACILITY' | 'DEPARTMENT';
const query = useQuery({ queryKey: ['admin', 'document-templates'], queryFn: loadDocumentTemplates, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const templates = computed(() => query.data.value ?? []);
const busy = ref('');
const notice = ref('');
const selected = ref<DocumentTemplateWire | null>(null);
const mode = ref<'CREATE' | 'VERSION'>('CREATE');
const form = reactive({
  code: '', name: '', documentType: '', scope: 'FACILITY' as Scope, departmentId: '',
  fields: 'chief_complaint,present_illness,assessment,treatment_plan',
  required: 'chief_complaint,present_illness', layout: 'two-column',
});
const activeCount = computed(() => new Set(templates.value.filter((item) => item.lifecycle_status === 'ACTIVE').map((item) => item.template_id)).size);
const publishedCount = computed(() => templates.value.filter((item) => item.version_status === 'PUBLISHED').length);
const draftCount = computed(() => templates.value.filter((item) => item.version_status === 'DRAFT').length);
const retiredCount = computed(() => templates.value.filter((item) => item.version_status === 'RETIRED').length);

function splitFields(value: string) { return [...new Set(value.split(',').map((item) => item.trim()).filter(Boolean))]; }
function formatDate(value: string | null) {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(parsed);
}
function scopeLabel(item: DocumentTemplateWire) {
  if (item.department_id) return `科室 …${item.department_id.slice(-8)}`;
  if (item.facility_id) return `院区 …${item.facility_id.slice(-8)}`;
  if (item.organization_id) return `机构 …${item.organization_id.slice(-8)}`;
  return '租户通用';
}
function fieldsOf(item: DocumentTemplateWire) {
  return Object.keys((item.section_schema.properties as Record<string, unknown> | undefined) ?? {});
}
function chooseForVersion(item: DocumentTemplateWire) {
  const latest = templates.value.filter((candidate) => candidate.template_id === item.template_id)
    .sort((left, right) => right.version_no - left.version_no)[0] ?? item;
  selected.value = latest;
  mode.value = 'VERSION';
  form.fields = fieldsOf(latest).join(',');
  form.required = latest.required_fields.join(',');
  form.layout = String(latest.display_rules.layout ?? 'two-column');
  notice.value = `已选择 ${latest.display_name}，将在 v${latest.version_no} 上创建新草案。`;
}
function versionPayload() {
  const fields = splitFields(form.fields);
  const required = splitFields(form.required);
  if (!fields.length || required.some((field) => !fields.includes(field))) throw new Error('必填项必须是已定义的字段');
  return {
    section_schema: { type: 'object', properties: Object.fromEntries(fields.map((field) => [field, { type: 'string' }])), additionalProperties: false },
    required_fields: required,
    display_rules: { layout: form.layout, field_order: fields },
  };
}
async function submit() {
  if (busy.value) return;
  busy.value = 'save'; notice.value = '';
  try {
    const payload = versionPayload();
    if (mode.value === 'VERSION' && selected.value) {
      await createDocumentTemplateVersion(selected.value, payload);
      notice.value = '新版本草案已保存；必须由另一名管理员独立发布。';
    } else {
      const input: DocumentTemplateCreateRequestWire = {
        template_code: form.code.trim(), display_name: form.name.trim(),
        document_type_code: form.documentType.trim(), ...payload,
      };
      if (form.scope === 'ORGANIZATION') input.organization_id = clinicalContext.organizationId;
      if (form.scope === 'FACILITY') { input.organization_id = clinicalContext.organizationId; input.facility_id = clinicalContext.facilityId; }
      if (form.scope === 'DEPARTMENT') {
        input.organization_id = clinicalContext.organizationId; input.facility_id = clinicalContext.facilityId;
        input.department_id = form.departmentId.trim();
      }
      await createDocumentTemplate(input);
      notice.value = '模板 v1 草案已创建，当前创建人不能自己发布。';
      form.code = ''; form.name = ''; form.documentType = '';
    }
    await query.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
async function publish(item: DocumentTemplateWire) {
  if (busy.value || item.version_status !== 'DRAFT') return;
  busy.value = item.template_version_id; notice.value = '';
  try {
    await publishDocumentTemplateVersion(item);
    notice.value = `v${item.version_no} 已发布，新建病历开始绑定该版本。`;
    await query.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function deactivate(item: DocumentTemplateWire) {
  if (busy.value || item.lifecycle_status !== 'ACTIVE') return;
  busy.value = item.template_id; notice.value = '';
  try {
    await deactivateDocumentTemplate(item, '模板管理员确认停用');
    notice.value = `${item.display_name}已停用；历史病历保留原版本语义。`;
    await query.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page template-admin-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">配置中心 / 病历模板</p><h1>病历模板与版本发布</h1><p>同一业务内核按机构、院区和科室解析模板；病历创建时永久绑定版本，必填项直接进入质控与签署门禁。</p></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/record">病历中心</RouterLink><RouterLink class="button secondary" to="/admin-permissions">权限策略</RouterLink></div>
    </div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取模板和不可变版本链" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <section class="admin-metrics auth-metrics" aria-label="模板指标">
        <article><span>有效模板</span><strong>{{ activeCount }}</strong><small>当前可解析</small></article>
        <article><span>已发布</span><strong>{{ publishedCount }}</strong><small>新建病历可绑定</small></article>
        <article><span>待独立审批</span><strong>{{ draftCount }}</strong><small>创建人不可自批</small></article>
        <article><span>历史版本</span><strong>{{ retiredCount }}</strong><small>仅供证据回溯</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="template-admin-layout">
        <section class="admin-panel">
          <header><div><h2>模板版本台账</h2><p>范围越具体优先级越高；已发布和已退役版本的语义不可修改。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header>
          <div class="admin-table-wrap"><table class="admin-table template-table"><thead><tr><th>模板 / 文书类型</th><th>范围</th><th>版本</th><th>字段与必填</th><th>生效证据</th><th>操作</th></tr></thead><tbody>
            <tr v-for="item in templates" :key="item.template_version_id">
              <td><strong>{{ item.display_name }}</strong><small><code>{{ item.template_code }}</code></small><small>{{ item.document_type_code }}</small></td>
              <td>{{ scopeLabel(item) }}<small>{{ item.lifecycle_status }}</small></td>
              <td><span class="admin-status" :class="item.version_status === 'PUBLISHED' ? 'active' : item.version_status === 'RETIRED' ? 'inactive' : ''">v{{ item.version_no }} · {{ item.version_status }}</span><small>版本行 {{ item.version_row_version }}</small></td>
              <td>{{ fieldsOf(item).length }} 个字段<small>必填：{{ item.required_fields.join(' / ') || '无' }}</small></td>
              <td>{{ formatDate(item.effective_from) }}<small>审批人：{{ item.approved_by ? `…${item.approved_by.slice(-8)}` : '待审批' }}</small></td>
              <td><div class="template-actions"><button :disabled="Boolean(busy) || item.lifecycle_status !== 'ACTIVE'" @click="chooseForVersion(item)">派生新版</button><button :disabled="Boolean(busy) || item.version_status !== 'DRAFT' || item.created_by === clinicalContext.userId" @click="publish(item)">{{ item.created_by === clinicalContext.userId ? '不可自批' : '审批发布' }}</button><button class="danger-text" :disabled="Boolean(busy) || item.lifecycle_status !== 'ACTIVE'" @click="deactivate(item)">停用</button></div></td>
            </tr>
            <tr v-if="!templates.length"><td colspan="6" class="mpi-empty">尚无模板，请创建第一个草案。</td></tr>
          </tbody></table></div>
        </section>
        <section class="admin-panel admin-form-panel template-editor">
          <header><div><h2>{{ mode === 'CREATE' ? '创建模板' : `创建 ${selected?.display_name} 新版本` }}</h2><p>字段逗号分隔；必填项必须是已定义字段。</p></div><button v-if="mode === 'VERSION'" class="task-action" @click="mode = 'CREATE'; selected = null">返回新建</button></header>
          <form class="admin-form" @submit.prevent="submit">
            <template v-if="mode === 'CREATE'">
              <label><span>模板编码</span><input v-model="form.code" required placeholder="OPD-GENERAL-V1" /></label>
              <label><span>显示名称</span><input v-model="form.name" required placeholder="通用门诊病历" /></label>
              <label><span>文书类型编码</span><input v-model="form.documentType" required placeholder="WS445.2.OUTPATIENT_RECORD" /></label>
              <label><span>适用范围</span><select v-model="form.scope"><option value="GLOBAL">租户通用</option><option value="ORGANIZATION">当前机构</option><option value="FACILITY">当前院区</option><option value="DEPARTMENT">指定科室</option></select></label>
              <label v-if="form.scope === 'DEPARTMENT'"><span>科室 ID</span><input v-model="form.departmentId" required /></label>
            </template>
            <label><span>结构化字段</span><textarea v-model="form.fields" rows="4" required /></label>
            <label><span>阻断签署的必填项</span><textarea v-model="form.required" rows="3" /></label>
            <label><span>布局规则</span><select v-model="form.layout"><option value="single-column">单列</option><option value="two-column">双列</option><option value="timeline">时间轴</option><option value="specialty">专科分区</option></select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ mode === 'CREATE' ? '保存 v1 草案' : '保存新版本草案' }}</button>
            <small class="template-governance-note">发布后只影响新建病历；历史病历不会被静默升级。</small>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
