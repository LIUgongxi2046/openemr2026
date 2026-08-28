<script setup lang="ts">
import { computed } from 'vue';

import type { MedicalAgentFamilyWire, MedicalAgentReleaseWire } from '../../generated/contracts';
import { doctorFacingAiText, doctorFacingTeamName } from '../medical-ai-terminology';

const props = defineProps<{
  agents: MedicalAgentFamilyWire[];
  selectedAgentCode: string;
  collapsed: boolean;
  busy?: boolean;
}>();

const emit = defineEmits<{
  toggle: [];
  select: [agent: MedicalAgentFamilyWire];
  example: [example: string, agent: MedicalAgentFamilyWire, child?: MedicalAgentReleaseWire];
  runChild: [agent: MedicalAgentFamilyWire, child: MedicalAgentReleaseWire];
}>();

const selectedAgent = computed(() => props.agents.find(
  (agent) => agent.main_agent.agent_code === props.selectedAgentCode,
));

function teamName(agent: MedicalAgentFamilyWire) {
  return doctorFacingTeamName(agent.main_agent.display_name);
}
</script>

<template>
  <aside class="xiaonan-harness-team-rail" :class="{ collapsed }" aria-label="Eva医助团队">
    <header>
      <div v-if="!collapsed"><strong>医助团队</strong><span>{{ agents.length }} 组 · 按诊疗任务调用</span></div>
      <button type="button" :aria-label="collapsed ? '展开医助团队' : '折叠医助团队'" :title="collapsed ? '展开医助团队' : '折叠医助团队'" @click="emit('toggle')">{{ collapsed ? '›' : '‹' }}</button>
    </header>

    <div v-if="agents.length === 0" class="xiaonan-rail-state">{{ collapsed ? '…' : '正在读取医助团队…' }}</div>
    <nav v-else class="xiaonan-team-list" aria-label="选择医助团队">
      <button
        v-for="agent in agents"
        :key="agent.main_agent.agent_code"
        type="button"
        :class="{ selected: selectedAgentCode === agent.main_agent.agent_code }"
        :aria-pressed="selectedAgentCode === agent.main_agent.agent_code"
        :title="teamName(agent)"
        @click="emit('select', agent)"
      >
        <i aria-hidden="true">{{ teamName(agent).slice(0, 1) }}</i>
        <span v-if="!collapsed"><b>{{ teamName(agent) }}</b><small>{{ doctorFacingAiText(agent.main_agent.display_role) }} · {{ agent.child_agents.length }} 位医助</small></span>
      </button>
    </nav>

    <section v-if="selectedAgent && !collapsed" class="xiaonan-agent-capabilities">
      <div class="xiaonan-agent-intro">
        <span>当前负责</span>
        <strong>{{ teamName(selectedAgent) }}</strong>
        <p>{{ doctorFacingAiText(selectedAgent.main_agent.current_action) }}</p>
      </div>

      <details open>
        <summary>主医助示例 <span>{{ selectedAgent.main_agent.question_examples.length }}</span></summary>
        <button
          v-for="example in selectedAgent.main_agent.question_examples"
          :key="example"
          type="button"
          @click="emit('example', example, selectedAgent)"
        >{{ doctorFacingAiText(example) }}</button>
      </details>

      <details open>
        <summary>诊疗环节医助 <span>{{ selectedAgent.child_agents.length }}</span></summary>
        <article v-for="child in selectedAgent.child_agents" :key="child.agent_code">
          <div><b>{{ doctorFacingAiText(child.display_name) }}</b><small>{{ doctorFacingAiText(child.current_action) }}</small></div>
          <div class="xiaonan-child-actions">
            <button
              v-for="example in child.question_examples.slice(0, 1)"
              :key="example"
              type="button"
              @click="emit('example', example, selectedAgent, child)"
            >示例：{{ doctorFacingAiText(example) }}</button>
            <button class="run" type="button" :disabled="busy" @click="emit('runChild', selectedAgent, child)">直接安排</button>
          </div>
        </article>
      </details>
    </section>
  </aside>
</template>

<style scoped>
.xiaonan-harness-team-rail { display: grid; grid-template-rows: auto auto minmax(0,1fr); width: 278px; min-width: 0; height: 100%; overflow: hidden; border-right: 1px solid #d8e3ef; background: #f6f9fd; transition: width .18s ease; }
.xiaonan-harness-team-rail.collapsed { width: 62px; }
header { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 58px; padding: 11px 12px; border-bottom: 1px solid #d8e3ef; background: #fff; }
header > div { display: grid; gap: 3px; min-width: 0; }
header strong { color: #263f58; font-size: 13px; }
header span { color: #738397; font-size: 9px; }
header button { display: grid; place-items: center; width: 30px; height: 30px; flex: 0 0 30px; padding: 0; color: #315a83; border: 1px solid #c8d7e7; border-radius: 8px; background: #f8fbff; font-size: 21px; cursor: pointer; }
.collapsed header { justify-content: center; padding-inline: 8px; }
.xiaonan-team-list { display: grid; gap: 6px; padding: 10px; border-bottom: 1px solid #d8e3ef; }
.xiaonan-team-list > button { display: grid; grid-template-columns: 34px minmax(0,1fr); align-items: center; gap: 9px; width: 100%; min-width: 0; padding: 7px; color: inherit; border: 1px solid transparent; border-radius: 9px; background: transparent; text-align: left; cursor: pointer; }
.xiaonan-team-list > button:hover { background: #edf5ff; }
.xiaonan-team-list > button.selected { border-color: #9dbfe6; background: #e8f2ff; box-shadow: 0 0 0 1px rgb(23 105 224 / 8%); }
.xiaonan-team-list i { display: grid; place-items: center; width: 34px; height: 34px; color: #fff; border-radius: 9px; background: linear-gradient(145deg,#1f6fbc,#19a1a0); font-size: 13px; font-style: normal; font-weight: 800; }
.xiaonan-team-list span { display: grid; gap: 3px; min-width: 0; }
.xiaonan-team-list b { overflow: hidden; color: #29435d; font-size: 11px; text-overflow: ellipsis; white-space: nowrap; }
.xiaonan-team-list small { overflow: hidden; color: #738397; font-size: 8px; text-overflow: ellipsis; white-space: nowrap; }
.collapsed .xiaonan-team-list { padding: 9px; }
.collapsed .xiaonan-team-list > button { display: grid; grid-template-columns: 34px; place-content: center; padding: 4px; }
.xiaonan-agent-capabilities { min-height: 0; padding: 10px; overflow-y: auto; }
.xiaonan-agent-intro { display: grid; gap: 4px; padding: 10px; margin-bottom: 9px; border: 1px solid #cfe0ef; border-radius: 10px; background: #fff; }
.xiaonan-agent-intro span { color: #738397; font-size: 8px; }
.xiaonan-agent-intro strong { color: #24628f; font-size: 11px; }
.xiaonan-agent-intro p { margin: 0; color: #526a80; font-size: 9px; line-height: 1.55; }
details { padding: 8px 0; border-top: 1px solid #dce6ef; }
summary { display: flex; align-items: center; justify-content: space-between; color: #405870; font-size: 10px; font-weight: 800; cursor: pointer; }
summary span { display: grid; place-items: center; min-width: 20px; height: 18px; color: #45637f; border-radius: 999px; background: #e7eef6; font-size: 8px; }
details > button { width: 100%; padding: 7px 8px; margin-top: 6px; color: #155d70; border: 1px solid #c3dedb; border-radius: 7px; background: #fff; font-size: 9px; line-height: 1.45; text-align: left; cursor: pointer; }
details > button:hover, .xiaonan-child-actions button:hover { border-color: #279b94; background: #edf9f7; }
article { display: grid; gap: 7px; padding: 9px; margin-top: 7px; border: 1px solid #d9e4ee; border-radius: 9px; background: #fff; }
article > div:first-child { display: grid; gap: 3px; }
article b { color: #2d465f; font-size: 10px; }
article small { color: #718296; font-size: 8px; line-height: 1.4; }
.xiaonan-child-actions { display: grid; gap: 5px; }
.xiaonan-child-actions button { padding: 6px 7px; color: #37647b; border: 1px solid #d3e0e9; border-radius: 6px; background: #f9fbfd; font-size: 8px; line-height: 1.4; text-align: left; cursor: pointer; }
.xiaonan-child-actions button.run { justify-self: start; color: #fff; border-color: #1769e0; background: #1769e0; }
.xiaonan-child-actions button:disabled { opacity: .55; cursor: not-allowed; }
.xiaonan-rail-state { padding: 18px 10px; color: #74869a; font-size: 9px; text-align: center; }
@media (max-width: 760px) {
  .xiaonan-harness-team-rail { width: 100%; height: auto; border-right: 0; border-bottom: 1px solid #d8e3ef; }
  .xiaonan-harness-team-rail.collapsed { width: 100%; }
  .collapsed header { justify-content: space-between; }
  .collapsed header::before { content: '医助团队'; color: #263f58; font-size: 12px; font-weight: 800; }
  .collapsed .xiaonan-team-list, .collapsed .xiaonan-agent-capabilities { display: none; }
  .xiaonan-team-list { grid-template-columns: repeat(auto-fit,minmax(150px,1fr)); }
  .xiaonan-agent-capabilities { max-height: 360px; }
}
</style>
