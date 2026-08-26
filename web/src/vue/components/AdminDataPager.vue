<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{ page: number; pageSize?: number; total: number }>(), { pageSize: 15 });
const emit = defineEmits<{ 'update:page': [value: number] }>();
const pages = computed(() => Math.max(1, Math.ceil(props.total / props.pageSize)));
const start = computed(() => props.total ? (props.page - 1) * props.pageSize + 1 : 0);
const end = computed(() => Math.min(props.total, props.page * props.pageSize));
function move(next: number) { emit('update:page', Math.min(pages.value, Math.max(1, next))); }
</script>

<template>
  <nav class="admin-data-pager" aria-label="数据分页">
    <span>显示 {{ start }}–{{ end }}，共 {{ total }} 条</span>
    <div><button type="button" :disabled="page <= 1" @click="move(page - 1)">上一页</button><b>{{ page }} / {{ pages }}</b><button type="button" :disabled="page >= pages" @click="move(page + 1)">下一页</button></div>
  </nav>
</template>

<style scoped>
.admin-data-pager{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 14px;border-top:1px solid var(--line);color:var(--muted);font-size:10px}.admin-data-pager>div{display:flex;align-items:center;gap:8px}.admin-data-pager button{border:1px solid var(--line);border-radius:6px;background:#fff;padding:5px 9px;color:var(--ink);cursor:pointer}.admin-data-pager button:disabled{opacity:.45;cursor:not-allowed}.admin-data-pager b{font-size:10px;color:var(--ink)}@media(max-width:560px){.admin-data-pager{align-items:flex-start;flex-direction:column}}
</style>
