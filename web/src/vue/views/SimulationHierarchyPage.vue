<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import { issueConfigurationLease, listConfigurations } from '../../api/config';
import {
  getMockInterfaceEvidence,
  getMockInterfaceRun,
  issueMockLease,
  listMockInterfaceRuns,
} from '../../api/mock';
import { simulationWorkbenches, type SimulationWorkbenchId } from '../simulation-workbenches';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const workbenchId = computed(() => String(route.params.workbenchId ?? '') as SimulationWorkbenchId);
const profileKey = computed(() => String(route.params.profileKey ?? ''));
const scenario = computed(() => String(route.params.scenario ?? 'SUCCESS').toUpperCase());
const runId = computed(() => String(route.params.runId ?? ''));
const definition = computed(() => simulationWorkbenches[workbenchId.value]);
const level = computed(() => {
  const name = String(route.name ?? '');
  if (name.endsWith('evidence')) return 7;
  if (name.endsWith('detail')) return 6;
  if (name.endsWith('runs')) return 5;
  if (name.endsWith('scenario')) return 4;
  return 3;
});

const configLeaseQuery = useQuery({ queryKey: ['mock-hierarchy', 'config-lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 5 * 60_000 });
const profilesQuery = useQuery({
  queryKey: ['mock-hierarchy', 'profiles'],
  queryFn: () => listConfigurations(configLeaseQuery.data.value!, 'MOCK_INTERFACE_PROFILE'),
  enabled: () => Boolean(configLeaseQuery.data.value), retry: false,
});
const mockLeaseQuery = useQuery({ queryKey: ['mock-hierarchy', 'mock-lease'], queryFn: issueMockLease, retry: false, staleTime: 5 * 60_000 });
const runsQuery = useQuery({
  queryKey: computed(() => ['mock-hierarchy', 'runs', workbenchId.value, profileKey.value]),
  queryFn: () => listMockInterfaceRuns(mockLeaseQuery.data.value!, { workbenchId: workbenchId.value, profileKey: profileKey.value || undefined }),
  enabled: () => Boolean(mockLeaseQuery.data.value && level.value >= 5), retry: false,
});
const runQuery = useQuery({
  queryKey: computed(() => ['mock-hierarchy', 'run', runId.value]),
  queryFn: () => getMockInterfaceRun(mockLeaseQuery.data.value!, runId.value),
  enabled: () => Boolean(mockLeaseQuery.data.value && runId.value && level.value === 6), retry: false,
});
const evidenceQuery = useQuery({
  queryKey: computed(() => ['mock-hierarchy', 'evidence', runId.value]),
  queryFn: () => getMockInterfaceEvidence(mockLeaseQuery.data.value!, runId.value),
  enabled: () => Boolean(mockLeaseQuery.data.value && runId.value && level.value === 7), retry: false,
});

const profile = computed(() => (profilesQuery.data.value ?? []).find((item) =>
  item.config_key === profileKey.value && item.payload?.workbench_id === workbenchId.value));
const activeError = computed(() => configLeaseQuery.error.value ?? profilesQuery.error.value
  ?? mockLeaseQuery.error.value ?? runsQuery.error.value ?? runQuery.error.value ?? evidenceQuery.error.value);
const issue = computed(() => activeError.value ? toClinicalIssue(activeError.value) : null);
const loading = computed(() => configLeaseQuery.isPending.value || profilesQuery.isPending.value || mockLeaseQuery.isPending.value
  || (level.value === 5 && runsQuery.isPending.value) || (level.value === 6 && runQuery.isPending.value)
  || (level.value === 7 && evidenceQuery.isPending.value));
const title = computed(() => ({ 3: '配置详情', 4: '场景治理', 5: '运行历史', 6: '运行详情', 7: '证据核验' }[level.value] ?? '仿真详情'));
const assessment = computed(() => level.value === 6 ? runQuery.data.value?.agent_assessment : evidenceQuery.data.value?.agent_assessment);
const events = computed(() => level.value === 6 ? runQuery.data.value?.events : evidenceQuery.data.value?.events);

function display(value: unknown) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'object') return JSON.stringify(value, null, 2);
  return String(value);
}
</script>

<template>
  <section data-page-root class="content vue-native-page simulation-hierarchy-page">
    <nav class="hierarchy-breadcrumbs" aria-label="模拟接口层级导航">
      <RouterLink to="/mock-interfaces">接口总览</RouterLink><span>/</span>
      <RouterLink :to="`/mock-interfaces/${workbenchId}`">{{ definition?.title ?? workbenchId }}</RouterLink>
      <template v-if="profileKey"><span>/</span><RouterLink :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}`">{{ profileKey }}</RouterLink></template>
      <template v-if="level >= 4"><span>/</span><RouterLink :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/${scenario}`">{{ scenario }}</RouterLink></template>
      <template v-if="level >= 5"><span>/</span><RouterLink :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/${scenario}/runs`">运行历史</RouterLink></template>
      <template v-if="level >= 6"><span>/</span><span>{{ runId.slice(0, 8) }}</span></template>
    </nav>

    <div class="page-heading admin-heading">
      <div><p class="eyebrow">模拟接口 · {{ level }} 级页面</p><h1>{{ title }}</h1><p>{{ definition?.subtitle }}</p></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" :to="`/mock-interfaces/${workbenchId}`">返回工作台</RouterLink></div>
    </div>

    <div class="portal-safety"><b>仿真与临床事实隔离</b><span>本层级仅处理 SYNTHETIC_ONLY 运行；Agent 无临床写入权限。</span><span class="status green">证据可追溯</span></div>
    <ClinicalPageState v-if="loading" kind="loading" message="正在加载配置、运行与证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" />
    <ClinicalPageState v-else-if="!definition || (level <= 5 && !profile)" kind="empty" message="未找到当前工作台的配置版本" />

    <template v-else>
      <section v-if="level === 3" class="hierarchy-grid">
        <article class="admin-panel detail-panel"><header><div><h2>{{ profile?.display_name }}</h2><p>{{ profile?.config_key }}</p></div><span class="status green">{{ profile?.status }}</span></header><dl class="detail-list"><div v-for="(value,key) in profile?.payload" :key="key"><dt>{{ key }}</dt><dd><pre v-if="typeof value === 'object'">{{ display(value) }}</pre><span v-else>{{ display(value) }}</span></dd></div></dl></article>
        <aside class="admin-panel action-panel"><header><div><h2>下一级功能</h2><p>进入可执行场景与运行证据</p></div></header><RouterLink class="hierarchy-action" :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/SUCCESS`"><strong>成功场景</strong><span>完整响应与规则 Agent 审查</span></RouterLink><RouterLink class="hierarchy-action" :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/DEGRADED`"><strong>降级场景</strong><span>强制人工复核与降级路径</span></RouterLink><RouterLink class="hierarchy-action" :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/UNAVAILABLE`"><strong>不可用场景</strong><span>保留失败证据并阻断后续</span></RouterLink></aside>
      </section>

      <section v-else-if="level === 4" class="hierarchy-grid">
        <article class="admin-panel detail-panel"><header><div><h2>{{ scenario }} 场景门禁</h2><p>{{ profile?.display_name }}</p></div><span class="status" :class="scenario === 'SUCCESS' ? 'green' : 'amber'">{{ scenario }}</span></header><ol class="scenario-gates"><li><b>配置绑定</b><span>仅接受 VALID + APPROVED + ACTIVE 配置</span></li><li><b>中国医疗规则</b><span>WS/T 846/847、院级危急值与业务闭环</span></li><li><b>安全 Agent</b><span>输出 PASS / REVIEW / BLOCK，无临床写权</span></li><li><b>证据封存</b><span>保留配置版本、请求指纹、事件轴和 SHA-256</span></li></ol></article>
        <aside class="admin-panel action-panel"><header><div><h2>场景操作</h2><p>执行与历史分离</p></div></header><RouterLink class="button primary" :to="`/mock-interfaces/${workbenchId}`">回工作台执行场景</RouterLink><RouterLink class="button secondary" :to="`/mock-interfaces/${workbenchId}/profiles/${profileKey}/scenarios/${scenario}/runs`">查看持久运行历史</RouterLink></aside>
      </section>

      <section v-else-if="level === 5" class="admin-panel runs-panel"><header><div><h2>运行历史</h2><p>{{ profile?.display_name }} · 最近200次</p></div><span class="status blue">{{ runsQuery.data.value?.length ?? 0 }} 次</span></header><div v-if="runsQuery.data.value?.length" class="run-table-wrap"><table><thead><tr><th>运行</th><th>接口</th><th>场景</th><th>结论</th><th>数据量</th><th>配置版本</th><th>时间</th><th>操作</th></tr></thead><tbody><tr v-for="run in runsQuery.data.value" :key="run.run_id"><td><code>{{ run.run_id.slice(0, 8) }}</code></td><td>{{ run.interface_code }}</td><td>{{ run.scenario }}</td><td><span class="status" :class="run.status === 'COMPLETED' ? 'green' : 'amber'">{{ run.status }}</span></td><td>{{ run.record_count }}</td><td>v{{ run.profile_version }}</td><td>{{ new Date(run.started_at).toLocaleString('zh-CN', { hour12: false }) }}</td><td><RouterLink class="btn sm" :to="`${route.path}/${run.run_id}`">详情</RouterLink></td></tr></tbody></table></div><div v-else class="admin-empty rich"><strong>暂无运行记录</strong><p>返回工作台执行一次场景后，运行会持久到这里。</p></div></section>

      <section v-else-if="level === 6 && runQuery.data.value" class="hierarchy-grid">
        <article class="admin-panel detail-panel"><header><div><h2>运行 {{ runId.slice(0, 8) }}</h2><p>{{ runQuery.data.value.interface_code }} · v{{ runQuery.data.value.profile_version }}</p></div><span class="status" :class="runQuery.data.value.status === 'COMPLETED' ? 'green' : 'amber'">{{ runQuery.data.value.status }}</span></header><dl class="detail-list compact"><div><dt>请求指纹</dt><dd><code>{{ runQuery.data.value.request_hash }}</code></dd></div><div><dt>证据哈希</dt><dd><code>{{ runQuery.data.value.evidence_hash }}</code></dd></div><div><dt>记录数</dt><dd>{{ runQuery.data.value.record_count }}</dd></div></dl><h3>结果载荷</h3><pre class="json-view">{{ display(runQuery.data.value.payload) }}</pre></article>
        <aside class="admin-panel agent-panel"><header><div><h2>医疗接口安全 Agent</h2><p>规则型、可复现、无临床写权</p></div></header><pre class="json-view">{{ display(assessment) }}</pre><h3>事件轴</h3><ol class="event-timeline"><li v-for="event in events" :key="String(event.sequence_no)"><b>{{ event.event_type }}</b><span>{{ event.summary }}</span></li></ol><RouterLink class="button primary" :to="`${route.path}/evidence`">进入七级证据核验</RouterLink></aside>
      </section>

      <section v-else-if="level === 7 && evidenceQuery.data.value" class="evidence-grid">
        <article class="admin-panel evidence-card"><header><div><h2>SHA-256 证据封存</h2><p>运行、配置版本、请求、结果与 Agent 结论联合取证</p></div><span class="status green">已封存</span></header><dl class="detail-list compact"><div><dt>证据哈希</dt><dd><code>{{ evidenceQuery.data.value.evidence_hash }}</code></dd></div><div><dt>请求哈希</dt><dd><code>{{ evidenceQuery.data.value.request_hash }}</code></dd></div><div><dt>配置</dt><dd><code>{{ evidenceQuery.data.value.profile_id }}</code> / v{{ evidenceQuery.data.value.profile_version }}</dd></div><div><dt>执行人</dt><dd><code>{{ evidenceQuery.data.value.created_by }}</code></dd></div><div><dt>验证口径</dt><dd>{{ evidenceQuery.data.value.verification }}</dd></div></dl></article><article class="admin-panel evidence-card"><header><div><h2>安全结论与事件</h2><p>审计链与 Outbox 已同事务记录</p></div></header><pre class="json-view">{{ display(evidenceQuery.data.value.agent_assessment) }}</pre><ol class="event-timeline"><li v-for="event in evidenceQuery.data.value.events" :key="String(event.sequence_no)"><b>{{ event.event_status }} · {{ event.event_type }}</b><span>{{ event.summary }}</span></li></ol></article></section>
    </template>
  </section>
</template>

<style scoped>
.simulation-hierarchy-page { display: grid; gap: 16px; width: min(100%, 1280px); margin-inline: auto; }
.simulation-hierarchy-page > * { min-width: 0; }
.hierarchy-breadcrumbs { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-width: 0; color: var(--muted); font-size: 13px; }
.hierarchy-breadcrumbs a { color: #2464a8; text-decoration: none; }
.hierarchy-grid, .evidence-grid { display: grid; grid-template-columns: minmax(0, 1.45fr) minmax(300px, .75fr); gap: 16px; align-items: start; }
.detail-panel, .action-panel, .agent-panel, .evidence-card { min-width: 0; }
.detail-panel > header, .action-panel > header, .agent-panel > header, .evidence-card > header, .runs-panel > header { padding: 15px 16px; }
.detail-list { display: grid; gap: 0; margin: 0; padding: 0 16px 16px; }
.detail-list > div { display: grid; grid-template-columns: minmax(140px, .45fr) minmax(0, 1fr); gap: 14px; padding: 10px 0; border-bottom: 1px solid var(--line); }
.detail-list dt { color: var(--muted); overflow-wrap: anywhere; }
.detail-list dd { min-width: 0; margin: 0; overflow-wrap: anywhere; }
.detail-list pre, .json-view { max-width: 100%; margin: 0; overflow: auto; white-space: pre-wrap; overflow-wrap: anywhere; font: 12px/1.55 ui-monospace, SFMono-Regular, Menlo, monospace; }
.detail-list.compact code { word-break: break-all; }
.action-panel { display: grid; gap: 10px; padding-bottom: 16px; }
.action-panel > :not(header) { margin-inline: 16px; }
.hierarchy-action { display: grid; gap: 4px; padding: 12px; border: 1px solid var(--line); border-radius: 9px; color: inherit; text-decoration: none; }
.hierarchy-action span { color: var(--muted); font-size: 13px; }
.scenario-gates, .event-timeline { display: grid; gap: 10px; margin: 0; padding: 0 16px 16px; list-style: none; }
.scenario-gates li, .event-timeline li { display: grid; gap: 4px; padding: 11px 12px; border: 1px solid var(--line); border-radius: 9px; }
.scenario-gates span, .event-timeline span { color: var(--muted); font-size: 13px; }
.run-table-wrap { width: 100%; overflow-x: auto; }
.run-table-wrap table { width: 100%; min-width: 920px; border-collapse: collapse; }
.run-table-wrap th, .run-table-wrap td { padding: 10px 12px; border-top: 1px solid var(--line); text-align: left; white-space: nowrap; }
.json-view { margin: 0 16px 16px; max-height: 520px; padding: 12px; border: 1px solid var(--line); border-radius: 9px; background: #f8fafc; }
.detail-panel > h3, .agent-panel > h3 { margin: 0; padding: 0 16px 10px; }
.agent-panel > .button { margin: 0 16px 16px; }
@media (max-width: 900px) { .hierarchy-grid, .evidence-grid { grid-template-columns: minmax(0, 1fr); } }
@media (max-width: 620px) { .detail-list > div { grid-template-columns: 1fr; gap: 4px; } .simulation-hierarchy-page { gap: 12px; } }
</style>
