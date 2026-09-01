<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { clinicalContext } from '../../clinical-api';
import {
  issueEmergencyFacilityLease,
  issueEmergencyLease,
  listEmergencyIdentityVerifications,
  listEmergencyTriageAssessments,
  listWaitingQueue,
} from '../../api/emergency';

const facilityLease = useQuery({
  queryKey: ['emergency', 'patient-strip', 'facility-lease'],
  queryFn: () => issueEmergencyFacilityLease('EMERGENCY_PATIENT_STRIP'),
  retry: false,
  staleTime: 5 * 60_000,
  gcTime: 0,
});
const patientLease = useQuery({
  queryKey: ['emergency', 'patient-strip', 'patient-lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_PATIENT_STRIP'),
  retry: false,
  staleTime: 5 * 60_000,
  gcTime: 0,
});
const queueQuery = useQuery({
  queryKey: ['emergency', 'patient-strip', 'queue'],
  queryFn: () => listWaitingQueue(facilityLease.data.value!),
  enabled: () => Boolean(facilityLease.data.value),
  retry: false,
});
const triageQuery = useQuery({
  queryKey: ['emergency', 'patient-strip', 'triage'],
  queryFn: () => listEmergencyTriageAssessments(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value),
  retry: false,
});
const identityQuery = useQuery({
  queryKey: ['emergency', 'patient-strip', 'identity'],
  queryFn: () => listEmergencyIdentityVerifications(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value),
  retry: false,
});

const currentQueue = computed(() => (queueQuery.data.value ?? []).find((entry) => entry.patient_id === clinicalContext.emergencyPatientId) ?? null);
const currentTriage = computed(() => (triageQuery.data.value ?? []).find((item) => item.status === 'ACTIVE' && !item.voided_at) ?? null);
const levelLabel = computed(() => ({ LEVEL_1: 'Ⅰ级 · 立即抢救', LEVEL_2: 'Ⅱ级 · 危重', LEVEL_3: 'Ⅲ级 · 急症', LEVEL_4: 'Ⅳ级 · 非急症' } as Record<string, string>)[currentTriage.value?.triage_level ?? ''] ?? '待分诊');
const patientName = computed(() => currentQueue.value?.patient_display_name ?? '当前急诊患者');
const queueNo = computed(() => currentQueue.value ? `#${currentQueue.value.sequence_no}` : `…${clinicalContext.emergencyEncounterId.slice(-8)}`);
const complaint = computed(() => currentTriage.value?.chief_complaint ?? '待补充急诊主诉');
const latestVerification = computed(() => (identityQuery.data.value ?? []).find((item) => item.encounter_id === clinicalContext.emergencyEncounterId) ?? null);
const wristbandLabel = computed(() => {
  const item = latestVerification.value;
  if (!item) return '腕带待核验';
  if (item.outcome !== 'MATCHED') return '腕带核验失败';
  return Date.now() - new Date(item.verified_at).getTime() <= 30 * 60_000 ? '腕带核验有效' : '腕带核验已超时';
});
</script>

<template>
  <section class="patient-strip emergency-context emergency-patient-strip" aria-label="当前急诊患者上下文">
    <div><div class="patient-name">{{ patientName }}</div><div class="meta">患者号 …{{ clinicalContext.emergencyPatientId.slice(-8) }}</div></div>
    <div class="divider"></div>
    <div><b>急诊号 {{ queueNo }}</b><div class="meta">急诊医学科 · 当前就诊 …{{ clinicalContext.emergencyEncounterId.slice(-8) }}</div></div>
    <div class="divider"></div>
    <div class="emergency-chief-complaint"><b>{{ complaint }}</b><div class="meta">{{ wristbandLabel }} · 临床事实实时同步</div></div>
    <span class="risk red">{{ levelLabel }}</span>
    <span v-if="currentTriage?.immediate_action_required" class="risk red">需立即处置</span>
    <RouterLink class="btn sm emergency-switch-patient" to="/er-triage">切换急诊患者</RouterLink>
  </section>
</template>
