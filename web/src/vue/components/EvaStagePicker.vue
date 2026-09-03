<script setup lang="ts">
import type { MedicalAgentReleaseWire } from '../../generated/contracts';
import { doctorFacingAiText } from '../medical-ai-terminology';

const props = defineProps<{
  children: MedicalAgentReleaseWire[];
  selectedStageCode: string;
  collapsed: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  'update:collapsed': [value: boolean];
  select: [child: MedicalAgentReleaseWire];
}>();
</script>

<template>
  <section class="eva-stage-picker" :class="{ collapsed }" aria-label="诊疗环节医助">
    <header class="eva-stage-picker-head">
      <button type="button" class="eva-stage-toggle" :aria-expanded="!collapsed" :aria-label="collapsed ? '展开诊疗环节医助' : '折叠诊疗环节医助'" @click="emit('update:collapsed', !collapsed)">
        <span class="eva-stage-caret" aria-hidden="true">{{ collapsed ? '›' : '⌄' }}</span>
        <span class="eva-stage-title">诊疗环节医助</span>
        <span class="eva-stage-count">{{ children.length }}</span>
      </button>
      <span v-if="!collapsed" class="eva-stage-hint">选择本次任务要安排的环节医助</span>
    </header>
    <nav v-if="!collapsed" class="eva-stage-chips" aria-label="选择诊疗环节医助">
      <button
        v-for="child in children"
        :key="child.agent_code"
        type="button"
        :class="{ selected: child.stage_code === selectedStageCode }"
        :aria-pressed="child.stage_code === selectedStageCode"
        :disabled="busy"
        :title="doctorFacingAiText(child.question_examples[0] ?? child.current_action)"
        @click="emit('select', child)"
      >
        <b>{{ doctorFacingAiText(child.display_name) }}</b>
        <small>{{ doctorFacingAiText(child.question_examples[0] ?? child.current_action) }}</small>
      </button>
    </nav>
  </section>
</template>

<style scoped>
.eva-stage-picker { display: grid; gap: 0; border-bottom: 1px solid #d8e3ef; background: #f7fafd; }
.eva-stage-picker-head { display: flex; align-items: center; gap: 10px; min-height: 40px; padding: 5px 12px; }
.eva-stage-toggle { display: flex; align-items: center; gap: 6px; min-height: 28px; padding: 2px 7px; color: #315a83; border: 1px solid #c8d7e7; border-radius: 8px; background: #f8fbff; cursor: pointer; }
.eva-stage-caret { display: inline-grid; place-items: center; width: 14px; color: #315a83; font-size: 14px; line-height: 1; }
.eva-stage-title { color: #2d465f; font-size: 10px; font-weight: 800; }
.eva-stage-count { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; color: #1769e0; border-radius: 999px; background: #e8f2ff; font-size: 8px; font-weight: 800; }
.eva-stage-hint { overflow: hidden; color: #7b8b9a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.eva-stage-chips { display: flex; gap: 7px; padding: 7px 12px 10px; overflow-x: auto; scrollbar-width: thin; }
.eva-stage-chips > button { display: grid; gap: 2px; flex: 0 0 auto; min-width: 118px; max-width: 200px; padding: 7px 9px; color: inherit; border: 1px solid #d3dfe9; border-radius: 9px; background: #fff; text-align: left; cursor: pointer; }
.eva-stage-chips > button:hover { border-color: #9dbfe6; background: #f0f6fd; }
.eva-stage-chips > button.selected { border-color: #1769e0; background: #e8f2ff; box-shadow: 0 0 0 1px rgb(23 105 224 / 12%); }
.eva-stage-chips > button:disabled { opacity: .55; cursor: not-allowed; }
.eva-stage-chips b { overflow: hidden; color: #2d465f; font-size: 10px; text-overflow: ellipsis; white-space: nowrap; }
.eva-stage-chips small { overflow: hidden; color: #7b8b9a; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.eva-stage-picker.collapsed { border-bottom: 1px solid #d8e3ef; }
</style>
