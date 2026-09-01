<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { clinicalContext } from '../../clinical-api';
import {
  issueEmergencyEncounterLease,
  issueEmergencyLease,
  listEmergencyCoordinationCases,
  listEmergencyIdentityVerifications,
  listEmergencyNursingNotes,
  listEmergencyObservations,
  listEmergencyResuscitations,
  listEmergencyTriageAssessments,
  listEmergencyVitalSigns,
  listEncounterDomainSwitches,
} from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import EmergencyPatientStrip from '../components/EmergencyPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const patientLease = useQuery({ queryKey: ['emergency', 'depth', 'patient-lease'], queryFn: () => issueEmergencyLease('EMERGENCY_JOURNEY_DEPTH'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const encounterLease = useQuery({ queryKey: ['emergency', 'depth', 'encounter-lease'], queryFn: () => issueEmergencyEncounterLease('EMERGENCY_JOURNEY_DEPTH'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const ready = computed(() => Boolean(patientLease.data.value));
const encounterReady = computed(() => Boolean(encounterLease.data.value));
const triageQuery = useQuery({ queryKey: ['emergency', 'depth', 'triage'], queryFn: () => listEmergencyTriageAssessments(patientLease.data.value!), enabled: ready, retry: false });
const resuscitationQuery = useQuery({ queryKey: ['emergency', 'depth', 'resuscitation'], queryFn: () => listEmergencyResuscitations(patientLease.data.value!), enabled: ready, retry: false });
const observationQuery = useQuery({ queryKey: ['emergency', 'depth', 'observation'], queryFn: () => listEmergencyObservations(patientLease.data.value!), enabled: ready, retry: false });
const nursingQuery = useQuery({ queryKey: ['emergency', 'depth', 'nursing'], queryFn: () => listEmergencyNursingNotes(patientLease.data.value!), enabled: ready, retry: false });
const identityQuery = useQuery({ queryKey: ['emergency', 'depth', 'identity'], queryFn: () => listEmergencyIdentityVerifications(patientLease.data.value!), enabled: ready, retry: false });
const coordinationQuery = useQuery({ queryKey: ['emergency', 'depth', 'coordination'], queryFn: () => listEmergencyCoordinationCases(patientLease.data.value!), enabled: ready, retry: false });
const switchesQuery = useQuery({ queryKey: ['emergency', 'depth', 'switches'], queryFn: () => listEncounterDomainSwitches(patientLease.data.value!), enabled: ready, retry: false });
const vitalsQuery = useQuery({ queryKey: ['emergency', 'depth', 'vitals'], queryFn: () => listEmergencyVitalSigns(encounterLease.data.value!), enabled: encounterReady, retry: false });

const queries = [patientLease, encounterLease, triageQuery, resuscitationQuery, observationQuery, nursingQuery, identityQuery, coordinationQuery, switchesQuery, vitalsQuery];
const loading = computed(() => queries.some((query) => query.isPending.value));
const issue = computed(() => {
  const error = queries.map((query) => query.error.value).find(Boolean);
  return error ? toClinicalIssue(error) : null;
});

const level = computed(() => ({
  'er-patient-overview': 3,
  'er-clinical-timeline': 4,
  'er-safety-gates': 5,
  'er-transfer-readiness': 6,
  'er-evidence-ledger': 7,
} as Record<string, number>)[String(route.name)] ?? 3);
const title = computed(() => ({
  3: '急诊患者全景', 4: '急诊临床时间线', 5: '急诊安全门禁', 6: '急诊去向与转运就绪度', 7: '急诊证据台账',
} as Record<number, string>)[level.value]);
const description = computed(() => ({
  3: '以患者和本次急诊就诊为唯一上下文，汇总所有有效业务事实。',
  4: '按实际事件时间排序，不用界面预设文案代替临床记录。',
  5: '身份、分诊、抢救结局、留观去向和协同状态均由后端事实判定。',
  6: '未完成的接收、风险交接和身份核验会明确阻断就绪结论。',
  7: '展示不可覆盖的业务资源标识、版本、时间与逻辑作废状态。',
} as Record<number, string>)[level.value]);

const activeTriage = computed(() => (triageQuery.data.value ?? []).find((item) => item.status === 'ACTIVE' && !item.voided_at));
const activeResuscitation = computed(() => (resuscitationQuery.data.value ?? []).find((item) => item.status === 'IN_PROGRESS' && !item.voided_at));
const activeObservation = computed(() => (observationQuery.data.value ?? []).find((item) => item.status === 'OBSERVING' && !item.voided_at));
const latestIdentity = computed(() => (identityQuery.data.value ?? []).find((item) => item.encounter_id === clinicalContext.emergencyEncounterId));
const identityValid = computed(() => Boolean(latestIdentity.value?.outcome === 'MATCHED' && Date.now() - new Date(latestIdentity.value.verified_at).getTime() <= 30 * 60_000));
const openCoordination = computed(() => (coordinationQuery.data.value ?? []).filter((item) => !['COMPLETED', 'VOIDED'].includes(item.status)));
const overdueCoordination = computed(() => openCoordination.value.filter((item) => new Date(item.due_at).getTime() < Date.now()));
const transferCases = computed(() => (coordinationQuery.data.value ?? []).filter((item) => item.case_type === 'TRANSFER' && item.status !== 'VOIDED'));
const latestVitals = computed(() => (vitalsQuery.data.value ?? [])[0]);

type TimelineItem = { id: string; at: string; type: string; summary: string; status: string; version: number };
const timeline = computed<TimelineItem[]>(() => [
  ...(triageQuery.data.value ?? []).map((item) => ({ id: item.triage_assessment_id, at: item.triaged_at, type: '预检分诊', summary: `${item.triage_level} · ${item.chief_complaint}`, status: item.voided_at ? '已作废' : item.status, version: item.row_version })),
  ...(resuscitationQuery.data.value ?? []).map((item) => ({ id: item.resuscitation_id, at: item.started_at, type: '抢救', summary: item.outcome, status: item.voided_at ? '已作废' : item.status, version: item.row_version })),
  ...(observationQuery.data.value ?? []).map((item) => ({ id: item.observation_id, at: item.observation_started_at, type: '留观', summary: item.disposition, status: item.voided_at ? '已作废' : item.status, version: item.row_version })),
  ...(nursingQuery.data.value ?? []).map((item) => ({ id: item.note_id, at: item.recorded_at, type: '急诊护理', summary: `${item.assessment} / ${item.intervention}`, status: item.voided_at ? '已作废' : (item.risk_flag ? '风险标记' : '有效'), version: item.row_version })),
  ...(identityQuery.data.value ?? []).map((item) => ({ id: item.verification_id, at: item.verified_at, type: '身份核验', summary: `${item.verification_purpose} · ${item.masked_identifier}`, status: item.outcome, version: item.row_version })),
  ...(vitalsQuery.data.value ?? []).map((item) => ({ id: item.vital_sign_record_id, at: item.recorded_at, type: '生命体征', summary: `P ${item.pulse ?? '—'} / BP ${item.systolic_bp ?? '—'}/${item.diastolic_bp ?? '—'} / SpO₂ ${item.spo2 ?? '—'}%`, status: item.source, version: item.row_version })),
  ...(coordinationQuery.data.value ?? []).map((item) => ({ id: item.coordination_case_id, at: item.acknowledged_at ?? item.completed_at ?? item.due_at, type: item.case_type, summary: `${item.target_unit} · ${item.summary}`, status: item.status, version: item.row_version })),
  ...(switchesQuery.data.value ?? []).map((item) => ({ id: item.domain_switch_id, at: item.switched_at, type: '诊疗域切换', summary: `${item.from_domain} → ${item.to_domain} · ${item.reason}`, status: '已留痕', version: item.row_version })),
].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()));

const gates = computed(() => [
  { label: '近30分钟身份核验', passed: identityValid.value, detail: latestIdentity.value ? `${latestIdentity.value.outcome} · ${formatDate(latestIdentity.value.verified_at)}` : '无核验记录' },
  { label: '有效分诊评估', passed: Boolean(activeTriage.value), detail: activeTriage.value ? `${activeTriage.value.triage_level} · ${activeTriage.value.chief_complaint}` : '未形成有效分诊' },
  { label: '抢救结局已闭环', passed: !activeResuscitation.value, detail: activeResuscitation.value ? '存在进行中抢救' : '无未闭环抢救' },
  { label: '留观去向已确认', passed: !activeObservation.value, detail: activeObservation.value ? '仍在留观且去向未闭环' : '无未闭环留观' },
  { label: '会诊/交接无逾期', passed: overdueCoordination.value.length === 0, detail: overdueCoordination.value.length ? `${overdueCoordination.value.length} 项已逾期` : '无逾期协同任务' },
]);
const transferReady = computed(() => gates.value.every((gate) => gate.passed) && transferCases.value.some((item) => item.status === 'ACKNOWLEDGED' || item.status === 'COMPLETED'));

const agentLinks = computed(() => [
  { label: '分诊上下文整理', agent: 'ENCOUNTER_SUMMARIZER', stage: 'TRIAGE', objective: '请根据当前急诊分诊、生命体征和护理记录整理高风险点，仅引用已记录事实。' },
  { label: '急诊病历候选稿', agent: 'DOCUMENT_DRAFTER', stage: 'EMERGENCY', objective: '请按事件时间线起草急诊记录候选稿，将未确认内容单独标记，不得自动签署。' },
  { label: '护理交班候选稿', agent: 'DOCUMENT_DRAFTER', stage: 'NURSING_HANDOFF', objective: '请整理当前急诊护理风险、生命体征变化和未完成任务，生成待人工审核的交班候选稿。' },
  { label: '转运交接准备', agent: 'CARE_COORDINATOR', stage: 'TRANSFER', objective: '请整理转运就绪度、已接收协同、未完成事项和风险，仅输出建议，不自动变更患者去向。' },
]);

function agentTo(item: typeof agentLinks.value[number]) { return { path: '/ai-assistant', query: { agent_code: item.agent, stage_code: item.stage, patient_id: clinicalContext.emergencyPatientId, encounter_id: clinicalContext.emergencyEncounterId, objective: item.objective } }; }
function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium', hour12: false }).format(new Date(value)) : '—'; }
async function reload() { await Promise.all(queries.map((query) => query.refetch())); }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-depth-page">
    <div class="page-head"><div class="page-title"><span class="depth-label">急诊 L{{ level }}</span><h1>{{ title }}</h1><p>{{ description }}</p></div><div class="head-actions"><RouterLink class="btn" to="/emergency">返回急诊工作台</RouterLink><button class="btn primary" :disabled="loading" @click="reload">刷新实时事实</button></div></div>
    <nav class="depth-nav" aria-label="急诊纵深页面"><RouterLink to="/er-patient-overview">L3 患者全景</RouterLink><RouterLink to="/er-clinical-timeline">L4 时间线</RouterLink><RouterLink to="/er-safety-gates">L5 安全门禁</RouterLink><RouterLink to="/er-transfer-readiness">L6 转运就绪</RouterLink><RouterLink to="/er-evidence-ledger">L7 证据台账</RouterLink></nav>
    <ClinicalPageState v-if="loading" kind="loading" message="正在按患者与急诊就诊上下文装载事实" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else>
      <EmergencyPatientStrip />
      <div v-if="level === 3" class="depth-grid summary-grid">
        <article class="card"><div class="card-head">当前流程</div><div class="card-body fact-list"><div><span>有效分诊</span><b>{{ activeTriage ? `${activeTriage.triage_level} · ${activeTriage.chief_complaint}` : '未记录' }}</b></div><div><span>抢救</span><b>{{ activeResuscitation ? '进行中' : '无进行中抢救' }}</b></div><div><span>留观</span><b>{{ activeObservation ? '观察中，去向待闭环' : '无进行中留观' }}</b></div><div><span>开放协同</span><b>{{ openCoordination.length }} 项</b></div></div></article>
        <article class="card"><div class="card-head">最近生命体征</div><div class="card-body vital-grid"><div><span>体温</span><b>{{ latestVitals?.temperature ?? '—' }} ℃</b></div><div><span>脉搏</span><b>{{ latestVitals?.pulse ?? '—' }} 次/分</b></div><div><span>血压</span><b>{{ latestVitals ? `${latestVitals.systolic_bp ?? '—'}/${latestVitals.diastolic_bp ?? '—'}` : '—' }} mmHg</b></div><div><span>SpO₂</span><b>{{ latestVitals?.spo2 ?? '—' }} %</b></div></div></article>
        <article class="card"><div class="card-head">业务事实计数</div><div class="card-body metric-pairs"><div><b>{{ triageQuery.data.value?.length ?? 0 }}</b><span>分诊版本</span></div><div><b>{{ nursingQuery.data.value?.length ?? 0 }}</b><span>护理记录</span></div><div><b>{{ identityQuery.data.value?.length ?? 0 }}</b><span>身份核验</span></div><div><b>{{ coordinationQuery.data.value?.length ?? 0 }}</b><span>协同单</span></div></div></article>
      </div>

      <section v-else-if="level === 4" class="card"><div class="card-head">跨模块临床时间线 <span class="sub">{{ timeline.length }} 条真实事实</span></div><div v-if="!timeline.length" class="clinical-empty-state rich"><strong>当前就诊暂无临床事实</strong><p>请从分诊、护理、病历、留观或交接页面录入。</p></div><div v-else class="timeline-list"><article v-for="item in timeline" :key="`${item.type}-${item.id}`"><time>{{ formatDate(item.at) }}</time><div><b>{{ item.type }}</b><p>{{ item.summary }}</p><small>状态 {{ item.status }} · v{{ item.version }} · …{{ item.id.slice(-8) }}</small></div></article></div></section>

      <section v-else-if="level === 5" class="card"><div class="card-head">安全门禁判定 <span class="sub">服务端事实实时计算</span></div><div class="gate-list"><article v-for="gate in gates" :key="gate.label" :class="{ passed: gate.passed, blocked: !gate.passed }"><span>{{ gate.passed ? '✓' : '!' }}</span><div><b>{{ gate.label }}</b><p>{{ gate.detail }}</p></div><em>{{ gate.passed ? '通过' : '阻断' }}</em></article></div><div class="depth-actions"><RouterLink class="btn" to="/er-triage">处理分诊</RouterLink><RouterLink class="btn" to="/er-nursing">处理身份与护理</RouterLink><RouterLink class="btn" to="/er-record">处理抢救结局</RouterLink><RouterLink class="btn" to="/er-observation">处理留观去向</RouterLink></div></section>

      <section v-else-if="level === 6" class="depth-grid transfer-grid"><article class="card readiness-card" :class="transferReady ? 'ready' : 'blocked'"><div class="card-head">转运就绪结论</div><div class="card-body"><strong>{{ transferReady ? '已满足系统可判定门禁' : '暂不具备转运闭环条件' }}</strong><p>{{ transferReady ? '仍须由具备权限的医护人员现场复核并执行。' : '请处理阻断门禁，并由目标单元接收转运协同单。' }}</p></div></article><article class="card"><div class="card-head">转运协同单</div><div class="card-body fact-list"><div v-for="item in transferCases" :key="item.coordination_case_id"><span>{{ item.target_unit }} · {{ formatDate(item.due_at) }}</span><b>{{ item.status }} · {{ item.risk_summary }}</b></div><div v-if="!transferCases.length"><span>尚未发起转运协同</span><b>请在会诊交接页面新建 TRANSFER 类型协同单</b></div></div><div class="card-footer"><RouterLink class="btn primary" to="/er-handoff">进入会诊交接与转运</RouterLink></div></article></section>

      <section v-else class="card"><div class="card-head">不可覆盖业务证据索引 <span class="sub">资源标识、版本与状态</span></div><div class="admin-table-wrap"><table class="table"><thead><tr><th>时间</th><th>证据类型</th><th>资源标识</th><th>版本</th><th>状态</th></tr></thead><tbody><tr v-for="item in timeline" :key="item.id"><td>{{ formatDate(item.at) }}</td><td>{{ item.type }}</td><td><code>{{ item.id }}</code></td><td>v{{ item.version }}</td><td>{{ item.status }}</td></tr></tbody></table></div><div v-if="!timeline.length" class="clinical-empty-state compact"><strong>暂无业务证据</strong><span>本页不生成假审计记录。</span></div><div class="notice info evidence-note"><div class="notice-title">审计边界</div>本页只展示当前角色可访问的临床资源索引；完整审计事件、哈希链与 outbox 由服务端保存，并在审计中心按授权查询。</div></section>

      <section class="card agent-panel"><div class="card-head">急诊 Agent 辅助 <span class="sub">真实运行、人工复核、禁止自动签署</span></div><div class="agent-links"><RouterLink v-for="item in agentLinks" :key="item.stage" class="agent-link" :to="agentTo(item)"><b>{{ item.label }}</b><span>带入当前患者和急诊就诊 →</span></RouterLink></div></section>
    </template>
  </section>
</template>

<style scoped>
.emergency-depth-page { display: grid; gap: 14px; }.depth-label { color: #236a91; font-size: 11px; font-weight: 800; letter-spacing: .08em; }.depth-nav { display: flex; gap: 8px; overflow-x: auto; padding: 4px 0; }.depth-nav a { flex: 0 0 auto; padding: 8px 12px; border: 1px solid #d3e0eb; border-radius: 9px; color: #42627c; background: #fff; font-size: 12px; text-decoration: none; }.depth-nav a.router-link-active { border-color: #3484b5; color: #075d8c; background: #eef8ff; font-weight: 700; }.depth-grid { display: grid; gap: 14px; grid-template-columns: repeat(3,minmax(0,1fr)); }.fact-list { display: grid; gap: 12px; }.fact-list div { display: grid; gap: 3px; padding-bottom: 10px; border-bottom: 1px solid #edf1f5; }.fact-list span,.vital-grid span,.metric-pairs span { color: #748596; font-size: 11px; }.fact-list b { overflow-wrap: anywhere; color: #304b62; font-size: 12px; }.vital-grid,.metric-pairs { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 12px; }.vital-grid div,.metric-pairs div { display: grid; gap: 5px; padding: 12px; border-radius: 9px; background: #f6f9fc; }.metric-pairs b { color: #0e6d9c; font-size: 22px; }.timeline-list { display: grid; padding: 6px 18px 18px; }.timeline-list article { display: grid; grid-template-columns: 170px minmax(0,1fr); gap: 18px; padding: 14px 0; border-bottom: 1px solid #e5edf4; }.timeline-list time { color: #748596; font-size: 11px; }.timeline-list p { margin: 5px 0; overflow-wrap: anywhere; color: #40586d; }.timeline-list small { color: #8794a0; }.gate-list { display: grid; gap: 10px; padding: 16px; }.gate-list article { display: grid; grid-template-columns: 28px minmax(0,1fr) auto; align-items: center; gap: 10px; padding: 12px; border: 1px solid; border-radius: 10px; }.gate-list article.passed { border-color: #bfe1d4; background: #f1fbf7; }.gate-list article.blocked { border-color: #efc5c8; background: #fff5f5; }.gate-list article > span { display: grid; place-items: center; width: 25px; height: 25px; border-radius: 50%; color: #fff; background: #bd3d48; font-weight: 800; }.gate-list article.passed > span { background: #24846b; }.gate-list p { margin: 3px 0 0; color: #65798b; font-size: 11px; }.gate-list em { font-style: normal; font-weight: 700; }.depth-actions { display: flex; flex-wrap: wrap; gap: 8px; padding: 0 16px 16px; }.transfer-grid { grid-template-columns: minmax(260px,.8fr) minmax(0,1.2fr); }.readiness-card .card-body { display: grid; gap: 10px; min-height: 160px; place-content: center; text-align: center; }.readiness-card strong { font-size: 20px; }.readiness-card.ready { border-color: #7dc5ad; background: #f4fcf8; }.readiness-card.blocked { border-color: #e7aeb2; background: #fff7f7; }.card-footer { padding: 12px 16px; border-top: 1px solid #e5edf4; }.evidence-note { margin: 14px; }.agent-panel { margin-top: 2px; }.agent-links { display: grid; grid-template-columns: repeat(4,minmax(0,1fr)); gap: 10px; padding: 14px; }.agent-link { display: grid; gap: 5px; min-width: 0; padding: 12px; border: 1px solid #cce0ef; border-radius: 10px; color: #285773; background: #f6fbff; text-decoration: none; }.agent-link span { color: #71879a; font-size: 10px; } code { overflow-wrap: anywhere; font-size: 10px; }
@media (max-width: 1000px) { .depth-grid,.agent-links { grid-template-columns: repeat(2,minmax(0,1fr)); } }
@media (max-width: 680px) { .depth-grid,.transfer-grid,.agent-links { grid-template-columns: 1fr; }.timeline-list article { grid-template-columns: 1fr; gap: 5px; }.page-head { align-items: flex-start; }.head-actions { width: 100%; flex-wrap: wrap; } }
</style>
