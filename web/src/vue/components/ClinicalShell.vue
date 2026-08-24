<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, ref, watch } from 'vue';
import { useRoute } from 'vue-router';

import { clinicalContext } from '../../clinical-api';
import { specialtyGuardRouteIds } from '../route-registry';

const GlobalAiAssistantDialog = defineAsyncComponent(() => import('./GlobalAiAssistantDialog.vue'));

const route = useRoute();
const routeId = computed(() => String(route.meta.contractId ?? 'safe-not-found'));
const assistantOpen = ref(false);
const assistantLauncher = ref<HTMLButtonElement | null>(null);

// 与高保真原型一致的侧栏导航（coverage.js + specialty 拼接）
interface NavItem { id: string; label: string; icon: string; group: string; count?: string }
const navigation: NavItem[] = [
  { id: 'clinical', label: '临床业务门户', icon: '⌂', group: '临床工作域' },
  { id: 'outpatient', label: '门诊工作台', icon: '◫', group: '临床工作域', count: '6' },
  { id: 'emergency', label: '急诊工作台', icon: '✚', group: '临床工作域', count: '4' },
  { id: 'inpatient', label: '住院工作站', icon: '▥', group: '临床工作域', count: '5' },
  { id: 'specialty-center', label: '核心专科工作台', icon: '专', group: '临床工作域', count: '10' },
  { id: 'record', label: '病历中心', icon: '▤', group: '病历与质量', count: '3' },
  { id: 'quality-center', label: '医疗质量中心', icon: '◈', group: '病历与质量', count: '7' },
  { id: 'archive-assets', label: '病案资产中心', icon: '▣', group: '病历与质量', count: '3' },
  { id: 'care-operations', label: '医疗协同中心', icon: '✚', group: '业务协同', count: '8' },
  { id: 'clinical-tasks', label: '任务与临床路径', icon: '☑', group: '业务协同', count: '9' },
  { id: 'data-center', label: '数据中心', icon: '⌁', group: '平台中心', count: '6' },
  { id: 'ai-center', label: 'AI 中心', icon: '✦', group: '平台中心', count: '4' },
  { id: 'mock-interfaces', label: '模拟接口', icon: '⇄', group: '平台中心' },
  { id: 'workflow', label: '业务配置', icon: '⌘', group: '管理与配置' },
  { id: 'admin', label: '系统管理', icon: '⚙', group: '管理与配置', count: '7' },
];

const groups = computed(() => {
  const order: string[] = [];
  const map = new Map<string, NavItem[]>();
  for (const item of navigation) {
    if (!map.has(item.group)) { map.set(item.group, []); order.push(item.group); }
    map.get(item.group)!.push(item);
  }
  return order.map((group) => ({ group, items: map.get(group)! }));
});

// 路由域归类（coverage.js + app.js）
const recordRoutes = ['record', 'record-editor', 'record-sources', 'record-qc', 'record-versions', 'record-sign', 'record-diff', 'lis-report', 'pacs-viewer'];
const outpatientRoutes = ['outpatient', 'opd-record', 'opd-diagnosis', 'opd-orders', 'opd-results', 'opd-consult', 'opd-followup'];
const emergencyRoutes = ['emergency', 'er-triage', 'er-record', 'er-observation', 'er-nursing', 'er-handoff'];
const inpatientDocRoutes = ['inpatient-doc-editor', 'inpatient-doc-qc', 'inpatient-doc-versions'];
const inpatientRoutes = ['inpatient', 'inpatient-overview', 'inpatient-course', ...inpatientDocRoutes, 'ip-orders', 'ip-results', 'ip-consult', 'ip-pathway', 'inpatient-discharge', 'ward'];
const archiveRoutes = ['archive-assets', 'archive-catalog', 'archive-scan', 'archive-integrity', 'archive-borrow', 'archive-preservation', 'asset-detail'];

const clinicalFoundationRoutes = ['clinical', 'login-context', 'unified-home', 'patient-registry', 'patient-merge', 'patient-timeline', 'emergency-access', 'appointment-registration', 'admission-bed'];
const careOperationRoutes = ['care-operations', 'billing', 'outpatient-pharmacy', 'inpatient-pharmacy', 'lab-workbench', 'pathology-workbench', 'imaging-workbench', 'therapy-workbench', 'surgery-schedule', 'anesthesia-workbench', 'device-monitoring', 'transfusion'];
const qualityCenterRoutes = ['quality-center', 'department-qc', 'quality-rating', 'infection-events', 'credentials'];
const dataCenterRoutes = ['data-center', 'integration', 'integration-connectors', 'integration-mapping', 'integration-messages', 'migration', 'data-quality', 'devices', 'research', 'cohort-builder', 'research-stats', 'research-dataset'];
const aiPlatformRoutes = ['ai-center', 'ai-assistant', 'ai-reminder-detail', 'ai-capture', 'ai-action-review', 'ai-assistant-policy', 'models', 'model-connection', 'model-routing', 'model-evaluation', 'agent-catalog', 'agent', 'agent-context', 'tool-catalog', 'skill-catalog', 'agent-compose', 'agent-evals', 'aiops'];
const configurationRoutes = ['workflow', 'capability-pack', 'specialty-coverage', 'form-designer', 'rule-center', 'scope-designer', 'config-release', 'config-upgrade'];
const operationRoutes = ['install', 'backup', 'operations', 'release-gates', 'opensource'];
const adminRoutes = ['admin', 'admin-org', 'admin-users', 'admin-roles', 'admin-permissions', 'admin-auth', 'admin-dictionaries', 'admin-master-data', 'admin-templates', 'admin-parameters', 'admin-jobs', 'admin-audit'];

function isActive(navId: string): boolean {
  const c = routeId.value;
  switch (navId) {
    case 'outpatient': return outpatientRoutes.includes(c) && !recordRoutes.includes(c);
    case 'emergency': return emergencyRoutes.includes(c);
    case 'inpatient': return inpatientRoutes.includes(c);
    case 'specialty-center': return specialtyGuardRouteIds.has(c);
    case 'record': return recordRoutes.includes(c);
    case 'quality-center': return qualityCenterRoutes.includes(c);
    case 'archive-assets': return archiveRoutes.includes(c);
    case 'care-operations': return careOperationRoutes.includes(c);
    case 'clinical-tasks': return c === 'clinical-tasks';
    case 'data-center': return dataCenterRoutes.includes(c);
    case 'ai-center': return aiPlatformRoutes.includes(c);
    case 'workflow': return configurationRoutes.includes(c);
    case 'admin': return adminRoutes.includes(c) || operationRoutes.includes(c);
    case 'clinical': return clinicalFoundationRoutes.includes(c);
    default: return c === navId;
  }
}

// 域内子导航（原型 domain-nav + center-nav）
type SubNavItem = [string, string]
interface SubNav { kind: 'domain' | 'center'; title: string; active: string; items: SubNavItem[] }
const subNav = computed<SubNav | null>(() => {
  const c = routeId.value;
  if (outpatientRoutes.includes(c) && !recordRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c, items: [['outpatient', '门诊工作台'], ['opd-record', '门诊病历'], ['opd-diagnosis', '诊断'], ['opd-orders', '医嘱处方'], ['opd-results', '检查检验'], ['opd-consult', '会诊转诊']] };
  }
  if (emergencyRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c, items: [['emergency', '急诊工作台'], ['er-triage', '预检分诊'], ['er-record', '急诊病历'], ['er-observation', '抢救留观'], ['er-nursing', '急诊护理'], ['er-handoff', '急会诊与交接']] };
  }
  if (inpatientRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c.startsWith('inpatient-doc') ? 'inpatient-course' : c, items: [['inpatient', '患者列表'], ['inpatient-overview', '患者总览'], ['inpatient-course', '病历文书'], ['ip-orders', '医嘱与用药'], ['ip-results', '检查检验'], ['ip-consult', '查房会诊'], ['ip-pathway', '临床路径'], ['ward', '护理摘要'], ['inpatient-discharge', '出院病案']] };
  }
  if (careOperationRoutes.includes(c)) {
    return { kind: 'center', title: '医疗协同', active: c, items: [['care-operations', '协同总览'], ['billing', '费用结算'], ['outpatient-pharmacy', '门诊药房'], ['inpatient-pharmacy', '住院药房'], ['lab-workbench', '检验'], ['imaging-workbench', '检查影像'], ['surgery-schedule', '手术'], ['transfusion', '输血']] };
  }
  if (qualityCenterRoutes.includes(c)) {
    return { kind: 'center', title: '医疗质量中心', active: c, items: [['quality-center', '质量总览'], ['quality-rating', '评级取证'], ['infection-events', '院感事件'], ['credentials', '临床资质']] };
  }
  if (dataCenterRoutes.includes(c)) {
    return { kind: 'center', title: '数据中心', active: c, items: [['data-center', '数据总览'], ['migration', '历史迁移'], ['data-quality', '数据质量'], ['research', '科研统计']] };
  }
  if (aiPlatformRoutes.includes(c)) {
    return { kind: 'center', title: 'AI 中心', active: c, items: [['ai-center', 'AI 总览'], ['ai-assistant', '临床助手'], ['models', '模型路由'], ['agent-catalog', 'Agent 设计'], ['skill-catalog', 'Skill'], ['tool-catalog', 'Tool'], ['aiops', '运行治理']] };
  }
  if (configurationRoutes.includes(c)) {
    return { kind: 'center', title: '业务配置', active: c, items: [['workflow', '流程设计'], ['capability-pack', '能力包'], ['specialty-coverage', '科室适配'], ['form-designer', '表单模板'], ['rule-center', '规则时限'], ['scope-designer', '职责范围']] };
  }
  if (clinicalFoundationRoutes.includes(c)) {
    return { kind: 'center', title: '临床通用', active: c, items: [['clinical', '业务门户'], ['unified-home', '统一首页'], ['patient-registry', '患者登记'], ['patient-timeline', '患者时间线'], ['appointment-registration', '预约挂号'], ['admission-bed', '入院床位'], ['emergency-access', '紧急访问']] };
  }
  return null;
});

const roleContext = computed(() => {
  const id = routeId.value;
  if (id === 'ward') return '病区护士 · 心内科一病区';
  if (inpatientRoutes.includes(id)) return '住院医生 · 心内科一病区';
  if (emergencyRoutes.includes(id)) return '急诊医生 · 抢救区';
  if (id === 'clinical-tasks') return '统一临床任务中心';
  if (outpatientRoutes.includes(id) || recordRoutes.includes(id)) return '病历中心 · 当前门诊就诊';
  return '管理与治理工作台';
});

const assistantContext = computed(() => {
  const id = routeId.value;
  if (inpatientRoutes.includes(id)) {
    return {
      label: `${roleContext.value} · 当前住院就诊`,
      patientId: clinicalContext.inpatientPatientId || null,
      encounterId: clinicalContext.inpatientEncounterId || null,
    };
  }
  if (outpatientRoutes.includes(id) || recordRoutes.includes(id) || emergencyRoutes.includes(id)) {
    return {
      label: `${roleContext.value} · 当前患者/就诊`,
      patientId: clinicalContext.patientId || null,
      encounterId: clinicalContext.encounterId || null,
    };
  }
  return { label: `${roleContext.value} · 机构级`, patientId: null, encounterId: null };
});
const assistantTaskId = computed(() => {
  const value = route.query.task_id;
  return typeof value === 'string' && value ? value : null;
});

watch(routeId, () => {
  assistantOpen.value = false;
});

async function closeAssistant() {
  assistantOpen.value = false;
  await nextTick();
  assistantLauncher.value?.focus();
}
</script>

<template>
  <div class="shell">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <header class="topbar">
      <RouterLink class="brand" to="/clinical" aria-label="openemr2026 首页">
        <b class="brand-mark">+</b>
        <span>openemr2026</span>
        <small>临床核心</small>
      </RouterLink>
      <div class="context-pill">江城大学附属医院<small>⌄</small></div>
      <div class="context-pill domain-context">{{ roleContext }}<small>⌄</small></div>
      <div class="top-search"><input type="search" placeholder="搜索患者、病历、医嘱、任务…" aria-label="全局搜索" /></div>
      <div class="top-actions">
        <button ref="assistantLauncher" class="topbar-ai-assistant" type="button" aria-label="打开随行 AI 助手" :aria-expanded="assistantOpen" @click="assistantOpen = true"><span>AI</span><small>随行助手</small></button>
        <button class="icon-btn" aria-label="帮助">?</button>
        <button class="icon-btn" aria-label="通知">♢</button>
        <span class="avatar" aria-label="当前医生">林</span>
      </div>
    </header>
    <aside class="sidebar" aria-label="一级导航">
      <template v-for="group in groups" :key="group.group">
        <p class="nav-group">{{ group.group }}</p>
        <RouterLink
          v-for="item in group.items"
          :key="item.id"
          :to="`/${item.id}`"
          class="nav-item"
          :class="{ active: isActive(item.id) }"
          :aria-current="isActive(item.id) ? 'page' : undefined"
        ><span class="nav-icon" aria-hidden="true">{{ item.icon }}</span><span class="nav-label">{{ item.label }}</span><span v-if="item.count" class="nav-count">{{ item.count }}</span></RouterLink>
      </template>
    </aside>
    <main id="main-content" class="main">
      <div v-if="subNav" class="center-nav" :class="subNav.kind">
        <b>{{ subNav.title }}</b>
        <RouterLink v-for="[id, label] in subNav.items" :key="id" :to="`/${id}`" :class="{ active: id === subNav.active }">{{ label }}</RouterLink>
      </div>
      <slot />
    </main>
    <GlobalAiAssistantDialog
      v-if="assistantOpen"
      :open="assistantOpen"
      :route-id="routeId"
      :context-label="assistantContext.label"
      :patient-id="assistantContext.patientId"
      :encounter-id="assistantContext.encounterId"
      :task-id="assistantTaskId"
      @close="closeAssistant"
    />
  </div>
</template>
