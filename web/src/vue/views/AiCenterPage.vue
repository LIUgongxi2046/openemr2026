<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';

import { issueAiLease, listModelDeployments } from '../../api/ai-platform';
import { issueMedicalAgentCatalogLease, listMedicalAgentCatalog } from '../../api/medical-agents';

const modelLeaseQuery = useQuery({
  queryKey: ['ai-center', 'model-lease'],
  queryFn: () => issueAiLease('AI_CENTER_OVERVIEW'),
  retry: false,
  staleTime: 60_000,
  gcTime: 0,
});
const modelsQuery = useQuery({
  queryKey: ['ai-center', 'models'],
  queryFn: () => listModelDeployments(modelLeaseQuery.data.value!),
  enabled: computed(() => Boolean(modelLeaseQuery.data.value)),
  retry: false,
  staleTime: 30_000,
});
const catalogLeaseQuery = useQuery({
  queryKey: ['ai-center', 'catalog-lease'],
  queryFn: issueMedicalAgentCatalogLease,
  retry: false,
  staleTime: 60_000,
  gcTime: 0,
});
const catalogQuery = useQuery({
  queryKey: ['ai-center', 'catalog'],
  queryFn: () => listMedicalAgentCatalog(catalogLeaseQuery.data.value!),
  enabled: computed(() => Boolean(catalogLeaseQuery.data.value)),
  retry: false,
  staleTime: 30_000,
});

const status = computed(() => {
  if (modelLeaseQuery.isPending.value || modelsQuery.isPending.value || catalogLeaseQuery.isPending.value || catalogQuery.isPending.value) {
    return { label: '正在核对服务状态', className: 'blue' };
  }
  if (modelLeaseQuery.error.value || modelsQuery.error.value || catalogLeaseQuery.error.value || catalogQuery.error.value) {
    return { label: 'AI 服务暂不可用', className: 'red' };
  }
  const readyModels = (modelsQuery.data.value ?? []).filter((model) => model.status === 'ACTIVE'
    && model.connection_status === 'READY' && model.evaluation_status === 'APPROVED').length;
  const activeTeams = (catalogQuery.data.value ?? []).length;
  if (readyModels === 0 || activeTeams === 0) return { label: 'AI 服务配置不完整', className: 'amber' };
  return { label: `${readyModels} 个模型 · ${activeTeams} 支医助团队可用`, className: 'green' };
});
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head"><div class="page-title"><h1>AI 总览</h1><p>AI医助 Eva、医助团队、医助能力、医助工具、评测发布与运行监测的统一入口</p></div></div>
    <div class="portal-safety"><b>使用说明</b><span>AI医助融入诊疗工作流程，生成的建议和草稿需由医务人员确认后使用，全过程可回看。</span><span class="status" :class="status.className" role="status">{{ status.label }}</span></div>
    <div class="hub-module-grid">
      <RouterLink class="hub-module" to="/ai-assistant"><span>✦</span><b>AI医助 Eva</b><p>随问随答、主动提醒、来源核验和任务草拟</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/models"><span>模</span><b>模型服务</b><p>配置模型提供方、API 地址、模型标识和密钥引用</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/agent-catalog"><span>医</span><b>医助团队编排</b><p>按诊疗环节配置医助分工、处理步骤和医生确认</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/skill-catalog"><span>能</span><b>医助能力库</b><p>管理病历整理、证据核验、风险提示等标准能力</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/tool-catalog"><span>工</span><b>医助工具库</b><p>管理院内系统查询、权限、审批和异常处置</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/agent"><span>运</span><b>医助任务运行</b><p>查看处理进度、医生确认、生成额度和任务记录</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/agent-evals"><span>评</span><b>医助评测发布</b><p>临床用例评测、对抗测试、试运行和版本回退</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/aiops"><span>监</span><b>医助运行监测</b><p>监测质量、响应时间、异常事件和服务停用</p><i>进入 →</i></RouterLink>
      <RouterLink class="hub-module" to="/ai-assistant-policy"><span>策</span><b>Eva工作策略</b><p>配置主动提醒、数据来源、模型选择和医生确认</p><i>进入 →</i></RouterLink>
    </div>
  </section>
</template>

<style scoped>
.hub-module-grid { grid-template-columns: repeat(3,minmax(0,1fr)); gap: 12px; }
.hub-module { min-width: 0; min-height: 132px; }
.hub-module p { overflow-wrap: anywhere; }
@media (max-width: 960px) { .hub-module-grid { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 560px) { .hub-module-grid { grid-template-columns: minmax(0,1fr); } }
</style>
