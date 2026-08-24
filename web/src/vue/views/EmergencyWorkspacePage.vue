<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { clinicalContext } from '../../clinical-api';
import {
  issueEmergencyFacilityLease,
  issueEmergencyLease,
  listEmergencyNursingNotes,
  listEmergencyObservations,
  listEmergencyPreadmissions,
  listEmergencyResuscitations,
  listEmergencyTriageAssessments,
  listEncounterDomainSwitches,
  listWaitingQueue,
} from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const facilityLease = useQuery({
  queryKey: ['emergency', 'facility-lease'],
  queryFn: () => issueEmergencyFacilityLease('EMERGENCY_BOARD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const patientLease = useQuery({
  queryKey: ['emergency', 'patient-lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});

const preadmissions = useQuery({
  queryKey: ['emergency', 'preadmissions'],
  queryFn: () => listEmergencyPreadmissions(facilityLease.data.value!),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});
const waitingQueue = useQuery({
  queryKey: ['emergency', 'waiting-queue'],
  queryFn: () => listWaitingQueue(facilityLease.data.value!),
  enabled: () => Boolean(facilityLease.data.value), retry: false,
});
const triages = useQuery({
  queryKey: ['emergency', 'triages'],
  queryFn: () => listEmergencyTriageAssessments(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const observations = useQuery({
  queryKey: ['emergency', 'observations'],
  queryFn: () => listEmergencyObservations(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const resuscitations = useQuery({
  queryKey: ['emergency', 'resuscitations'],
  queryFn: () => listEmergencyResuscitations(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const nursingNotes = useQuery({
  queryKey: ['emergency', 'nursing-notes'],
  queryFn: () => listEmergencyNursingNotes(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const domainSwitches = useQuery({
  queryKey: ['emergency', 'domain-switches'],
  queryFn: () => listEncounterDomainSwitches(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});

const queries = [facilityLease, patientLease, preadmissions, waitingQueue, triages, observations, resuscitations, nursingNotes, domainSwitches];
const pending = computed(() => queries.some((q) => q.isPending.value));
const issue = computed(() => {
  const failed = queries.find((q) => q.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});

const unregistered = computed(() => (preadmissions.data.value ?? []).filter((p) => p.status === 'UNREGISTERED'));
const queue = computed(() => waitingQueue.data.value ?? []);
const triageList = computed(() => triages.data.value ?? []);
const observationList = computed(() => observations.data.value ?? []);
const resuscitationList = computed(() => resuscitations.data.value ?? []);
const noteList = computed(() => nursingNotes.data.value ?? []);
const switchList = computed(() => domainSwitches.data.value ?? []);
const highRiskNotes = computed(() => noteList.value.filter((n) => n.risk_flag).length);

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}
function shortId(value: string) { return `…${value.slice(-8)}`; }

function triageLabel(level: string | null | undefined) {
  return ({ LEVEL_1: 'Ⅰ级', LEVEL_2: 'Ⅱ级', LEVEL_3: 'Ⅲ级', LEVEL_4: 'Ⅳ级' } as Record<string, string>)[level ?? ''] ?? (level ?? '—');
}
function dispositionLabel(value: string | null | undefined) {
  return ({ DISCHARGED: '离院', ADMITTED: '入院', TRANSFERRED: '转科' } as Record<string, string>)[value ?? ''] ?? (value ?? '—');
}
function outcomeLabel(value: string | null | undefined) {
  return ({ ROSC: '恢复自主循环', DEATH: '死亡', TRANSFERRED: '转科' } as Record<string, string>)[value ?? ''] ?? (value ?? '—');
}

async function reload() {
  await Promise.all([preadmissions.refetch(), waitingQueue.refetch(), triages.refetch(), observations.refetch(), resuscitations.refetch(), nursingNotes.refetch(), domainSwitches.refetch()]);
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-head">
      <div class="page-title">
        <h1>急诊工作台</h1>
        <p>抢救区 · 白班 · 急诊域实时状态 · 各环节向下钻取到独立工作页</p>
      </div>
      <div class="head-actions">
        <RouterLink class="btn" to="/er-handoff">急诊交接</RouterLink>
        <RouterLink class="btn" to="/er-observation">留观清单</RouterLink>
        <RouterLink class="btn danger" to="/er-record">启动抢救记录</RouterLink>
      </div>
    </div>

    <ClinicalPageState v-if="pending" kind="loading" message="正在汇总急诊域实时状态" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <div class="metric-grid">
        <div class="metric"><div class="name">候诊队列</div><div class="value">{{ queue.length }}</div><div class="trend">当前院区</div></div>
        <div class="metric"><div class="name">未登记预入院</div><div class="value">{{ unregistered.length }}</div><div class="trend">先救治后补登</div></div>
        <div class="metric"><div class="name">抢救 / 留观</div><div class="value">{{ resuscitationList.length }} / {{ observationList.length }}</div><div class="trend">去向闭环</div></div>
        <div class="metric"><div class="name">分诊记录</div><div class="value">{{ triageList.length }}</div><div class="trend">四级分诊</div></div>
      </div>

      <div class="grid emergency-grid">
        <aside class="card scroll-card">
          <div class="card-head">急诊队列 <span class="sub">{{ queue.length }} 人</span></div>
          <div v-if="!queue.length" class="card-body">今日暂无候诊患者。</div>
          <div v-else>
            <div v-for="entry in queue" :key="entry.waiting_queue_entry_id" class="queue-item">
              <div class="queue-title"><span class="dot green"></span>#{{ entry.sequence_no }}<span class="status green">{{ entry.status }}</span></div>
              <div class="queue-meta"><span>叫号 {{ formatDate(entry.called_at) }}</span></div>
            </div>
          </div>
          <div class="card-head">预入院 <span class="sub">先救治后补登</span></div>
          <div v-if="!preadmissions.data.value?.length" class="card-body">当前院区暂无预入院登记。</div>
          <div v-for="p in preadmissions.data.value ?? []" :key="p.preadmission_id" class="queue-item">
            <div class="queue-title"><span class="dot amber"></span>{{ p.temporary_identifier }}<span class="status" :class="p.status === 'UNREGISTERED' ? 'amber' : 'green'">{{ p.status === 'UNREGISTERED' ? '未登记' : '已登记' }}</span></div>
            <div class="queue-meta"><span>{{ p.reason }}</span></div>
          </div>
        </aside>

        <section class="card scroll-card">
          <div class="card-head">时间关键诊疗轴 <span class="status red">当前患者</span></div>
          <div class="card-body">
            <div class="event-row">
              <div class="event-time">预检分诊</div><span class="dot"></span>
              <div><b>四级分诊</b><p>{{ triageList.length }} 条 · 最新 {{ triageLabel(triageList[0]?.triage_level) }}</p></div>
              <RouterLink class="btn sm" to="/er-triage">进入</RouterLink>
            </div>
            <div class="event-row">
              <div class="event-time">抢救留观</div><span class="dot amber"></span>
              <div><b>去向闭环</b><p>{{ observationList.length }} 条 · 去向 {{ dispositionLabel(observationList[0]?.disposition) }}</p></div>
              <RouterLink class="btn sm" to="/er-observation">进入</RouterLink>
            </div>
            <div class="event-row">
              <div class="event-time">抢救记录</div><span class="dot red"></span>
              <div><b>复苏与结局</b><p>{{ resuscitationList.length }} 条 · 结局 {{ outcomeLabel(resuscitationList[0]?.outcome) }}</p></div>
              <RouterLink class="btn sm" to="/er-record">进入</RouterLink>
            </div>
            <div class="event-row">
              <div class="event-time">急诊护理</div><span class="dot"></span>
              <div><b>危重评估</b><p>{{ noteList.length }} 条 · 高危 {{ highRiskNotes }}</p></div>
              <RouterLink class="btn sm" to="/er-nursing">进入</RouterLink>
            </div>
            <div class="event-row">
              <div class="event-time">域切换</div><span class="dot"></span>
              <div><b>门急诊显式切换</b><p>{{ switchList.length }} 条 · 源/目标域硬门</p></div>
            </div>
          </div>
        </section>

        <aside class="card scroll-card">
          <div class="card-head">抢救、护理与去向</div>
          <div class="card-body">
            <div class="notice info"><div class="notice-title">当前患者上下文</div>患者 {{ shortId(clinicalContext.patientId) }} · 就诊 {{ shortId(clinicalContext.encounterId) }}</div>
            <div class="notice hard"><div class="notice-title">去向闭环</div>抢救、留观与域切换必须形成去向与接收，未闭环不结束急诊就诊。</div>
            <div class="section-title">急诊域导航</div>
            <div class="folder-row">预检分诊<RouterLink class="text-link" to="/er-triage">进入 →</RouterLink></div>
            <div class="folder-row">抢救留观<RouterLink class="text-link" to="/er-observation">进入 →</RouterLink></div>
            <div class="folder-row">急诊病历与抢救记录<RouterLink class="text-link" to="/er-record">进入 →</RouterLink></div>
            <div class="folder-row">急诊护理<RouterLink class="text-link" to="/er-nursing">进入 →</RouterLink></div>
            <div class="folder-row">会诊、交接与转运<RouterLink class="text-link" to="/er-handoff">进入 →</RouterLink></div>
          </div>
        </aside>
      </div>
    </template>
  </main>
</template>
