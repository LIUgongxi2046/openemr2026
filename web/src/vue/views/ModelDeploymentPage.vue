<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ModelDeploymentWire } from '../../generated/contracts';
import { deactivateModelDeployment, issueAiLease, listModelDeployments, registerModelDeployment } from '../../api/ai-platform';
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

const form = reactive({
  modelCode: '',
  providerCode: '',
  displayName: '',
  residencyPolicy: 'LOCAL_PREFERRED' as ResidencyPolicy,
  endpointUrl: '',
});
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '未配置';
}

async function reload() {
  notice.value = '';
  await modelsQuery.refetch();
}

async function register() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.modelCode.trim() || !form.providerCode.trim() || !form.displayName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await registerModelDeployment(lease, {
      model_code: form.modelCode.trim(),
      provider_code: form.providerCode.trim(),
      display_name: form.displayName.trim(),
      residency_policy: form.residencyPolicy,
      endpoint_url: form.endpointUrl.trim() || null,
    });
    form.modelCode = ''; form.providerCode = ''; form.displayName = ''; form.endpointUrl = '';
    notice.value = '模型部署已登记，审计链与事件出箱已同步记录。';
    await modelsQuery.refetch();
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
        <p class="eyebrow">AI 平台 / 基座模型目录与路由</p>
        <h1>模型部署管理</h1>
        <p>登记与停用基座模型部署；所有变更使用版本号、幂等键、审计链与事件出箱，停用不物理删除。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || modelsQuery.isPending.value" kind="loading" message="正在读取模型部署目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="模型部署统计">
        <article><span>模型部署</span><strong>{{ models.length }}</strong><small>全部登记</small></article>
        <article><span>有效部署</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>模型部署台账</h2><p>模型与提供方编码不可变；停用保留历史语义。</p></div>
            <button class="button secondary" @click="modelsQuery.refetch()">刷新</button>
          </header>
          <div v-if="models.length === 0" class="admin-empty" role="status">暂无模型部署，可在右侧登记。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>模型 / 名称</th><th>提供方</th><th>驻留策略</th><th>评估状态</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="model in models" :key="model.model_deployment_id">
                  <td><strong>{{ model.display_name }}</strong><small><code>{{ model.model_code }}</code> · …{{ model.model_deployment_id.slice(-8) }} · v{{ model.row_version }}</small></td>
                  <td><code>{{ model.provider_code }}</code></td>
                  <td>{{ residencyPolicyLabels[model.residency_policy] }}</td>
                  <td><span class="admin-status" :class="model.evaluation_status.toLowerCase()">{{ evaluationStatusLabels[model.evaluation_status] }}</span></td>
                  <td><span class="admin-status" :class="model.status.toLowerCase()">{{ model.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="model.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(model)">{{ busy === model.model_deployment_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>登记模型部署</h2><p>模型编码、提供方编码与显示名称为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="register">
            <label><span>模型编码</span><input v-model="form.modelCode" maxlength="128" required placeholder="例：DEEPSEEK-V4" /></label>
            <label><span>提供方编码</span><input v-model="form.providerCode" maxlength="128" required placeholder="例：DEEPSEEK" /></label>
            <label><span>显示名称</span><input v-model="form.displayName" maxlength="256" required placeholder="例：DeepSeek V4 主模型" /></label>
            <label><span>驻留策略</span><select v-model="form.residencyPolicy"><option v-for="(name, policy) in residencyPolicyLabels" :key="policy" :value="policy">{{ name }}</option></select></label>
            <label><span>端点地址（可选）</span><input v-model="form.endpointUrl" maxlength="512" placeholder="例：https://llm.example.com/v1" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在登记…' : '登记并生效' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
