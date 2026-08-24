<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['quality', 'rating', 'lease'],
  queryFn: () => issueSpecialtySupportLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const assessmentsQuery = useQuery({
  queryKey: ['quality', 'rating', 'assessments'],
  queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? assessmentsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? assessmentsQuery.error.value) : null);
const assessments = computed(() => assessmentsQuery.data.value ?? []);
const generalAvailable = computed(() => assessments.value.filter((a) => a.support_level === 'GENERAL_AVAILABLE').length);

function levelLabel(level: string) {
  const map: Record<string, string> = {
    GENERAL_AVAILABLE: '通用可用', BASIC_CLOSED_LOOP: '基础闭环', PACK_PENDING: '能力包待配', UNSUPPORTED: '不支持',
  };
  return map[level] ?? level;
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">质量与安全 / 评级取证</p><h1>科室支持等级</h1><p>支持等级绑定证据哈希与缺失安全门；未验证科室不能升级支持级别。</p></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || assessmentsQuery.isPending.value" kind="loading" message="正在读取支持评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assessmentsQuery.refetch()" />
    <template v-else>
      <section class="admin-metrics" aria-label="支持等级统计">
        <article><span>评估记录</span><strong>{{ assessments.length }}</strong><small>当前院区</small></article>
        <article><span>通用可用</span><strong>{{ generalAvailable }}</strong><small>GENERAL_AVAILABLE</small></article>
      </section>
      <section class="admin-panel">
        <header><div><h2>支持评估台账</h2><p>证据哈希与缺失安全门决定评级，不得手工越级。</p></div><button class="button secondary" @click="assessmentsQuery.refetch()">刷新</button></header>
        <div v-if="assessments.length === 0" class="admin-empty">该院区暂无支持评估。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>科室 / 范围</th><th>支持等级</th><th>证据哈希</th><th>缺失安全门</th><th>有效期</th></tr></thead><tbody>
          <tr v-for="assessment in assessments" :key="assessment.department_support_assessment_id">
            <td><strong>{{ assessment.clinical_scope_code }}</strong><small>…{{ assessment.department_id.slice(-8) }}</small></td>
            <td><span class="admin-status" :class="assessment.support_level.toLowerCase()">{{ levelLabel(assessment.support_level) }}</span></td>
            <td><code>{{ assessment.evidence_bundle_hash ? assessment.evidence_bundle_hash.slice(0, 16) + '…' : '—' }}</code></td>
            <td>{{ assessment.missing_safety_gates.length ? assessment.missing_safety_gates.join('、') : '无' }}</td>
            <td>{{ assessment.expires_at ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(assessment.expires_at)) : '长期' }}</td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </main>
</template>
