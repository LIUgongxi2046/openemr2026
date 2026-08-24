<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import type { MockInterfaceWire, MockInvocationResultWire } from '../../generated/contracts';
import { invokeMockInterface, issueMockLease, listMockInterfaces } from '../../api/mock';
import { clinicalContext } from '../../clinical-api';
import type { SimulationWorkbenchDefinition } from '../simulation-workbenches';
import ClinicalPageState from './ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const props = defineProps<{ definition: SimulationWorkbenchDefinition }>();
const scenario = ref<'SUCCESS' | 'DEGRADED' | 'UNAVAILABLE'>('SUCCESS');
const entityValue = ref(props.definition.defaultEntity);
const selectedCode = ref('');
const busy = ref(false);
const result = ref<MockInvocationResultWire | null>(null);
const notice = ref('');
const failure = ref<{ code: string; message: string } | null>(null);

const leaseQuery = useQuery({ queryKey: ['mock', 'lease'], queryFn: () => issueMockLease(), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const interfacesQuery = useQuery({ queryKey: ['mock', 'interfaces'], queryFn: () => listMockInterfaces(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? interfacesQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? interfacesQuery.error.value) : null);
const interfaces = computed(() => (interfacesQuery.data.value ?? []).filter((item) => item.system_type.startsWith(props.definition.systemType)));
const selected = computed<MockInterfaceWire | null>(() => interfaces.value.find((item) => item.code === selectedCode.value) ?? interfaces.value[0] ?? null);
watch(interfaces, (items) => { if (!selectedCode.value && items[0]) selectedCode.value = props.definition.interfaceCode ?? items[0].code; }, { immediate: true });

async function runScenario() {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || busy.value) return;
  busy.value = true; result.value = null; failure.value = null; notice.value = '';
  try {
    result.value = await invokeMockInterface(lease, selected.value.code, {
      simulation_scenario: scenario.value,
      [props.definition.entityKey]: entityValue.value.trim(),
      patient_id: clinicalContext.patientId,
      encounter_id: clinicalContext.encounterId,
    });
    notice.value = scenario.value === 'DEGRADED'
      ? '降级结果已返回；流程停在人工复核，不允许自动进入临床事实。'
      : '场景执行完成；相同输入可重放得到同一 request_id、时间和业务结果。';
  } catch (error) {
    const next = toClinicalIssue(error); failure.value = next;
    notice.value = next.code === 'MOCK_DEPENDENCY_UNAVAILABLE'
      ? '外部依赖不可用已被明确呈现；请走人工降级路径，禁止把失败解释为空结果。'
      : `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}

function valueFor(key: string) {
  return result.value?.payload[key];
}
</script>

<template>
  <main id="main-content" class="content vue-native-page simulation-workbench-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">场景化外部依赖模拟 / {{ definition.id }}</p><h1>{{ definition.title }}</h1><p>{{ definition.subtitle }}</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/mock-interfaces">接口契约</RouterLink><button class="button primary" :disabled="busy || !selected" @click="runScenario">{{ busy ? '执行中…' : '运行场景' }}</button></div></div>
    <div class="portal-safety"><b>确定性合成适配器</b><span>不访问真实外部系统，不接收真实 PHI/凭据，不写入临床事实。</span><span class="status amber">待真实适配器</span></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || interfacesQuery.isPending.value" kind="loading" message="正在加载模拟接口与场景契约" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="interfacesQuery.refetch()" />
    <template v-else>
      <section class="simulation-controls" aria-label="模拟场景参数"><label>适配器<select v-model="selectedCode"><option v-for="item in interfaces" :key="item.code" :value="item.code">{{ item.display_name }}</option></select></label><label>{{ definition.entityLabel }}<input v-model="entityValue" autocomplete="off" /></label><label>运行场景<select v-model="scenario"><option value="SUCCESS">成功 · 完整响应</option><option value="DEGRADED">降级 · 部分响应</option><option value="UNAVAILABLE">不可用 · 503</option></select></label></section>
      <p v-if="notice" class="admin-notice" :class="{ danger: failure }" role="status">{{ notice }}</p>
      <section class="simulation-stepper" aria-label="业务流程"><article v-for="(step,index) in definition.steps" :key="step" :class="{ complete: result, blocked: failure && index > 0 }"><span>{{ index + 1 }}</span><strong>{{ step }}</strong><small>{{ failure && index > 0 ? '依赖不可用，进入人工路径' : result ? '合成证据已生成' : '待执行' }}</small></article></section>
      <div class="simulation-layout">
        <section class="admin-panel"><header><div><h2>场景结果</h2><p>{{ selected?.standard_interface ?? '标准接口' }}</p></div><span v-if="result" class="admin-status" :class="result.scenario === 'DEGRADED' ? 'warning' : 'active'">{{ result.scenario }}</span></header>
          <div v-if="failure" class="simulation-unavailable"><strong>{{ failure.code }}</strong><p>{{ failure.message }}</p><ol><li>保留当前输入和上下文，不自动重试写操作</li><li>转人工工作队列并记录外部依赖状态</li><li>恢复后使用相同业务键幂等重放</li></ol></div>
          <div v-else-if="!result" class="admin-empty">请选择成功、降级或不可用场景并执行。</div>
          <template v-else><dl class="simulation-evidence"><div><dt>确定性键</dt><dd><code>{{ result.deterministic_key }}</code></dd></div><div><dt>请求 ID</dt><dd><code>{{ result.request_id }}</code></dd></div><div><dt>合成时间</dt><dd>{{ new Date(result.produced_at).toLocaleString('zh-CN', { hour12: false }) }}</dd></div></dl><div class="simulation-focus"><article v-for="key in definition.resultFocus" :key="key"><span>{{ key }}</span><pre>{{ JSON.stringify(valueFor(key) ?? '—', null, 2) }}</pre></article></div></template>
        </section>
        <aside class="admin-panel"><header><div><h2>门禁与替换契约</h2><p>真实适配器必须保持同一语义</p></div></header><ul class="simulation-safeguards"><li v-for="item in definition.safeguards" :key="item">{{ item }}</li></ul><details v-if="selected"><summary>请求/响应 Schema</summary><pre class="mock-payload">{{ JSON.stringify({ request: selected.request_schema, response: selected.response_schema }, null, 2) }}</pre></details><p class="integration-doc">{{ selected?.integration_doc }}</p></aside>
      </div>
    </template>
  </main>
</template>

<style scoped>
.simulation-controls{display:grid;grid-template-columns:1fr 1.2fr 1fr;gap:12px;padding:16px;border:1px solid var(--line);border-radius:12px;background:#fff}.simulation-controls label{display:grid;gap:6px;font-size:12px;color:#667085}.simulation-controls input,.simulation-controls select{min-width:0;padding:10px;border:1px solid var(--line);border-radius:8px;background:#fff}.simulation-stepper{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.simulation-stepper article{display:grid;grid-template-columns:30px 1fr;gap:2px 8px;padding:12px;border:1px solid var(--line);border-radius:10px;background:#fff}.simulation-stepper article>span{grid-row:1/3;display:grid;place-items:center;width:30px;height:30px;border-radius:50%;background:#eaf1fb;color:#245493;font-weight:700}.simulation-stepper small{color:#697586}.simulation-stepper .complete>span{background:#dcfce7;color:#166534}.simulation-stepper .blocked>span{background:#fee2e2;color:#991b1b}.simulation-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.75fr);gap:14px}.simulation-evidence{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;padding:14px}.simulation-evidence div{min-width:0}.simulation-evidence dt{font-size:11px;color:#697586}.simulation-evidence dd{margin:4px 0;overflow-wrap:anywhere}.simulation-focus{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:0 14px 14px}.simulation-focus article{min-width:0;padding:10px;border:1px solid var(--line);border-radius:8px;background:#f8fafc}.simulation-focus span{font-size:11px;color:#536273}.simulation-focus pre,.mock-payload{max-height:220px;overflow:auto;white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px}.simulation-unavailable{margin:14px;padding:14px;border:1px solid #fecaca;border-radius:10px;background:#fff7f7}.simulation-unavailable strong{color:#b42318}.simulation-safeguards{display:grid;gap:10px;padding:14px 32px}.integration-doc{padding:0 14px 14px;color:#536273}.admin-notice.danger{border-color:#fecaca;background:#fff7f7;color:#b42318}@media(max-width:900px){.simulation-controls,.simulation-stepper,.simulation-layout,.simulation-evidence,.simulation-focus{grid-template-columns:1fr}}
</style>
