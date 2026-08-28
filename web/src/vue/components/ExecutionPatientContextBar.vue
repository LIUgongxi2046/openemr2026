<script setup lang="ts">
import { computed, inject } from 'vue';
import { executionPatientSelectionKey } from '../execution-patient-flow';

const context = inject(executionPatientSelectionKey, null);
const selected = computed(() => context?.selected.value ?? null);
const config = computed(() => context?.config.value ?? null);
</script>

<template>
  <section v-if="selected && config" data-execution-patient-context class="execution-context-bar" aria-label="当前下转患者">
    <div class="selected-patient-avatar" aria-hidden="true">{{ selected.patientDisplayName.slice(0, 1) }}</div>
    <div class="selected-patient-main">
      <span>已下转到 {{ config.title }}工作台</span>
      <strong>{{ selected.patientDisplayName }} · {{ selected.visitType }} · {{ selected.location }}</strong>
      <small>患者 {{ selected.patientId }} · 就诊 {{ selected.encounterId }}</small>
    </div>
    <button class="context-return-button" type="button" data-return-execution-list @click="context?.returnToList()">返回患者列表</button>
  </section>
</template>

<style scoped>
.execution-context-bar { position: sticky; z-index: 3; top: 0; display: flex; align-items: center; gap: 12px; margin: 0 0 16px; padding: 12px 15px; border: 1px solid #bcd8ee; border-radius: 11px; background: #f2f8fd; box-shadow: 0 5px 16px rgba(24, 85, 132, .08); }
.selected-patient-avatar { display: grid; width: 38px; height: 38px; flex: 0 0 auto; place-items: center; border-radius: 50%; background: #0b6bcb; color: #fff; font-weight: 800; }
.selected-patient-main { display: grid; flex: 1; gap: 2px; min-width: 0; }
.selected-patient-main span { color: #1769aa; font-size: 12px; font-weight: 700; }
.selected-patient-main strong { overflow: hidden; color: #18334b; text-overflow: ellipsis; white-space: nowrap; }
.selected-patient-main small { overflow: hidden; color: #607488; text-overflow: ellipsis; white-space: nowrap; }
.context-return-button { min-height: 36px; flex: 0 0 auto; border: 1px solid #bfd0df; border-radius: 8px; padding: 7px 13px; background: #fff; color: #31506d; font-weight: 700; cursor: pointer; white-space: nowrap; }
.context-return-button:hover { background: #f8fbff; }
@media (max-width: 700px) {
  .execution-context-bar { align-items: flex-start; flex-wrap: wrap; }
  .context-return-button { width: 100%; }
}
</style>
