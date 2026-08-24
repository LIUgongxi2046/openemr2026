<script setup lang="ts">
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { simulationWorkbench } from '../simulation-workbenches';
const definition = simulationWorkbench('device-monitoring');
</script>

<template><SimulationWorkbenchPage :definition="definition" /></template>
