<script setup lang="ts">
defineProps<{
  title: string;
  description: string;
  steps: string[];
  facts: Array<{ label: string; value: string }>;
  noteTitle: string;
  note: string;
}>();
</script>

<template>
  <section class="ai-governance-layout" :aria-label="title">
    <article class="card ai-governance-flow">
      <div class="card-head"><div><h2>{{ title }}</h2><p>{{ description }}</p></div></div>
      <ol>
        <li v-for="(step, index) in steps" :key="step"><i>{{ index + 1 }}</i><span>{{ step }}</span></li>
      </ol>
    </article>
    <aside class="card ai-governance-facts">
      <div class="card-head">当前运行约束</div>
      <div class="card-body">
        <div class="notice info"><div class="notice-title">{{ noteTitle }}</div>{{ note }}</div>
        <div v-for="fact in facts" :key="fact.label" class="folder-row">{{ fact.label }}<span>{{ fact.value }}</span></div>
      </div>
    </aside>
  </section>
</template>

<style scoped>
.ai-governance-layout { display: grid; grid-template-columns: minmax(0,1fr) minmax(250px,300px); gap: 14px; margin-bottom: 18px; }
.ai-governance-layout > * { min-width: 0; overflow: hidden; }
.ai-governance-flow .card-head { height: auto; min-height: 56px; padding: 12px 14px; }
.ai-governance-flow h2 { margin: 0; color: #263b53; font-size: 14px; }
.ai-governance-flow p { margin: 5px 0 0; color: #6c7d8e; font-size: 10px; line-height: 1.55; }
.ai-governance-flow ol { display: grid; grid-template-columns: repeat(5,minmax(0,1fr)); gap: 20px; padding: 18px 16px; margin: 0; list-style: none; }
.ai-governance-flow li { position: relative; display: grid; justify-items: center; gap: 8px; min-width: 0; color: #40566c; font-size: 10px; line-height: 1.45; text-align: center; }
.ai-governance-flow li:not(:last-child)::after { position: absolute; top: 14px; right: -15px; width: 10px; color: #8ba0b5; content: '›'; font-size: 18px; }
.ai-governance-flow i { display: grid; place-items: center; width: 28px; height: 28px; color: #fff; border-radius: 50%; background: #1769a7; font-size: 10px; font-style: normal; font-weight: 800; }
.ai-governance-flow span { overflow-wrap: anywhere; }
.ai-governance-facts .card-head { min-height: 56px; height: auto; padding: 12px 14px; }
.ai-governance-facts .card-body { padding: 12px 14px; }
.ai-governance-facts .notice { margin-bottom: 6px; line-height: 1.55; }
.ai-governance-facts .folder-row { gap: 10px; }
.ai-governance-facts .folder-row span { max-width: 58%; overflow-wrap: anywhere; text-align: right; }
@media (max-width: 1000px) {
  .ai-governance-layout { grid-template-columns: minmax(0,1fr); }
}
@media (max-width: 700px) {
  .ai-governance-flow ol { grid-template-columns: minmax(0,1fr); gap: 10px; }
  .ai-governance-flow li { grid-template-columns: 28px minmax(0,1fr); justify-items: start; align-items: center; text-align: left; }
  .ai-governance-flow li:not(:last-child)::after { display: none; }
}
</style>
