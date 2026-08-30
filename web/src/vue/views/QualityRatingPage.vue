<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import type { DepartmentSupportAssessmentWire } from '../../generated/contracts';
import {
  clinicalContext, createSpecialtySupportAssessment, deleteSpecialtySupportAssessment,
  issueSpecialtySupportLease, loadSpecialtySupportAssessments, updateSpecialtySupportAssessment,
} from '../../clinical-api';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const props = withDefaults(defineProps<{ assessmentId?: string }>(), { assessmentId: '' });
const route = useRoute(); const router = useRouter();
const leaseQuery = useQuery({ queryKey: ['quality', 'rating', 'lease'], queryFn: () => issueSpecialtySupportLease(), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const assessmentsQuery = useQuery({ queryKey: ['quality', 'rating', 'assessments'], queryFn: () => loadSpecialtySupportAssessments(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? assessmentsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? assessmentsQuery.error.value) : null);
const assessments = computed(() => assessmentsQuery.data.value ?? []);
const visibleAssessments = computed(() => props.assessmentId ? assessments.value.filter((item) => item.department_support_assessment_id === props.assessmentId) : assessments.value);
const generalAvailable = computed(() => assessments.value.filter((a) => a.support_level === 'GENERAL_AVAILABLE').length);
const pending = computed(() => assessments.value.filter((a) => ['PACK_PENDING', 'UNSUPPORTED'].includes(a.support_level)).length);
const evidenceGaps = computed(() => assessments.value.filter((a) => a.missing_safety_gates.length > 0).length);
const editorOpen = ref(false); const deleteOpen = ref(false); const editing = ref<DepartmentSupportAssessmentWire | null>(null);
const deleting = ref<DepartmentSupportAssessmentWire | null>(null); const busy = ref(''); const notice = ref('');
const form = reactive({ departmentId: clinicalContext.departmentId, scope: '', level: 'PACK_PENDING', packReleaseId: '', evidenceHash: '', gates: '', expiresAt: '' });

function levelLabel(level: string) {
  return ({ GENERAL_AVAILABLE: '通用可用', BASIC_CLOSED_LOOP: '基础闭环', PACK_PENDING: '能力包待配', UNSUPPORTED: '不支持' } as Record<string, string>)[level] ?? level;
}
function localDate(value: string | null) {
  if (!value) return ''; const date = new Date(value); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function reset(item?: DepartmentSupportAssessmentWire) {
  editing.value = item ?? null; form.departmentId = item?.department_id ?? clinicalContext.departmentId; form.scope = item?.clinical_scope_code ?? '';
  form.level = item?.support_level ?? 'PACK_PENDING'; form.packReleaseId = item?.pack_release_id ?? ''; form.evidenceHash = item?.evidence_bundle_hash ?? '';
  form.gates = item?.missing_safety_gates.join(', ') ?? 'EVIDENCE_REVIEW'; form.expiresAt = localDate(item?.expires_at ?? null);
}
function openCreate() { reset(); notice.value = ''; editorOpen.value = true; }
function openEdit(item: DepartmentSupportAssessmentWire) { reset(item); notice.value = ''; editorOpen.value = true; }
function requestDelete(item: DepartmentSupportAssessmentWire) { deleting.value = item; deleteOpen.value = true; }
function payload() {
  return {
    support_level: form.level as 'GENERAL_AVAILABLE' | 'BASIC_CLOSED_LOOP' | 'PACK_PENDING' | 'UNSUPPORTED',
    pack_release_id: form.packReleaseId.trim() || null, evidence_bundle_hash: form.evidenceHash.trim().toLowerCase() || null,
    missing_safety_gates: form.gates.split(',').map((value) => value.trim().toUpperCase()).filter(Boolean),
    expires_at: form.expiresAt ? new Date(form.expiresAt).toISOString() : null,
  };
}
async function save() {
  const lease = leaseQuery.data.value; if (!lease || busy.value || !form.departmentId || !form.scope.trim()) return;
  busy.value = 'save'; notice.value = '';
  try {
    if (editing.value) await updateSpecialtySupportAssessment(lease, editing.value, payload());
    else await createSpecialtySupportAssessment(lease, form.departmentId, form.scope.trim().toUpperCase(), payload());
    notice.value = editing.value ? '评级证据已更新，支持等级已按安全门重新计算。' : '评级证据已建档并进入审计与 Outbox 证据链。';
    editorOpen.value = false; await assessmentsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function remove() {
  const lease = leaseQuery.data.value; const item = deleting.value; if (!lease || !item || busy.value) return;
  busy.value = 'delete'; notice.value = '';
  try { await deleteSpecialtySupportAssessment(lease, item); deleteOpen.value = false; deleting.value = null; notice.value = '评级声明已撤回，科室不再继承该支持等级。'; await assessmentsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
watch(() => route.query.create, (value) => {
  if (value !== '1') return;
  openCreate();
  void router.replace({ query: { ...route.query, create: undefined } });
}, { immediate: true });
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav v-if="$route.path.includes('/assessments')" class="quality-breadcrumb" aria-label="评级取证层级导航"><RouterLink to="/quality-center">医疗质量中心</RouterLink><span>/</span><RouterLink to="/quality-rating">评级取证</RouterLink><span>/</span><RouterLink to="/quality-rating/assessments">支持评估台账</RouterLink><template v-if="assessmentId"><span>/</span><b>评估详情</b></template></nav>
    <div class="page-heading admin-heading"><div><p class="eyebrow">质量与安全 / {{ assessmentId ? '四级评估详情' : '评级取证' }}</p><h1>医疗质量与电子病历评级看板</h1><p>39 项评价的功能、应用范围、四维数据质量和证据快照；未验证科室不能升级支持级别。</p></div><div class="toolbar-actions"><RouterLink v-if="!$route.path.includes('/assessments')" class="button secondary" to="/quality-rating/assessments">打开三级台账</RouterLink><RouterLink v-if="assessmentId" class="button secondary" to="/quality-rating/assessments">返回台账</RouterLink><button class="button primary" @click="openCreate">新建评级证据</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || assessmentsQuery.isPending.value" kind="loading" message="正在读取支持评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assessmentsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" :class="{ danger: notice.includes('：') }" role="status">{{ notice }}</p>
      <section class="admin-metrics" aria-label="支持等级统计"><article><span>项目映射</span><strong>{{ assessments.length }}</strong><small>实际已建档评估</small></article><article><span>有效应用达标</span><strong>{{ generalAvailable }}</strong><small>当前院区已验证</small></article><article><span>待整改</span><strong>{{ pending }}</strong><small>能力包或支持缺口</small></article><article><span>证据缺口</span><strong>{{ evidenceGaps }}</strong><small>缺失安全门</small></article></section>
      <section class="admin-panel"><header><div><h2>{{ assessmentId ? '支持评估详情' : '支持评估台账' }}</h2><p>证据哈希与缺失安全门决定评级，不得手工越级。</p></div><div class="toolbar-actions"><button class="button secondary" @click="assessmentsQuery.refetch()">刷新</button><button class="button primary" @click="openCreate">新建</button></div></header>
        <div v-if="visibleAssessments.length === 0" class="admin-empty">{{ assessmentId ? '未找到该评估，可能已撤回。' : '该院区暂无支持评估。' }}</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>科室 / 范围</th><th>支持等级</th><th>证据哈希</th><th>缺失安全门</th><th>有效期</th><th>操作</th></tr></thead><tbody><tr v-for="assessment in visibleAssessments" :key="assessment.department_support_assessment_id"><td><RouterLink :to="`/quality-rating/assessments/${assessment.department_support_assessment_id}`"><strong>{{ assessment.clinical_scope_code }}</strong></RouterLink><small>…{{ assessment.department_id.slice(-8) }}</small></td><td><span class="admin-status" :class="assessment.support_level.toLowerCase()">{{ levelLabel(assessment.support_level) }}</span></td><td><code>{{ assessment.evidence_bundle_hash ? assessment.evidence_bundle_hash.slice(0, 16) + '…' : '—' }}</code></td><td>{{ assessment.missing_safety_gates.length ? assessment.missing_safety_gates.join('、') : '无' }}</td><td>{{ assessment.expires_at ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(assessment.expires_at)) : '长期' }}</td><td class="admin-actions"><button class="task-action" @click="openEdit(assessment)">编辑</button><button class="task-action danger" @click="requestDelete(assessment)">删除</button></td></tr></tbody></table></div>
      </section>
    </template>
    <AdminActionDialog v-model:open="editorOpen" :title="editing ? '编辑评级证据' : '新建评级证据'" description="正向支持声明必须同时具备 64 位 SHA-256 证据哈希、无缺失安全门和未来到期时间。" size="large" :busy="busy === 'save'"><form class="admin-form quality-dialog-form" @submit.prevent="save"><label><span>科室 ID</span><input v-model="form.departmentId" required :disabled="Boolean(editing)" /></label><label><span>临床范围编码</span><input v-model="form.scope" required maxlength="96" :disabled="Boolean(editing)" /></label><label><span>支持等级</span><select v-model="form.level"><option value="GENERAL_AVAILABLE">通用可用</option><option value="BASIC_CLOSED_LOOP">基础闭环</option><option value="PACK_PENDING">能力包待配</option><option value="UNSUPPORTED">不支持</option></select></label><label><span>能力包发布 ID（可选）</span><input v-model="form.packReleaseId" /></label><label class="full-span"><span>证据包 SHA-256</span><input v-model="form.evidenceHash" minlength="64" maxlength="64" /></label><label class="full-span"><span>缺失安全门（逗号分隔）</span><input v-model="form.gates" /></label><label><span>证据到期时间</span><input v-model="form.expiresAt" type="datetime-local" /></label></form><template #footer="{ close }"><button class="button secondary" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" :disabled="busy === 'save'" @click="save">{{ busy === 'save' ? '保存中…' : '保存并重算支持等级' }}</button></template></AdminActionDialog>
    <AdminConfirmDialog v-model:open="deleteOpen" title="撤回评级支持声明" description="撤回后对应科室和临床范围不再继承该支持等级，审计与 Outbox 历史证据保留。" confirm-label="确认撤回" :busy="busy === 'delete'" @confirm="remove" />
  </section>
</template>

<style scoped>
.quality-breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#667085;font-size:13px}.quality-breadcrumb a{color:#245493;text-decoration:none}.quality-dialog-form{grid-template-columns:repeat(2,minmax(0,1fr))}.full-span{grid-column:1/-1}@media(max-width:640px){.quality-dialog-form{grid-template-columns:1fr}.full-span{grid-column:auto}}
</style>
