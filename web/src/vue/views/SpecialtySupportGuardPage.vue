<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';
import { resolveSpecialtyRouteAccess } from '../../specialty-support';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { routeById, specialtyScopeForRoute } from '../route-registry';

const route = useRoute();
const routeId = computed(() => String(route.meta.contractId));
const definition = computed(() => routeById.get(routeId.value));
const scope = computed(() => specialtyScopeForRoute(routeId.value));
const supportQuery = useQuery({
  queryKey: ['governance', 'specialty-support'],
  queryFn: async () => loadSpecialtySupportAssessments(await issueSpecialtySupportLease()),
  retry: false,
  staleTime: 10 * 60_000,
  gcTime: 10 * 60_000,
});
const issue = computed(() => supportQuery.error.value ? toClinicalIssue(supportQuery.error.value) : null);
const assessment = computed(() => supportQuery.data.value?.find((item) => item.clinical_scope_code === scope.value));
const access = computed(() => assessment.value ? resolveSpecialtyRouteAccess(assessment.value) : null);
const counts = computed(() => ({ verified: supportQuery.data.value?.filter((item) => item.support_level === 'BASIC_CLOSED_LOOP').length ?? 0, general: supportQuery.data.value?.filter((item) => item.support_level === 'GENERAL_AVAILABLE').length ?? 0, gap: supportQuery.data.value?.filter((item) => ['PACK_PENDING','UNSUPPORTED'].includes(item.support_level)).length ?? 0 }));
</script>

<template>
  <main id="main-content" class="vue-boundary-page specialty-guard-page"><p class="eyebrow">专科支持门禁 / {{ routeId }}</p><h1>{{ definition?.title }}</h1><ClinicalPageState v-if="supportQuery.isPending.value" kind="loading" message="正在读取院级专科支持声明与证据有效期" /><ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="supportQuery.refetch()" />
    <template v-else-if="routeId === 'specialty-center'"><section class="migration-notice" role="status"><strong>专科能力按真实支持声明开放</strong><p>路由和高保真页面不等于科室已验证；只有 `BASIC_CLOSED_LOOP` 且证据有效的专科才能进入发布清单。</p></section><section class="specialty-support-metrics"><article><span>闭环已验证</span><strong>{{ counts.verified }}</strong></article><article><span>仅通用内核</span><strong>{{ counts.general }}</strong></article><article><span>缺口或阻断</span><strong>{{ counts.gap }}</strong></article></section></template>
    <template v-else><section v-if="!assessment" class="migration-notice specialty-blocked" role="alert"><strong>未找到当前机构的专科支持声明</strong><p>{{ scope }} 不会因为页面已登记就被宣称为可用；需先完成专科包、临床闭环、恢复与科室签字证据。</p></section><section v-else class="migration-notice" :class="`specialty-${access?.mode.toLowerCase()}`" role="status"><strong>{{ access?.mode === 'SPECIALTY_ENABLED' ? '专科闭环证据有效' : access?.mode === 'GENERAL_CORE_ONLY' ? '仅允许通用临床内核' : access?.mode === 'GAP_ONLY' ? '仅展示能力缺口' : '当前专科范围已阻断' }}</strong><p>支持级别：{{ assessment.support_level }} · 评估时间 {{ new Date(assessment.assessed_at).toLocaleString('zh-CN') }}</p><p v-if="assessment.expires_at">证据有效期至 {{ new Date(assessment.expires_at).toLocaleString('zh-CN') }}</p><p v-if="assessment.missing_safety_gates.length">缺失门禁：{{ assessment.missing_safety_gates.join('、') }}</p><p v-if="access?.mode === 'SPECIALTY_ENABLED'">支持声明通过并不自动完成本业务页；仍需该路由 API、异常、恢复和临床验收后才能替换本门禁页。</p></section></template>
    <dl class="route-contract-card"><div><dt>需求</dt><dd>{{ definition?.requirement_refs.join(' · ') }}</dd></div><div><dt>角色</dt><dd>{{ definition?.roles.join(' · ') }}</dd></div><div><dt>守卫</dt><dd>{{ definition?.guards.join(' · ') }}</dd></div><div><dt>科室范围</dt><dd>{{ scope || '全部专科声明汇总' }}</dd></div></dl>
  </main>
</template>
