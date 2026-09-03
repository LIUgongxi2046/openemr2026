<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ModelDeploymentWire } from '../../generated/contracts';

type AuthorizationLevel = 'READ_ONLY' | 'STANDARD' | 'EXTENDED';
type ContextScope = 'RECORDS' | 'ORDERS' | 'RESULTS' | 'TASKS' | 'ATTACHMENTS';

const props = defineProps<{
  models: ModelDeploymentWire[];
  modelId: string;
  authorizationLevel: AuthorizationLevel;
  contextScopes: ContextScope[];
  disabled?: boolean;
  compact?: boolean;
}>();

const emit = defineEmits<{
  'update:modelId': [value: string];
  'update:authorizationLevel': [value: AuthorizationLevel];
  'update:contextScopes': [value: ContextScope[]];
}>();

const contextOpen = ref(false);
const advancedOpen = ref(false);
const scopeOptions: Array<{ code: ContextScope; label: string; description: string }> = [
  { code: 'RECORDS', label: '病历文书', description: '当前就诊已确认文书及版本' },
  { code: 'ORDERS', label: '医嘱执行', description: '医嘱、执行状态与异常' },
  { code: 'RESULTS', label: '检查检验', description: '报告、结果版本与危急值' },
  { code: 'TASKS', label: '任务随访', description: '开放任务、责任人与随访' },
  { code: 'ATTACHMENTS', label: '病历附件', description: '已通过安全检查的附件' },
];
const authorizationHelp = computed(() => ({
  READ_ONLY: '只读取已选资料，不生成系统操作',
  STANDARD: '可读取、分析和草拟；写入前由医生确认',
  EXTENDED: '可调用更多院内工具；每项写入仍需确认',
}[props.authorizationLevel]));
const authorizationShort = computed(() => ({
  READ_ONLY: '只读', STANDARD: '标准', EXTENDED: '扩展',
}[props.authorizationLevel]));

function toggleScope(code: ContextScope) {
  const selected = new Set(props.contextScopes);
  if (selected.has(code)) {
    if (selected.size === 1) return;
    selected.delete(code);
  } else selected.add(code);
  emit('update:contextScopes', scopeOptions.filter((item) => selected.has(item.code)).map((item) => item.code));
}
</script>

<template>
  <div class="eva-control-bar" :class="{ compact }">
    <div class="eva-add-context">
      <button type="button" class="eva-context-trigger" :disabled="disabled" aria-label="选择诊疗数据范围" :aria-expanded="contextOpen" @click="contextOpen = !contextOpen">
        <span class="eva-context-glyph" aria-hidden="true">◈</span>
        <span class="eva-context-text">数据范围</span>
        <b>{{ contextScopes.length }}</b>
        <span class="eva-context-caret" aria-hidden="true">⌄</span>
      </button>
      <section v-if="contextOpen" class="eva-context-menu" aria-label="选择诊疗信息">
        <header><strong>添加诊疗信息</strong><span>Eva 仅访问勾选范围</span></header>
        <button v-for="item in scopeOptions" :key="item.code" type="button" :aria-pressed="contextScopes.includes(item.code)" @click="toggleScope(item.code)">
          <i>{{ contextScopes.includes(item.code) ? '✓' : '' }}</i><span><b>{{ item.label }}</b><small>{{ item.description }}</small></span>
        </button>
      </section>
    </div>

    <label class="eva-control-select model"><span>模型</span><select :value="modelId" :disabled="disabled || models.length === 0" @change="emit('update:modelId', ($event.target as HTMLSelectElement).value)"><option v-if="models.length === 0" value="">暂无可用模型</option><option v-for="model in models" :key="model.model_deployment_id" :value="model.model_deployment_id">{{ model.display_name }}</option></select></label>

    <div class="eva-advanced">
      <button type="button" class="eva-advanced-trigger" :disabled="disabled" :aria-expanded="advancedOpen" aria-label="高级设置" @click="advancedOpen = !advancedOpen"><span>高级</span><em>{{ authorizationShort }}</em><span class="eva-context-caret" aria-hidden="true">⌄</span></button>
      <section v-if="advancedOpen" class="eva-advanced-menu" aria-label="高级设置">
        <header><strong>授权与运行模式</strong><span>影响 Eva 可执行的操作范围</span></header>
        <label class="eva-control-select auth"><span>授权</span><select :value="authorizationLevel" :disabled="disabled" @change="emit('update:authorizationLevel', ($event.target as HTMLSelectElement).value as AuthorizationLevel)"><option value="READ_ONLY">只读</option><option value="STANDARD">标准</option><option value="EXTENDED">扩展</option></select><small>{{ authorizationHelp }}</small></label>
      </section>
    </div>
  </div>
</template>

<style scoped>
.eva-control-bar { position: relative; display: flex; align-items: center; gap: 8px; min-width: 0; }
.eva-add-context, .eva-advanced { position: relative; flex: 0 0 auto; }
.eva-context-trigger, .eva-advanced-trigger { display: flex; align-items: center; gap: 6px; min-height: 32px; padding: 2px 9px; color: #334e68; border: 1px solid #c9d6e2; border-radius: 8px; background: #fff; cursor: pointer; }
.eva-context-trigger:hover, .eva-advanced-trigger:hover { border-color: #7da7cf; background: #f4f8fc; }
.eva-context-trigger:focus-visible, .eva-advanced-trigger:focus-visible { outline: 3px solid rgb(23 105 224 / 18%); outline-offset: 2px; }
.eva-context-glyph { color: #1769e0; font-size: 11px; }
.eva-context-text { color: #334e68; font-size: 9px; font-weight: 800; }
.eva-context-trigger > b { display: grid; place-items: center; min-width: 18px; height: 18px; padding: 0 5px; color: #1769e0; border-radius: 999px; background: #e8f2ff; font-size: 8px; }
.eva-context-caret { color: #7d90a3; font-size: 10px; line-height: 1; }
.eva-context-menu { position: absolute; z-index: 20; left: 0; bottom: calc(100% + 8px); display: grid; width: 288px; overflow: hidden; border: 1px solid #cbd8e5; border-radius: 12px; background: #fff; box-shadow: 0 16px 40px rgb(26 51 78 / 18%); }
.eva-context-menu header, .eva-advanced-menu header { display: grid; gap: 2px; padding: 12px; border-bottom: 1px solid #e2e9f0; }
.eva-context-menu header strong, .eva-advanced-menu header strong { color: #263f58; font-size: 12px; }
.eva-context-menu header span, .eva-advanced-menu header span { color: #75879a; font-size: 9px; }
.eva-context-menu > button { display: grid; grid-template-columns: 22px minmax(0,1fr); align-items: center; gap: 8px; padding: 9px 12px; color: inherit; border: 0; border-bottom: 1px solid #eef2f6; background: #fff; text-align: left; cursor: pointer; }
.eva-context-menu > button:hover { background: #f4f8fc; }
.eva-context-menu i { display: grid; place-items: center; width: 19px; height: 19px; color: #fff; border: 1px solid #b7c6d4; border-radius: 5px; background: #fff; font-size: 10px; font-style: normal; }
.eva-context-menu > button[aria-pressed="true"] i { border-color: #1769e0; background: #1769e0; }
.eva-context-menu > button span { display: grid; gap: 2px; }
.eva-context-menu b { color: #304a63; font-size: 10px; }
.eva-context-menu small { color: #7d8c9b; font-size: 8px; }
.eva-advanced-trigger { color: #55697e; }
.eva-advanced-trigger > span { color: #55697e; font-size: 9px; font-weight: 800; }
.eva-advanced-trigger em { padding: 1px 6px; color: #8a5a12; border-radius: 999px; background: #fff3d6; font-size: 8px; font-style: normal; font-weight: 800; }
.eva-advanced-menu { position: absolute; z-index: 20; right: 0; bottom: calc(100% + 8px); display: grid; width: 260px; overflow: hidden; border: 1px solid #cbd8e5; border-radius: 12px; background: #fff; box-shadow: 0 16px 40px rgb(26 51 78 / 18%); }
.eva-advanced-menu .eva-control-select { margin: 10px; }
.eva-control-select { display: grid; grid-template-columns: auto minmax(0,auto); align-items: center; gap: 4px; min-width: 0; padding: 4px 7px; border: 1px solid #d2dde7; border-radius: 8px; background: #fff; }
.eva-control-select > span { color: #77899a; font-size: 8px; font-weight: 800; }
.eva-control-select select { min-width: 0; max-width: 180px; padding: 0 16px 0 0; color: #304a63; border: 0; outline: 0; background: transparent; font-size: 9px; font-weight: 750; }
.eva-control-select small { grid-column: 1 / -1; max-width: 210px; overflow: hidden; color: #8a98a6; font-size: 7px; text-overflow: ellipsis; white-space: nowrap; }
.eva-control-select.model { grid-template-columns: auto minmax(0,1fr); }
.compact { gap: 5px; }
.compact .eva-context-text, .compact .eva-control-select > span, .compact .eva-advanced-trigger > span { display: none; }
.compact .eva-control-select { padding: 6px; }
.compact .eva-control-select select { max-width: 128px; }
@media (max-width: 720px) { .eva-control-bar { flex-wrap: wrap; } .eva-context-menu { width: min(288px,calc(100vw - 34px)); } }
</style>
