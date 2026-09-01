<script setup lang="ts">
// 临床业务门户 —— 三域卡片门户。DOM 结构与类名严格对齐高保真原型
// prototype/app/app.js `clinical()`（见 DEVELOPMENT_PRINCIPLES.md §六：复用原型类名，勿另写一套）。
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import { clinicalContext } from '../../clinical-api';
import { issueEmergencyFacilityLease, issueEmergencyLease, listEmergencyCoordinationCases, listEmergencyIdentityVerifications, listEmergencyObservations, listEmergencyResuscitations, listEmergencyTriageAssessments, listWaitingQueue } from '../../api/emergency';

const router = useRouter();
const emergencyFacilityLease = useQuery({ queryKey: ['clinical-portal', 'emergency', 'facility-lease'], queryFn: () => issueEmergencyFacilityLease('CLINICAL_PORTAL_EMERGENCY'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const emergencyPatientLease = useQuery({ queryKey: ['clinical-portal', 'emergency', 'patient-lease'], queryFn: () => issueEmergencyLease('CLINICAL_PORTAL_EMERGENCY'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const emergencyQueue = useQuery({ queryKey: ['clinical-portal', 'emergency', 'queue'], queryFn: () => listWaitingQueue(emergencyFacilityLease.data.value!), enabled: () => Boolean(emergencyFacilityLease.data.value), retry: false });
const emergencyTriages = useQuery({ queryKey: ['clinical-portal', 'emergency', 'triage'], queryFn: () => listEmergencyTriageAssessments(emergencyPatientLease.data.value!), enabled: () => Boolean(emergencyPatientLease.data.value), retry: false });
const emergencyResuscitations = useQuery({ queryKey: ['clinical-portal', 'emergency', 'resuscitation'], queryFn: () => listEmergencyResuscitations(emergencyPatientLease.data.value!), enabled: () => Boolean(emergencyPatientLease.data.value), retry: false });
const emergencyObservations = useQuery({ queryKey: ['clinical-portal', 'emergency', 'observation'], queryFn: () => listEmergencyObservations(emergencyPatientLease.data.value!), enabled: () => Boolean(emergencyPatientLease.data.value), retry: false });
const emergencyCoordination = useQuery({ queryKey: ['clinical-portal', 'emergency', 'coordination'], queryFn: () => listEmergencyCoordinationCases(emergencyPatientLease.data.value!), enabled: () => Boolean(emergencyPatientLease.data.value), retry: false });
const emergencyIdentity = useQuery({ queryKey: ['clinical-portal', 'emergency', 'identity'], queryFn: () => listEmergencyIdentityVerifications(emergencyPatientLease.data.value!), enabled: () => Boolean(emergencyPatientLease.data.value), retry: false });

interface DomainModule { title: string; desc: string; to: string }
interface DomainCard {
  type: 'outpatient' | 'emergency' | 'inpatient';
  eyebrow: string;
  symbol: string;
  title: string;
  desc: string;
  to: string;
  metrics: [string, string][];
  alerts: [string, string, string][];
  flow: string[];
  modules: DomainModule[];
  footer: [string, string][];
}

const baseDomains: DomainCard[] = [
  {
    type: 'outpatient',
    eyebrow: 'OUTPATIENT CARE',
    symbol: '门',
    title: '门诊诊疗',
    desc: '以一次门诊就诊为中心，从预约到诊、问诊病历、诊断医嘱到签署终诊。',
    to: 'outpatient',
    metrics: [['今日挂号', '46'], ['已到诊', '21'], ['候诊', '6'], ['诊疗中', '2'], ['待结果', '5'], ['待签病历', '3']],
    alerts: [['危急值', '1', 'red'], ['处方待审', '2', 'amber'], ['会诊临期', '1', 'amber']],
    flow: ['预约挂号', '到诊分诊', '问诊病历', '诊断医嘱', '结果处置', '签署终诊'],
    modules: [
      { title: '预约挂号与队列', desc: '号源、到诊、分诊、叫号、过号', to: 'appointment-registration' },
      { title: '门诊病历与质控', desc: '主诉、病史、查体、诊断、签署', to: 'record' },
      { title: '医嘱处方与执行', desc: '药品、检验、检查、治疗、审方', to: 'opd-orders' },
      { title: '结果与危急值', desc: '趋势、报告更正、确认与处置', to: 'opd-results' },
      { title: '会诊转诊', desc: '申请、受理、意见、时限', to: 'opd-consult' },
      { title: '随访与终诊', desc: '教育、复诊、随访、结束就诊', to: 'opd-followup' },
    ],
    footer: [['当前上下文', '心内科 · 门诊医生 · 今日班次'], ['最近访问', '陈建国 / James Chen · OP20260813-0842 · 草稿已保存']],
  },
  {
    type: 'emergency',
    eyebrow: 'EMERGENCY CARE',
    symbol: '急',
    title: '急诊诊疗',
    desc: '以时间关键事件为主线，从预检分诊、抢救留观、急会诊交接到明确去向。',
    to: 'emergency',
    metrics: [],
    alerts: [],
    flow: ['院前 / 到院', '预检分诊', '抢救 / 诊室', '急诊医嘱', '会诊交接', '去向闭环'],
    modules: [
      { title: '预检分诊与分区', desc: '级别、依据、立即处置、动态复评', to: 'er-triage' },
      { title: '急诊病历与抢救', desc: '时间轴、抢救记录、医嘱结果', to: 'er-record' },
      { title: '急诊护理与输液', desc: '生命体征、执行、异常', to: 'er-nursing' },
      { title: '急会诊与交接班', desc: '时限、责任、未完任务', to: 'er-handoff' },
      { title: '留观与转住院', desc: '观察记录、去向、接收', to: 'er-observation' },
      { title: '时间关键质控', desc: '双时间、超时、补录原因', to: 'er-record' },
    ],
    footer: [],
  },
  {
    type: 'inpatient',
    eyebrow: 'INPATIENT CARE',
    symbol: '住',
    title: '住院诊疗',
    desc: '以连续住院为中心，从入院接管、医嘱执行、病程查房到出院归档。',
    to: 'inpatient',
    metrics: [['在管患者', '12'], ['病危 / 病重', '2 / 4'], ['新入院', '2'], ['文书逾期', '2'], ['异常结果', '3'], ['拟出院', '3']],
    alerts: [['危急值', '1', 'red'], ['首程逾期', '1', 'red'], ['路径变异', '2', 'amber']],
    flow: ['入院接管', '入院 / 首程', '医嘱执行', '病程查房', '会诊手术', '出院归档'],
    modules: [
      { title: '在院患者与任务', desc: '床位、医疗组、风险、责任与时限', to: 'inpatient' },
      { title: '住院总览', desc: '诊断、医嘱、体征、结果、护理摘要', to: 'inpatient-overview' },
      { title: '病历文书与查房', desc: '入院、首程、病程、三级查房、审签', to: 'inpatient-course' },
      { title: '医嘱用药与执行', desc: '长期/临时医嘱、给药、停止与重整', to: 'ip-orders' },
      { title: '会诊手术与协同', desc: '会诊、手术、转科、交班、事件文书', to: 'ip-consult' },
      { title: '出院病案闭环', desc: '出院记录、首页、质控、整改、归档', to: 'inpatient-discharge' },
    ],
    footer: [['当前上下文', '心内科一病区 · A 医疗组'], ['最近访问', '李桂兰 / Grace Li · 02床 · 首程待完成']],
  },
];

const currentTriage = computed(() => (emergencyTriages.data.value ?? []).find((item) => item.status === 'ACTIVE' && !item.voided_at));
const activeResuscitationCount = computed(() => (emergencyResuscitations.data.value ?? []).filter((item) => item.status === 'IN_PROGRESS' && !item.voided_at).length);
const activeObservationCount = computed(() => (emergencyObservations.data.value ?? []).filter((item) => item.status === 'OBSERVING' && !item.voided_at).length);
const waitingCount = computed(() => (emergencyQueue.data.value ?? []).filter((item) => item.status === 'WAITING').length);
const openCoordination = computed(() => (emergencyCoordination.data.value ?? []).filter((item) => !['COMPLETED', 'VOIDED'].includes(item.status)));
const overdueCoordinationCount = computed(() => openCoordination.value.filter((item) => new Date(item.due_at).getTime() < Date.now()).length);
const recentIdentityMatched = computed(() => {
  const latest = emergencyIdentity.data.value?.[0];
  return Boolean(latest?.outcome === 'MATCHED' && Date.now() - new Date(latest.verified_at).getTime() <= 30 * 60_000);
});
const emergencyDataUnavailable = computed(() => [emergencyQueue, emergencyTriages, emergencyResuscitations, emergencyObservations, emergencyCoordination, emergencyIdentity].some((query) => Boolean(query.error.value)));
const triageLabel = (value?: string) => ({ LEVEL_1: 'Ⅰ(A)', LEVEL_2: 'Ⅱ(B)', LEVEL_3: 'Ⅲ(C)', LEVEL_4: 'Ⅳ(D)' } as Record<string, string>)[value ?? ''] ?? '待分诊';
const domains = computed<DomainCard[]>(() => baseDomains.map((domain) => domain.type !== 'emergency' ? domain : {
  ...domain,
  metrics: emergencyDataUnavailable.value
    ? [['当前分诊', '不可用'], ['需立即处置', '—'], ['院区候诊', '—'], ['当前留观', '—'], ['开放协同', '—'], ['待去向', '—']]
    : [['当前分诊', triageLabel(currentTriage.value?.triage_level)], ['需立即处置', currentTriage.value?.immediate_action_required ? '1' : '0'], ['院区候诊', String(waitingCount.value)], ['当前留观', String(activeObservationCount.value)], ['开放协同', String(openCoordination.value.length)], ['待去向', String(activeObservationCount.value)]],
  alerts: emergencyDataUnavailable.value
    ? [['急诊数据', '加载失败', 'red']]
    : [['身份核验', recentIdentityMatched.value ? '有效' : '待核', recentIdentityMatched.value ? 'green' : 'red'], ['抢救未闭环', String(activeResuscitationCount.value), activeResuscitationCount.value ? 'red' : 'green'], ['协同已逾期', String(overdueCoordinationCount.value), overdueCoordinationCount.value ? 'amber' : 'green']],
  footer: [['当前上下文', `急诊患者 …${clinicalContext.emergencyPatientId.slice(-8)} · 就诊 …${clinicalContext.emergencyEncounterId.slice(-8)}`], ['数据边界', '院区候诊队列 + 当前急诊患者事实']],
}));
const dataUpdatedAt = new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());

const portalBottom = [
  { to: 'clinical-tasks', title: '统一任务与临床路径', desc: '危急值 · 会诊 · 审签 · 时限 · 路径变异 · 出院整改' },
  { to: 'archive-assets', title: '病案资产与 CDA', desc: '电子文书 · 签字扫描件 · 共享文档 · CA · 无纸化归档' },
  { to: 'credentials', title: '专科与资质扩展', desc: '专科能力包 · 移动查房 PWA · 处方/手术/技术授权' },
];

function go(to: string): void {
  void router.push(`/${to}`);
}
</script>

<template>
  <section data-page-root class="content vue-native-page clinical-portal-page">
  <div class="page-head">
    <div class="page-title">
      <h1>临床业务门户</h1>
      <p>一级入口 · 门诊、急诊、住院三个独立临床工作域 · 本次加载 {{ dataUpdatedAt }}</p>
    </div>
    <div class="head-actions">
      <button class="btn" type="button" data-route-target="clinical-tasks" @click="go('clinical-tasks')">统一任务</button>
      <button class="btn" type="button" data-route-target="workflow" @click="go('workflow')">业务配置</button>
    </div>
  </div>

  <div class="portal-safety">
    <b>工作域安全边界</b>
    <span>三域共享患者主索引和时间线，但患者、就诊、草稿、任务筛选、搜索和 AI 会话分别隔离。</span>
    <span class="status blue">访问按岗位与患者上下文授权</span>
  </div>

  <section class="portal-ai-intro" aria-labelledby="portal-ai-title">
    <img src="/brand/ai-medical-assistant-eva.png" alt="" width="52" height="52" />
    <div class="portal-ai-copy">
      <span>AI CAPABILITIES</span>
      <h2 id="portal-ai-title">AI医助 Eva 随诊协同</h2>
      <p>结合当前患者、就诊、页面和任务上下文，提供有来源、可回看的诊疗辅助；所有结果均需医务人员确认后才能进入业务流程。</p>
    </div>
    <ul>
      <li><b>上下文问答与摘要</b><span>基于当前诊疗事实生成带来源的候选内容</span></li>
      <li><b>主动风险提醒</b><span>识别危急值、任务超时与流程缺口</span></li>
      <li><b>任务草拟与专科协作</b><span>辅助拆解任务、调用专科医助并全程留痕</span></li>
    </ul>
    <button class="btn primary" type="button" data-route-target="ai-assistant" @click="go('ai-assistant')">打开AI医助 Eva</button>
  </section>

  <div class="domain-split domain-triple">
    <section v-for="d in domains" :key="d.type" class="domain-card" :class="`${d.type}-domain`">
      <div class="domain-hero">
        <div class="domain-symbol">{{ d.symbol }}</div>
        <div>
          <div class="domain-eyebrow">{{ d.eyebrow }}</div>
          <h2>{{ d.title }}</h2>
          <p>{{ d.desc }}</p>
        </div>
        <button class="btn domain-enter" :class="{ primary: d.type === 'outpatient' }" type="button" :data-route-target="d.to" @click="go(d.to)">
          进入{{ d.title }} →
        </button>
      </div>
      <div class="domain-metrics">
        <div v-for="[label, value] in d.metrics" :key="label"><span>{{ label }}</span><b>{{ value }}</b></div>
      </div>
      <div class="domain-alerts">
        <span v-for="[label, count, status] in d.alerts" :key="label" class="status" :class="status">{{ label }} {{ count }}</span>
      </div>
      <div class="domain-flow">
        <b>诊疗主线</b>
        <template v-for="(step, i) in d.flow" :key="step">
          <i v-if="i">›</i><span>{{ step }}</span>
        </template>
      </div>
      <div class="module-map">
        <button v-for="m in d.modules" :key="m.title" type="button" :data-route-target="m.to" @click="go(m.to)"><b>{{ m.title }}</b><small>{{ m.desc }}</small></button>
      </div>
      <div class="domain-footer">
        <div v-for="[label, value] in d.footer" :key="label"><span>{{ label }}</span><b>{{ value }}</b></div>
      </div>
    </section>
  </div>

  <div class="portal-bottom">
    <div
      v-for="item in portalBottom"
      :key="item.to"
      role="button"
      tabindex="0"
      :data-route-target="item.to"
      @click="go(item.to)"
      @keydown.enter="go(item.to)"
    ><b>{{ item.title }}</b><span>{{ item.desc }}</span></div>
  </div>
  </section>
</template>

<style scoped>
.portal-ai-intro { display: grid; grid-template-columns: 52px minmax(240px,.95fr) minmax(420px,1.35fr) auto; gap: 14px; align-items: center; padding: 15px 16px; margin-bottom: 14px; border: 1px solid #c8dcf0; border-radius: 12px; background: linear-gradient(135deg,#f3f8ff,#fff); box-shadow: 0 5px 18px rgba(31,79,128,.06); }
.portal-ai-intro > img { width: 52px; height: 52px; border: 1px solid #d8e5f0; border-radius: 14px; background: #fff; object-fit: cover; }
.portal-ai-copy > span { color: #1769a7; font-size: 9px; font-weight: 850; letter-spacing: 1.1px; }
.portal-ai-copy h2 { margin: 3px 0 5px; font-size: 17px; }
.portal-ai-copy p { margin: 0; color: var(--muted); font-size: 10px; line-height: 1.55; }
.portal-ai-intro ul { display: grid; grid-template-columns: repeat(3,minmax(0,1fr)); gap: 8px; padding: 0; margin: 0; list-style: none; }
.portal-ai-intro li { display: grid; gap: 3px; min-height: 58px; padding: 9px 10px; border: 1px solid #dce8f3; border-radius: 8px; background: rgba(255,255,255,.82); }
.portal-ai-intro li b { color: #234c70; font-size: 10px; }
.portal-ai-intro li span { color: var(--muted); font-size: 9px; line-height: 1.45; }
.portal-ai-intro > button { white-space: nowrap; }
@media (max-width: 1280px) {
  .portal-ai-intro { grid-template-columns: 52px minmax(0,1fr) auto; }
  .portal-ai-intro ul { grid-column: 1 / -1; }
}
@media (max-width: 720px) {
  .portal-ai-intro { grid-template-columns: 44px minmax(0,1fr); padding: 13px; }
  .portal-ai-intro > img { width: 44px; height: 44px; border-radius: 12px; }
  .portal-ai-intro ul { grid-template-columns: 1fr; }
  .portal-ai-intro > button { grid-column: 1 / -1; width: 100%; }
}
</style>
