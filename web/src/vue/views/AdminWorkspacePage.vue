<script setup lang="ts">
import { computed } from 'vue';
import { nativeVueRouteIds, routeById, routeRegistry } from '../route-registry';

// 治理与管理/AI/数据 相关一级导航的各个工作区（route_id 来自 route contract，标题动态取自 routeById）。
const sections = [
  { title: '组织、用户与权限', blurb: '机构/院区/科室/病区/床位、人员与账户、角色职责与权限策略、范围设计。', routes: ['admin-org', 'admin-users', 'admin-roles', 'admin-permissions', 'admin-auth', 'scope-designer'] },
  { title: '主数据、字典与参数', blurb: '术语与值集中心、医院主数据、系统参数与功能开关。', routes: ['admin-dictionaries', 'admin-master-data', 'admin-parameters'] },
  { title: '模板、流程与规则', blurb: '模板/编号/输出管理、表单设计、流程状态、规则时限、配置发布与升级。', routes: ['admin-templates', 'form-designer', 'workflow', 'rule-center', 'config-release', 'config-upgrade'] },
  { title: '能力包与集成', blurb: '机构能力包与继承解析、连接器、字段映射、消息追踪、设备接入。', routes: ['capability-pack', 'integration', 'integration-connectors', 'integration-mapping', 'integration-messages', 'devices'] },
  { title: 'AI 平台', blurb: '模型目录/路由/评估、Agent·Skill·Tool 目录、运行预算、助手策略与审批。', routes: ['models', 'model-connection', 'model-routing', 'model-evaluation', 'agent', 'agent-catalog', 'agent-compose', 'agent-context', 'agent-evals', 'skill-catalog', 'tool-catalog', 'aiops', 'ai-center', 'ai-assistant', 'ai-assistant-policy', 'ai-action-review', 'ai-capture', 'ai-reminder-detail'] },
  { title: '数据与科研', blurb: '数据中心、数据质量、科研队列构建、科研申请与统计、开源指标。', routes: ['data-center', 'data-quality', 'cohort-builder', 'research', 'research-dataset', 'research-stats', 'opensource'] },
  { title: '迁移、备份与运维', blurb: '历史数据迁移与上线切换、备份恢复、生产运行、安装向导与发布门禁。', routes: ['migration', 'backup', 'operations', 'install', 'release-gates', 'specialty-coverage'] },
  { title: '审计与任务', blurb: '管理审计与权限复核、通知调度与批量任务。', routes: ['admin-audit', 'admin-jobs'] },
];

// 后端已就绪但页面尚未接线的路由（后端 API/迁移已存在）。
const backendReady = new Set([
  'admin-dictionaries', 'capability-pack', 'models', 'agent-catalog', 'skill-catalog',
  'tool-catalog', 'model-evaluation', 'aiops', 'data-quality', 'cohort-builder',
  'research-dataset', 'opensource', 'migration', 'backup',
]);

type EntryStatus = 'available' | 'backend' | 'planned';
function statusOf(routeId: string): EntryStatus {
  if (nativeVueRouteIds.has(routeId)) return 'available';
  if (backendReady.has(routeId)) return 'backend';
  return 'planned';
}
function titleOf(routeId: string): string {
  return routeById.get(routeId)?.title ?? routeId;
}

const counts = computed(() => {
  let available = 0;
  let backend = 0;
  let planned = 0;
  for (const route of routeRegistry) {
    const status = statusOf(route.route_id);
    if (status === 'available') available += 1;
    else if (status === 'backend') backend += 1;
    else planned += 1;
  }
  return { available, backend, planned };
});

const statusLabel: Record<EntryStatus, string> = {
  available: '可用',
  backend: '后端已就绪',
  planned: '规划中',
};
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">配置中心 / 系统管理工作台</p>
        <h1>系统管理工作台</h1>
        <p>集中访问组织机构、主数据、模板流程、能力包、AI 平台、数据科研、迁移运维与审计等治理能力。所有写操作都经版本号、幂等键、审计哈希链与事件出箱。</p>
      </div>
      <RouterLink class="button secondary" to="/admin-org">组织机构</RouterLink>
    </div>

    <section class="admin-metrics" aria-label="全仓实现状态">
      <article><span>已可用页面</span><strong>{{ counts.available }}</strong><small>/ {{ routeRegistry.length }} 路由</small></article>
      <article><span>后端已就绪</span><strong>{{ counts.backend }}</strong><small>待接页面</small></article>
      <article><span>规划中</span><strong>{{ counts.planned }}</strong><small>待实现</small></article>
    </section>

    <div class="admin-hub">
      <section v-for="section in sections" :key="section.title" class="admin-panel hub-card">
        <header><div><h2>{{ section.title }}</h2><p>{{ section.blurb }}</p></div></header>
        <ul class="hub-list">
          <li v-for="routeId in section.routes" :key="routeId" :class="`hub-${statusOf(routeId)}`">
            <RouterLink v-if="statusOf(routeId) === 'available'" :to="`/${routeId}`" class="hub-link">{{ titleOf(routeId) }}</RouterLink>
            <span v-else class="hub-link muted">{{ titleOf(routeId) }}</span>
            <span class="hub-badge" :class="`hub-badge-${statusOf(routeId)}`">{{ statusLabel[statusOf(routeId)] }}</span>
          </li>
        </ul>
      </section>
    </div>
  </section>
</template>

<style scoped>
.admin-hub {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 16px;
}
.hub-card { margin: 0; }
.hub-list {
  list-style: none;
  margin: 0;
  padding: 4px 0 0;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hub-list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border: 1px solid var(--line, #dce3eb);
  border-radius: 8px;
  background: #fbfcfe;
}
.hub-link { font-weight: 600; color: var(--blue, #1769e0); text-decoration: none; }
.hub-link.muted { color: var(--ink, #172235); cursor: default; }
.hub-badge {
  flex: 0 0 auto;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.hub-badge-available { background: #e6f4ea; color: #137333; }
.hub-badge-backend { background: #fef7e0; color: #8a6100; }
.hub-badge-planned { background: #eef1f5; color: #6b7684; }
</style>
