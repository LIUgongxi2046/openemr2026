<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { ReferralWire } from '../../generated/contracts';
import { createReferral, issueOutpatientPatientLease, listReferrals, listReferralTargets, transitionReferral, updateReferral } from '../../api/emergency';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['opd-consult', 'lease', clinicalContext.patientId, clinicalContext.encounterId],
  queryFn: () => issueOutpatientPatientLease('OPD_CONSULT'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['opd-consult', 'referrals', clinicalContext.patientId, clinicalContext.encounterId],
  queryFn: () => listReferrals(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const targetsQuery = useQuery({
  queryKey: ['opd-consult', 'targets', clinicalContext.facilityId],
  queryFn: () => listReferralTargets(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value ?? targetsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value ?? targetsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const targets = computed(() => targetsQuery.data.value ?? []);

const form = reactive({
  referral_type: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL',
  target_department: '',
  target_organization: '',
  reason: '',
  clinical_summary: '',
});
const busy = ref<string>('');
const notice = ref('');
const createOpen = ref(false);
const editTarget = ref<ReferralWire | null>(null);
const transitionTarget = ref<ReferralWire | null>(null);
const transitionAction = ref<'SEND' | 'ACCEPT' | 'REJECT' | 'CANCEL' | null>(null);
const formReady = computed(() => Boolean(
  form.reason.trim().length >= 2
  && form.clinical_summary.trim().length >= 4
  && (form.referral_type === 'INTERNAL' ? form.target_department : form.target_organization.trim()),
));

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await itemsQuery.refetch();
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !formReady.value) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createReferral(lease, {
      referral_type: form.referral_type,
      target_department: form.target_department.trim() || null,
      target_organization: form.target_organization.trim() || null,
      reason: form.reason.trim(),
      clinical_summary: form.clinical_summary.trim(),
    });
    notice.value = '转诊/会诊申请已建立（DRAFT），可发送给目标科室/机构。';
    createOpen.value = false;
    form.reason = ''; form.clinical_summary = ''; form.target_department = ''; form.target_organization = '';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

function beginCreate() {
  editTarget.value = null;
  form.referral_type = 'INTERNAL'; form.target_department = ''; form.target_organization = '';
  form.reason = ''; form.clinical_summary = '';
  createOpen.value = true;
}

function beginEdit(referral: ReferralWire) {
  editTarget.value = referral;
  form.referral_type = referral.referral_type;
  form.target_department = referral.target_department ?? '';
  form.target_organization = referral.target_organization ?? '';
  form.reason = referral.reason;
  form.clinical_summary = referral.clinical_summary;
  createOpen.value = true;
}

async function saveEdit() {
  const lease = leaseQuery.data.value;
  const target = editTarget.value;
  if (!lease || !target || busy.value || !formReady.value) return;
  busy.value = `edit:${target.referral_id}`; notice.value = '';
  try {
    await updateReferral(lease, target, {
      referral_type: form.referral_type,
      target_department: form.referral_type === 'INTERNAL' ? form.target_department.trim() : null,
      target_organization: form.referral_type === 'EXTERNAL' ? form.target_organization.trim() : null,
      reason: form.reason.trim(),
      clinical_summary: form.clinical_summary.trim(),
    });
    createOpen.value = false; editTarget.value = null;
    notice.value = '会诊/转诊草稿已更新，版本号与审计证据已递增。';
    await itemsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginTransition(referral: ReferralWire, action: 'SEND' | 'ACCEPT' | 'REJECT' | 'CANCEL') {
  transitionTarget.value = referral;
  transitionAction.value = action;
}

async function transition() {
  const referral = transitionTarget.value;
  const action = transitionAction.value;
  const lease = leaseQuery.data.value;
  if (!lease || !referral || !action || busy.value) return;
  busy.value = referral.referral_id; notice.value = '';
  try {
    await transitionReferral(lease, referral, action);
    notice.value = `转诊已${action === 'SEND' ? '发送' : action === 'ACCEPT' ? '接受' : action === 'REJECT' ? '拒绝' : '取消（逻辑删除）'}。`;
    transitionTarget.value = null; transitionAction.value = null;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 门急诊</p>
        <h1>门诊会诊、转诊与协同</h1>
        <p>院内科间会诊与院外转诊统一走转诊状态机：草稿 → 发送 → 接受/拒绝；附临床摘要与转诊原因，全程审计可溯。</p>
      </div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/outpatient">返回门诊</RouterLink><button class="button primary" @click="beginCreate">新建会诊 / 转诊</button></div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value || targetsQuery.isPending.value" kind="loading" message="正在读取会诊与转诊记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="会诊转诊统计">
        <article><span>转诊记录</span><strong>{{ items.length }}</strong><small>患者 …{{ clinicalContext.patientId.slice(-8) }}</small></article>
        <article><span>待发送</span><strong>{{ items.filter((i) => i.status === 'DRAFT').length }}</strong></article>
        <article><span>已接受</span><strong>{{ items.filter((i) => i.status === 'ACCEPTED').length }}</strong></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-panel">
          <header><div><h2>会诊 / 转诊台账</h2><p>草稿可发送，发送后可接受或拒绝。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header>
          <div v-if="!items.length" class="admin-empty" role="status">暂无会诊或转诊记录，可在右侧新建。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>类型</th><th>目标</th><th>原因</th><th>状态</th><th>发送时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="referral in items" :key="referral.referral_id">
                  <td><span class="admin-status" :class="referral.referral_type.toLowerCase()">{{ referral.referral_type === 'INTERNAL' ? '院内会诊' : '院外转诊' }}</span></td>
                  <td>{{ referral.target_department || referral.target_organization || '—' }}</td>
                  <td>{{ referral.reason }}</td>
                  <td><span class="admin-status" :class="referral.status.toLowerCase()">{{ referral.status }}</span></td>
                  <td>{{ formatDate(referral.sent_at) }}</td>
                  <td>
                    <span class="inline-actions">
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'DRAFT'" @click="beginTransition(referral, 'SEND')">发送</button>
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'DRAFT'" @click="beginEdit(referral)">编辑</button>
                      <button class="task-action danger" :disabled="Boolean(busy) || referral.status !== 'DRAFT'" @click="beginTransition(referral, 'CANCEL')">删除</button>
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'SENT'" @click="beginTransition(referral, 'ACCEPT')">接受</button>
                      <button class="task-action danger" :disabled="Boolean(busy) || referral.status !== 'SENT'" @click="beginTransition(referral, 'REJECT')">拒绝</button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <BusinessActionDialog :open="createOpen" :title="editTarget ? '编辑会诊 / 转诊草稿' : '新建会诊 / 转诊'" description="申请首先建立为草稿，发送后才进入目标科室或机构待办。" eyebrow="门诊会诊转诊" :confirm-label="editTarget ? '保存草稿修改' : '建立申请草稿'" :busy="busy === 'create' || busy.startsWith('edit:')" :confirm-disabled="!formReady" width="wide" @cancel="createOpen = false; editTarget = null" @confirm="editTarget ? saveEdit() : create()">
          <div class="admin-form">
            <label><span>类型</span><select v-model="form.referral_type"><option value="INTERNAL">院内会诊 / 转科</option><option value="EXTERNAL">院外转诊</option></select></label>
            <label v-if="form.referral_type === 'INTERNAL'"><span>目标科室</span><select v-model="form.target_department" required><option value="">请选择当前院区在效科室</option><option v-for="target in targets" :key="target.department_id" :value="target.display_name">{{ target.display_name }} · {{ target.department_code }}</option></select><small v-if="targets.length === 0">当前院区无在效会诊目标，已禁止手工伪造科室。</small></label>
            <label v-else><span>目标机构</span><input v-model="form.target_organization" required placeholder="例：江城市康复医院" /></label>
            <label><span>转诊 / 会诊原因</span><textarea v-model="form.reason" rows="2" required placeholder="例：胸痛待排，需心血管会诊" /></label>
            <label><span>临床摘要</span><textarea v-model="form.clinical_summary" rows="3" required placeholder="病情摘要、已做检查与用药" /></label>
          </div>
      </BusinessActionDialog>

      <BusinessActionDialog :open="Boolean(transitionTarget && transitionAction)" :title="transitionAction === 'SEND' ? '发送会诊 / 转诊' : transitionAction === 'ACCEPT' ? '接受会诊 / 转诊' : transitionAction === 'CANCEL' ? '删除会诊 / 转诊草稿' : '拒绝会诊 / 转诊'" :description="transitionAction === 'CANCEL' ? '删除将执行为带审计的逻辑取消，不再进入下游待办。' : transitionAction === 'REJECT' ? '拒绝会保留申请与审计证据；申请人不能自行拒绝。' : transitionAction === 'ACCEPT' ? '必须由接诊医师独立接受，申请人不能自接；确认后会结清下游待办。' : '确认后将生成目标科室会诊响应待办。'" eyebrow="门诊会诊转诊" :confirm-label="transitionAction === 'SEND' ? '确认发送' : transitionAction === 'ACCEPT' ? '确认接受' : transitionAction === 'CANCEL' ? '确认删除并取消' : '确认拒绝'" :danger="transitionAction === 'REJECT' || transitionAction === 'CANCEL'" :busy="Boolean(busy)" @cancel="transitionTarget = null; transitionAction = null" @confirm="transition"><p class="dialog-warning">{{ transitionTarget?.reason }} · {{ transitionTarget?.target_department || transitionTarget?.target_organization }}</p></BusinessActionDialog>
    </template>
  </section>
</template>
