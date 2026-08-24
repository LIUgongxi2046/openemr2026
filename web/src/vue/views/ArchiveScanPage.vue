<script setup lang="ts">
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { simulationWorkbench } from '../simulation-workbenches';
const definition = simulationWorkbench('archive-scan');
</script>

<template><SimulationWorkbenchPage :definition="definition" /></template>
