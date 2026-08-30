<script setup lang="ts">
import { computed } from 'vue';
import QualityOperationsPanel from '../components/QualityOperationsPanel.vue';
import type { QualityOperationModuleId } from '../quality-operations';
import { qualityOperation } from '../quality-operations';

const props = withDefaults(defineProps<{ moduleId: QualityOperationModuleId; itemId?: string }>(), { itemId: '' });
const definition = computed(() => qualityOperation(props.moduleId));
const parentPath = computed(() => `/${props.moduleId}`);
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav class="quality-breadcrumb" aria-label="质量中心层级导航">
      <RouterLink to="/quality-center">医疗质量中心</RouterLink><span>/</span>
      <RouterLink :to="parentPath">{{ definition.title }}</RouterLink><span>/</span>
      <RouterLink :to="definition.routeBase">工作台账</RouterLink><template v-if="itemId"><span>/</span><b>处理详情</b></template>
    </nav>
    <div class="page-heading admin-heading"><div><p class="eyebrow">质量与安全 / {{ itemId ? '四级详情' : '三级工作台' }}</p><h1>{{ itemId ? `${definition.itemLabel}处理详情` : definition.title }}</h1><p>{{ definition.description }}</p></div><div class="toolbar-actions"><RouterLink class="button secondary" :to="parentPath">返回二级页面</RouterLink><RouterLink v-if="itemId" class="button secondary" :to="definition.routeBase">返回台账</RouterLink></div></div>
    <QualityOperationsPanel :module-id="moduleId" :item-id="itemId" />
  </section>
</template>

<style scoped>
.quality-breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#667085;font-size:13px}.quality-breadcrumb a{color:#245493;text-decoration:none}.quality-breadcrumb b{color:#344054}
</style>
