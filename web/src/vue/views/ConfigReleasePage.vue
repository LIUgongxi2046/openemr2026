<script setup lang="ts">
import ConfigurationStudioPage from '../components/ConfigurationStudioPage.vue';
import { configurationStudio } from '../configuration-studios';

const definition = configurationStudio('config-release');
</script>

<template><ConfigurationStudioPage :definition="definition" /></template>
