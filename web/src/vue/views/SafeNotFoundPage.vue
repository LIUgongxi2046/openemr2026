<script setup lang="ts">
import { onMounted } from 'vue';
import { useRoute } from 'vue-router';

import { useClinicalContextStore } from '../stores/clinical-context';

const route = useRoute();
const clinicalContext = useClinicalContextStore();
onMounted(() => clinicalContext.clear('UNKNOWN_ROUTE'));
</script>

<template>
  <section data-page-root class="vue-boundary-page not-found-page">
    <span>404</span>
    <h1>页面不存在或尚未登记</h1>
    <p>路由 <code>{{ route.fullPath }}</code> 不会静默回落到门诊或继续保留旧患者上下文。</p>
    <RouterLink class="button primary" to="/outpatient">返回门诊工作台</RouterLink>
  </section>
</template>
