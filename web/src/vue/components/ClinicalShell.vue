<script setup lang="ts">
import { computed, defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { clinicalContext } from '../../clinical-api';
import { authSession, logoutClinicalSession } from '../../auth-session';
import { specialtyGuardRouteIds } from '../route-registry';
import { mockInterfaceSubmenus } from '../simulation-workbenches';

const GlobalAiAssistantDialog = defineAsyncComponent(() => import('./GlobalAiAssistantDialog.vue'));

const route = useRoute();
const router = useRouter();
const routeId = computed(() => String(route.meta.contractId ?? 'safe-not-found'));
const assistantOpen = ref(false);
type AssistantDisplayMode = 'center' | 'side';
const assistantMode = ref<AssistantDisplayMode>('center');
const assistantLauncher = ref<HTMLButtonElement | null>(null);
type TopbarMenu = 'hospital' | 'role' | 'notifications' | 'account' | null;
const activeMenu = ref<TopbarMenu>(null);
const hospitals = ['江城大学附属医院', '江城第二医院', '江城儿童医学中心'];
const currentHospital = ref(hospitals[0]);
const doctorName = computed(() => authSession.user?.display_name ?? '未登录');
const doctorInitial = computed(() => doctorName.value === '未登录' ? '未' : doctorName.value.slice(0, 1));
const shiftDisplay = computed(() => authSession.user?.shift_display ?? '请登录后加载班次');
const hospitalDisplay = computed(() => authSession.user?.organization_name ?? currentHospital.value);
const roleLabels: Record<string, string> = {
  CHIEF_PHYSICIAN: '主任医师', ATTENDING_PHYSICIAN: '主治医师', SURGEON: '外科医师',
  EMERGENCY_PHYSICIAN: '急诊医师', PEDIATRICIAN: '儿科医师', ICU_PHYSICIAN: '重症医师',
  RADIOLOGIST: '影像诊断医师', NURSE_MANAGER: '护士长', REGISTERED_NURSE: '注册护士',
  PHARMACIST: '药师', LAB_TECHNICIAN: '检验技师', IMAGING_TECHNICIAN: '影像技师',
  PATHOLOGY_TECHNICIAN: '病理技师', CLINICAL_ADMIN: '医务管理', MEDICAL_RECORDS: '病案人员',
  SECURITY_AUDITOR: '安全审计员', REGISTRAR: '门诊服务人员', RESEARCHER: '临床研究人员',
  CLINICIAN: '临床医生', ADMINISTRATOR: '系统管理员', QUALITY_MANAGER: '质量管理员',
};
const roleOptions = computed(() => (authSession.user?.role_assignment_ids ?? []).map((id, index) => {
  const code = authSession.user?.role_codes[index] ?? 'UNKNOWN_ROLE';
  return { id, code, label: `${roleLabels[code] ?? code} · ${code}` };
}));
const selectedRoleId = ref(clinicalContext.roleId || null);
const searchText = ref('');
interface TopbarNotification { id: string; title: string; description: string; category: 'critical' | 'task' | 'governance'; route: string; unread: boolean }
const notifications = ref<TopbarNotification[]>([
  { id: 'critical-result', title: '危急值待确认', description: '检验结果已进入医生工作队列', category: 'critical', route: '/opd-results', unread: true },
  { id: 'consult-timeout', title: '会诊即将超时', description: '心内科会诊剩余 20 分钟', category: 'task', route: '/clinical-tasks', unread: true },
  { id: 'model-gate', title: '模型治理提醒', description: 'DeepSeek 实模门禁仍未批准', category: 'governance', route: '/models', unread: true },
]);
const notificationFilter = ref<'all' | 'unread'>('all');
const unreadNotifications = computed(() => notifications.value.filter((item) => item.unread).length);
const filteredNotifications = computed(() => notificationFilter.value === 'unread' ? notifications.value.filter((item) => item.unread) : notifications.value);
const guideOpen = ref(false);
const guideDialog = ref<HTMLDialogElement | null>(null);
const guideLauncher = ref<HTMLButtonElement | null>(null);
const guideCloseAction = ref<'focus' | 'assistant' | 'navigate'>('focus');
const guideTarget = ref<string | null>(null);

// 与高保真原型一致的侧栏导航（coverage.js + specialty 拼接）
interface NavItem { id: string; label: string; icon: string; group: string; count?: string }
const navigation: NavItem[] = [
  { id: 'clinical', label: '临床业务门户', icon: '⌂', group: '临床工作域' },
  { id: 'outpatient', label: '门诊工作台', icon: '◫', group: '临床工作域' },
  { id: 'emergency', label: '急诊工作台', icon: '✚', group: '临床工作域' },
  { id: 'inpatient', label: '住院工作站', icon: '▥', group: '临床工作域' },
  { id: 'record', label: '全院病历中心', icon: '▤', group: '病历与质量' },
  { id: 'quality-center', label: '医疗质量中心', icon: '◈', group: '病历与质量' },
  { id: 'archive-assets', label: '病案资产中心', icon: '▣', group: '病历与质量' },
  { id: 'care-operations', label: '诊疗执行中心', icon: '✚', group: '业务协同' },
  { id: 'clinical-tasks', label: '任务中心', icon: '☑', group: '业务协同' },
  { id: 'data-center', label: '数据中心', icon: '⌁', group: '平台中心' },
  { id: 'ai-assistant', label: 'AI 中心', icon: '✦', group: '平台中心' },
  { id: 'knowledge-center', label: '知识中心', icon: '⬡', group: '平台中心' },
  { id: 'workflow', label: '业务配置', icon: '⌘', group: '管理与配置' },
  { id: 'admin', label: '系统管理', icon: '⚙', group: '管理与配置' },
  { id: 'mock-interfaces', label: '模拟接口', icon: '⇄', group: '管理与配置' },
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
const emergencyRoutes = [
  'emergency', 'er-triage', 'er-record', 'er-observation', 'er-nursing', 'er-handoff',
  'er-patient-overview', 'er-clinical-timeline', 'er-safety-gates', 'er-transfer-readiness', 'er-evidence-ledger',
];
const inpatientDocRoutes = ['inpatient-doc-editor', 'inpatient-doc-qc', 'inpatient-doc-versions'];
const inpatientRoutes = ['inpatient', 'inpatient-overview', 'inpatient-course', ...inpatientDocRoutes, 'ip-orders', 'ip-results', 'ip-consult', 'ip-pathway', 'inpatient-discharge', 'ward'];
const inpatientAgentContextRoutes = [...inpatientRoutes, 'inpatient-pharmacy'];
const archiveRoutes = ['archive-assets', 'archive-catalog', 'archive-scan', 'archive-integrity', 'archive-borrow', 'archive-preservation', 'asset-detail'];

const clinicalFoundationRoutes = ['clinical', 'unified-home', 'patient-registry', 'patient-merge', 'patient-timeline', 'emergency-access', 'appointment-registration', 'admission-bed'];
const careOperationRoutes = ['care-operations', 'billing', 'outpatient-pharmacy', 'inpatient-pharmacy', 'lab-workbench', 'pathology-workbench', 'imaging-workbench', 'therapy-workbench', 'surgery-schedule', 'anesthesia-workbench', 'device-monitoring', 'transfusion'];
const qualityCenterRoutes = ['quality-center', 'department-qc', 'quality-rating', 'infection-events', 'credentials'];
const dataCenterRoutes = ['data-center', 'integration', 'integration-connectors', 'integration-mapping', 'integration-messages', 'migration', 'data-quality', 'devices', 'research', 'cohort-builder', 'research-stats', 'research-dataset'];
const knowledgeCenterRoutes = ['knowledge-center', 'pathway-graph', 'pathway-review', 'pathway-versions'];
const aiPlatformRoutes = ['ai-assistant', 'ai-reminder-detail', 'ai-capture', 'ai-action-review', 'ai-assistant-policy', 'models', 'model-connection', 'model-routing', 'model-evaluation', 'agent-catalog', 'agent', 'agent-context', 'tool-catalog', 'skill-catalog', 'agent-compose', 'agent-evals', 'aiops'];
const configurationRoutes = ['workflow', 'capability-pack', 'specialty-coverage', 'form-designer', 'rule-center', 'scope-designer', 'config-release', 'config-upgrade'];
const operationRoutes = ['install', 'backup', 'operations', 'release-gates', 'opensource'];
const adminRoutes = ['admin', 'admin-org', 'admin-users', 'admin-roles', 'admin-permissions', 'admin-auth', 'admin-dictionaries', 'admin-master-data', 'admin-templates', 'admin-parameters', 'admin-jobs', 'admin-audit'];
const adminNavigation: ReadonlyArray<readonly [string, string]> = [
  ['admin', '管理工作台'], ['admin-org', '组织机构'], ['admin-users', '用户账户'],
  ['admin-roles', '角色工作组'], ['admin-permissions', '权限策略'], ['admin-auth', '认证安全'],
  ['admin-dictionaries', '字典术语'], ['admin-master-data', '主数据'], ['admin-templates', '模板输出'],
  ['admin-parameters', '参数开关'], ['admin-jobs', '通知任务'], ['admin-audit', '管理审计'],
];
const isAdminDomain = computed(() => adminRoutes.includes(routeId.value));

function isActive(navId: string): boolean {
  const c = routeId.value;
  switch (navId) {
    case 'outpatient': return outpatientRoutes.includes(c) && !recordRoutes.includes(c);
    case 'emergency': return emergencyRoutes.includes(c);
    case 'inpatient': return inpatientRoutes.includes(c);
    case 'record': return recordRoutes.includes(c);
    case 'quality-center': return qualityCenterRoutes.includes(c);
    case 'archive-assets': return archiveRoutes.includes(c);
    case 'care-operations': return careOperationRoutes.includes(c);
    case 'clinical-tasks': return c === 'clinical-tasks';
    case 'data-center': return dataCenterRoutes.includes(c);
    case 'ai-assistant': return aiPlatformRoutes.includes(c);
    case 'knowledge-center': return knowledgeCenterRoutes.includes(c);
    case 'workflow': return configurationRoutes.includes(c);
    case 'admin': return adminRoutes.includes(c) || operationRoutes.includes(c);
    case 'clinical': return clinicalFoundationRoutes.includes(c) || specialtyGuardRouteIds.has(c);
    case 'mock-interfaces': return c === 'mock-interfaces' || c === 'mock-interface-workbench';
    default: return c === navId;
  }
}

// 域内子导航（原型 domain-nav + center-nav）
type SubNavItem = [string, string]
interface SubNav { kind: 'domain' | 'center'; title: string; active: string; items: SubNavItem[] }
const subNav = computed<SubNav | null>(() => {
  const c = routeId.value;
  if (c === 'mock-interfaces' || c === 'mock-interface-workbench') {
    const workbenchId = typeof route.params.workbenchId === 'string' ? route.params.workbenchId : 'mock-interfaces';
    return {
      kind: 'center',
      title: '模拟接口',
      active: workbenchId === 'mock-interfaces' ? 'mock-interfaces' : `mock-interfaces/${workbenchId}`,
      items: mockInterfaceSubmenus.map(([id, label]) => [id === 'mock-interfaces' ? id : `mock-interfaces/${id}`, label]),
    };
  }
  if (recordRoutes.includes(c)) {
    const active = c === 'record-sign' ? 'record-qc' : c === 'record-diff' ? 'record-versions' : c;
    return {
      kind: 'center',
      title: '全院病历中心',
      active,
      items: [
        ['record', '病历工作台'], ['record-editor', '专注编辑'], ['record-sources', '来源证据'],
        ['record-qc', '质控审签'], ['record-versions', '版本证据'],
        ['lis-report', 'LIS 报告'], ['pacs-viewer', 'PACS 影像'],
      ],
    };
  }
  if (outpatientRoutes.includes(c) && !recordRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c, items: [['outpatient', '门诊工作台'], ['opd-record', '门诊病历'], ['opd-diagnosis', '诊断'], ['opd-orders', '医嘱处方'], ['opd-results', '检查检验'], ['opd-consult', '会诊转诊'], ['opd-followup', '随访终诊']] };
  }
  if (emergencyRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c, items: [['emergency', '急诊工作台'], ['er-triage', '预检分诊'], ['er-record', '急诊病历'], ['er-observation', '抢救留观'], ['er-nursing', '急诊护理'], ['er-handoff', '急会诊与交接'], ['er-patient-overview', '患者纵深']] };
  }
  if (inpatientRoutes.includes(c)) {
    return { kind: 'domain', title: '临床业务门户', active: c.startsWith('inpatient-doc') ? 'inpatient-course' : c, items: [['inpatient', '患者列表'], ['inpatient-overview', '患者总览'], ['inpatient-course', '病历文书'], ['ip-orders', '医嘱与用药'], ['ip-results', '检查检验'], ['ip-consult', '查房会诊'], ['ip-pathway', '临床路径'], ['ward', '护理摘要'], ['inpatient-discharge', '出院病案']] };
  }
  if (c === 'clinical-tasks') {
    const requestedView = typeof route.query.view === 'string' ? route.query.view : 'overview';
    const activeView = ['overview', 'team', 'collaboration', 'notifications', 'pathway', 'rules'].includes(requestedView)
      ? requestedView
      : 'overview';
    return {
      kind: 'center',
      title: '任务中心',
      active: `clinical-tasks?view=${activeView}`,
      items: [
        ['clinical-tasks?view=overview', '任务总览'], ['clinical-tasks?view=team', '团队队列'],
        ['clinical-tasks?view=collaboration', '委托协作'], ['clinical-tasks?view=notifications', '消息通知'],
        ['clinical-tasks?view=pathway', '临床路径'], ['clinical-tasks?view=rules', '任务规则'],
      ],
    };
  }
  if (careOperationRoutes.includes(c)) {
    return {
      kind: 'center',
      title: '诊疗执行',
      active: c,
      items: [
        ['care-operations', '执行总览'], ['billing', '费用结算'],
        ['outpatient-pharmacy', '门诊药房'], ['inpatient-pharmacy', '住院药房'],
        ['lab-workbench', '检验'], ['pathology-workbench', '病理'],
        ['imaging-workbench', '检查影像'], ['therapy-workbench', '治疗'],
        ['surgery-schedule', '手术'], ['anesthesia-workbench', '麻醉'],
        ['transfusion', '输血'], ['device-monitoring', '设备监护'],
      ],
    };
  }
  if (qualityCenterRoutes.includes(c)) {
    return { kind: 'center', title: '医疗质量中心', active: c, items: [['quality-center', '质量总览'], ['department-qc', '院科质控'], ['quality-rating', '评级取证'], ['infection-events', '院感事件'], ['credentials', '临床资质']] };
  }
  if (archiveRoutes.includes(c)) {
    return {
      kind: 'center', title: '病案资产', active: c === 'asset-detail' ? 'archive-integrity' : c,
      items: [['archive-assets', '总览'], ['archive-catalog', '病案目录'], ['archive-scan', '扫描编目'], ['archive-integrity', '完整性与验真'], ['archive-borrow', '借阅复制'], ['archive-preservation', '长期保存']],
    };
  }
  if (dataCenterRoutes.includes(c)) {
    return { kind: 'center', title: '数据中心', active: c, items: [['data-center', '数据总览'], ['integration', '集成交换'], ['migration', '历史迁移'], ['data-quality', '数据质量'], ['devices', '设备接入'], ['research', '科研统计']] };
  }
  if (aiPlatformRoutes.includes(c)) {
    return { kind: 'center', title: 'AI 中心', active: c, items: [['ai-assistant', 'AI医助 Eva'], ['ai-assistant-policy', 'Eva工作策略'], ['models', '模型服务'], ['agent-catalog', '医助团队'], ['skill-catalog', '医助能力'], ['tool-catalog', '医助工具'], ['agent-evals', '评测发布'], ['aiops', '运行监测']] };
  }
  if (knowledgeCenterRoutes.includes(c)) {
    return { kind: 'center', title: '知识中心', active: c, items: [['knowledge-center', '路径知识库'], ['pathway-graph', '知识图谱'], ['pathway-review', '审核队列'], ['pathway-versions', '版本历史']] };
  }
  if (configurationRoutes.includes(c)) {
    return { kind: 'center', title: '业务配置', active: c, items: [['workflow', '流程设计'], ['capability-pack', '能力包'], ['specialty-coverage', '科室适配'], ['form-designer', '表单模板'], ['rule-center', '规则时限'], ['scope-designer', '职责范围']] };
  }
  if (clinicalFoundationRoutes.includes(c)) {
    return { kind: 'center', title: '临床通用', active: c, items: [['clinical', '业务门户'], ['appointment-registration', '预约挂号'], ['admission-bed', '入院床位'], ['emergency-access', '紧急访问']] };
  }
  return null;
});

const routeRoleContext = computed(() => {
  const id = routeId.value;
  if (id === 'ward') return '病区护士 · 心内科一病区';
  if (id === 'inpatient-pharmacy') return '住院药师 · 住院药房';
  if (inpatientRoutes.includes(id)) return '住院医生 · 心内科一病区';
  if (emergencyRoutes.includes(id)) return '急诊医生 · 抢救区';
  if (id === 'clinical-tasks') return '任务中心';
  if (archiveRoutes.includes(id)) return '病案资产与长期保存';
  if (recordRoutes.includes(id)) return '全院病历中心 · 当前门诊就诊';
  if (outpatientRoutes.includes(id)) return '病历中心 · 当前门诊就诊';
  return '管理与治理工作台';
});
const roleContext = computed(() => roleOptions.value.find((role) => role.id === selectedRoleId.value)?.label
  ?? roleOptions.value[0]?.label
  ?? routeRoleContext.value);

const assistantContext = computed(() => {
  const id = routeId.value;
  if (inpatientAgentContextRoutes.includes(id)) {
    return {
      label: `${roleContext.value} · 当前住院就诊`,
      patientId: clinicalContext.inpatientPatientId || null,
      encounterId: clinicalContext.inpatientEncounterId || null,
    };
  }
  if (emergencyRoutes.includes(id)) {
    return {
      label: `${roleContext.value} · 当前急诊就诊`,
      patientId: clinicalContext.emergencyPatientId || null,
      encounterId: clinicalContext.emergencyEncounterId || null,
    };
  }
  if (outpatientRoutes.includes(id) || recordRoutes.includes(id) || archiveRoutes.includes(id)) {
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
  activeMenu.value = null;
});

function toggleMenu(menu: Exclude<TopbarMenu, null>) {
  activeMenu.value = activeMenu.value === menu ? null : menu;
}

function selectHospital(hospital: string) {
  currentHospital.value = hospital;
  activeMenu.value = null;
}

function selectRole(roleId: string) {
  if (!roleOptions.value.some((role) => role.id === roleId)) return;
  selectedRoleId.value = roleId;
  clinicalContext.roleId = roleId;
  activeMenu.value = null;
}

function selectRoleFromEvent(event: Event) {
  selectRole((event.target as HTMLSelectElement).value);
}

async function submitSearch() {
  const query = searchText.value.trim();
  if (!query) return;
  activeMenu.value = null;
  await router.push({ path: '/patient-registry', query: { q: query } });
}

async function openGuide() {
  activeMenu.value = null;
  guideOpen.value = true;
  await nextTick();
  guideDialog.value?.showModal();
}

function closeGuide(action: 'focus' | 'assistant' | 'navigate' = 'focus') {
  guideCloseAction.value = action;
  guideDialog.value?.close();
}

async function onGuideClosed() {
  guideOpen.value = false;
  await nextTick();
  if (guideCloseAction.value === 'assistant') assistantOpen.value = true;
  else if (guideCloseAction.value === 'navigate' && guideTarget.value) await router.push(guideTarget.value);
  else guideLauncher.value?.focus();
  guideCloseAction.value = 'focus';
  guideTarget.value = null;
}

function markNotificationsRead() {
  notifications.value = notifications.value.map((item) => ({ ...item, unread: false }));
}

function markNotificationRead(id: string) {
  notifications.value = notifications.value.map((item) => item.id === id ? { ...item, unread: false } : item);
}

async function openNotification(item: TopbarNotification) {
  markNotificationRead(item.id);
  activeMenu.value = null;
  await router.push(item.route);
}

function navigateFromGuide(path: string) {
  guideTarget.value = path;
  closeGuide('navigate');
}

function openAssistantFromGuide() {
  closeGuide('assistant');
}

async function openLoginContext() {
  activeMenu.value = null;
  await logoutClinicalSession();
  await router.push('/login');
}

function onDocumentPointerDown(event: PointerEvent) {
  const target = event.target;
  if (target instanceof Element && !target.closest('.topbar-menu-control')) activeMenu.value = null;
}

function onDocumentKeyDown(event: KeyboardEvent) {
  if (event.key === 'Escape' && activeMenu.value) activeMenu.value = null;
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocumentPointerDown);
  document.addEventListener('keydown', onDocumentKeyDown);
});

onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onDocumentPointerDown);
  document.removeEventListener('keydown', onDocumentKeyDown);
});

async function closeAssistant() {
  assistantOpen.value = false;
  await nextTick();
  assistantLauncher.value?.focus();
}
</script>

<template>
  <div class="shell" :class="{ 'assistant-side-open': assistantOpen && assistantMode === 'side', 'mock-interface-shell': routeId === 'mock-interfaces' || routeId === 'mock-interface-workbench' }">
    <a class="skip-link" href="#main-content">跳到主要内容</a>
    <header class="topbar">
      <RouterLink class="brand" to="/clinical" aria-label="OpenEMR2026 首页">
        <img class="brand-logo" data-testid="brand-logo" src="/brand/haonan-medical-ai-logo.png" alt="" width="38" height="38" />
        <span class="brand-copy"><strong>OpenEMR2026</strong><small>电子病历系统</small></span>
      </RouterLink>
      <div class="topbar-menu-control context-control">
        <button class="context-pill" type="button" aria-label="选择医院" aria-haspopup="menu" :aria-expanded="activeMenu === 'hospital'" @click.stop="toggleMenu('hospital')">{{ hospitalDisplay }}<small aria-hidden="true">⌄</small></button>
        <div v-if="activeMenu === 'hospital'" class="topbar-popover context-menu" role="menu" aria-label="医院列表">
          <strong>切换工作医院</strong>
          <button v-for="hospital in hospitals" :key="hospital" type="button" role="menuitemradio" :aria-checked="currentHospital === hospital" @click="selectHospital(hospital)"><span>{{ hospital }}</span><b aria-hidden="true">{{ currentHospital === hospital ? '✓' : '' }}</b></button>
          <small>仅切换当前演示会话，不改变生产授权。</small>
        </div>
      </div>
      <div class="topbar-menu-control context-control role-control">
        <button class="context-pill domain-context" type="button" aria-label="选择角色" aria-haspopup="menu" :aria-expanded="activeMenu === 'role'" @click.stop="toggleMenu('role')">{{ roleContext }}<small aria-hidden="true">⌄</small></button>
        <div v-if="activeMenu === 'role'" class="topbar-popover context-menu" role="menu" aria-label="角色列表">
          <strong>当前授权岗位</strong>
          <button v-for="role in roleOptions" :key="role.id" type="button" role="menuitemradio" :aria-checked="selectedRoleId === role.id" @click="selectRole(role.id)"><span>{{ role.label }}</span><b aria-hidden="true">{{ selectedRoleId === role.id ? '✓' : '' }}</b></button>
          <small>这里只显示当前账号在服务端有效的岗位；切换后重新签发上下文授权。</small>
        </div>
      </div>
      <form class="top-search" role="search" @submit.prevent="submitSearch">
        <input v-model="searchText" type="search" placeholder="搜索患者、病历、医嘱、任务…" aria-label="全局搜索" />
        <button type="submit" aria-label="提交全局搜索">搜索</button>
      </form>
      <div class="top-actions">
        <button ref="assistantLauncher" class="topbar-ai-assistant" type="button" aria-label="打开AI医助Eva" :aria-expanded="assistantOpen" @click="assistantOpen = true"><img src="/brand/ai-medical-assistant-eva.png" alt="" width="28" height="28" /><small>AI医助 Eva</small></button>
        <button ref="guideLauncher" class="icon-btn" type="button" aria-label="打开操作指引" @click="openGuide"><svg class="topbar-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.35 2.35 0 0 1 4.55.8c0 1.8-2.35 2.05-2.35 3.55"/><path d="M12 17.2h.01"/></svg></button>
        <div class="topbar-menu-control">
          <button class="icon-btn notification-trigger" type="button" :aria-label="unreadNotifications ? `通知，${unreadNotifications} 条未读` : '通知，无未读'" aria-haspopup="true" :aria-expanded="activeMenu === 'notifications'" @click.stop="toggleMenu('notifications')"><svg class="topbar-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/></svg><span v-if="unreadNotifications" aria-hidden="true">{{ unreadNotifications }}</span></button>
          <section v-if="activeMenu === 'notifications'" class="topbar-popover notification-panel" role="region" aria-label="通知中心">
            <header><div><strong>通知中心</strong><small>{{ unreadNotifications ? `${unreadNotifications} 条未读` : '已全部阅读' }}</small></div><button type="button" :disabled="!unreadNotifications" @click="markNotificationsRead">全部标为已读</button></header>
            <div class="notification-tabs" role="tablist" aria-label="通知筛选"><button type="button" role="tab" :aria-selected="notificationFilter === 'all'" @click="notificationFilter = 'all'">全部</button><button type="button" role="tab" :aria-selected="notificationFilter === 'unread'" @click="notificationFilter = 'unread'">未读 <b>{{ unreadNotifications }}</b></button></div>
            <ul v-if="filteredNotifications.length"><li v-for="item in filteredNotifications" :key="item.id" :class="{ unread: item.unread }"><button class="notification-main" type="button" @click="openNotification(item)"><i class="notification-item-icon" :class="item.category" aria-hidden="true">{{ item.category === 'critical' ? '!' : item.category === 'task' ? '✓' : '◇' }}</i><span><b>{{ item.title }}</b><small>{{ item.description }}</small></span><em aria-hidden="true">›</em></button><button v-if="item.unread" class="notification-read" type="button" :aria-label="`标记${item.title}为已读`" @click="markNotificationRead(item.id)">✓</button></li></ul>
            <div v-else class="notification-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18"/><path d="m8 12 2.2 2.2L16 8.5"/></svg><strong>没有未读通知</strong><span>新的临床与治理提醒会显示在这里。</span></div>
            <footer><RouterLink to="/clinical-tasks" @click="activeMenu = null">进入任务中心 <span aria-hidden="true">→</span></RouterLink></footer>
          </section>
        </div>
        <div class="topbar-menu-control">
          <button class="avatar" type="button" aria-label="用户登录与账户" aria-haspopup="dialog" :aria-expanded="activeMenu === 'account'" @click.stop="toggleMenu('account')">{{ doctorInitial }}</button>
          <section v-if="activeMenu === 'account'" class="topbar-popover account-menu" role="region" aria-label="用户账户">
            <header><span class="avatar large" aria-hidden="true">{{ doctorInitial }}</span><div><strong>{{ doctorName }}</strong><small>{{ authSession.user ? '数据库会话有效' : '尚未登录' }}</small></div></header>
            <div class="account-context-summary">
              <label><span>工作医院</span><select v-model="currentHospital" aria-label="账户菜单选择医院"><option v-for="hospital in hospitals" :key="hospital" :value="hospital">{{ hospital }}</option></select></label>
              <label><span>工作角色</span><select :value="selectedRoleId" aria-label="账户菜单选择角色" @change="selectRoleFromEvent"><option v-for="role in roleOptions" :key="role.id" :value="role.id">{{ role.label }}</option></select></label>
            </div>
            <RouterLink to="/admin-users" @click="activeMenu = null">账号与权限</RouterLink>
            <button type="button" @click="openLoginContext">退出系统</button>
          </section>
        </div>
        <div class="user-meta" aria-label="当前医生与出诊时间"><b>{{ doctorName }}</b><br><small>{{ shiftDisplay }}</small></div>
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
        ><span class="nav-icon" aria-hidden="true">{{ item.icon }}</span><span class="nav-label">{{ item.label }}</span></RouterLink>
      </template>
    </aside>
    <main id="main-content" class="main">
      <nav v-if="subNav" class="center-nav" :class="[subNav.kind, { 'task-center-subnav': routeId === 'clinical-tasks', 'archive-subpage-nav': archiveRoutes.includes(routeId) }]" :aria-label="`${subNav.title}二级导航`">
        <b>{{ subNav.title }}</b>
        <RouterLink v-for="[id, label] in subNav.items" :key="id" :to="`/${id}`" :class="{ active: id === subNav.active }" :aria-current="id === subNav.active ? 'page' : undefined">{{ label }}</RouterLink>
      </nav>
      <div v-if="isAdminDomain" class="admin-domain-layout">
        <aside class="admin-domain-nav card" aria-label="系统管理二级导航">
          <div class="admin-nav-title"><b>系统管理</b><span>身份 · 主数据 · 安全 · 运行</span></div>
          <RouterLink
            v-for="[id, label] in adminNavigation"
            :key="id"
            :to="`/${id}`"
            class="admin-domain-link"
            :class="{ active: id === routeId }"
            :aria-current="id === routeId ? 'page' : undefined"
          >{{ label }}</RouterLink>
          <div class="admin-nav-divider"></div>
          <RouterLink class="admin-domain-external" to="/workflow">业务流程配置 →</RouterLink>
          <RouterLink class="admin-domain-external" to="/integration">接口集成管理 →</RouterLink>
        </aside>
        <section class="admin-domain-content"><slot /></section>
      </div>
      <slot v-else />
    </main>
    <GlobalAiAssistantDialog
      v-if="assistantOpen"
      :open="assistantOpen"
      :route-id="routeId"
      :context-label="assistantContext.label"
      :patient-id="assistantContext.patientId"
      :encounter-id="assistantContext.encounterId"
      :task-id="assistantTaskId"
      :mode="assistantMode"
      @mode-change="assistantMode = $event"
      @close="closeAssistant"
    />
    <dialog v-if="guideOpen" ref="guideDialog" class="operation-guide-dialog" aria-labelledby="operation-guide-title" @close="onGuideClosed">
      <header><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5z"/><path d="M20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/></svg></i><div><span>快速开始</span><h2 id="operation-guide-title">操作指引</h2><p>从工作上下文到临床任务的四步入口</p></div><button type="button" aria-label="关闭操作指引" @click="closeGuide()"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header>
      <ol><li><b>1</b><div><strong>选择医院与角色</strong><span>顶栏切换当前工作上下文，服务端仍会独立校验授权。</span></div></li><li><b>2</b><div><strong>搜索患者或任务</strong><span>输入关键词后进入患者主索引，继续查看授权资料。</span></div></li><li><b>3</b><div><strong>进入业务工作台</strong><span>通过左侧一级导航和页面内子导航处理门诊、急诊或住院任务。</span></div></li><li><b>4</b><div><strong>调用AI医助 Eva</strong><span>Eva 保留当前页面上下文，生成内容需要人工审核后才能进入业务流程。</span></div></li></ol>
      <section class="guide-quick-actions" aria-label="快捷入口"><strong>立即开始</strong><div><button type="button" @click="navigateFromGuide('/patient-registry')"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2"/><circle cx="9.5" cy="7" r="4"/><path d="M19 8v6M16 11h6"/></svg><span>患者主索引<small>搜索与登记患者</small></span></button><button type="button" @click="navigateFromGuide('/admin-users')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg><span>账号与权限<small>查看用户与岗位授权</small></span></button><button type="button" @click="openAssistantFromGuide"><img src="/brand/ai-medical-assistant-eva.png" alt="" width="24" height="24"/><span>AI医助 Eva<small>带上下文开始任务</small></span></button></div></section>
      <footer><span>按 Esc 可随时关闭</span><button class="button secondary" type="button" @click="closeGuide()">稍后再看</button></footer>
    </dialog>
  </div>
</template>
