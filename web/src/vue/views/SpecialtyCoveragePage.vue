<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['specialty', 'coverage', 'lease'], queryFn: () => issueSpecialtySupportLease(), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const assessmentsQuery = useQuery({ queryKey: ['specialty', 'coverage', 'assessments'], queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? assessmentsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? assessmentsQuery.error.value) : null);
const assessments = computed(() => assessmentsQuery.data.value ?? []);

function levelLabel(level: string) { const m: Record<string, string> = { GENERAL_AVAILABLE: '通用可用', BASIC_CLOSED_LOOP: '基础闭环', PACK_PENDING: '能力包待配', UNSUPPORTED: '不支持' }; return m[level] ?? level; }
function coverage(level: string) { return level === 'GENERAL_AVAILABLE' ? 100 : level === 'BASIC_CLOSED_LOOP' ? 70 : level === 'PACK_PENDING' ? 30 : 0; }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">质量与安全 / 评级取证</p><h1>专科覆盖度</h1><p>各专科支持等级与缺失安全门；未验证科室不能升级支持级别。</p></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || assessmentsQuery.isPending.value" kind="loading" message="正在读取专科覆盖度" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assessmentsQuery.refetch()" />
    <template v-else>
      <section class="admin-panel"><header><div><h2>专科覆盖台账</h2><p>证据哈希与缺失安全门决定评级。</p></div><button class="button secondary" @click="assessmentsQuery.refetch()">刷新</button></header>
        <div v-if="!assessments.length" class="admin-empty">暂无支持评估。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>范围</th><th>支持等级</th><th>覆盖度</th><th>缺失安全门</th><th>证据有效期</th></tr></thead><tbody>
          <tr v-for="assessment in assessments" :key="assessment.department_support_assessment_id">
            <td><strong>{{ assessment.clinical_scope_code }}</strong><small>…{{ assessment.department_id.slice(-8) }}</small></td>
            <td><span class="admin-status" :class="assessment.support_level.toLowerCase()">{{ levelLabel(assessment.support_level) }}</span></td>
            <td><strong>{{ coverage(assessment.support_level) }}%</strong></td>
            <td>{{ assessment.missing_safety_gates.length ? assessment.missing_safety_gates.join('、') : '无' }}</td>
            <td>{{ assessment.expires_at ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(assessment.expires_at)) : '长期' }}</td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </section>
</template>
