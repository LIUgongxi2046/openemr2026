<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import { createEmergencyTriageAssessment, issueEmergencyLease, listEmergencyTriageAssessments } from '../../api/emergency';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['emergency', 'triage', 'lease'],
  queryFn: () => issueEmergencyLease('EMERGENCY_TRIAGE'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['emergency', 'triage', 'items'],
  queryFn: () => listEmergencyTriageAssessments(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const activeCount = computed(() => items.value.filter((i) => i.status === 'ACTIVE').length);

const levelLabels: Record<string, string> = {
  LEVEL_1: '一级 · 濒危', LEVEL_2: '二级 · 危重', LEVEL_3: '三级 · 急症', LEVEL_4: '四级 · 非急症',
};

const form = reactive({
  triage_level: 'LEVEL_3' as 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4',
  chief_complaint: '',
  immediate_action_required: false,
  triaged_at: new Date().toISOString().slice(0, 16),
});
const busy = ref(false);
const notice = ref('');

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value));
}

async function reload() {
  notice.value = '';
  await itemsQuery.refetch();
}

async function createAssessment() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.chief_complaint.trim()) return;
  busy.value = true; notice.value = '';
  try {
    await createEmergencyTriageAssessment(lease, {
      triage_level: form.triage_level,
      chief_complaint: form.chief_complaint.trim(),
      triaged_at: new Date(form.triaged_at).toISOString(),
      immediate_action_required: form.immediate_action_required,
    });
    notice.value = `已按${levelLabels[form.triage_level]}完成分诊，旧评估自动置为 SUPERSEDED。`;
    form.chief_complaint = '';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = false; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">临床工作域 / 急诊</p>
        <h1>急诊预检分诊</h1>
        <p>按「一级濒危 / 二级危重 / 三级急症 / 四级非急症」四级分诊硬门；分诊结果驱动分区与立即处置判断，历史评估只读保留。</p>
      </div>
      <RouterLink class="button secondary" to="/emergency">返回急诊工作台</RouterLink>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取分诊评估" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="分诊统计">
        <article><span>分诊评估</span><strong>{{ items.length }}</strong><small>患者 …{{ clinicalContext.patientId.slice(-8) }}</small></article>
        <article><span>当前生效</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>分诊台账</h2><p>新评估生效后旧评估置为 SUPERSEDED。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header>
          <div v-if="!items.length" class="admin-empty" role="status">暂无分诊评估，可在右侧录入首次分诊。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>分级</th><th>主诉</th><th>分诊时间</th><th>立即处置</th><th>状态</th></tr></thead>
              <tbody>
                <tr v-for="item in items" :key="item.triage_assessment_id">
                  <td><strong>{{ levelLabels[item.triage_level] ?? item.triage_level }}</strong></td>
                  <td>{{ item.chief_complaint }}</td>
                  <td>{{ formatDate(item.triaged_at) }}</td>
                  <td><span class="admin-status" :class="item.immediate_action_required ? 'danger' : 'muted'">{{ item.immediate_action_required ? '需立即处置' : '常规流程' }}</span></td>
                  <td><span class="admin-status" :class="item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '生效' : '已替换' }}</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>录入分诊评估</h2><p>主诉必填；一级/二级建议勾选立即处置。</p></div></header>
          <form class="admin-form" @submit.prevent="createAssessment">
            <label><span>分诊分级</span>
              <select v-model="form.triage_level">
                <option value="LEVEL_1">一级 · 濒危</option>
                <option value="LEVEL_2">二级 · 危重</option>
                <option value="LEVEL_3">三级 · 急症</option>
                <option value="LEVEL_4">四级 · 非急症</option>
              </select>
            </label>
            <label><span>主诉</span><textarea v-model="form.chief_complaint" rows="4" required placeholder="例：胸痛伴大汗 30 分钟" /></label>
            <label><span>分诊时间</span><input v-model="form.triaged_at" type="datetime-local" required /></label>
            <label class="risk-confirm"><input v-model="form.immediate_action_required" type="checkbox" /><span>需要立即抢救/处置</span></label>
            <button class="button primary full" :disabled="busy || !form.chief_complaint.trim()">{{ busy ? '正在保存…' : '保存分诊评估' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
