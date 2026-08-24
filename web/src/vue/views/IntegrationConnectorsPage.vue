<script setup lang="ts">
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { simulationWorkbench } from '../simulation-workbenches';
const definition = simulationWorkbench('integration-connectors');
</script>

<template><SimulationWorkbenchPage :definition="definition" /></template>
