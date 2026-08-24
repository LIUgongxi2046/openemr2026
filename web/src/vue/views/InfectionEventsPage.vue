<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { InfectionMonitoringEventWire } from '../../generated/contracts';
import { issueInfectionLease, listInfectionMonitoringEvents, reportInfectionMonitoringEvent, resolveInfectionMonitoringEvent } from '../../api/quality';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['quality', 'infection', 'lease'],
  queryFn: () => issueInfectionLease('INFECTION_MONITORING'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const eventsQuery = useQuery({
  queryKey: ['quality', 'infection', 'events'],
  queryFn: () => listInfectionMonitoringEvents(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? eventsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? eventsQuery.error.value) : null);
const events = computed(() => eventsQuery.data.value ?? []);

const form = reactive({ infectionType: 'SURGICAL_SITE', organismCode: '', reportedAt: new Date().toISOString() });
const busy = ref('');
const notice = ref('');

function statusLabel(status: string) {
  const map: Record<string, string> = { REPORTED: '已上报', CONFIRMED: '已确认', REFUTED: '已排除' };
  return map[status] ?? status;
}

async function report() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'report'; notice.value = '';
  try {
    await reportInfectionMonitoringEvent(lease, {
      infection_type: form.infectionType, organism_code: form.organismCode.trim() || null, reported_at: form.reportedAt,
    });
    form.organismCode = ''; notice.value = '院感线索已上报，规则只生线索不自动确诊。'; await eventsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function resolve(event: InfectionMonitoringEventWire, resolution: 'CONFIRM' | 'REFUTE') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = event.infection_event_id; notice.value = '';
  try {
    await resolveInfectionMonitoringEvent(lease, event, resolution, resolution === 'CONFIRM' ? '确认为院内感染' : '排除感染');
    notice.value = '线索已复核。'; await eventsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">质量与安全 / 院感</p><h1>院感监测线索</h1><p>上报、确认与排除均留不可变证据；确认/排除必填结论。</p></div>
    </div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || eventsQuery.isPending.value" kind="loading" message="正在读取院感线索" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="eventsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>线索台账</h2><p>确认/排除必须附结论。</p></div><button class="button secondary" @click="eventsQuery.refetch()">刷新</button></header>
          <div v-if="events.length === 0" class="admin-empty">暂无院感线索。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>类型</th><th>病原体</th><th>上报时间</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="event in events" :key="event.infection_event_id">
              <td><strong>{{ event.infection_type }}</strong><small>…{{ event.infection_event_id.slice(-8) }}</small></td>
              <td><code>{{ event.organism_code ?? '—' }}</code></td>
              <td>{{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(event.reported_at)) }}</td>
              <td><span class="admin-status" :class="event.status.toLowerCase()">{{ statusLabel(event.status) }}</span></td>
              <td>
                <button v-if="event.status === 'REPORTED'" class="task-action" :disabled="Boolean(busy)" @click="resolve(event, 'CONFIRM')">确认</button>
                <button v-if="event.status === 'REPORTED'" class="task-action danger" :disabled="Boolean(busy)" @click="resolve(event, 'REFUTE')">排除</button>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody></table></div>
        </section>
        <section class="admin-panel admin-form-panel">
          <header><div><h2>上报线索</h2><p>线索仅登记，不自动确诊。</p></div></header>
          <form class="admin-form" @submit.prevent="report">
            <label><span>感染类型</span><select v-model="form.infectionType"><option value="SURGICAL_SITE">手术部位</option><option value="BLOODSTREAM">血流感染</option><option value="URINARY_TRACT">泌尿道</option><option value="PNEUMONIA">肺炎</option><option value="OTHER">其他</option></select></label>
            <label><span>病原体（可选）</span><input v-model="form.organismCode" maxlength="96" placeholder="例：MRSA" /></label>
            <label><span>上报时间</span><input v-model="form.reportedAt" type="datetime-local" required /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'report' ? '上报中…' : '上报线索' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
