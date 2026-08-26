<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import ClinicalShell from './components/ClinicalShell.vue';

const route = useRoute();
const usesSystemAuthLayout = computed(() => route.meta.layout === 'SYSTEM_AUTH');
</script>

<template>
  <RouterView v-if="usesSystemAuthLayout" />
  <ClinicalShell v-else><RouterView /></ClinicalShell>
</template>
