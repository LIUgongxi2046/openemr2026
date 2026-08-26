<script setup lang="ts">
import AdminActionDialog from './AdminActionDialog.vue';

withDefaults(defineProps<{
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  busy?: boolean;
}>(), {
  confirmLabel: '确认停用',
  cancelLabel: '取消',
  busy: false,
});

const emit = defineEmits<{
  'update:open': [value: boolean];
  confirm: [];
}>();
</script>

<template>
  <AdminActionDialog
    :open="open"
    :title="title"
    :description="description"
    eyebrow="高风险操作确认"
    tone="danger"
    :busy="busy"
    @update:open="emit('update:open', $event)"
  >
    <div class="admin-confirm-impact">
      <strong>本操作会立即影响新的业务流程</strong>
      <p>历史病历、审计证据、签名和既有引用仍然保留，系统不会物理删除受管数据。</p>
    </div>
    <slot />
    <template #footer="{ close }">
      <button class="button secondary" type="button" :disabled="busy" @click="close">{{ cancelLabel }}</button>
      <button class="button danger" type="button" :disabled="busy" @click="emit('confirm')">{{ busy ? '正在处理…' : confirmLabel }}</button>
    </template>
  </AdminActionDialog>
</template>
