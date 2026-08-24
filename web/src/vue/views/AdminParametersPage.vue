<script setup lang="ts">
import ConfigurationStudioPage from '../components/ConfigurationStudioPage.vue';
import { configurationStudio } from '../configuration-studios';

const definition = configurationStudio('admin-parameters');
</script>

<template><ConfigurationStudioPage :definition="definition" /></template>
