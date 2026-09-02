<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueSpecialtySupportLease, loadSpecialtySupportAssessments } from '../../clinical-api';

const modules = [
  { icon: '质', title: '院科病历质控', description: '运行与终末质控、抽查、整改和复核', to: '/department-qc' },
  { icon: '级', title: '评级取证', description: '39 项功能、应用范围、质量和证据快照', to: '/quality-rating' },
  { icon: '感', title: '院感与不良事件', description: '线索、排除、上报、重试和闭环', to: '/infection-events' },
  { icon: '权', title: '临床资质', description: '处方、手术、技术和临时授权', to: '/credentials' },
  { icon: '历', title: '跨域：病历中心', description: '进入患者病历创作、来源、审签和版本', to: '/record' },
  { icon: '案', title: '跨域：病案资产中心', description: '进入目录、扫描、验真、借阅和长期保存', to: '/archive-assets' },
] as const;

const leaseQuery = useQuery({ queryKey: ['quality-center', 'rating-lease'], queryFn: issueSpecialtySupportLease, retry: false, staleTime: 5 * 60_000 });
const ratingQuery = useQuery({ queryKey: ['quality-center', 'rating-mapping'], queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false, staleTime: 0 });
const mappedProjects = computed(() => new Set((ratingQuery.data.value ?? []).map((item) => item.clinical_scope_code)).size);
const verifiedProjects = computed(() => new Set((ratingQuery.data.value ?? []).filter((item) => ['GENERAL_AVAILABLE', 'BASIC_CLOSED_LOOP'].includes(item.support_level)).map((item) => item.clinical_scope_code)).size);
</script>

<template>
  <section data-page-root class="content vue-native-page quality-center-page">
    <div class="page-head"><div class="page-title"><h1>医疗质量中心</h1><p>院科病历质量、评级证据、院感事件和临床资质统一治理</p></div><div class="head-actions"><RouterLink class="btn" to="/quality-center/initiatives">角色工作台</RouterLink><RouterLink class="btn primary" to="/clinical-tasks">查看全部待办</RouterLink></div></div>
    <section class="hub-hero" aria-label="医疗质量中心治理摘要"><div><span>QUALITY &amp; SAFETY</span><h2>把每个质量指标落回患者、文书、规则、缺陷和整改证据</h2><p>功能存在不等于有效应用；中心同时呈现覆盖范围、数据质量、问题工单、整改复核与评级取证快照。具体病历和病案证据使用明确跨域入口查看。</p></div><div class="hub-score"><b>{{ leaseQuery.isPending.value || ratingQuery.isPending.value ? '…' : `${mappedProjects}/39` }}</b><span>已建档范围，其中 {{ verifiedProjects }} 项已验证</span></div></section>
    <nav class="hub-module-grid quality-center-modules" aria-label="医疗质量中心功能入口"><RouterLink v-for="item in modules" :key="item.to" class="hub-module" :to="item.to"><span>{{ item.icon }}</span><b>{{ item.title }}</b><p>{{ item.description }}</p><i>进入 →</i></RouterLink></nav>
  </section>
</template>

<style scoped>
.quality-center-page .hub-hero h2,.quality-center-page .hub-hero p{color:#fff}.quality-center-modules{grid-template-columns:repeat(3,minmax(0,1fr));margin-bottom:16px}.hub-module{color:inherit;text-decoration:none}@media(max-width:900px){.quality-center-modules{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.page-head{height:auto;flex-direction:column;align-items:stretch}.head-actions{display:flex;flex-wrap:wrap;margin-left:0}}
</style>
