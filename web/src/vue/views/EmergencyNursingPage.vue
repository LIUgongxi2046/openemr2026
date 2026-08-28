<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { EmergencyNursingNoteWire } from '../../generated/contracts';
import { createEmergencyNursingNote, issueEmergencyLease, listEmergencyNursingNotes, voidEmergencyNursingNote } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'nursing', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_NURSING'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'nursing', 'items'], queryFn: () => listEmergencyNursingNotes(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const currentItems = computed(() => items.value.filter((i) => !i.voided_at));
const riskCount = computed(() => currentItems.value.filter((i) => i.risk_flag).length);
const form = reactive({ assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) });
const editorOpen = ref(false);
const editingTarget = ref<EmergencyNursingNoteWire | null>(null);
const voidTarget = ref<EmergencyNursingNoteWire | null>(null);
const voidReason = ref(''); const busy = ref(''); const notice = ref('');

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function resetForm() { Object.assign(form, { assessment: '', intervention: '', risk_flag: false, recorded_at: new Date().toISOString().slice(0, 16) }); editingTarget.value = null; }
function openCreate() { resetForm(); editorOpen.value = true; }
function openEdit(item: EmergencyNursingNoteWire) { editingTarget.value = item; Object.assign(form, { assessment: item.assessment, intervention: item.intervention, risk_flag: item.risk_flag, recorded_at: new Date().toISOString().slice(0, 16) }); editorOpen.value = true; }
async function reload() { notice.value = ''; await itemsQuery.refetch(); }
async function saveNote() { const lease = leaseQuery.data.value; if (!lease || busy.value || !form.assessment.trim() || !form.intervention.trim()) return; busy.value = 'save'; notice.value = ''; try { await createEmergencyNursingNote(lease, { assessment: form.assessment.trim(), intervention: form.intervention.trim(), risk_flag: form.risk_flag, recorded_at: new Date(form.recorded_at).toISOString() }); if (editingTarget.value) await voidEmergencyNursingNote(lease, editingTarget.value, '护理记录更正：已生成新版本'); notice.value = editingTarget.value ? '护理记录更正版本已保存，原记录已逻辑作废。' : form.risk_flag ? '高危护理记录已保存并驱动交接复核。' : '护理记录已保存。'; editorOpen.value = false; resetForm(); await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = leaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyNursingNote(lease, target, voidReason.value.trim()); notice.value = '护理记录已逻辑作废，不再计入风险与交接流程。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 急诊</p><h1>急诊护理、输液与执行</h1><p>高危评估驱动交接与复核；编辑生成更正版本，删除采用逻辑作废并保留证据。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/emergency">返回工作台</RouterLink><button class="button primary" @click="openCreate">新建护理记录</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取急诊护理记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><section class="admin-metrics"><article><span>有效护理记录</span><strong>{{ currentItems.length }}</strong><small>患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }}</small></article><article><span>高危记录</span><strong>{{ riskCount }}</strong><small>驱动交接复核</small></article></section><p v-if="notice" class="admin-notice">{{ notice }}</p>
      <section class="admin-panel"><header><div><h2>护理记录台账</h2><p>原始评估与干预不可直接篡改，更正使用新版本。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header><div v-if="!items.length" class="admin-empty rich"><strong>暂无护理记录</strong><p>记录危重评估、护理干预与输液执行。</p><button class="button primary" @click="openCreate">新建护理记录</button></div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>时间</th><th>危重评估</th><th>护理干预 / 输液</th><th>风险</th><th>操作</th></tr></thead><tbody><tr v-for="item in items" :key="item.note_id" :class="{'is-voided':item.voided_at}"><td>{{ formatDate(item.recorded_at) }}</td><td>{{ item.assessment }}</td><td>{{ item.intervention }}</td><td><span class="admin-status" :class="item.voided_at?'muted':item.risk_flag?'danger':'muted'">{{ item.voided_at?'已作废':item.risk_flag?'高危':'常规' }}</span></td><td><span class="inline-actions"><button class="task-action" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="openEdit(item)">编辑/更正</button><button class="task-action danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div></section>
    </template>
    <AdminActionDialog v-model:open="editorOpen" :title="editingTarget?'编辑护理记录并生成更正版本':'新建护理记录'" description="评估与干预均为必填；高危记录将直接进入交接复核统计。" eyebrow="急诊 / 护理执行" size="large" :busy="busy==='save'" @update:open="!$event&&resetForm()"><form class="admin-form" @submit.prevent="saveNote"><label><span>危重评估</span><textarea v-model="form.assessment" rows="3" autofocus required placeholder="神志、生命体征、疼痛、出血风险" /></label><label><span>护理干预 / 输液执行</span><textarea v-model="form.intervention" rows="3" required placeholder="开放静脉通路、补液、给药、监测" /></label><label><span>记录时间</span><input v-model="form.recorded_at" type="datetime-local" required /></label><label class="risk-confirm"><input v-model="form.risk_flag" type="checkbox" /><span>存在危险信号（需交接与复核）</span></label><button class="button primary" :disabled="Boolean(busy)||!form.assessment.trim()||!form.intervention.trim()">{{ busy==='save'?'正在保存…':'验证并保存' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除护理记录" description="删除执行为逻辑作废；该记录将退出高危统计与后续交接流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
