<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import type { WaitingQueueEntryWire } from '../../generated/contracts';
import { clinicalContext } from '../../clinical-api';
import { callWaitingQueueEntry, issueEmergencyFacilityLease, listWaitingQueue } from '../../api/emergency';
import { loadOutpatientWorkspaceSnapshot } from '../../api/outpatient-workspace';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { clinicalCodeLabel } from '../clinical-display';
import { toClinicalIssue } from '../clinical-error';
import { useClinicalContextStore } from '../stores/clinical-context';

const contextStore = useClinicalContextStore();
const selectedPatientId = ref(clinicalContext.patientId);
const selectedEncounterId = ref(clinicalContext.encounterId);
const queueFilter = ref<'ALL' | WaitingQueueEntryWire['status']>('ALL');
const busy = ref('');
const notice = ref('');

const facilityLease = useQuery({ queryKey: ['outpatient', 'facility-lease'], queryFn: () => issueEmergencyFacilityLease('OUTPATIENT_QUEUE'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const queueQuery = useQuery({ queryKey: ['outpatient', 'queue'], queryFn: () => listWaitingQueue(facilityLease.data.value!), enabled: () => Boolean(facilityLease.data.value), retry: false });
const snapshotQuery = useQuery({
  queryKey: computed(() => ['outpatient', 'workspace', selectedPatientId.value, selectedEncounterId.value]),
  queryFn: () => loadOutpatientWorkspaceSnapshot(selectedPatientId.value, selectedEncounterId.value),
  retry: false, staleTime: 0, gcTime: 0,
});

watch(() => snapshotQuery.data.value?.lease, (lease) => { if (lease) contextStore.replaceFromLease(lease); }, { immediate: true });

const queue = computed(() => queueQuery.data.value ?? []);
const filteredQueue = computed(() => queue.value.filter((entry) => queueFilter.value === 'ALL' || entry.status === queueFilter.value));
const snapshot = computed(() => snapshotQuery.data.value);
const documents = computed(() => snapshot.value?.documents ?? []);
const currentDocument = computed(() => documents.value.find((item) => item.status !== 'VOID') ?? documents.value[0]);
const diagnoses = computed(() => snapshot.value?.diagnoses ?? []);
const orders = computed(() => snapshot.value?.orders ?? []);
const results = computed(() => snapshot.value?.results ?? []);
const timeline = computed(() => snapshot.value?.timeline.items ?? []);
const criticalValues = computed(() => results.value.flatMap((item) => item.critical_values).filter((item) => item.state !== 'DISPOSED'));
const activeOrders = computed(() => orders.value.filter((item) => !['COMPLETED', 'CANCELLED', 'STOPPED'].includes(item.status)));
const provisionalDiagnoses = computed(() => diagnoses.value.filter((item) => item.status === 'PROVISIONAL'));
const partialTimeline = computed(() => snapshot.value?.timeline.completeness === 'PARTIAL');
const selectedQueueEntry = computed(() => queue.value.find((entry) => entry.patient_id === selectedPatientId.value && entry.encounter_id === selectedEncounterId.value));
const patientLabel = computed(() => selectedQueueEntry.value?.patient_display_name ?? developmentCopy.patientName);
const issue = computed(() => {
  const failed = [facilityLease, queueQuery, snapshotQuery].find((query) => query.error.value);
  return failed ? toClinicalIssue(failed.error.value) : null;
});

function selectPatient(entry: WaitingQueueEntryWire) {
  if (busy.value) return;
  contextStore.clear('OUTPATIENT_PATIENT_SWITCH');
  selectedPatientId.value = entry.patient_id;
  selectedEncounterId.value = entry.encounter_id;
  notice.value = `已切换至候诊 #${entry.sequence_no}；旧上下文租约已从客户端状态移除，新数据按新租约加载。`;
}

async function callPatient(entry: WaitingQueueEntryWire) {
  const lease = facilityLease.data.value;
  if (!lease || busy.value || entry.status !== 'WAITING') return;
  busy.value = entry.waiting_queue_entry_id; notice.value = '';
  try {
    const updated = await callWaitingQueueEntry(lease, entry);
    notice.value = `候诊 #${updated.sequence_no} 已叫号；状态 ${clinicalCodeLabel(updated.status)}，版本 v${updated.row_version}。`;
    await queueQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = next.code === 'VERSION_CONFLICT'
      ? '队列已被其他工作站更新，请刷新后重试。'
      : `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function refreshWorkspace() {
  await Promise.all([queueQuery.refetch(), snapshotQuery.refetch()]);
}

function date(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(value));
}
</script>

<template>
  <section data-page-root class="content vue-native-page outpatient-workspace-page">
    <div class="page-heading outpatient-heading"><div><p class="eyebrow">门诊 / 当日诊疗闭环</p><h1>门诊复合工作台</h1><p>候诊队列、患者上下文、风险、病历摘要与诊疗动作保持在同一屏；所有事实来自服务端当前快照。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/appointment-registration">预约挂号</RouterLink><button class="button secondary" @click="refreshWorkspace">刷新快照</button><RouterLink class="button primary" to="/opd-record">进入病历</RouterLink></div></div>
    <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
    <ClinicalPageState v-if="facilityLease.isPending.value || queueQuery.isPending.value || snapshotQuery.isPending.value" kind="loading" message="正在加载候诊队列与患者诊疗快照" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="refreshWorkspace" />
    <template v-else-if="snapshot">
      <section class="patient-strip" aria-label="当前患者上下文"><div class="patient-avatar">{{ patientLabel.slice(0, 1) }}</div><div><strong>{{ patientLabel }}</strong><span>患者 …{{ selectedPatientId.slice(-8) }} · 就诊 …{{ selectedEncounterId.slice(-8) }}</span></div><dl><div><dt>候诊状态</dt><dd>{{ selectedQueueEntry ? clinicalCodeLabel(selectedQueueEntry.status) : '已进入诊疗上下文' }}</dd></div><div><dt>上下文租约</dt><dd>…{{ snapshot.lease.lease_id.slice(-8) }}</dd></div><div><dt>快照完整性</dt><dd :class="{ danger: partialTimeline }">{{ partialTimeline ? '部分数据' : '完整' }}</dd></div></dl></section>
      <section class="outpatient-risk-strip" aria-label="风险摘要"><article :class="{ danger: criticalValues.length }"><span>未闭环危急值</span><strong>{{ criticalValues.length }}</strong><small>{{ criticalValues.length ? '需先确认并处置' : '当前无未闭环危急值' }}</small></article><article :class="{ warning: provisionalDiagnoses.length }"><span>待确认诊断</span><strong>{{ provisionalDiagnoses.length }}</strong><small>PROVISIONAL</small></article><article><span>活动医嘱</span><strong>{{ activeOrders.length }}</strong><small>含草稿、执行中和异常</small></article><article :class="{ warning: partialTimeline }"><span>病史来源</span><strong>{{ snapshot.timeline.source_statuses.filter((item) => item.state === 'AVAILABLE').length }}/{{ snapshot.timeline.source_statuses.length }}</strong><small>{{ partialTimeline ? '存在失败来源，不可视为空' : '授权来源已加载' }}</small></article></section>
      <div class="outpatient-dashboard">
        <aside class="outpatient-queue admin-panel"><header><div><h2>今日候诊</h2><p>{{ queue.length }} 人 · 选择后重签上下文租约</p></div><select v-model="queueFilter" aria-label="候诊状态筛选"><option value="ALL">全部</option><option value="WAITING">候诊</option><option value="CALLED">已叫号</option><option value="IN_CONSULTATION">接诊中</option><option value="COMPLETED">已完成</option></select></header><div v-if="!filteredQueue.length" class="admin-empty">当前筛选下暂无候诊患者。</div><div v-else class="queue-list"><article v-for="entry in filteredQueue" :key="entry.waiting_queue_entry_id" :class="{ active: entry.patient_id === selectedPatientId && entry.encounter_id === selectedEncounterId }"><button class="queue-patient" @click="selectPatient(entry)"><b>#{{ entry.sequence_no }} · {{ entry.patient_display_name }}</b><span>{{ clinicalCodeLabel(entry.status) }} · v{{ entry.row_version }}</span><small>就诊 …{{ entry.encounter_id.slice(-8) }}</small></button><button class="task-action" :disabled="Boolean(busy) || entry.status !== 'WAITING'" @click="callPatient(entry)">{{ busy === entry.waiting_queue_entry_id ? '处理中…' : '叫号' }}</button></article></div></aside>
        <section class="outpatient-center">
          <section class="admin-panel outpatient-summary"><header><div><h2>当次病历与诊疗摘要</h2><p>数据水位 {{ snapshot.timeline.data_watermark.slice(0, 14) }}…</p></div><span class="state-chip" :class="currentDocument?.status === 'SIGNED' ? 'signed' : 'draft'">{{ currentDocument?.status ?? 'NO_DOCUMENT' }}</span></header><div class="summary-grid"><article><span>当前文书</span><strong>{{ currentDocument?.document_type_code ?? '尚未建立门诊文书' }}</strong><small v-if="currentDocument">v{{ currentDocument.version_no }} · {{ currentDocument.status }}</small><RouterLink to="/opd-record">{{ currentDocument ? '继续书写' : '新建病历' }} →</RouterLink></article><article><span>诊断问题</span><strong>{{ diagnoses.find((item) => item.diagnosis_role === 'PRIMARY')?.diagnosis_text ?? '尚无主诊断' }}</strong><small>{{ diagnoses.length }} 条 · {{ provisionalDiagnoses.length }} 条待确认</small><RouterLink to="/opd-diagnosis">管理诊断 →</RouterLink></article><article><span>医嘱处方</span><strong>{{ activeOrders.length }} 条活动</strong><small>{{ orders.reduce((count,item) => count + item.items.length, 0) }} 个医嘱项目</small><RouterLink to="/opd-orders">安全检查与签署 →</RouterLink></article><article><span>检查检验</span><strong>{{ results.length }} 份报告</strong><small>{{ criticalValues.length }} 项危急值待闭环</small><RouterLink to="/opd-results">查看报告与危急值 →</RouterLink></article></div></section>
          <section class="admin-panel outpatient-timeline"><header><div><h2>患者风险时间线</h2><p>最近 {{ timeline.length }} 条授权事实</p></div><RouterLink to="/patient-timeline">完整时间线</RouterLink></header><div v-if="!timeline.length" class="admin-empty">已成功查询，当前没有授权时间线资料。</div><ol v-else><li v-for="item in timeline.slice(0, 7)" :key="`${item.item_type}-${item.resource_id}`"><time>{{ date(item.occurred_at) }}</time><span :data-type="item.item_type">{{ item.item_type }}</span><div><strong>{{ item.title }}</strong><p>{{ item.summary || item.status }}</p></div></li></ol></section>
        </section>
        <aside class="outpatient-actions">
          <section class="admin-panel"><header><div><h2>AI 摘要边界</h2><p>建议层，不是临床事实</p></div></header><div class="ai-source-state"><span>当前状态</span><strong>尚未生成当次 AI 摘要</strong><p>页面只呈现服务端临床事实。需要时进入AI医助小南，以当前租约和数据水位生成带引用、有效期和人工决策的候选。</p><dl><div><dt>来源水位</dt><dd>{{ snapshot.timeline.data_watermark.slice(0, 12) }}…</dd></div><div><dt>失效条件</dt><dd>切换患者 / 新版本 / 租约过期</dd></div></dl><RouterLink class="button secondary full" to="/ai-assistant">生成带来源的候选摘要</RouterLink></div></section>
          <section class="admin-panel"><header><div><h2>诊疗动作</h2><p>服务端门禁决定结果</p></div></header><nav class="action-list"><RouterLink to="/opd-record"><b>自动保存与版本</b><span>继续病历书写</span></RouterLink><RouterLink to="/record-qc"><b>确定性质控</b><span>阻断项与整改</span></RouterLink><RouterLink to="/record-sign"><b>签署与证据</b><span>当前版本签署</span></RouterLink><RouterLink to="/clinical-tasks"><b>任务与协作</b><span>认领、转派、升级</span></RouterLink><RouterLink to="/opd-followup"><b>随访计划</b><span>建立可追踪随访</span></RouterLink></nav></section>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.outpatient-heading{align-items:flex-start}.patient-strip dd.danger{color:#b42318}.outpatient-risk-strip{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:14px 0}.outpatient-risk-strip article{display:grid;gap:3px;padding:14px;border:1px solid var(--line);border-radius:10px;background:#fff}.outpatient-risk-strip span,.outpatient-risk-strip small{font-size:11px;color:#667085}.outpatient-risk-strip strong{font-size:24px}.outpatient-risk-strip .danger{border-color:#fecaca;background:#fff7f7}.outpatient-risk-strip .warning{border-color:#fed7aa;background:#fffaf3}.outpatient-dashboard{display:grid;grid-template-columns:minmax(250px,.72fr) minmax(480px,1.55fr) minmax(260px,.8fr);gap:14px;align-items:start}.outpatient-queue header select{padding:7px;border:1px solid var(--line);border-radius:7px}.queue-list{display:grid;max-height:650px;overflow:auto}.queue-list article{display:grid;grid-template-columns:1fr auto;align-items:center;gap:8px;padding:10px 12px;border-top:1px solid var(--line)}.queue-list article.active{background:#eef6ff;box-shadow:inset 3px 0 #2463a9}.queue-patient{display:grid;gap:2px;padding:0;border:0;background:transparent;text-align:left;cursor:pointer}.queue-patient span,.queue-patient small{font-size:11px;color:#667085}.outpatient-center,.outpatient-actions{display:grid;gap:14px}.summary-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px;padding:14px}.summary-grid article{display:grid;gap:5px;padding:13px;border:1px solid var(--line);border-radius:9px;background:#f8fafc}.summary-grid article>span,.summary-grid small{font-size:11px;color:#667085}.summary-grid a{font-size:12px}.outpatient-timeline ol{display:grid;gap:0;margin:0;padding:8px 14px 14px;list-style:none}.outpatient-timeline li{display:grid;grid-template-columns:78px 76px 1fr;gap:8px;padding:10px 0;border-bottom:1px solid var(--line)}.outpatient-timeline time,.outpatient-timeline li>span{font-size:11px;color:#667085}.outpatient-timeline p{margin:3px 0 0;color:#667085;font-size:12px}.ai-source-state{padding:14px}.ai-source-state>span{font-size:11px;color:#667085}.ai-source-state strong{display:block;margin:4px 0}.ai-source-state p{font-size:12px;color:#536273;line-height:1.6}.ai-source-state dl{display:grid;gap:8px}.ai-source-state dl div{display:grid;gap:2px}.ai-source-state dt{font-size:11px;color:#667085}.ai-source-state dd{margin:0;font-size:12px}.action-list{display:grid;padding:8px}.action-list a{display:grid;gap:2px;padding:10px;border-radius:8px;text-decoration:none}.action-list a:hover{background:#eef6ff}.action-list span{font-size:11px;color:#667085}@media(max-width:1180px){.outpatient-dashboard{grid-template-columns:minmax(240px,.7fr) minmax(0,1.6fr)}.outpatient-actions{grid-column:1/-1;grid-template-columns:repeat(2,1fr)}}@media(max-width:760px){.outpatient-risk-strip,.outpatient-dashboard,.summary-grid,.outpatient-actions{grid-template-columns:1fr}.outpatient-actions{grid-column:auto}.outpatient-timeline li{grid-template-columns:66px 62px 1fr}}
</style>
