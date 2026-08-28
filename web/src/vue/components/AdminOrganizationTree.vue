<script setup lang="ts">
import type { OrganizationTreeNode } from '../organization-tree';

defineOptions({ name: 'AdminOrganizationTree' });
const props = withDefaults(defineProps<{
  nodes: OrganizationTreeNode[];
  expandedIds: ReadonlySet<string>;
  selectedUnitId: string;
  depth?: number;
}>(), { depth: 0 });
const emit = defineEmits<{
  toggle: [unitId: string];
  select: [unitId: string];
}>();

function summary(node: OrganizationTreeNode) {
  if (node.unit.unit_type === 'WARD') return `${node.activeBedCount} 床`;
  const labels: Partial<Record<OrganizationTreeNode['unit']['unit_type'], string>> = {
    ORGANIZATION: '院区', FACILITY: '科室', DEPARTMENT: '病区',
  };
  return `${node.children.length} ${labels[node.unit.unit_type] ?? '单元'}`;
}
</script>

<template>
  <ul class="org-tree-list" :role="props.depth === 0 ? 'tree' : 'group'">
    <li
      v-for="node in props.nodes"
      :key="node.unit.unit_id"
      class="org-tree-item"
      role="treeitem"
      :aria-expanded="node.children.length ? props.expandedIds.has(node.unit.unit_id) : undefined"
      :aria-selected="props.selectedUnitId === node.unit.unit_id"
    >
      <div
        class="org-tree-node-row"
        :class="{ active: props.selectedUnitId === node.unit.unit_id }"
        :style="{ paddingLeft: `${8 + props.depth * 14}px` }"
      >
        <button
          v-if="node.children.length"
          class="org-tree-toggle"
          type="button"
          :aria-label="`${props.expandedIds.has(node.unit.unit_id) ? '收起' : '展开'}${node.unit.display_name}`"
          @click.stop="emit('toggle', node.unit.unit_id)"
        ><span aria-hidden="true">{{ props.expandedIds.has(node.unit.unit_id) ? '▾' : '▸' }}</span></button>
        <span v-else class="org-tree-leaf" aria-hidden="true">·</span>
        <button
          class="org-tree-select"
          type="button"
          :title="node.unit.display_name"
          @click="emit('select', node.unit.unit_id)"
        ><b>{{ node.unit.display_name }}</b></button>
        <span class="org-tree-summary">{{ summary(node) }}</span>
      </div>
      <AdminOrganizationTree
        v-if="node.children.length && props.expandedIds.has(node.unit.unit_id)"
        :nodes="node.children"
        :expanded-ids="props.expandedIds"
        :selected-unit-id="props.selectedUnitId"
        :depth="props.depth + 1"
        @toggle="emit('toggle', $event)"
        @select="emit('select', $event)"
      />
    </li>
  </ul>
</template>

<style>
.admin-domain-content .organization-admin-page .org-tree {
  display: grid;
  grid-template-rows: auto auto auto minmax(0,1fr);
  align-self: start;
  height: clamp(360px, calc(100vh - 190px), 720px);
  height: clamp(360px, calc(100dvh - 190px), 720px);
  max-height: none;
  overflow: hidden;
}
.admin-domain-content .organization-admin-page .org-tree .card-head {
  justify-content: space-between;
  background: #fff;
}
.admin-domain-content .organization-admin-page .org-tree-node-count {
  flex: 0 0 auto;
  color: var(--muted);
  font-size: 9px;
  font-weight: 600;
  white-space: nowrap;
}
.admin-domain-content .organization-admin-page .org-tree-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 7px 9px;
  border-bottom: 1px solid var(--line);
  background: #f8fbff;
}
.admin-domain-content .organization-admin-page .org-tree-toolbar .task-action { margin: 0; }
.admin-domain-content .organization-admin-page .org-tree-scroll {
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  scrollbar-gutter: stable;
  -webkit-overflow-scrolling: touch;
}
.admin-domain-content .organization-admin-page .org-tree-scroll:focus-visible {
  outline: 2px solid #2f7dd1;
  outline-offset: -2px;
}
.admin-domain-content .organization-admin-page .org-tree-list {
  margin: 0;
  padding: 0;
  list-style: none;
}
.admin-domain-content .organization-admin-page .org-tree-item { margin: 0; padding: 0; }
.admin-domain-content .organization-admin-page .org-tree-node-row {
  display: grid;
  grid-template-columns: 22px minmax(0,1fr) auto;
  align-items: center;
  min-height: 36px;
  padding: 5px 9px 5px 8px;
  border-bottom: 1px solid var(--line);
  background: #fff;
}
.admin-domain-content .organization-admin-page .org-tree-node-row:hover { background: #f7faff; }
.admin-domain-content .organization-admin-page .org-tree-node-row.active { background: #eaf3ff; }
.admin-domain-content .organization-admin-page .org-tree-toggle,
.admin-domain-content .organization-admin-page .org-tree-select {
  min-width: 0;
  margin: 0;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  font: inherit;
}
.admin-domain-content .organization-admin-page .org-tree-toggle {
  display: grid;
  width: 22px;
  height: 26px;
  place-items: center;
  border-radius: 5px;
  color: #4f6f95;
  cursor: pointer;
}
.admin-domain-content .organization-admin-page .org-tree-toggle:hover { background: #dfeeff; color: #135ca8; }
.admin-domain-content .organization-admin-page .org-tree-toggle:focus-visible,
.admin-domain-content .organization-admin-page .org-tree-select:focus-visible {
  outline: 2px solid #2f7dd1;
  outline-offset: 1px;
}
.admin-domain-content .organization-admin-page .org-tree-leaf {
  display: grid;
  width: 22px;
  place-items: center;
  color: #9aa9b8;
}
.admin-domain-content .organization-admin-page .org-tree-select {
  overflow: hidden;
  text-align: left;
  cursor: pointer;
}
.admin-domain-content .organization-admin-page .org-tree-select b {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.admin-domain-content .organization-admin-page .org-tree-summary {
  padding-left: 6px;
  color: var(--muted);
  font-size: 9px;
  white-space: nowrap;
}
</style>
