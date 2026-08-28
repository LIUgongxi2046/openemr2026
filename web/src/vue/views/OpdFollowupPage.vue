<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { OutpatientFollowupWire } from '../../generated/contracts';
import {
  completeOutpatientFollowup,
  createOutpatientFollowup,
  issueFollowupEncounterLease,
  issueFollowupPatientLease,
  listOutpatientFollowups,
} from '../../api/outpatient-followup';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import { toClinicalIssue } from '../clinical-error';

const patientLease = useQuery({
  queryKey: ['outpatient', 'followup', 'patient-lease'],
  queryFn: () => issueFollowupPatientLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const encounterLease = useQuery({
  queryKey: ['outpatient', 'followup', 'encounter-lease'],
  queryFn: () => issueFollowupEncounterLease(),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const followupsQuery = useQuery({
  queryKey: ['outpatient', 'followups'],
  queryFn: () => listOutpatientFollowups(patientLease.data.value!),
  enabled: () => Boolean(patientLease.data.value), retry: false,
});
const issue = computed(() => [patientLease.error.value, encounterLease.error.value, followupsQuery.error.value].find(Boolean)
  ? toClinicalIssue([patientLease.error.value, encounterLease.error.value, followupsQuery.error.value].find(Boolean)) : null);
const followups = computed(() => followupsQuery.data.value ?? []);
const pending = computed(() => followups.value.filter((f) => f.status === 'PENDING'));

const form = reactive({ followupType: 'FOLLOWUP', content: '', dueAt: '' });
const busy = ref('');
const notice = ref('');
const createOpen = ref(false);
const completeTarget = ref<OutpatientFollowupWire | null>(null);
const completeOutcome = ref('');

function typeLabel(value: OutpatientFollowupWire['followup_type']) {
  return value === 'EDUCATION' ? '健康教育' : value === 'REVISIT' ? '复诊' : '随访';
}
function formatDate(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}

async function create() {
  const lease = encounterLease.data.value;
  if (!lease || busy.value || !form.content.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createOutpatientFollowup(lease, {
      followup_type: form.followupType,
      content: form.content.trim(),
      due_at: form.dueAt ? new Date(form.dueAt).toISOString() : null,
    });
    form.content = ''; form.dueAt = '';
    createOpen.value = false;
    notice.value = '随访已登记（幂等 + 审计 + Outbox）。';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginComplete(followup: OutpatientFollowupWire) {
  completeTarget.value = followup;
  completeOutcome.value = '';
}

async function complete() {
  const followup = completeTarget.value;
  const lease = encounterLease.data.value;
  if (!lease || !followup || busy.value || !completeOutcome.value.trim()) return;
  busy.value = `complete:${followup.followup_id}`; notice.value = '';
  try {
    await completeOutpatientFollowup(lease, followup, completeOutcome.value.trim());
    notice.value = '随访已完成，结局留痕。';
    completeTarget.value = null; completeOutcome.value = '';
    await followupsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-head">
      <div class="page-title"><h1>门诊随访与终诊</h1><p>教育、复诊与随访登记；结局闭环由真实随访记录驱动</p></div>
      <div class="head-actions"><button class="btn" type="button" @click="followupsQuery.refetch()">刷新</button><button class="btn primary" type="button" @click="createOpen = true">登记随访</button></div>
    </div>

    <div v-if="patientLease.isPending.value || encounterLease.isPending.value || followupsQuery.isPending.value" class="card"><div class="card-body">正在读取随访记录…</div></div>
    <div v-else-if="issue" class="card"><div class="card-body">加载失败：{{ issue.code }} {{ issue.message }}</div></div>

    <template v-else>
      <div class="metric-grid" aria-label="随访指标">
        <div class="metric"><div class="name">随访记录</div><div class="value">{{ followups.length }}</div><div class="trend">当前患者</div></div>
        <div class="metric"><div class="name">待完成随访</div><div class="value">{{ pending.length }}</div><div class="trend">状态 PENDING</div></div>
        <div class="metric"><div class="name">已完成</div><div class="value">{{ followups.filter((f) => f.status === 'COMPLETED').length }}</div><div class="trend">结局留痕</div></div>
        <div class="metric"><div class="name">随访类型</div><div class="value">3</div><div class="trend">教育 / 复诊 / 随访</div></div>
      </div>

      <div v-if="notice" class="inline-notice" role="status">{{ notice }}</div>

      <section class="admin-panel">
          <header><div><h2>随访记录</h2><p>按患者聚合，结局不可改写。</p></div></header>
          <div v-if="followups.length === 0" class="empty-state"><span>随</span><p>暂无随访记录</p><small>在右侧登记</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>类型</th><th>内容</th><th>状态</th><th>计划时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="followup in followups" :key="followup.followup_id">
                  <td><span class="admin-status muted">{{ typeLabel(followup.followup_type) }}</span></td>
                  <td><strong>{{ followup.content }}</strong><small v-if="followup.outcome">{{ followup.outcome }}</small></td>
                  <td><span class="admin-status" :class="followup.status === 'COMPLETED' ? 'green' : 'amber'">{{ followup.status === 'COMPLETED' ? '已完成' : '待完成' }}</span></td>
                  <td>{{ formatDate(followup.due_at) }}</td>
                  <td><button v-if="followup.status === 'PENDING'" class="task-action" :disabled="Boolean(busy)" @click="beginComplete(followup)">{{ busy === `complete:${followup.followup_id}` ? '处理中…' : '填写结局' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <BusinessActionDialog :open="createOpen" title="登记随访计划" description="教育、复诊与随访计划将进入待办状态，并影响终诊闭环。" eyebrow="门诊随访终诊" confirm-label="登记随访" :busy="busy === 'create'" width="wide" @cancel="createOpen = false" @confirm="create">
          <div class="admin-form">
            <label><span>类型</span><select v-model="form.followupType"><option value="EDUCATION">健康教育</option><option value="REVISIT">复诊</option><option value="FOLLOWUP">随访</option></select></label>
            <label><span>内容</span><textarea v-model="form.content" rows="3" required placeholder="说明随访目标、观察指标、异常触发条件与责任人" /></label>
            <label><span>计划时间（可选）</span><input v-model="form.dueAt" type="datetime-local" /></label>
          </div>
      </BusinessActionDialog>

      <BusinessActionDialog :open="Boolean(completeTarget)" title="填写随访结局" description="结局确认后会将随访从待完成推进为已完成，不可静默覆盖。" eyebrow="门诊随访终诊" confirm-label="完成随访并留痕" :busy="Boolean(busy)" width="wide" @cancel="completeTarget = null" @confirm="complete"><p class="dialog-warning">{{ completeTarget?.content }}</p><label>随访结局<textarea v-model="completeOutcome" required minlength="2" maxlength="2000" rows="4" placeholder="记录患者反馈、复评结果、后续计划和红旗症状交代" /></label></BusinessActionDialog>
    </template>
  </section>
</template>
