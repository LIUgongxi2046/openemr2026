<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const scopeLabels: Record<string, { name: string; prefix: string }> = {
  OBGYN: { name: '妇产', prefix: 'obgyn' },
  REPRODUCTIVE_MEDICINE: { name: '生殖', prefix: 'reproductive' },
  PEDIATRICS: { name: '儿科', prefix: 'pediatrics' },
  NEONATAL: { name: '新生儿', prefix: 'neonatal' },
  MENTAL_HEALTH: { name: '精神心理', prefix: 'mental' },
  OPHTHALMOLOGY: { name: '眼科', prefix: 'ophthalmology' },
  ENT: { name: '耳鼻喉', prefix: 'ent' },
  DENTAL: { name: '口腔', prefix: 'dental' },
  DERMATOLOGY: { name: '皮肤', prefix: 'dermatology' },
  TCM: { name: '中医', prefix: 'tcm' },
};

const leaseQuery = useQuery({
  queryKey: ['specialty', 'center', 'lease'],
  queryFn: () => issueSpecialtySupportLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const assessmentsQuery = useQuery({
  queryKey: ['specialty', 'center', 'assessments'],
  queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? assessmentsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? assessmentsQuery.error.value) : null);
const assessments = computed(() => assessmentsQuery.data.value ?? []);

const specialties = computed(() => Object.entries(scopeLabels).map(([scope, meta]) => {
  const match = assessments.value.find((a) => a.clinical_scope_code === scope);
  return { scope, name: meta.name, prefix: meta.prefix, assessment: match ?? null };
}));

function levelLabel(level: string | undefined) {
  const map: Record<string, string> = {
    GENERAL_AVAILABLE: '通用可用', BASIC_CLOSED_LOOP: '基础闭环', PACK_PENDING: '能力包待配', UNSUPPORTED: '不支持',
  };
  return level ? map[level] ?? level : '未评估';
}

function levelClass(level: string | undefined) {
  if (level === 'GENERAL_AVAILABLE') return 'active';
  if (level === 'BASIC_CLOSED_LOOP') return 'active';
  return '';
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">专科中心</p><h1>专科支持总览</h1><p>十个核心专科的能力包支持等级与证据状态；越界能力默认拒绝，未验证科室不能升级支持级别。</p></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || assessmentsQuery.isPending.value" kind="loading" message="正在读取专科支持评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assessmentsQuery.refetch()" />
    <template v-else>
      <section class="admin-panel">
        <header><div><h2>专科支持台账</h2><p>支持等级绑定证据哈希与缺失安全门。</p></div><button class="button secondary" @click="assessmentsQuery.refetch()">刷新</button></header>
        <div v-if="specialties.length === 0" class="admin-empty">暂无专科支持评估。</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>专科</th><th>支持等级</th><th>缺失安全门</th><th>有效期</th><th>入口</th></tr></thead>
            <tbody>
              <tr v-for="specialty in specialties" :key="specialty.scope">
                <td><strong>{{ specialty.name }}</strong><small><code>{{ specialty.scope }}</code></small></td>
                <td><span class="admin-status" :class="levelClass(specialty.assessment?.support_level)">{{ levelLabel(specialty.assessment?.support_level) }}</span></td>
                <td>{{ specialty.assessment?.missing_safety_gates.length ? specialty.assessment.missing_safety_gates.join('、') : '无' }}</td>
                <td>{{ specialty.assessment?.expires_at ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(specialty.assessment.expires_at)) : '长期' }}</td>
                <td><RouterLink class="task-action" :to="`/${specialty.prefix}-workbench`">工作台</RouterLink> <RouterLink class="task-action" :to="`/${specialty.prefix}-record`">记录</RouterLink></td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>
  </section>
</template>
