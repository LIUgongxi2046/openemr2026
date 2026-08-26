<script setup lang="ts">
// 临床业务门户 —— 三域卡片门户。DOM 结构与类名严格对齐高保真原型
// prototype/app/app.js `clinical()`（见 DEVELOPMENT_PRINCIPLES.md §六：复用原型类名，勿另写一套）。
import { useRouter } from 'vue-router';

const router = useRouter();

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

const domains: DomainCard[] = [
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
    metrics: [['急诊在区', '18'], ['一级抢救', '2'], ['待分诊', '4'], ['留观', '9'], ['急会诊', '3'], ['待去向', '4']],
    alerts: [['绿色通道', '2', 'red'], ['抢救记录待补', '1', 'amber'], ['交接临期', '2', 'amber']],
    flow: ['院前 / 到院', '预检分诊', '抢救 / 诊室', '急诊医嘱', '会诊交接', '去向闭环'],
    modules: [
      { title: '预检分诊与分区', desc: '级别、依据、改区、绿色通道', to: 'er-triage' },
      { title: '急诊病历与抢救', desc: '时间轴、抢救记录、医嘱结果', to: 'er-record' },
      { title: '急诊护理与输液', desc: '生命体征、执行、异常', to: 'er-nursing' },
      { title: '急会诊与交接班', desc: '时限、责任、未完任务', to: 'er-handoff' },
      { title: '留观与转住院', desc: '观察记录、去向、接收', to: 'er-observation' },
      { title: '时间关键质控', desc: '双时间、超时、补录原因', to: 'er-record' },
    ],
    footer: [['当前上下文', '急诊抢救区 · 白班 · 林医生'], ['最高风险', '胸痛中心绿色通道 · 7 分钟前到院']],
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
      <p>一级入口 · 门诊、急诊、住院三个独立临床工作域 · 数据更新 09:45</p>
    </div>
    <div class="head-actions">
      <button class="btn" type="button" data-route-target="clinical-tasks" @click="go('clinical-tasks')">统一任务 9</button>
      <button class="btn" type="button" data-route-target="workflow" @click="go('workflow')">业务配置</button>
    </div>
  </div>

  <div class="portal-safety">
    <b>工作域安全边界</b>
    <span>三域共享患者主索引和时间线，但患者、就诊、草稿、任务筛选、搜索和 AI 会话分别隔离。</span>
    <span class="status green">核心服务正常</span>
  </div>

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
