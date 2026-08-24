<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext, issueContextLease, loadEncounterDocuments } from '../../clinical-api';
import type { EmergencyResuscitationWire } from '../../generated/contracts';
import { completeEmergencyResuscitation, issueEmergencyLease, listEmergencyResuscitations, startEmergencyResuscitation } from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['emergency', 'record', 'lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_RECORD'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLeaseQuery = useQuery({
  queryKey: ['emergency', 'record', 'encounter-lease'],
  queryFn: () => issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, 'EMERGENCY_RECORD_DOCUMENTS'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const resuscitationsQuery = useQuery({
  queryKey: ['emergency', 'record', 'resuscitations'],
  queryFn: () => listEmergencyResuscitations(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const documentsQuery = useQuery({
  queryKey: ['emergency', 'record', 'documents'],
  queryFn: () => loadEncounterDocuments(encounterLeaseQuery.data.value!),
  enabled: () => Boolean(encounterLeaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value) : null);
const resuscitations = computed(() => resuscitationsQuery.data.value ?? []);
const documents = computed(() => documentsQuery.data.value ?? []);

const outcomeLabels: Record<string, string> = {
  PENDING: '抢救中', ROSC: '自主循环恢复', DEATH: '死亡', TRANSFERRED: '转科/转院',
};

const form = reactive({ started_at: new Date().toISOString().slice(0, 16) });
const busy = ref<string>('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await Promise.all([resuscitationsQuery.refetch(), documentsQuery.refetch()]);
}

async function startResuscitation() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'start'; notice.value = '';
  try {
    await startEmergencyResuscitation(lease, { started_at: new Date(form.started_at).toISOString() });
    notice.value = '抢救已开始，结局初始为抢救中（PENDING）。';
    await resuscitationsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function completeResuscitation(item: EmergencyResuscitationWire, outcome: 'ROSC' | 'DEATH' | 'TRANSFERRED') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || item.status !== 'IN_PROGRESS') return;
  busy.value = item.resuscitation_id; notice.value = '';
  try {
    await completeEmergencyResuscitation(lease, item, outcome);
    notice.value = `抢救结局已记录为「${outcomeLabels[outcome]}」。`;
    await resuscitationsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 急诊</p>
        <h1>急诊病历与抢救记录</h1>
        <p>抢救记录以开始时间与结局闭环（自主循环恢复 / 死亡 / 转科转院）；急诊病历复用文书内核，就诊内所有文档在此聚合。</p>
      </div>
      <RouterLink class="button secondary" to="/emergency">返回急诊工作台</RouterLink>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || encounterLeaseQuery.isPending.value || resuscitationsQuery.isPending.value || documentsQuery.isPending.value" kind="loading" message="正在读取抢救记录与急诊病历" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="急诊病历统计">
        <article><span>抢救记录</span><strong>{{ resuscitations.length }}</strong><small>患者 …{{ clinicalContext.patientId.slice(-8) }}</small></article>
        <article><span>急诊病历文档</span><strong>{{ documents.length }}</strong><small>就诊内</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>抢救记录</h2><p>进行中的抢救需记录结局后闭环。</p></div><button class="button secondary" @click="resuscitationsQuery.refetch()">刷新</button></header>
          <div v-if="!resuscitations.length" class="admin-empty" role="status">暂无抢救记录，可在右侧开启抢救。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>开始时间</th><th>结束时间</th><th>结局</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="item in resuscitations" :key="item.resuscitation_id">
                  <td>{{ formatDate(item.started_at) }}</td>
                  <td>{{ formatDate(item.ended_at) }}</td>
                  <td><span class="admin-status" :class="item.outcome.toLowerCase()">{{ outcomeLabels[item.outcome] ?? item.outcome }}</span></td>
                  <td><span class="admin-status" :class="item.status.toLowerCase()">{{ item.status === 'IN_PROGRESS' ? '抢救中' : '已完成' }}</span></td>
                  <td>
                    <span v-if="item.status !== 'IN_PROGRESS'">—</span>
                    <span v-else class="inline-actions">
                      <button class="task-action" :disabled="Boolean(busy)" @click="completeResuscitation(item, 'ROSC')">ROSC</button>
                      <button class="task-action" :disabled="Boolean(busy)" @click="completeResuscitation(item, 'DEATH')">死亡</button>
                      <button class="task-action" :disabled="Boolean(busy)" @click="completeResuscitation(item, 'TRANSFERRED')">转科转院</button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>开启抢救记录</h2><p>抢救开始时间默认当前。</p></div></header>
          <form class="admin-form" @submit.prevent="startResuscitation">
            <label><span>抢救开始时间</span><input v-model="form.started_at" type="datetime-local" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'start' ? '正在开启…' : '开启抢救记录' }}</button>
          </form>
          <header class="panel-subhead"><div><h2>急诊病历文档</h2><p>就诊 …{{ clinicalContext.encounterId.slice(-8) }}</p></div></header>
          <div v-if="!documents.length" class="admin-empty" role="status">该就诊暂无文书文档。</div>
          <ul v-else class="doc-list">
            <li v-for="doc in documents" :key="doc.document_version_id">
              <span>{{ doc.document_type_code || '未命名文档' }}</span>
              <small>v{{ doc.version_no }} · {{ formatDate(doc.created_at) }}</small>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </main>
</template>
