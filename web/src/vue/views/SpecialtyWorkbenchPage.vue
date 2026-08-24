<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const prefix = computed(() => String(route.name ?? '').replace('-workbench', ''));

const specialtyMeta: Record<string, { name: string; scope: string }> = {
  obgyn: { name: '妇产', scope: 'OBGYN' },
  reproductive: { name: '生殖', scope: 'REPRODUCTIVE_MEDICINE' },
  pediatrics: { name: '儿科', scope: 'PEDIATRICS' },
  neonatal: { name: '新生儿', scope: 'NEONATAL' },
  mental: { name: '精神心理', scope: 'MENTAL_HEALTH' },
  ophthalmology: { name: '眼科', scope: 'OPHTHALMOLOGY' },
  ent: { name: '耳鼻喉', scope: 'ENT' },
  dental: { name: '口腔', scope: 'DENTAL' },
  dermatology: { name: '皮肤', scope: 'DERMATOLOGY' },
  tcm: { name: '中医', scope: 'TCM' },
};
const meta = computed(() => specialtyMeta[prefix.value] ?? { name: prefix.value, scope: prefix.value.toUpperCase() });

const layers: { key: string; label: string }[] = [
  { key: 'record', label: '记录' },
  { key: 'evidence', label: '证据' },
  { key: 'treatment', label: '治疗' },
  { key: 'care', label: '护理' },
  { key: 'followup', label: '随访' },
  { key: 'qc', label: '质控' },
];

const leaseQuery = useQuery({
  queryKey: ['specialty', 'workbench', 'lease'],
  queryFn: () => issueSpecialtySupportLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const assessmentsQuery = useQuery({
  queryKey: ['specialty', 'workbench', 'assessments'],
  queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? assessmentsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? assessmentsQuery.error.value) : null);
const assessment = computed(() => assessmentsQuery.data.value?.find((a) => a.clinical_scope_code === meta.value.scope) ?? null);

function levelLabel(level: string | undefined) {
  const map: Record<string, string> = {
    GENERAL_AVAILABLE: '通用可用', BASIC_CLOSED_LOOP: '基础闭环', PACK_PENDING: '能力包待配', UNSUPPORTED: '不支持',
  };
  return level ? map[level] ?? level : '未评估';
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">专科中心 / {{ meta.name }}</p><h1>{{ meta.name }}工作台</h1><p>支持等级 {{ levelLabel(assessment?.support_level) }}；越界能力默认拒绝，未验证科室不能升级支持级别。</p></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || assessmentsQuery.isPending.value" kind="loading" message="正在读取专科支持评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assessmentsQuery.refetch()" />
    <template v-else>
      <section class="admin-metrics" aria-label="专科支持状态">
        <article><span>支持等级</span><strong>{{ levelLabel(assessment?.support_level) }}</strong><small>{{ meta.scope }}</small></article>
        <article><span>缺失安全门</span><strong>{{ assessment?.missing_safety_gates.length ?? 0 }}</strong><small>项</small></article>
      </section>
      <section class="admin-panel">
        <header><div><h2>七层入口</h2><p>记录 / 证据 / 治疗 / 护理 / 随访 / 质控，逐层真实 API。</p></div></header>
        <div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>层级</th><th>路由</th><th>入口</th></tr></thead><tbody>
          <tr v-for="layer in layers" :key="layer.key">
            <td><strong>{{ layer.label }}</strong></td>
            <td><code>{{ prefix }}-{{ layer.key }}</code></td>
            <td><RouterLink class="task-action" :to="`/${prefix}-${layer.key}`">进入</RouterLink></td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </main>
</template>
