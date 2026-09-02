<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { InfectionMonitoringEventWire } from '../../generated/contracts';
import { issueInfectionEncounterLease, issueInfectionLease, listInfectionMonitoringEvents, reportInfectionMonitoringEvent, resolveInfectionMonitoringEvent } from '../../api/quality';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import { toClinicalIssue } from '../clinical-error';

const props = withDefaults(defineProps<{ eventId?: string }>(), { eventId: '' });
const route = useRoute(); const router = useRouter();

const leaseQuery = useQuery({
  queryKey: ['quality', 'infection', 'lease'],
  queryFn: () => issueInfectionLease('INFECTION_MONITORING'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const writeLeaseQuery = useQuery({
  queryKey: ['quality', 'infection', 'write-lease'],
  queryFn: () => issueInfectionEncounterLease('INFECTION_MONITORING'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const eventsQuery = useQuery({
  queryKey: ['quality', 'infection', 'events'],
  queryFn: () => listInfectionMonitoringEvents(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? writeLeaseQuery.error.value ?? eventsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? writeLeaseQuery.error.value ?? eventsQuery.error.value) : null);
const events = computed(() => eventsQuery.data.value ?? []);
const visibleEvents = computed(() => props.eventId ? events.value.filter((event) => event.infection_event_id === props.eventId) : events.value);

const now = new Date();
const currentLocal = new Date(now.getTime() - now.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
const form = reactive({
  infectionType: 'SURGICAL_SITE', organismCode: '', eventCategory: 'HAI_CASE' as 'HAI_CASE' | 'HAI_OUTBREAK' | 'NOTIFIABLE_DISEASE',
  onsetAt: '', detectedAt: currentLocal, reportingWindowHours: 24 as 2 | 24,
  externalReportRequired: false, reportingPolicyCode: 'HOSPITAL_INFECTION_MONITORING_POLICY', reportedAt: currentLocal,
});
const busy = ref('');
const notice = ref('');
const reportOpen = ref(false);
const resolutionOpen = ref(false);
const selectedEvent = ref<InfectionMonitoringEventWire | null>(null);
const resolution = ref<'CONFIRM' | 'REFUTE'>('CONFIRM');
const conclusion = ref('');

function statusLabel(status: string) {
  const map: Record<string, string> = { REPORTED: '已上报', CONFIRMED: '已确认', REFUTED: '已排除' };
  return map[status] ?? status;
}

async function report() {
  const lease = writeLeaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = 'report'; notice.value = '';
  try {
    await reportInfectionMonitoringEvent(lease, {
      infection_type: form.infectionType, organism_code: form.organismCode.trim() || null,
      event_category: form.eventCategory, onset_at: form.onsetAt || null, detected_at: form.detectedAt,
      reporting_window_hours: form.reportingWindowHours,
      external_report_required: form.eventCategory === 'HAI_CASE' ? form.externalReportRequired : true,
      reporting_policy_code: form.reportingPolicyCode, reported_at: form.reportedAt,
    });
    form.organismCode = ''; reportOpen.value = false; notice.value = '院感线索已上报，规则只生线索不自动确诊。'; await eventsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function openResolution(event: InfectionMonitoringEventWire, nextResolution: 'CONFIRM' | 'REFUTE') {
  selectedEvent.value = event; resolution.value = nextResolution; conclusion.value = '';
  resolutionOpen.value = true;
}

async function resolve() {
  const event = selectedEvent.value;
  const lease = writeLeaseQuery.data.value;
  if (!lease || !event || busy.value || conclusion.value.trim().length < 4) return;
  busy.value = event.infection_event_id; notice.value = '';
  try {
    await resolveInfectionMonitoringEvent(lease, event, resolution.value, conclusion.value.trim());
    resolutionOpen.value = false; selectedEvent.value = null; notice.value = '线索已复核，结论已进入不可变证据链。'; await eventsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
watch(() => route.query.create, (value) => {
  if (value !== '1') return;
  reportOpen.value = true;
  void router.replace({ query: { ...route.query, create: undefined } });
}, { immediate: true });
watch([() => route.query.review, events], ([value, current]) => {
  if (value !== '1' || !current.length) return;
  const candidate = current.find((item) => item.status === 'REPORTED');
  if (candidate) openResolution(candidate, 'CONFIRM');
  else notice.value = '当前没有待人工复核的院感线索。';
  void router.replace({ query: { ...route.query, review: undefined } });
}, { immediate: true });
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav v-if="$route.path.includes('/clues')" class="quality-breadcrumb" aria-label="院感事件层级导航"><RouterLink to="/quality-center">医疗质量中心</RouterLink><span>/</span><RouterLink to="/infection-events">院感事件</RouterLink><span>/</span><RouterLink to="/infection-events/clues">院感线索台账</RouterLink><template v-if="eventId"><span>/</span><b>线索详情</b></template></nav>
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">质量与安全 / {{ eventId ? '四级线索详情' : '院感' }}</p><h1>院感、传染病与不良事件</h1><p>智能线索、人工排除、上报时限、重试和整改闭环；确认/排除必填结论。</p></div><div class="toolbar-actions"><RouterLink v-if="!$route.path.includes('/clues')" class="button secondary" to="/infection-events/clues">打开三级台账</RouterLink><RouterLink v-if="eventId" class="button secondary" to="/infection-events/clues">返回台账</RouterLink><button class="button secondary" @click="eventsQuery.refetch()">刷新</button><button class="button primary" @click="reportOpen = true">新建院感线索</button></div>
    </div>
    <nav v-if="eventId" class="quality-depth-links"><RouterLink :to="`/infection-events/clues/${eventId}/actions`">L5 防控动作</RouterLink><RouterLink :to="`/infection-events/clues/${eventId}/evidence`">L6 上报与回执证据</RouterLink><RouterLink :to="`/infection-events/clues/${eventId}/reviews`">L7 复核 / Agent</RouterLink></nav>
    <ClinicalPageState v-if="leaseQuery.isPending.value || writeLeaseQuery.isPending.value || eventsQuery.isPending.value" kind="loading" message="正在读取院感线索" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="eventsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div>
        <section class="admin-panel">
          <header><div><h2>线索台账</h2><p>确认/排除必须在弹窗中填写人工结论。</p></div><button class="button primary" @click="reportOpen = true">新建线索</button></header>
          <div v-if="visibleEvents.length === 0" class="admin-empty">{{ eventId ? '未找到该院感线索。' : '暂无院感线索。' }}</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>类型</th><th>类别 / 时限</th><th>病原体</th><th>外部上报</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="event in visibleEvents" :key="event.infection_event_id">
              <td><RouterLink :to="`/infection-events/clues/${event.infection_event_id}`"><strong>{{ event.infection_type }}</strong></RouterLink><small>…{{ event.infection_event_id.slice(-8) }}</small></td>
              <td>{{ event.event_category }}<small>{{ event.reporting_window_hours }}h · 截止 {{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(event.report_deadline_at)) }}</small></td>
              <td><code>{{ event.organism_code ?? '—' }}</code></td>
              <td>{{ event.external_report_state }}<small>{{ event.receipt_no ?? '暂无回执' }}</small></td>
              <td><span class="admin-status" :class="event.status.toLowerCase()">{{ statusLabel(event.status) }}</span></td>
              <td>
                <button v-if="event.status === 'REPORTED'" class="task-action" :disabled="Boolean(busy)" @click="openResolution(event, 'CONFIRM')">确认</button>
                <button v-if="event.status === 'REPORTED'" class="task-action danger" :disabled="Boolean(busy)" @click="openResolution(event, 'REFUTE')">排除</button>
                <span v-else>—</span>
              </td>
            </tr>
          </tbody></table></div>
        </section>
      </div>
    </template>
    <AdminActionDialog v-model:open="reportOpen" title="新建院感线索" description="线索只进入人工复核；系统按院内选定制度计算 2/24 小时时限，不代替法定直报网络。" size="large" :busy="busy === 'report'"><form class="admin-form credential-dialog-form" @submit.prevent="report"><label><span>感染类型</span><select v-model="form.infectionType"><option value="SURGICAL_SITE">手术部位</option><option value="BLOODSTREAM">血流感染</option><option value="URINARY_TRACT">泌尿道</option><option value="PNEUMONIA">肺炎</option><option value="OTHER">其他</option></select></label><label><span>事件类别</span><select v-model="form.eventCategory"><option value="HAI_CASE">医院感染病例</option><option value="HAI_OUTBREAK">医院感染暴发</option><option value="NOTIFIABLE_DISEASE">传染病网络报告</option></select></label><label><span>病原体（可选）</span><input v-model="form.organismCode" maxlength="96" placeholder="例：MRSA" /></label><label><span>发病时间（可选）</span><input v-model="form.onsetAt" type="datetime-local" /></label><label><span>发现时间</span><input v-model="form.detectedAt" type="datetime-local" required /></label><label><span>时限策略</span><select v-model="form.reportingWindowHours"><option :value="2">2 小时</option><option :value="24">24 小时</option></select></label><label><span>制度代码</span><input v-model="form.reportingPolicyCode" minlength="4" maxlength="128" required /></label><label><span>入系统时间</span><input v-model="form.reportedAt" type="datetime-local" required /></label><label v-if="form.eventCategory === 'HAI_CASE'" class="full-span"><input v-model="form.externalReportRequired" type="checkbox" /> 该病例需进入外部直报队列</label><p v-else class="full-span admin-notice">暴发和传染病类别将强制进入外部上报队列。</p></form><template #footer="{ close }"><button class="button secondary" :disabled="busy === 'report'" @click="close">取消</button><button class="button primary" :disabled="busy === 'report'" @click="report">{{ busy === 'report' ? '上报中…' : '上报线索' }}</button></template></AdminActionDialog>
    <AdminActionDialog v-model:open="resolutionOpen" :title="resolution === 'CONFIRM' ? '确认院感线索' : '排除院感线索'" description="人工结论至少 4 个字符；提交后状态不可回写覆盖，后续整改通过独立工作项闭环。" :busy="Boolean(busy)"><form class="admin-form" @submit.prevent="resolve"><label><span>复核结论</span><textarea v-model="conclusion" required minlength="4" maxlength="1000" rows="4" :placeholder="resolution === 'CONFIRM' ? '说明确认依据和后续防控动作' : '说明排除依据和替代解释'" /></label></form><template #footer="{ close }"><button class="button secondary" :disabled="Boolean(busy)" @click="close">取消</button><button class="button primary" :class="{ danger: resolution === 'REFUTE' }" :disabled="Boolean(busy) || conclusion.trim().length < 4" @click="resolve">确认提交结论</button></template></AdminActionDialog>
  </section>
</template>

<style scoped>
.quality-breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#667085;font-size:13px}.quality-breadcrumb a{color:#245493;text-decoration:none}.quality-depth-links{display:flex;gap:8px;flex-wrap:wrap;margin-bottom:12px}.quality-depth-links a{padding:8px 11px;border:1px solid var(--line);border-radius:8px;background:#fff;color:#245493;text-decoration:none}
.credential-dialog-form{grid-template-columns:repeat(2,minmax(0,1fr))}.full-span{grid-column:1/-1}@media(max-width:640px){.credential-dialog-form{grid-template-columns:1fr}.full-span{grid-column:auto}}
</style>
