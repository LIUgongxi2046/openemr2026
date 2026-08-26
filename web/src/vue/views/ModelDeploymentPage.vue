<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ModelDeploymentWire } from '../../generated/contracts';
import { deactivateModelDeployment, issueAiLease, listModelDeployments, registerModelDeployment, updateModelDeployment } from '../../api/ai-platform';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type ResidencyPolicy = ModelDeploymentWire['residency_policy'];
const residencyPolicyLabels: Record<ResidencyPolicy, string> = {
  ON_PREM_ONLY: '仅本地部署',
  LOCAL_PREFERRED: '本地优先',
  CLOUD_ALLOWED: '允许云端',
};
const evaluationStatusLabels: Record<ModelDeploymentWire['evaluation_status'], string> = {
  EVALUATING: '评估中',
  APPROVED: '已通过',
  REJECTED: '已拒绝',
};
const providerOptions = [
  { code: 'DEEPSEEK', label: 'DeepSeek', endpoint: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
  { code: 'QWEN', label: '阿里云百炼（通义千问）', endpoint: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  { code: 'GLM', label: '智谱开放平台', endpoint: 'https://open.bigmodel.cn/api/paas/v4', model: 'glm-4-plus' },
  { code: 'DOUBAO', label: '火山方舟（豆包）', endpoint: 'https://ark.cn-beijing.volces.com/api/v3', model: '' },
  { code: 'OPENAI_COMPATIBLE', label: '其他兼容接口', endpoint: '', model: '' },
];

const leaseQuery = useQuery({
  queryKey: ['ai-platform', 'models', 'lease'],
  queryFn: () => issueAiLease('AI_PLATFORM_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const modelsQuery = useQuery({
  queryKey: ['ai-platform', 'models', 'deployments'],
  queryFn: () => listModelDeployments(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? modelsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? modelsQuery.error.value) : null);
const models = computed(() => modelsQuery.data.value ?? []);
const activeCount = computed(() => models.value.filter((model) => model.status === 'ACTIVE').length);
const connectedCount = computed(() => models.value.filter((model) => model.connection_status === 'READY').length);

const form = reactive({
  modelCode: '',
  providerCode: '',
  displayName: '',
  residencyPolicy: 'LOCAL_PREFERRED' as ResidencyPolicy,
  endpointUrl: '',
  apiKeyRef: '',
  credentialAction: 'KEEP' as 'KEEP' | 'REPLACE' | 'CLEAR',
});
const editingModel = ref<ModelDeploymentWire | null>(null);
const editorOpen = ref(false);
const deactivateTarget = ref<ModelDeploymentWire | null>(null);
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '未配置';
}

function applyProviderPreset() {
  const preset = providerOptions.find((item) => item.code === form.providerCode);
  if (!preset) return;
  form.endpointUrl = preset.endpoint;
  if (!form.modelCode) form.modelCode = preset.model;
  if (!form.displayName && preset.label !== '其他兼容接口') form.displayName = `${preset.label} 医疗模型`;
}

async function reload() {
  notice.value = '';
  await modelsQuery.refetch();
}

function resetForm() {
  editingModel.value = null;
  form.modelCode = ''; form.providerCode = ''; form.displayName = '';
  form.residencyPolicy = 'LOCAL_PREFERRED'; form.endpointUrl = ''; form.apiKeyRef = '';
  form.credentialAction = 'KEEP';
}

function openCreate() {
  resetForm();
  editorOpen.value = true;
}

function edit(model: ModelDeploymentWire) {
  editingModel.value = model;
  form.modelCode = model.model_code; form.providerCode = model.provider_code;
  form.displayName = model.display_name; form.residencyPolicy = model.residency_policy;
  form.endpointUrl = model.endpoint_url ?? ''; form.apiKeyRef = '';
  form.credentialAction = 'KEEP'; notice.value = ''; editorOpen.value = true;
}

async function saveModel() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.modelCode.trim() || !form.providerCode.trim() || !form.displayName.trim()) return;
  busy.value = editingModel.value ? 'update' : 'create'; notice.value = '';
  try {
    if (editingModel.value) {
      await updateModelDeployment(lease, editingModel.value, {
        display_name: form.displayName.trim(), residency_policy: form.residencyPolicy,
        endpoint_url: form.endpointUrl.trim() || null,
        api_key_ref: form.credentialAction === 'REPLACE' ? form.apiKeyRef.trim() || null : null,
        credential_action: form.credentialAction,
      });
      notice.value = '模型配置已更新，并立即用于后续医助任务路由。';
    } else {
      await registerModelDeployment(lease, {
        model_code: form.modelCode.trim(), provider_code: form.providerCode.trim(),
        display_name: form.displayName.trim(), residency_policy: form.residencyPolicy,
        endpoint_url: form.endpointUrl.trim() || null, api_key_ref: form.apiKeyRef.trim() || null,
      });
      notice.value = '模型 API 配置已保存。密钥只保存引用，不保存明文内容。';
    }
    resetForm();
    editorOpen.value = false;
    await modelsQuery.refetch();
    deactivateTarget.value = null;
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(model: ModelDeploymentWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || model.status !== 'ACTIVE') return;
  busy.value = model.model_deployment_id; notice.value = '';
  try {
    await deactivateModelDeployment(lease, model);
    notice.value = `模型部署 ${model.display_name} 已停用。`;
    await modelsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">AI 中心 / 模型 API 配置</p>
        <h1>模型服务与 API 配置</h1>
        <p>在这里配置模型提供方、API 地址、模型标识和密钥引用，供小南及医助团队调用。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || modelsQuery.isPending.value" kind="loading" message="正在读取模型部署目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="模型部署统计">
        <article><span>模型部署</span><strong>{{ models.length }}</strong><small>全部登记</small></article>
        <article><span>有效部署</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
        <article><span>API 已就绪</span><strong>{{ connectedCount }}</strong><small>地址与密钥引用完整</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-panel model-api-guide">
        <header><div><h2>大模型 API 在哪里配置？</h2><p>当前位置：AI 中心 → 模型服务 → 登记模型 API。</p></div><span class="admin-status active">已支持</span></header>
        <div class="model-api-guide-grid">
          <article><b>① 选择模型提供方</b><p>支持 DeepSeek、通义千问、智谱、豆包以及其他 OpenAI 兼容接口。</p></article>
          <article><b>② 填写 API 地址和模型标识</b><p>API 地址必须使用 HTTPS；模型标识应与提供方控制台保持一致。</p></article>
          <article><b>③ 配置密钥引用</b><p>页面不保存明文密钥。填写 <code>env://变量名</code> 或 <code>file:///密钥文件</code>，再由部署环境提供真实密钥。</p></article>
        </div>
      </section>

      <div>
        <section class="admin-panel">
          <header>
            <div><h2>模型部署台账</h2><p>模型与提供方编码不可变；停用保留历史语义。</p></div>
            <div class="admin-row-actions"><button class="button secondary" @click="modelsQuery.refetch()">刷新</button><button class="button primary" @click="openCreate">新建模型 API 配置</button></div>
          </header>
          <div v-if="models.length === 0" class="admin-empty" role="status">暂无模型配置，请点击“新建模型 API 配置”。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>模型 / 名称</th><th>提供方</th><th>API 连接</th><th>驻留策略</th><th>评估状态</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="model in models" :key="model.model_deployment_id">
                  <td><strong>{{ model.display_name }}</strong><small><code>{{ model.model_code }}</code> · …{{ model.model_deployment_id.slice(-8) }} · v{{ model.row_version }}</small></td>
                  <td><code>{{ model.provider_code }}</code></td>
                  <td><span class="admin-status" :class="model.connection_status === 'READY' ? 'active' : 'evaluating'">{{ model.connection_status === 'READY' ? '已配置' : '未配置密钥' }}</span><small v-if="model.credential_hint">{{ model.credential_hint }}</small></td>
                  <td>{{ residencyPolicyLabels[model.residency_policy] }}</td>
                  <td><span class="admin-status" :class="model.evaluation_status.toLowerCase()">{{ evaluationStatusLabels[model.evaluation_status] }}</span></td>
                  <td><span class="admin-status" :class="model.status.toLowerCase()">{{ model.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><div class="admin-row-actions"><button class="task-action" :disabled="model.status !== 'ACTIVE' || Boolean(busy)" @click="edit(model)">编辑</button><button class="task-action danger" :disabled="model.status !== 'ACTIVE' || Boolean(busy)" @click="deactivateTarget = model">删除</button></div></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <AdminActionDialog v-model:open="editorOpen" :title="editingModel ? '编辑模型 API' : '新建模型 API 配置'" description="保存后，小南及医助团队的后续任务会读取最新有效连接配置。" size="large" :busy="Boolean(busy)" @update:open="!$event && resetForm()">
          <form class="admin-form ai-center-dialog-form" @submit.prevent="saveModel">
            <label><span>模型提供方</span><select v-model="form.providerCode" required :disabled="Boolean(editingModel)" @change="applyProviderPreset"><option value="" disabled>请选择提供方</option><option v-for="provider in providerOptions" :key="provider.code" :value="provider.code">{{ provider.label }}</option></select></label>
            <label><span>模型标识</span><input v-model="form.modelCode" maxlength="128" required :disabled="Boolean(editingModel)" placeholder="例：deepseek-chat" /></label>
            <label><span>显示名称</span><input v-model="form.displayName" maxlength="256" required placeholder="例：DeepSeek 医疗主模型" /></label>
            <label><span>驻留策略</span><select v-model="form.residencyPolicy"><option v-for="(name, policy) in residencyPolicyLabels" :key="policy" :value="policy">{{ name }}</option></select></label>
            <label><span>API 地址</span><input v-model="form.endpointUrl" maxlength="512" required placeholder="例：https://api.deepseek.com/v1" /></label>
            <label v-if="editingModel"><span>密钥处理</span><select v-model="form.credentialAction"><option value="KEEP">保留当前密钥引用</option><option value="REPLACE">更换密钥引用</option><option value="CLEAR">清除密钥引用</option></select></label>
            <label v-if="!editingModel || form.credentialAction === 'REPLACE'"><span>API 密钥引用</span><input v-model="form.apiKeyRef" maxlength="512" :required="!editingModel || form.credentialAction === 'REPLACE'" autocomplete="off" placeholder="例：env://DEEPSEEK_API_KEY" /><small>请勿粘贴 sk- 开头的明文密钥。</small></label>
            <div class="admin-form-actions"><button class="button secondary" type="button" :disabled="Boolean(busy)" @click="editorOpen = false">取消</button><button class="button primary" :disabled="Boolean(busy)">{{ busy ? '正在保存…' : editingModel ? '保存变更' : '保存 API 配置' }}</button></div>
          </form>
      </AdminActionDialog>
      <AdminConfirmDialog :open="Boolean(deactivateTarget)" :title="`删除模型配置 ${deactivateTarget?.display_name ?? ''}`" description="删除将以安全停用方式执行；后续医助任务不再选择该模型，历史评测、运行记录和审计证据继续保留。" confirm-label="确认删除并停用" :busy="Boolean(busy)" @update:open="!$event && (deactivateTarget = null)" @confirm="deactivateTarget && deactivate(deactivateTarget)"><div v-if="deactivateTarget" class="admin-impact-grid"><div><span>模型标识</span><b>{{ deactivateTarget.model_code }}</b></div><div><span>提供方</span><b>{{ deactivateTarget.provider_code }}</b></div><div><span>当前版本</span><b>v{{ deactivateTarget.row_version }}</b></div><div><span>流程影响</span><b>退出后续模型路由</b></div></div></AdminConfirmDialog>
    </template>
  </section>
</template>

<style scoped>
.model-api-guide { margin-bottom: 18px; }
.model-api-guide-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; padding: 16px; }
.model-api-guide-grid article { padding: 14px; border: 1px solid #d8e7e4; border-radius: 10px; background: #f5fbfa; }
.model-api-guide-grid b { color: #087c75; }
.model-api-guide-grid p { margin: 7px 0 0; color: #526579; line-height: 1.6; }
.admin-form label small { color: #7a5b28; line-height: 1.45; }
@media (max-width: 900px) { .model-api-guide-grid { grid-template-columns: 1fr; } }
</style>
