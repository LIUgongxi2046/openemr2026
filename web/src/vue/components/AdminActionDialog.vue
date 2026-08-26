<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, useId, watch } from 'vue';

const props = withDefaults(defineProps<{
  open: boolean;
  title: string;
  description?: string;
  eyebrow?: string;
  size?: 'medium' | 'large';
  tone?: 'default' | 'danger';
  busy?: boolean;
}>(), {
  description: '',
  eyebrow: '系统管理',
  size: 'medium',
  tone: 'default',
  busy: false,
});

const emit = defineEmits<{ 'update:open': [value: boolean] }>();
const dialog = ref<HTMLDialogElement | null>(null);
const instanceId = useId().replace(/:/g, '');
const titleId = `admin-action-title-${instanceId}`;
const descriptionId = `admin-action-description-${instanceId}`;

function requestClose() {
  if (!props.busy) emit('update:open', false);
}

function handleCancel(event: Event) {
  event.preventDefault();
  requestClose();
}

function handleClosed() {
  if (props.open) emit('update:open', false);
}

async function syncDialog(open: boolean) {
  await nextTick();
  const element = dialog.value;
  if (!element) return;
  if (open && !element.open) {
    element.showModal();
    await nextTick();
    const target = element.querySelector<HTMLElement>('[autofocus], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled])');
    target?.focus();
  } else if (!open && element.open) {
    element.close();
  }
}

watch(() => props.open, syncDialog, { immediate: true });
onBeforeUnmount(() => { if (dialog.value?.open) dialog.value.close(); });
</script>

<template>
  <dialog
    ref="dialog"
    class="admin-action-dialog"
    :class="[`is-${size}`, `is-${tone}`]"
    :aria-labelledby="titleId"
    :aria-describedby="description ? descriptionId : undefined"
    @cancel="handleCancel"
    @close="handleClosed"
  >
    <div class="admin-action-dialog-shell">
      <header>
        <div>
          <span>{{ eyebrow }}</span>
          <h2 :id="titleId">{{ title }}</h2>
          <p v-if="description" :id="descriptionId">{{ description }}</p>
        </div>
        <button type="button" :disabled="busy" aria-label="关闭弹窗" @click="requestClose">关闭</button>
      </header>
      <div class="admin-action-dialog-body"><slot /></div>
      <footer v-if="$slots.footer" class="admin-action-dialog-footer">
        <slot name="footer" :close="requestClose" />
      </footer>
    </div>
  </dialog>
</template>
