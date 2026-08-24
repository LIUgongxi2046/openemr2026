<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { ReferralWire } from '../../generated/contracts';
import { createReferral, issueEmergencyLease, listReferrals, transitionReferral } from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['opd-consult', 'lease'],
  queryFn: () => issueEmergencyLease('OPD_CONSULT'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['opd-consult', 'referrals'],
  queryFn: () => listReferrals(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);

const form = reactive({
  referral_type: 'INTERNAL' as 'INTERNAL' | 'EXTERNAL',
  target_department: '',
  target_organization: '',
  reason: '',
  clinical_summary: '',
});
const busy = ref<string>('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await itemsQuery.refetch();
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.reason.trim() || !form.clinical_summary.trim()) return;
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
    form.reason = ''; form.clinical_summary = ''; form.target_department = ''; form.target_organization = '';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function transition(referral: ReferralWire, action: 'SEND' | 'ACCEPT' | 'REJECT') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = referral.referral_id; notice.value = '';
  try {
    await transitionReferral(lease, referral, action);
    notice.value = `转诊已${action === 'SEND' ? '发送' : action === 'ACCEPT' ? '接受' : '拒绝'}。`;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 门急诊</p>
        <h1>门诊会诊、转诊与协同</h1>
        <p>院内科间会诊与院外转诊统一走转诊状态机：草稿 → 发送 → 接受/拒绝；附临床摘要与转诊原因，全程审计可溯。</p>
      </div>
      <RouterLink class="button secondary" to="/outpatient">返回门诊</RouterLink>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取会诊与转诊记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="会诊转诊统计">
        <article><span>转诊记录</span><strong>{{ items.length }}</strong><small>患者 …{{ clinicalContext.patientId.slice(-8) }}</small></article>
        <article><span>待发送</span><strong>{{ items.filter((i) => i.status === 'DRAFT').length }}</strong><small>DRAFT</small></article>
        <article><span>已接受</span><strong>{{ items.filter((i) => i.status === 'ACCEPTED').length }}</strong><small>ACCEPTED</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
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
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'DRAFT'" @click="transition(referral, 'SEND')">发送</button>
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'SENT'" @click="transition(referral, 'ACCEPT')">接受</button>
                      <button class="task-action" :disabled="Boolean(busy) || referral.status !== 'SENT'" @click="transition(referral, 'REJECT')">拒绝</button>
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新建会诊 / 转诊</h2><p>原因与临床摘要为必填。</p></div></header>
          <form class="admin-form" @submit.prevent="create">
            <label><span>类型</span><select v-model="form.referral_type"><option value="INTERNAL">院内会诊 / 转科</option><option value="EXTERNAL">院外转诊</option></select></label>
            <label><span>目标科室</span><input v-model="form.target_department" placeholder="例：心血管内科" /></label>
            <label><span>目标机构</span><input v-model="form.target_organization" placeholder="院外转诊时填写" /></label>
            <label><span>转诊 / 会诊原因</span><textarea v-model="form.reason" rows="2" required placeholder="例：胸痛待排，需心血管会诊" /></label>
            <label><span>临床摘要</span><textarea v-model="form.clinical_summary" rows="3" required placeholder="病情摘要、已做检查与用药" /></label>
            <button class="button primary full" :disabled="Boolean(busy) || !form.reason.trim() || !form.clinical_summary.trim()">{{ busy === 'create' ? '正在建立…' : '建立转诊/会诊' }}</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
