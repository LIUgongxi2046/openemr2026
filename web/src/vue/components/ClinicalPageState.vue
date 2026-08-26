<script setup lang="ts">
defineProps<{ kind: 'loading' | 'error'; code?: string; message?: string }>();
defineEmits<{ retry: [] }>();
</script>

<template>
  <div v-if="kind === 'loading'" class="state-page" aria-live="polite">
    <div class="spinner" /><h2>正在连接当前诊疗场景</h2><p>完成身份、岗位、患者和就诊授权校验后加载数据。</p>
  </div>
  <div v-else class="state-page error" role="alert">
    <span>!</span><h2>临床页面暂不可用</h2><p>{{ code }}：{{ message }}</p>
    <button class="button primary" @click="$emit('retry')">重新连接</button>
  </div>
</template>
