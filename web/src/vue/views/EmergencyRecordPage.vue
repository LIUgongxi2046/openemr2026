<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext, issueContextLease, loadEncounterDocuments } from '../../clinical-api';
import type { EmergencyResuscitationWire } from '../../generated/contracts';
import { completeEmergencyResuscitation, issueEmergencyLease, listEmergencyResuscitations, startEmergencyResuscitation, voidEmergencyResuscitation } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'record', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_RECORD'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const encounterLeaseQuery = useQuery({ queryKey: ['emergency', 'record', 'encounter-lease'], queryFn: () => issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, 'EMERGENCY_RECORD_DOCUMENTS'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const resuscitationsQuery = useQuery({ queryKey: ['emergency', 'record', 'resuscitations'], queryFn: () => listEmergencyResuscitations(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const documentsQuery = useQuery({ queryKey: ['emergency', 'record', 'documents'], queryFn: () => loadEncounterDocuments(encounterLeaseQuery.data.value!), enabled: () => Boolean(encounterLeaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? encounterLeaseQuery.error.value ?? resuscitationsQuery.error.value ?? documentsQuery.error.value) : null);
const resuscitations = computed(() => resuscitationsQuery.data.value ?? []);
const documents = computed(() => documentsQuery.data.value ?? []);
const currentResuscitations = computed(() => resuscitations.value.filter((i) => !i.voided_at));
const outcomeLabels: Record<string, string> = { PENDING: '抢救中', ROSC: '自主循环恢复', DEATH: '死亡', TRANSFERRED: '转科/转院' };
const form = reactive({ started_at: new Date().toISOString().slice(0, 16) });
const createOpen = ref(false);
const outcomeTarget = ref<EmergencyResuscitationWire | null>(null);
const outcome = ref<'ROSC' | 'DEATH' | 'TRANSFERRED'>('ROSC');
const voidTarget = ref<EmergencyResuscitationWire | null>(null);
const voidReason = ref(''); const busy = ref(''); const notice = ref('');

function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
async function reload() { notice.value = ''; await Promise.all([resuscitationsQuery.refetch(), documentsQuery.refetch()]); }
async function startResuscitation() { const lease = leaseQuery.data.value; if (!lease || busy.value) return; busy.value = 'create'; notice.value = ''; try { await startEmergencyResuscitation(lease, { started_at: new Date(form.started_at).toISOString() }); createOpen.value = false; notice.value = '抢救记录已开启，结局待闭环。'; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function saveOutcome() { const lease = leaseQuery.data.value; const target = outcomeTarget.value; if (!lease || !target || busy.value) return; busy.value = 'complete'; notice.value = ''; try { await completeEmergencyResuscitation(lease, target, outcome.value); notice.value = `抢救结局已编辑为「${outcomeLabels[outcome.value]}」，抢救闭环完成。`; outcomeTarget.value = null; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = leaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyResuscitation(lease, target, voidReason.value.trim()); notice.value = '抢救记录已逻辑作废，不再影响当前急诊流程。'; voidTarget.value = null; voidReason.value = ''; await resuscitationsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 急诊</p><h1>急诊病历与抢救记录</h1><p>抢救记录以结局闭环；急诊文档从病历内核读取。所有新增、结局编辑和删除均通过弹窗确认。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/emergency">返回工作台</RouterLink><button class="button danger" :disabled="currentResuscitations.length>0" @click="createOpen=true">新建抢救记录</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || encounterLeaseQuery.isPending.value || resuscitationsQuery.isPending.value || documentsQuery.isPending.value" kind="loading" message="正在读取抢救记录与急诊病历" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><section class="admin-metrics"><article><span>抢救记录</span><strong>{{ resuscitations.length }}</strong><small>含历史作废</small></article><article><span>急诊病历文档</span><strong>{{ documents.length }}</strong><small>真实病历内核</small></article></section><p v-if="notice" class="admin-notice">{{ notice }}</p>
      <div class="emergency-record-grid"><section class="admin-panel"><header><div><h2>抢救记录</h2><p>进行中的抢救必须编辑明确结局。</p></div><button class="button secondary" @click="resuscitationsQuery.refetch()">刷新</button></header><div v-if="!resuscitations.length" class="admin-empty rich"><strong>暂无抢救记录</strong><p>仅在患者进入抢救流程时开启。</p><button class="button danger" @click="createOpen=true">新建抢救记录</button></div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>开始</th><th>结束</th><th>结局</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in resuscitations" :key="item.resuscitation_id" :class="{'is-voided':item.voided_at}"><td>{{ formatDate(item.started_at) }}</td><td>{{ formatDate(item.ended_at) }}</td><td>{{ item.voided_at?'已作废':outcomeLabels[item.outcome] }}</td><td>{{ item.voided_at?'退出流程':item.status==='IN_PROGRESS'?'抢救中':'已完成' }}</td><td><span class="inline-actions"><button class="task-action" :disabled="Boolean(busy)||item.status!=='IN_PROGRESS'||Boolean(item.voided_at)" @click="outcomeTarget=item">编辑结局</button><button class="task-action danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div></section>
        <section class="admin-panel"><header><div><h2>急诊病历文档</h2><p>就诊 …{{ clinicalContext.encounterId.slice(-8) }}</p></div></header><div v-if="!documents.length" class="admin-empty">该就诊暂无文书文档。</div><ul v-else class="doc-list"><li v-for="doc in documents" :key="doc.document_version_id"><span>{{ doc.document_type_code || '未命名文档' }}</span><small>v{{ doc.version_no }} · {{ formatDate(doc.created_at) }}</small></li></ul></section>
      </div>
    </template>
    <AdminActionDialog v-model:open="createOpen" title="新建抢救记录" description="确认后立即进入抢救中状态，必须后续登记结局。" eyebrow="急诊 / 抢救" tone="danger" :busy="busy==='create'"><form class="admin-form" @submit.prevent="startResuscitation"><label><span>抢救开始时间</span><input v-model="form.started_at" type="datetime-local" autofocus required /></label><button class="button danger">{{ busy==='create'?'正在开启…':'确认开启抢救' }}</button></form></AdminActionDialog>
    <AdminActionDialog :open="Boolean(outcomeTarget)" title="编辑抢救结局" description="结局保存后立即关闭抢救流程并进入审计链。" eyebrow="急诊 / 结局闭环" :busy="busy==='complete'" @update:open="!$event&&(outcomeTarget=null)"><form class="admin-form" @submit.prevent="saveOutcome"><label><span>抢救结局</span><select v-model="outcome" autofocus><option value="ROSC">自主循环恢复（ROSC）</option><option value="DEATH">死亡</option><option value="TRANSFERRED">转科 / 转院</option></select></label><button class="button primary">{{ busy==='complete'?'正在保存…':'保存结局并完成' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除抢救记录" description="删除按医疗审计规范执行为逻辑作废，原始抢救事实继续只读保留。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
