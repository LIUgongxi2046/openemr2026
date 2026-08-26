<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { EmergencyObservationWire } from '../../generated/contracts';
import { completeEmergencyObservation, issueEmergencyLease, listEmergencyObservations, startEmergencyObservation } from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['emergency', 'observation', 'lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_OBSERVATION'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['emergency', 'observation', 'items'],
  queryFn: () => listEmergencyObservations(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);

const dispositionLabels: Record<string, string> = {
  PENDING: '待定', DISCHARGED: '离院', ADMITTED: '收住院', TRANSFERRED: '转科/转院',
};

const form = reactive({ observation_started_at: new Date().toISOString().slice(0, 16) });
const busy = ref<string>('');
const notice = ref('');
const startedAtInput = ref<HTMLInputElement | null>(null);

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await itemsQuery.refetch();
}

function focusStartForm() { startedAtInput.value?.focus(); }

async function startObservation() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'start'; notice.value = '';
  try {
    await startEmergencyObservation(lease, { observation_started_at: new Date(form.observation_started_at).toISOString() });
    notice.value = '已开启抢救留观，去向待定（PENDING）。';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function complete(item: EmergencyObservationWire, disposition: 'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || item.status !== 'OBSERVING') return;
  busy.value = item.observation_id; notice.value = '';
  try {
    await completeEmergencyObservation(lease, item, disposition);
    notice.value = `留观去向已记录为「${dispositionLabels[disposition]}」，留观闭环完成。`;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 急诊</p>
        <h1>急诊抢救留观与去向</h1>
        <p>对需要持续观察或抢救的患者开启留观，结束时必须给出「离院 / 收住院 / 转科转院」去向，形成去留处置闭环。</p>
      </div>
      <RouterLink class="button secondary" to="/emergency">返回急诊工作台</RouterLink>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取抢救留观记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="留观统计">
        <article><span>留观记录</span><strong>{{ items.length }}</strong><small>全部</small></article>
        <article><span>观察中</span><strong>{{ items.filter((i) => i.status === 'OBSERVING').length }}</strong><small>OBSERVING</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>留观台账</h2><p>观察中的记录可记录去向完成闭环。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header>
          <div v-if="!items.length" class="admin-empty rich" role="status"><span class="admin-empty-icon" aria-hidden="true">⌁</span><strong>当前患者还没有留观记录</strong><p>符合持续观察或抢救条件时，可在右侧确认开始时间并开启留观。开启后必须记录离院、收住院或转科转院去向。</p><button class="button primary" type="button" @click="focusStartForm">填写留观开始时间</button></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>开始时间</th><th>完成时间</th><th>去向</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="item in items" :key="item.observation_id">
                  <td>{{ formatDate(item.observation_started_at) }}</td>
                  <td>{{ formatDate(item.completed_at) }}</td>
                  <td><span class="admin-status" :class="item.disposition.toLowerCase()">{{ dispositionLabels[item.disposition] ?? item.disposition }}</span></td>
                  <td><span class="admin-status" :class="item.status.toLowerCase()">{{ item.status === 'OBSERVING' ? '观察中' : '已完成' }}</span></td>
                  <td>
                    <span v-if="item.status !== 'OBSERVING'">—</span>
                    <span v-else class="inline-actions">
                      <button class="task-action" :disabled="Boolean(busy)" @click="complete(item, 'DISCHARGED')">离院</button>
                      <button class="task-action" :disabled="Boolean(busy)" @click="complete(item, 'ADMITTED')">收住院</button>
                      <button class="task-action" :disabled="Boolean(busy)" @click="complete(item, 'TRANSFERRED')">转科转院</button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>开启抢救留观</h2><p>留观开始时间默认当前，去向初始为待定。</p></div></header>
          <form class="admin-form" @submit.prevent="startObservation">
            <label><span>留观开始时间</span><input ref="startedAtInput" v-model="form.observation_started_at" type="datetime-local" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'start' ? '正在开启…' : '开启留观' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
