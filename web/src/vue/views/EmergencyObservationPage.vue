<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { EmergencyObservationWire } from '../../generated/contracts';
import { completeEmergencyObservation, issueEmergencyEncounterLease, issueEmergencyLease, listEmergencyCoordinationCases, listEmergencyIdentityVerifications, listEmergencyObservations, listEmergencyVitalSigns, startEmergencyObservation, voidEmergencyObservation } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'observation', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_OBSERVATION'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const commandLeaseQuery = useQuery({ queryKey: ['emergency', 'observation', 'command-lease'], queryFn: () => issueEmergencyEncounterLease('EMERGENCY_OBSERVATION_COMMAND'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'observation', 'items'], queryFn: () => listEmergencyObservations(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const identityQuery = useQuery({ queryKey: ['emergency', 'observation', 'identity'], queryFn: () => listEmergencyIdentityVerifications(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const coordinationQuery = useQuery({ queryKey: ['emergency', 'observation', 'coordination'], queryFn: () => listEmergencyCoordinationCases(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const vitalsQuery = useQuery({ queryKey: ['emergency', 'observation', 'vitals'], queryFn: () => listEmergencyVitalSigns(commandLeaseQuery.data.value!), enabled: () => Boolean(commandLeaseQuery.data.value), retry: false });
const issue = computed(() => {
  const error = leaseQuery.error.value ?? commandLeaseQuery.error.value ?? itemsQuery.error.value ?? identityQuery.error.value ?? coordinationQuery.error.value ?? vitalsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});
const items = computed(() => itemsQuery.data.value ?? []);
const currentItems = computed(() => items.value.filter((i) => !i.voided_at));
const currentObservation = computed(() => currentItems.value.find((item) => item.status === 'OBSERVING') ?? currentItems.value[0] ?? null);
const observingCount = computed(() => currentItems.value.filter((item) => item.status === 'OBSERVING').length);
const admittedCount = computed(() => currentItems.value.filter((item) => item.disposition === 'ADMITTED').length);
const dischargeCount = computed(() => currentItems.value.filter((item) => item.disposition === 'DISCHARGED').length);
const latestIdentity = computed(() => identityQuery.data.value?.[0]);
const identityValid = computed(() => Boolean(latestIdentity.value?.outcome === 'MATCHED' && Date.now() - new Date(latestIdentity.value.verified_at).getTime() <= 30 * 60_000));
const latestVitals = computed(() => vitalsQuery.data.value?.[0]);
const openCoordination = computed(() => (coordinationQuery.data.value ?? []).filter((item) => !['COMPLETED', 'VOIDED'].includes(item.status)));
const acceptedTransfer = computed(() => (coordinationQuery.data.value ?? []).some((item) => item.case_type === 'TRANSFER' && ['ACKNOWLEDGED', 'COMPLETED'].includes(item.status)));
const dispositionGates = computed(() => [
  { label: '近30分钟身份核验', state: identityValid.value ? '通过' : '阻断', tone: identityValid.value ? 'green' : 'red' },
  { label: '最近生命体征', state: latestVitals.value ? formatDate(latestVitals.value.recorded_at) : '未记录', tone: latestVitals.value ? 'green' : 'amber' },
  { label: '未完成协同任务', state: openCoordination.value.length ? `${openCoordination.value.length} 项` : '无', tone: openCoordination.value.length ? 'amber' : 'green' },
  { label: '转运接收', state: acceptedTransfer.value ? '已接收' : '未接收', tone: acceptedTransfer.value ? 'green' : 'amber' },
]);
const dispositionLabels: Record<string, string> = { PENDING: '待定', DISCHARGED: '离院', ADMITTED: '收住院', TRANSFERRED: '转科/转院' };
const form = reactive({ observation_started_at: new Date().toISOString().slice(0, 16) });
const createOpen = ref(false);
const bedMapOpen = ref(false);
const dispositionTarget = ref<EmergencyObservationWire | null>(null);
const disposition = ref<'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED'>('ADMITTED');
const voidTarget = ref<EmergencyObservationWire | null>(null);
const voidReason = ref('');
const busy = ref(''); const notice = ref('');

function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
async function reload() { notice.value = ''; await Promise.all([itemsQuery.refetch(), identityQuery.refetch(), coordinationQuery.refetch(), vitalsQuery.refetch()]); }
async function startObservation() { const lease = commandLeaseQuery.data.value; if (!lease || busy.value) return; busy.value = 'create'; notice.value = ''; try { await startEmergencyObservation(lease, { observation_started_at: new Date(form.observation_started_at).toISOString() }); createOpen.value = false; notice.value = '已开启抢救留观，去向待定。'; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function saveDisposition() { const lease = commandLeaseQuery.data.value; const target = dispositionTarget.value; if (!lease || !target || busy.value) return; busy.value = 'complete'; notice.value = ''; try { await completeEmergencyObservation(lease, target, disposition.value); notice.value = `留观去向已更新为「${dispositionLabels[disposition.value]}」，闭环完成。`; dispositionTarget.value = null; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = commandLeaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyObservation(lease, target, voidReason.value.trim()); notice.value = '留观记录已逻辑作废，已退出当前去向门禁。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-head"><div class="page-title"><h1>急诊抢救留观与去向</h1><p>留观计划、复评、未回结果、交接和离院/入院/转院闭环</p></div><div class="head-actions"><button class="btn" @click="bedMapOpen=true">留观占用</button><button class="btn" :disabled="currentItems.some((item)=>item.status==='OBSERVING')" @click="createOpen=true">新建留观</button><button class="btn primary" @click="currentObservation?.status==='OBSERVING' ? (dispositionTarget=currentObservation) : (createOpen=true)">发起去向评估</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || commandLeaseQuery.isPending.value || itemsQuery.isPending.value || identityQuery.isPending.value || coordinationQuery.isPending.value || vitalsQuery.isPending.value" kind="loading" message="正在读取抢救留观与去向门禁" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><div class="metric-grid emergency-metrics"><div class="metric"><div class="name">在观患者</div><div class="value">{{ observingCount }}</div><div class="trend">当前患者实时事实</div></div><div class="metric"><div class="name">待复评</div><div class="value warning-text">{{ observingCount }}</div><div class="trend">去向待确认</div></div><div class="metric"><div class="name">待住院接收</div><div class="value">{{ admittedCount }}</div><div class="trend">已完成住院去向</div></div><div class="metric"><div class="name">拟离院</div><div class="value">{{ dischargeCount }}</div><div class="trend">离院闭环记录</div></div></div><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="grid secondary-grid emergency-prototype-layout"><section class="card scroll-card emergency-prototype-main"><div class="card-head">留观患者与去向台账 <span class="sub">真实留观流程</span></div><div v-if="!items.length" class="clinical-empty-state rich"><strong>当前患者还没有留观记录</strong><p>符合持续观察或抢救条件时，可新建留观并在结束时填写去向。</p><button class="btn primary" @click="createOpen=true">新建留观</button></div><div v-else class="admin-table-wrap"><table class="table emergency-compact-table"><thead><tr><th>患者/开始</th><th>时长</th><th>关键待办</th><th>拟去向</th><th>操作</th></tr></thead><tbody><tr v-for="item in items" :key="item.observation_id" :class="{'is-voided':item.voided_at}"><td><b>患者 …{{ item.patient_id.slice(-8) }}</b><br><span class="meta">{{ formatDate(item.observation_started_at) }}</span></td><td>{{ item.completed_at ? '已完成' : '观察中' }}</td><td>{{ item.status==='OBSERVING'?'需核对复评、协同与去向':'去向已闭环' }}</td><td><span class="status" :class="item.voided_at?'gray':item.disposition==='ADMITTED'?'amber':item.disposition==='DISCHARGED'?'green':'blue'">{{ item.voided_at?'已作废':dispositionLabels[item.disposition] }}</span></td><td><span class="inline-actions"><button class="btn sm" :disabled="Boolean(busy)||item.status!=='OBSERVING'||Boolean(item.voided_at)" @click="dispositionTarget=item">编辑去向</button><button class="btn sm danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div><div class="card-body"><div class="section-title">当前留观事实</div><div class="order-form"><div><span>留观状态</span><b>{{ currentObservation ? '急诊持续观察中' : '暂无活动留观' }}</b></div><div><span>最近生命体征</span><b>{{ latestVitals ? formatDate(latestVitals.recorded_at) : '尚未记录' }}</b></div><div><span>复评频率</span><b>本模块未配置，应以医嘱/院内制度为准</b></div><div><span>待回结果</span><b>待检查检验责任清单接入后判定</b></div><div><span>目标去向</span><b>{{ dispositionLabels[currentObservation?.disposition ?? 'PENDING'] }}</b></div><div><span>未完成协同</span><b>{{ openCoordination.length }} 项</b></div></div></div></section>
        <aside class="card scroll-card emergency-prototype-side"><div class="card-head">去向门禁</div><div class="card-body"><div v-for="gate in dispositionGates" :key="gate.label" class="queue-item"><div class="queue-title">{{ gate.label }}<span class="status" :class="gate.tone">{{ gate.state }}</span></div></div><div class="notice hard"><div class="notice-title">不伪造已交接状态</div>当前尚未建模的未回结果、管路、用药和财物核对不显示为“已通过”；必须由后续结构化事实接入后才能形成硬门禁。</div><RouterLink class="btn primary emergency-full-action" to="/er-handoff">打开会诊交接与转运</RouterLink></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="bedMapOpen" title="急诊留观占用事实" description="本页不虚构床位数量；院区留观床位须接入真实床位主数据后才显示可用容量。" eyebrow="急诊 / 留观占用"><div class="emergency-bed-map"><div v-for="item in currentItems.filter((row)=>row.status==='OBSERVING')" :key="item.observation_id" class="occupied"><b>患者 …{{ item.patient_id.slice(-8) }}</b><span>开始 {{ formatDate(item.observation_started_at) }}</span></div><div v-if="!observingCount" class="clinical-empty-state compact"><strong>当前患者无活动留观</strong><span>未接入床位主数据，不展示虚拟空床。</span></div></div></AdminActionDialog>
    <AdminActionDialog v-model:open="createOpen" title="新建抢救留观" description="新建后立即进入留观流程，必须后续记录离院、收住院或转科转院去向。" eyebrow="急诊 / 抢救留观" :busy="busy==='create'"><form class="admin-form" @submit.prevent="startObservation"><label><span>留观开始时间</span><input v-model="form.observation_started_at" type="datetime-local" autofocus required /></label><button class="button primary" :disabled="Boolean(busy)">{{ busy==='create'?'正在开启…':'确认开启留观' }}</button></form></AdminActionDialog>
    <AdminActionDialog :open="Boolean(dispositionTarget)" title="编辑留观去向" description="确认后立即完成留观闭环并影响急诊去向统计。" eyebrow="急诊 / 去向闭环" :busy="busy==='complete'" @update:open="!$event&&(dispositionTarget=null)"><form class="admin-form" @submit.prevent="saveDisposition"><label><span>患者去向</span><select v-model="disposition" autofocus><option value="DISCHARGED">离院</option><option value="ADMITTED">收住院</option><option value="TRANSFERRED">转科 / 转院</option></select></label><button class="button primary" :disabled="Boolean(busy)">{{ busy==='complete'?'正在更新…':'保存去向并完成' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除留观记录" description="该操作按医疗审计要求执行为逻辑作废，并立即停止这条记录影响去向流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
