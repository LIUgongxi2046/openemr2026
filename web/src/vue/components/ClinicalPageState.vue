<script setup lang="ts">
defineProps<{ kind: 'loading' | 'error'; code?: string; message?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="kind === 'loading'" class="state-page" aria-live="polite">
    <div class="spinner" /><h2>正在建立临床上下文</h2><p>验证身份、岗位和患者租约后加载数据。</p>
  </div>
  <div v-else class="state-page error" role="alert">
    <span>!</span><h2>临床页面暂不可用</h2><p>{{ code }}：{{ message }}</p>
    <button class="button primary" @click="$emit('retry')">重新连接</button>
  </div>
</template>
