<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { EmergencyTriageAssessmentWire } from '../../generated/contracts';
import { createEmergencyTriageAssessment, issueEmergencyLease, listEmergencyTriageAssessments, voidEmergencyTriageAssessment } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'triage', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_TRIAGE'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'triage', 'items'], queryFn: () => listEmergencyTriageAssessments(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const activeCount = computed(() => items.value.filter((i) => i.status === 'ACTIVE' && !i.voided_at).length);
const levelLabels: Record<string, string> = { LEVEL_1: '一级 · 濒危', LEVEL_2: '二级 · 危重', LEVEL_3: '三级 · 急症', LEVEL_4: '四级 · 非急症' };

const form = reactive({ triage_level: 'LEVEL_3' as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4', chief_complaint: '', immediate_action_required: false, triaged_at: new Date().toISOString().slice(0, 16) });
const editorOpen = ref(false);
const editingTarget = ref<EmergencyTriageAssessmentWire | null>(null);
const voidTarget = ref<EmergencyTriageAssessmentWire | null>(null);
const voidReason = ref('');
const busy = ref('');
const notice = ref('');

function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function resetForm() { Object.assign(form, { triage_level: 'LEVEL_3', chief_complaint: '', immediate_action_required: false, triaged_at: new Date().toISOString().slice(0, 16) }); editingTarget.value = null; }
function openCreate() { resetForm(); editorOpen.value = true; }
function openEdit(item: EmergencyTriageAssessmentWire) { editingTarget.value = item; Object.assign(form, { triage_level: item.triage_level, chief_complaint: item.chief_complaint, immediate_action_required: item.immediate_action_required, triaged_at: new Date(item.triaged_at).toISOString().slice(0, 16) }); editorOpen.value = true; }
async function reload() { notice.value = ''; await itemsQuery.refetch(); }

async function saveAssessment() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.chief_complaint.trim()) return;
  busy.value = 'save'; notice.value = '';
  try {
    await createEmergencyTriageAssessment(lease, { triage_level: form.triage_level, chief_complaint: form.chief_complaint.trim(), triaged_at: new Date(form.triaged_at).toISOString(), immediate_action_required: form.immediate_action_required });
    notice.value = editingTarget.value ? `已完成复评并生成新版${levelLabels[form.triage_level]}分诊，原评估只读保留。` : `已按${levelLabels[form.triage_level]}完成分诊。`;
    editorOpen.value = false; resetForm(); await itemsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}

async function confirmVoid() {
  const lease = leaseQuery.data.value; const target = voidTarget.value;
  if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return;
  busy.value = 'void'; notice.value = '';
  try { await voidEmergencyTriageAssessment(lease, target, voidReason.value.trim()); notice.value = '分诊评估已逻辑作废，不再影响当前分诊流程，历史审计仍保留。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 急诊</p><h1>急诊预检分诊</h1><p>四级分诊结果驱动分区与立即处置；复评生成新版本，作废只退出当前流程，不物理删除临床事实。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/emergency">返回工作台</RouterLink><button class="button primary" type="button" @click="openCreate">新建分诊</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取分诊评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else>
      <section class="admin-metrics" aria-label="分诊统计"><article><span>分诊评估</span><strong>{{ items.length }}</strong><small>患者 …{{ clinicalContext.emergencyPatientId.slice(-8) }}</small></article><article><span>当前生效</span><strong>{{ activeCount }}</strong><small>驱动候诊分区</small></article></section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <section class="admin-panel"><header><div><h2>分诊台账</h2><p>更正与作废均保留版本、审计和 Outbox 证据。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header>
        <div v-if="!items.length" class="admin-empty rich" role="status"><strong>暂无分诊评估</strong><p>录入首次分诊后，级别和立即处置标记会进入急诊流程。</p><button class="button primary" type="button" @click="openCreate">新建分诊</button></div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>分级</th><th>主诉</th><th>分诊时间</th><th>立即处置</th><th>状态</th><th>操作</th></tr></thead><tbody>
          <tr v-for="item in items" :key="item.triage_assessment_id" :class="{ 'is-voided': item.voided_at }"><td><strong>{{ levelLabels[item.triage_level] }}</strong></td><td>{{ item.chief_complaint }}</td><td>{{ formatDate(item.triaged_at) }}</td><td><span class="admin-status" :class="item.immediate_action_required ? 'danger' : 'muted'">{{ item.immediate_action_required ? '需立即处置' : '常规流程' }}</span></td><td><span class="admin-status" :class="item.voided_at ? 'muted' : item.status.toLowerCase()">{{ item.voided_at ? '已作废' : item.status === 'ACTIVE' ? '生效' : '历史版本' }}</span></td><td><span class="inline-actions"><button class="task-action" :disabled="Boolean(busy) || Boolean(item.voided_at)" @click="openEdit(item)">编辑/复评</button><button class="task-action danger" :disabled="Boolean(busy) || Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr>
        </tbody></table></div>
      </section>
    </template>

    <AdminActionDialog v-model:open="editorOpen" :title="editingTarget ? '编辑分诊并生成复评版本' : '新建分诊评估'" description="保存后立即影响急诊分区与处置流程；原始临床事实不会被覆盖。" eyebrow="急诊 / 预检分诊" :busy="busy==='save'" @update:open="!$event && resetForm()"><form class="admin-form" @submit.prevent="saveAssessment"><label><span>分诊分级</span><select v-model="form.triage_level"><option value="LEVEL_1">一级 · 濒危</option><option value="LEVEL_2">二级 · 危重</option><option value="LEVEL_3">三级 · 急症</option><option value="LEVEL_4">四级 · 非急症</option></select></label><label><span>主诉</span><textarea v-model="form.chief_complaint" rows="4" required placeholder="例：突发胸痛伴大汗 30 分钟" /></label><label><span>分诊时间</span><input v-model="form.triaged_at" type="datetime-local" required /></label><label class="risk-confirm"><input v-model="form.immediate_action_required" type="checkbox" /><span>需要立即抢救/处置</span></label><button class="button primary" :disabled="Boolean(busy) || !form.chief_complaint.trim()">{{ busy === 'save' ? '正在保存…' : '验证并保存' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除分诊评估" description="删除按医疗审计要求执行为逻辑作废；该评估将停止影响分诊流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event && (voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required placeholder="例：误选患者，记录无效" /></label></AdminConfirmDialog>
  </section>
</template>
