<script setup lang="ts">
import AdminActionDialog from './AdminActionDialog.vue';

withDefaults(defineProps<{
  modal: boolean;
  open: boolean;
  title: string;
  description: string;
  busy?: boolean;
}>(), { busy: false });

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
</script>

<template>
  <AdminActionDialog v-if="modal" :open="open" :title="title" :description="description" size="large" :busy="busy" @update:open="emit('update:open', $event)">
    <div class="admin-editor-dialog-content"><slot /></div>
  </AdminActionDialog>
  <template v-else><slot /></template>
</template>
