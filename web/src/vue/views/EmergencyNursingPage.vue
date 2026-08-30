<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { EmergencyNursingNoteWire } from '../../generated/contracts';
import { correctEmergencyNursingNote, createEmergencyNursingNote, issueEmergencyEncounterLease, issueEmergencyLease, listEmergencyNursingNotes, voidEmergencyNursingNote } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import EmergencyPatientStrip from '../components/EmergencyPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'nursing', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_NURSING'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const commandLeaseQuery = useQuery({ queryKey: ['emergency', 'nursing', 'command-lease'], queryFn: () => issueEmergencyEncounterLease('EMERGENCY_NURSING_COMMAND'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'nursing', 'items'], queryFn: () => listEmergencyNursingNotes(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? commandLeaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? commandLeaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const currentItems = computed(() => items.value.filter((i) => !i.voided_at));
const riskCount = computed(() => currentItems.value.filter((i) => i.risk_flag).length);
const latestNote = computed(() => currentItems.value[0] ?? null);
const form = reactive({ assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) });
const editorOpen = ref(false);
const scanOpen = ref(false);
const editingTarget = ref<EmergencyNursingNoteWire | null>(null);
const voidTarget = ref<EmergencyNursingNoteWire | null>(null);
const voidReason = ref(''); const busy = ref(''); const notice = ref('');

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function resetForm() { Object.assign(form, { assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) }); editingTarget.value = null; }
function openCreate() { resetForm(); editorOpen.value = true; }
function openEdit(item: EmergencyNursingNoteWire) { editingTarget.value = item; Object.assign(form, { assessment: item.assessment, intervention: item.intervention, risk_flag: item.risk_flag, recorded_at: new Date().toISOString().slice(0, 16) }); editorOpen.value = true; }
async function reload() { notice.value = ''; await itemsQuery.refetch(); }
async function saveNote() { const lease = commandLeaseQuery.data.value; if (!lease || busy.value || !form.assessment.trim() || !form.intervention.trim()) return; busy.value = 'save'; notice.value = ''; try { const input = { assessment: form.assessment.trim(), intervention: form.intervention.trim(), risk_flag: form.risk_flag, recorded_at: new Date(form.recorded_at).toISOString() }; if (editingTarget.value) await correctEmergencyNursingNote(lease, editingTarget.value, { ...input, reason: '护理记录内容更正' }); else await createEmergencyNursingNote(lease, input); notice.value = editingTarget.value ? '护理记录已在单一事务中生成更正版本，原记录已逻辑作废。' : form.risk_flag ? '高危护理记录已保存并驱动交接复核。' : '护理记录已保存。'; editorOpen.value = false; resetForm(); await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = commandLeaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyNursingNote(lease, target, voidReason.value.trim()); notice.value = '护理记录已逻辑作废，不再计入风险与交接流程。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-head"><div class="page-title"><h1>急诊护理、输液与执行</h1><p>腕带核验、生命体征、用药输液、管路、抢救配合和转运交接</p></div><div class="head-actions"><button class="btn" @click="scanOpen=true">扫描腕带</button><button class="btn primary" @click="openCreate">新增护理记录</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || commandLeaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取急诊护理记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><EmergencyPatientStrip /><p v-if="notice" class="admin-notice">{{ notice }}</p>
      <div class="grid secondary-grid emergency-prototype-layout"><section class="card scroll-card emergency-prototype-main"><div class="card-head">急诊护理执行轴 <span class="sub">患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }}</span></div><div v-if="!items.length" class="clinical-empty-state rich"><strong>暂无护理记录</strong><p>记录危重评估、护理干预与输液执行。</p><button class="btn primary" @click="openCreate">新增护理记录</button></div><div v-else class="admin-table-wrap"><table class="table emergency-compact-table"><thead><tr><th>时间</th><th>危重评估</th><th>护理干预 / 结果</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in items" :key="item.note_id" :class="{'is-voided':item.voided_at}"><td>{{ formatDate(item.recorded_at) }}</td><td><b>{{ item.assessment }}</b></td><td>{{ item.intervention }}</td><td><span class="status" :class="item.voided_at?'gray':item.risk_flag?'red':'green'">{{ item.voided_at?'已作废':item.risk_flag?'高危待复核':'已记录' }}</span></td><td><span class="inline-actions"><button class="btn sm" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="openEdit(item)">编辑/更正</button><button class="btn sm danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div><div class="card-body"><div class="section-title">连续生命体征</div><div class="trend-grid"><div class="trend-card"><span>风险评估</span><b :class="{'danger-text':riskCount}">{{ riskCount ? '高危' : '稳定' }}</b><small>{{ riskCount }} 条高危事实</small></div><div class="trend-card"><span>记录数</span><b>{{ currentItems.length }}</b><small>有效护理记录</small></div><div class="trend-card"><span>交接状态</span><b>{{ riskCount ? '待复核' : '已确认' }}</b><small>由护理风险驱动</small></div><div class="trend-card"><span>最近记录</span><b>{{ latestNote ? formatDate(latestNote.recorded_at).split(' ').at(-1) : '—' }}</b><small>事件时间</small></div></div><div class="notice hard"><div class="notice-title">床旁复核</div>任何给药、输液、血制品和转运前都必须重新核对腕带、任务、药物/液体和执行者。</div></div></section>
        <aside class="card scroll-card emergency-prototype-side"><div class="card-head">管路、输液与转运</div><div class="card-body"><div class="section-title">管路</div><div v-for="line in [['左上肢静脉留置针','通畅','green'],['第二静脉通路',riskCount?'待建立':'已评估',riskCount?'amber':'green'],['鼻导管吸氧','按需执行','blue']]" :key="line[0]" class="queue-item"><div class="queue-title">{{ line[0] }}<span class="status" :class="line[2]">{{ line[1] }}</span></div></div><div class="section-title emergency-summary-title">当前输液与护理</div><div class="approval-box"><b>{{ latestNote?.intervention ?? '暂无正在执行的输液/护理记录' }}</b><p class="meta">{{ latestNote ? formatDate(latestNote.recorded_at) : '待录入' }} · 腕带核验后执行</p><button class="btn sm" @click="latestNote ? openEdit(latestNote) : openCreate()">记录速度调整</button></div><div class="notice rule"><div class="notice-title">转运前待完成</div>第二通路、药物执行双核、监护设备切换和接收护士确认。</div></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="scanOpen" title="扫描急诊腕带" description="床旁执行前必须核对患者、就诊和当前急诊上下文。" eyebrow="急诊 / 腕带核验"><div class="emergency-scan-result"><span aria-hidden="true">✓</span><div><b>腕带核验通过</b><p>患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }} · 就诊 …{{ clinicalContext.emergencyEncounterId.slice(-8) }}</p></div></div></AdminActionDialog>
    <AdminActionDialog v-model:open="editorOpen" :title="editingTarget?'编辑护理记录并生成更正版本':'新建护理记录'" description="评估与干预均为必填；高危记录将直接进入交接复核统计。" eyebrow="急诊 / 护理执行" size="large" :busy="busy==='save'" @update:open="!$event&&resetForm()"><form class="admin-form" @submit.prevent="saveNote"><label><span>危重评估</span><textarea v-model="form.assessment" rows="3" autofocus required placeholder="神志、生命体征、疼痛、出血风险" /></label><label><span>护理干预 / 输液执行</span><textarea v-model="form.intervention" rows="3" required placeholder="开放静脉通路、补液、给药、监测" /></label><label><span>记录时间</span><input v-model="form.recorded_at" type="datetime-local" required /></label><label class="risk-confirm"><input v-model="form.risk_flag" type="checkbox" /><span>存在危险信号（需交接与复核）</span></label><button class="button primary" :disabled="Boolean(busy)||!form.assessment.trim()||!form.intervention.trim()">{{ busy==='save'?'正在保存…':'验证并保存' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除护理记录" description="删除执行为逻辑作废；该记录将退出高危统计与后续交接流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
