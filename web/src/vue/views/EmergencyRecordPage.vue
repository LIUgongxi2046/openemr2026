<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext, loadEncounterDocuments } from '../../clinical-api';
import type { EmergencyResuscitationWire } from '../../generated/contracts';
import { completeEmergencyResuscitation, issueEmergencyEncounterLease, issueEmergencyLease, listEmergencyResuscitations, startEmergencyResuscitation, voidEmergencyResuscitation } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import EmergencyPatientStrip from '../components/EmergencyPatientStrip.vue';
import AgentInlineReview from '../components/AgentInlineReview.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'record', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_RECORD'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const encounterLeaseQuery = useQuery({ queryKey: ['emergency', 'record', 'encounter-lease'], queryFn: () => issueEmergencyEncounterLease('EMERGENCY_RECORD_COMMAND'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const resuscitationsQuery = useQuery({ queryKey: ['emergency', 'record', 'resuscitations'], queryFn: () => listEmergencyResuscitations(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const documentsQuery = useQuery({ queryKey: ['emergency', 'record', 'documents'], queryFn: () => loadEncounterDocuments(encounterLeaseQuery.data.value!, clinicalContext.emergencyEncounterId, clinicalContext.emergencyPatientId), enabled: () => Boolean(encounterLeaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value) : null);
const resuscitations = computed(() => resuscitationsQuery.data.value ?? []);
const documents = computed(() => documentsQuery.data.value ?? []);
const agentPatientId = computed(() => clinicalContext.emergencyPatientId);
const agentEncounterId = computed(() => clinicalContext.emergencyEncounterId);
const agentObjective = computed(() => '基于当前急诊就诊信息起草急诊病历候选，仅供医生审阅后采用。');
const currentResuscitations = computed(() => resuscitations.value.filter((i) => !i.voided_at));
const currentResuscitation = computed(() => currentResuscitations.value.find((item) => item.status === 'IN_PROGRESS') ?? currentResuscitations.value[0] ?? null);
const outcomeLabels: Record<string, string> = { PENDING: '抢救中', ROSC: '自主循环恢复', DEATH: '死亡', TRANSFERRED: '转科/转院' };
const form = reactive({ started_at: new Date().toISOString().slice(0, 16) });
const createOpen = ref(false);
const versionsOpen = ref(false);
const signOpen = ref(false);
const outcomeTarget = ref<EmergencyResuscitationWire | null>(null);
const outcome = ref<'ROSC' | 'DEATH' | 'TRANSFERRED'>('ROSC');
const voidTarget = ref<EmergencyResuscitationWire | null>(null);
const voidReason = ref(''); const busy = ref(''); const notice = ref('');

function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
async function reload() { notice.value = ''; await Promise.all([resuscitationsQuery.refetch(), documentsQuery.refetch()]); }
async function startResuscitation() { const lease = encounterLeaseQuery.data.value; if (!lease || busy.value) return; busy.value = 'create'; notice.value = ''; try { await startEmergencyResuscitation(lease, { started_at: new Date(form.started_at).toISOString() }); createOpen.value = false; notice.value = '抢救记录已开启，结局待闭环。'; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function saveOutcome() { const lease = encounterLeaseQuery.data.value; const target = outcomeTarget.value; if (!lease || !target || busy.value) return; busy.value = 'complete'; notice.value = ''; try { await completeEmergencyResuscitation(lease, target, outcome.value); notice.value = `抢救结局已编辑为「${outcomeLabels[outcome.value]}」，抢救闭环完成。`; outcomeTarget.value = null; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = encounterLeaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyResuscitation(lease, target, voidReason.value.trim()); notice.value = '抢救记录已逻辑作废，不再影响当前急诊流程。'; voidTarget.value = null; voidReason.value = ''; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-head"><div class="page-title"><h1>急诊病历与抢救记录</h1><p>急诊病历、抢救事件、医嘱结果和补录双时间在同一时间轴编辑</p></div><div class="head-actions"><button class="btn" @click="versionsOpen=true">病历版本</button><button class="btn danger" :disabled="currentResuscitations.some((item)=>item.status==='IN_PROGRESS')" @click="createOpen=true">新增抢救事件</button><button class="btn primary" @click="signOpen=true">提交审签</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || encounterLeaseQuery.isPending.value || resuscitationsQuery.isPending.value || documentsQuery.isPending.value" kind="loading" message="正在读取抢救记录与急诊病历" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><EmergencyPatientStrip />
      <AgentInlineReview agent-code="DOCUMENT_DRAFTER" stage-code="OUTPATIENT" :objective="agentObjective" :patient-id="agentPatientId" :encounter-id="agentEncounterId" target-type="ENCOUNTER" :target-id="agentEncounterId" title="AI 急诊文书起草候选" source-route="er-record" />
      <p v-if="notice" class="admin-notice">{{ notice }}</p>
      <div class="grid course-layout emergency-record-prototype">
        <aside class="card scroll-card emergency-record-timeline"><div class="card-head">时间轴与文书</div>
          <div v-for="item in resuscitations" :key="item.resuscitation_id" class="queue-item" :class="{ active:item.resuscitation_id===currentResuscitation?.resuscitation_id, 'is-voided':item.voided_at }"><div class="queue-title">{{ formatDate(item.started_at) }} · 抢救{{ item.status==='IN_PROGRESS'?'进行中':'已闭环' }}</div><div class="queue-meta">来源：抢救记录 · {{ item.voided_at?'已作废':outcomeLabels[item.outcome] }}</div><div class="inline-actions emergency-row-actions"><button class="btn sm" :disabled="Boolean(busy)||item.status!=='IN_PROGRESS'||Boolean(item.voided_at)" @click="outcomeTarget=item">编辑结局</button><button class="btn sm danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></div></div>
          <div v-for="doc in documents" :key="doc.document_version_id" class="queue-item"><div class="queue-title">{{ formatDate(doc.created_at) }} · {{ doc.document_type_code || '急诊文书' }}</div><div class="queue-meta">来源：病历内核 · v{{ doc.version_no }}</div></div>
          <div class="card-body"><button class="btn emergency-full-action" :disabled="currentResuscitations.some((item)=>item.status==='IN_PROGRESS')" @click="createOpen=true">＋ 补录抢救事件</button></div>
        </aside>
        <section class="card scroll-card emergency-record-document"><div class="card-head">急诊抢救记录 <span class="status" :class="currentResuscitation?.status==='IN_PROGRESS'?'red':'green'">{{ currentResuscitation?.status==='IN_PROGRESS'?'进行中':'已闭环' }}</span><span class="sub">{{ documents.length ? `病历 ${documents.length} 版` : '待形成病历' }}</span></div>
          <div class="card-body document-paper"><h2>急诊抢救记录</h2><p class="document-meta">患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }} · 急诊就诊 …{{ clinicalContext.emergencyEncounterId.slice(-8) }}</p><div class="doc-section"><b>到院情况</b><div class="field textarea">急诊患者已完成身份上下文核验，抢救开始时间 {{ formatDate(currentResuscitation?.started_at) }}。</div></div><div class="doc-section"><b>抢救经过</b><div class="field textarea ai">系统已汇总 {{ resuscitations.length }} 条抢救事实与 {{ documents.length }} 个病历版本；事件时间和记录时间分别留痕。<span class="source-tag">真实 API 汇总</span></div></div><div class="doc-section"><b>当前判断与去向</b><div class="field textarea">{{ currentResuscitation ? outcomeLabels[currentResuscitation.outcome] : '尚未开启抢救记录' }}；进行中的抢救必须填写结局后才能闭环。</div></div></div>
          <div class="footer-actions"><span class="save-state">● 病历内核与抢救事实已同步</span><button class="btn" @click="versionsOpen=true">暂存/版本</button><button class="btn primary" @click="signOpen=true">提交抢救负责人审签</button></div>
        </section>
        <aside class="card scroll-card emergency-record-quality"><div class="card-head">时间质控与来源</div><div class="card-body"><div class="notice hard"><div class="notice-title">补录双时间</div>实际事件时间与系统记录时间分别保存，补录不得回写覆盖原始时间。</div><div class="notice rule"><div class="notice-title">抢救结局门禁</div>{{ currentResuscitation?.status==='IN_PROGRESS' ? '当前抢救尚未登记结局，不能结束急诊流程。' : '当前抢救流程已形成结局证据。' }}</div><div class="notice ai"><div class="notice-title">✦ 一致性检查</div>病历版本、抢救状态和结局会在提交审签前再次校验。</div><div class="section-title emergency-summary-title">来源状态</div><div class="folder-row">抢救记录<span class="status green">已同步 {{ resuscitations.length }}</span></div><div class="folder-row">病历内核<span class="status green">已同步 {{ documents.length }}</span></div><div class="folder-row">审计与 Outbox<span class="status blue">持续留痕</span></div><div class="folder-row">家属沟通<span class="status amber">待人工确认</span></div></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="versionsOpen" title="急诊病历版本" description="病历版本来自真实病历内核；原版本不可覆盖。" eyebrow="急诊 / 病历版本"><div class="emergency-rule-dialog"><div v-for="doc in documents" :key="doc.document_version_id"><span class="status blue">v{{ doc.version_no }}</span><b>{{ doc.document_type_code || '急诊病历文档' }} · {{ formatDate(doc.created_at) }}</b></div><div v-if="!documents.length" class="clinical-empty-state compact"><strong>暂无病历版本</strong><span>请先在病历内核创建急诊文书。</span></div></div></AdminActionDialog>
    <AdminActionDialog v-model:open="signOpen" title="提交抢救负责人审签" description="提交前需确认抢救结局、时间事实与病历内容一致。" eyebrow="急诊 / 审签门禁"><div class="notice" :class="currentResuscitation?.status==='IN_PROGRESS'?'hard':'info'"><div class="notice-title">{{ currentResuscitation?.status==='IN_PROGRESS'?'尚有抢救未闭环':'已满足抢救结局门禁' }}</div>{{ currentResuscitation?.status==='IN_PROGRESS'?'请先编辑抢救结局，再进入病历审签。':'可进入病历审签中心完成签署。' }}</div><template #footer><button class="button secondary" @click="signOpen=false">取消</button><RouterLink class="button primary" to="/record-sign" @click="signOpen=false">进入审签中心</RouterLink></template></AdminActionDialog>
    <AdminActionDialog v-model:open="createOpen" title="新建抢救记录" description="确认后立即进入抢救中状态，必须后续登记结局。" eyebrow="急诊 / 抢救" tone="danger" :busy="busy==='create'"><form class="admin-form" @submit.prevent="startResuscitation"><label><span>抢救开始时间</span><input v-model="form.started_at" type="datetime-local" autofocus required /></label><button class="button danger">{{ busy==='create'?'正在开启…':'确认开启抢救' }}</button></form></AdminActionDialog>
    <AdminActionDialog :open="Boolean(outcomeTarget)" title="编辑抢救结局" description="结局保存后立即关闭抢救流程并进入审计链。" eyebrow="急诊 / 结局闭环" :busy="busy==='complete'" @update:open="!$event&&(outcomeTarget=null)"><form class="admin-form" @submit.prevent="saveOutcome"><label><span>抢救结局</span><select v-model="outcome" autofocus><option value="ROSC">自主循环恢复（ROSC）</option><option value="DEATH">死亡</option><option value="TRANSFERRED">转科 / 转院</option></select></label><button class="button primary">{{ busy==='complete'?'正在保存…':'保存结局并完成' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除抢救记录" description="删除按医疗审计规范执行为逻辑作废，原始抢救事实继续只读保留。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
