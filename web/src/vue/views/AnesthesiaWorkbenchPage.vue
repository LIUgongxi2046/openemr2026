<script setup lang="ts">
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { simulationWorkbench } from '../simulation-workbenches';
const definition = simulationWorkbench('anesthesia-workbench');
</script>

<template><SimulationWorkbenchPage :definition="definition" /></template>
