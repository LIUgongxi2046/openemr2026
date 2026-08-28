<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { simulationWorkbenches, type SimulationWorkbenchId } from '../simulation-workbenches';

const route = useRoute();
const definition = computed(() => simulationWorkbenches[String(route.params.workbenchId) as SimulationWorkbenchId]);
</script>

<template>
  <SimulationWorkbenchPage v-if="definition" :definition="definition" />
  <section v-else data-page-root class="content vue-native-page">
    <ClinicalPageState kind="empty" message="未找到该模拟接口场景，请从模拟接口子菜单重新选择。" />
  </section>
</template>
