<script setup lang="ts">
import ProductionExecutionWorkbenchPage from '../components/ProductionExecutionWorkbenchPage.vue';
import { specialtyExecutionWorkbenches } from '../specialty-execution-workbenches';
const definition = specialtyExecutionWorkbenches.THERAPY;
</script>

<template><ProductionExecutionWorkbenchPage :definition="definition" /></template>
