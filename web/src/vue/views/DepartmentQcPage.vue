<script setup lang="ts">
import MetricWorkbenchPage from '../components/MetricWorkbenchPage.vue';
import { metricWorkbench } from '../metric-workbenches';
const definition = metricWorkbench('department-qc');
</script>

<template><MetricWorkbenchPage :definition="definition" /></template>
