<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { EmergencyNursingNoteWire } from '../../generated/contracts';
import {
  correctEmergencyNursingNote, createEmergencyNursingNote, issueEmergencyEncounterLease,
  issueEmergencyLease, listEmergencyIdentityVerifications, listEmergencyNursingNotes,
  listEmergencyVitalSigns, recordEmergencyVitalSigns, verifyEmergencyIdentity,
  voidEmergencyNursingNote,
} from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import EmergencyPatientStrip from '../components/EmergencyPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'nursing', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_NURSING'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const commandLeaseQuery = useQuery({ queryKey: ['emergency', 'nursing', 'command-lease'], queryFn: () => issueEmergencyEncounterLease('EMERGENCY_NURSING_COMMAND'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'nursing', 'items'], queryFn: () => listEmergencyNursingNotes(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const identityQuery = useQuery({ queryKey: ['emergency', 'nursing', 'identity'], queryFn: () => listEmergencyIdentityVerifications(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const vitalsQuery = useQuery({ queryKey: ['emergency', 'nursing', 'vitals'], queryFn: () => listEmergencyVitalSigns(commandLeaseQuery.data.value!), enabled: () => Boolean(commandLeaseQuery.data.value), retry: false });
const allQueries = [leaseQuery, commandLeaseQuery, itemsQuery, identityQuery, vitalsQuery];
const issue = computed(() => { const failed = allQueries.find((query) => query.error.value); return failed ? toClinicalIssue(failed.error.value) : null; });
const pending = computed(() => allQueries.some((query) => query.isPending.value));
const items = computed(() => itemsQuery.data.value ?? []);
const currentItems = computed(() => items.value.filter((item) => !item.voided_at));
const riskCount = computed(() => currentItems.value.filter((item) => item.risk_flag).length);
const latestNote = computed(() => currentItems.value[0] ?? null);
const vitals = computed(() => vitalsQuery.data.value ?? []);
const latestVitals = computed(() => vitals.value[0] ?? null);
const latestVerification = computed(() => (identityQuery.data.value ?? []).find((item) => item.encounter_id === clinicalContext.emergencyEncounterId) ?? null);
const identityVerified = computed(() => { const item = latestVerification.value; return Boolean(item && item.outcome === 'MATCHED' && Date.now() - new Date(item.verified_at).getTime() <= 30 * 60_000); });

const form = reactive({ assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) });
const vitalForm = reactive({ recorded_at: new Date().toISOString().slice(0, 16), temperature: null as number | null, pulse: null as number | null, respiration: null as number | null, systolic_bp: null as number | null, diastolic_bp: null as number | null, spo2: null as number | null });
const scanForm = reactive({ identifier_value: '', verification_purpose: 'GENERAL' as 'MEDICATION' | 'INFUSION' | 'SPECIMEN' | 'TRANSFER' | 'GENERAL' });
const editorOpen = ref(false); const vitalsOpen = ref(false); const scanOpen = ref(false);
const editingTarget = ref<EmergencyNursingNoteWire | null>(null); const voidTarget = ref<EmergencyNursingNoteWire | null>(null);
const voidReason = ref(''); const busy = ref(''); const notice = ref('');

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function resetForm() { Object.assign(form, { assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) }); editingTarget.value = null; }
function openCreate() { resetForm(); editorOpen.value = true; }
function openEdit(item: EmergencyNursingNoteWire) { editingTarget.value = item; Object.assign(form, { assessment: item.assessment, intervention: item.intervention, risk_flag: item.risk_flag, recorded_at: new Date().toISOString().slice(0, 16) }); editorOpen.value = true; }
function openVitals() {
  if (!identityVerified.value) { notice.value = '录入生命体征前必须完成当前急诊就诊的30分钟内腕带核验。'; scanOpen.value = true; return; }
  Object.assign(vitalForm, { recorded_at: new Date().toISOString().slice(0, 16), temperature: null, pulse: null, respiration: null, systolic_bp: null, diastolic_bp: null, spo2: null }); vitalsOpen.value = true;
}
async function reload() { notice.value = ''; await Promise.all([itemsQuery.refetch(), identityQuery.refetch(), vitalsQuery.refetch()]); }
async function saveNote() {
  const lease = commandLeaseQuery.data.value; if (!lease || busy.value || !form.assessment.trim() || !form.intervention.trim()) return;
  busy.value = 'save'; notice.value = '';
  try { const input = { assessment: form.assessment.trim(), intervention: form.intervention.trim(), risk_flag: form.risk_flag, recorded_at: new Date(form.recorded_at).toISOString() }; if (editingTarget.value) await correctEmergencyNursingNote(lease, editingTarget.value, { ...input, reason: '护理记录内容更正' }); else await createEmergencyNursingNote(lease, input); notice.value = editingTarget.value ? '已生成更正版本，原记录仅作历史留痕。' : form.risk_flag ? '高危护理记录已保存并进入交接复核。' : '护理记录已保存。'; editorOpen.value = false; resetForm(); await itemsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}
async function saveVitals() {
  const lease = commandLeaseQuery.data.value; const hasMeasurement = [vitalForm.temperature, vitalForm.pulse, vitalForm.respiration, vitalForm.systolic_bp, vitalForm.diastolic_bp, vitalForm.spo2].some((value) => value !== null && value !== undefined);
  if (!lease || busy.value || !identityVerified.value || !hasMeasurement) return;
  busy.value = 'vitals'; notice.value = '';
  try { await recordEmergencyVitalSigns(lease, { ...vitalForm, recorded_at: new Date(vitalForm.recorded_at).toISOString(), source: 'MANUAL' }); notice.value = '生命体征已写入当前急诊就诊，将影响护理评估与交接。'; vitalsOpen.value = false; await vitalsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}
async function submitScan() {
  const lease = commandLeaseQuery.data.value; if (!lease || busy.value || scanForm.identifier_value.trim().length < 2) return;
  busy.value = 'scan'; notice.value = '';
  try { const result = await verifyEmergencyIdentity(lease, scanForm.identifier_value.trim(), scanForm.verification_purpose); scanForm.identifier_value = ''; await identityQuery.refetch(); if (result.outcome === 'MATCHED') { notice.value = `腕带核验通过（${result.masked_identifier}），30分钟内可执行当前就诊的床旁操作。`; scanOpen.value = false; } else notice.value = result.outcome === 'MISMATCHED' ? '腕带属于其他患者，已留存失败审计记录并阻断执行。' : '未找到该腕带，已留存失败审计记录并阻断执行。'; }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}
async function confirmVoid() {
  const lease = commandLeaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return;
  busy.value = 'void'; notice.value = '';
  try { await voidEmergencyNursingNote(lease, target, voidReason.value.trim()); notice.value = '护理记录已逻辑作废，不再计入风险与交接流程。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-head"><div class="page-title"><h1>急诊护理、输液与执行</h1><p>真实腕带核验、生命体征、护理记录和床旁安全门禁</p></div><div class="head-actions"><button class="btn" type="button" @click="scanOpen=true">扫描腕带</button><button class="btn" type="button" @click="openVitals">录入生命体征</button><button class="btn primary" type="button" @click="openCreate">新增护理记录</button></div></div>
    <ClinicalPageState v-if="pending" kind="loading" message="正在读取护理事实、腕带核验和生命体征" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else>
      <EmergencyPatientStrip /><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="metric-grid emergency-metrics"><div class="metric"><div class="name">腕带核验</div><div class="value" :class="identityVerified?'success-text':'danger-text'">{{ identityVerified ? '有效' : '待核验' }}</div><div class="trend">{{ latestVerification ? `${latestVerification.outcome} · ${formatDate(latestVerification.verified_at)}` : '尚无核验记录' }}</div></div><div class="metric"><div class="name">生命体征记录</div><div class="value">{{ vitals.length }}</div><div class="trend">{{ latestVitals ? formatDate(latestVitals.recorded_at) : '待录入' }}</div></div><div class="metric"><div class="name">护理高危事实</div><div class="value" :class="riskCount?'danger-text':''">{{ riskCount }}</div><div class="trend">直接驱动交接复核</div></div><div class="metric"><div class="name">有效护理记录</div><div class="value">{{ currentItems.length }}</div><div class="trend">更正与作废均留痕</div></div></div>
      <div class="grid secondary-grid emergency-prototype-layout">
        <section class="card scroll-card emergency-prototype-main"><div class="card-head">护理执行轴 <span class="sub">患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }}</span></div><div v-if="!items.length" class="clinical-empty-state rich"><strong>暂无护理记录</strong><p>记录危重评估、护理干预与执行结果。</p><button class="btn primary" @click="openCreate">新增护理记录</button></div><div v-else class="admin-table-wrap"><table class="table emergency-compact-table"><thead><tr><th>时间</th><th>危重评估</th><th>护理干预 / 结果</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in items" :key="item.note_id" :class="{'is-voided':item.voided_at}"><td>{{ formatDate(item.recorded_at) }}</td><td><b>{{ item.assessment }}</b></td><td>{{ item.intervention }}</td><td><span class="status" :class="item.voided_at?'gray':item.risk_flag?'red':'green'">{{ item.voided_at?'已作废':item.risk_flag?'高危待复核':'已记录' }}</span></td><td><span class="inline-actions"><button class="btn sm" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="openEdit(item)">编辑/更正</button><button class="btn sm danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div></section>
        <aside class="card scroll-card emergency-prototype-side"><div class="card-head">生命体征与床旁门禁</div><div class="card-body"><div class="trend-grid"><div class="trend-card"><span>体温</span><b>{{ latestVitals?.temperature ?? '—' }}</b><small>℃</small></div><div class="trend-card"><span>脉搏</span><b>{{ latestVitals?.pulse ?? '—' }}</b><small>次/分</small></div><div class="trend-card"><span>血压</span><b>{{ latestVitals ? `${latestVitals.systolic_bp ?? '—'}/${latestVitals.diastolic_bp ?? '—'}` : '—' }}</b><small>mmHg</small></div><div class="trend-card"><span>SpO₂</span><b>{{ latestVitals?.spo2 ?? '—' }}</b><small>%</small></div></div><div class="notice hard"><div class="notice-title">真实执行门禁</div>生命体征录入要求当前急诊就诊30分钟内腕带匹配成功；错腕带和未登记腕带均留存失败审计。</div><div class="notice info"><div class="notice-title">管路与输液</div>未获得结构化管路/输液事实时不显示猜测状态；当前最新护理干预：{{ latestNote?.intervention ?? '无' }}。</div></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="scanOpen" title="扫描急诊腕带" description="输入或扫描腕带标识；只保存脱敏结果和哈希比对证据。" eyebrow="急诊 / 身份核验" :busy="busy==='scan'"><form class="admin-form" @submit.prevent="submitScan"><label><span>腕带标识</span><input v-model="scanForm.identifier_value" autocomplete="off" autofocus required minlength="2" placeholder="请扫描腕带" /></label><label><span>核验目的</span><select v-model="scanForm.verification_purpose"><option value="GENERAL">一般床旁操作</option><option value="MEDICATION">给药</option><option value="INFUSION">输液</option><option value="SPECIMEN">标本</option><option value="TRANSFER">转运</option></select></label><button class="button primary" :disabled="Boolean(busy)||scanForm.identifier_value.trim().length<2">{{ busy==='scan'?'正在核验…':'核验并留存证据' }}</button></form></AdminActionDialog>
    <AdminActionDialog v-model:open="vitalsOpen" title="录入生命体征" description="已通过当前急诊就诊的腕带核验；至少录入一项测量。" eyebrow="急诊 / 床旁执行" :busy="busy==='vitals'"><form class="admin-form" @submit.prevent="saveVitals"><label><span>测量时间</span><input v-model="vitalForm.recorded_at" type="datetime-local" required /></label><div class="admin-form-grid"><label><span>体温 ℃</span><input v-model.number="vitalForm.temperature" type="number" min="25" max="45" step="0.1" /></label><label><span>脉搏 次/分</span><input v-model.number="vitalForm.pulse" type="number" min="0" max="300" /></label><label><span>呼吸 次/分</span><input v-model.number="vitalForm.respiration" type="number" min="0" max="100" /></label><label><span>收缩压 mmHg</span><input v-model.number="vitalForm.systolic_bp" type="number" min="0" max="300" /></label><label><span>舒张压 mmHg</span><input v-model.number="vitalForm.diastolic_bp" type="number" min="0" max="200" /></label><label><span>SpO₂ %</span><input v-model.number="vitalForm.spo2" type="number" min="0" max="100" step="0.1" /></label></div><button class="button primary" :disabled="Boolean(busy)||!identityVerified">{{ busy==='vitals'?'正在保存…':'验证并写入就诊' }}</button></form></AdminActionDialog>
    <AdminActionDialog v-model:open="editorOpen" :title="editingTarget?'编辑护理记录并生成更正版本':'新建护理记录'" description="评估与干预均为必填；高危记录将直接进入交接复核统计。" eyebrow="急诊 / 护理执行" size="large" :busy="busy==='save'" @update:open="!$event&&resetForm()"><form class="admin-form" @submit.prevent="saveNote"><label><span>危重评估</span><textarea v-model="form.assessment" rows="3" autofocus required placeholder="神志、生命体征、疼痛、出血风险" /></label><label><span>护理干预 / 输液执行</span><textarea v-model="form.intervention" rows="3" required placeholder="开放静脉通路、补液、给药、监测" /></label><label><span>记录时间</span><input v-model="form.recorded_at" type="datetime-local" required /></label><label class="risk-confirm"><input v-model="form.risk_flag" type="checkbox" /><span>存在危险信号（需交接与复核）</span></label><button class="button primary" :disabled="Boolean(busy)||!form.assessment.trim()||!form.intervention.trim()">{{ busy==='save'?'正在保存…':'验证并保存' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除护理记录" description="删除执行为逻辑作废；该记录将退出高危统计与后续交接流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
