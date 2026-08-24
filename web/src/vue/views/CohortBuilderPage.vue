<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ResearchCohortWire } from '../../generated/contracts';
import { clinicalContext } from '../../clinical-api';
import {
  computeResearchCohortMember,
  defineResearchCohort,
  deactivateResearchCohort,
  issueDataLease,
  listResearchCohortMembers,
  listResearchCohortSnapshots,
  listResearchCohorts,
  recordResearchCohortSnapshot,
} from '../../api/data';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const status = ref('');
const selectedCohortId = ref('');

const leaseQuery = useQuery({
  queryKey: ['data', 'cohort-builder', 'lease'],
  queryFn: () => issueDataLease('COHORT_BUILDER_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const cohortsQuery = useQuery({
  queryKey: ['data', 'cohort-builder', 'cohorts', status],
  queryFn: () => listResearchCohorts(leaseQuery.data.value!, status.value || undefined),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const snapshotsQuery = useQuery({
  queryKey: ['data', 'cohort-builder', 'snapshots', selectedCohortId],
  queryFn: () => listResearchCohortSnapshots(leaseQuery.data.value!, selectedCohortId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedCohortId.value),
  retry: false,
});
const membersQuery = useQuery({
  queryKey: ['data', 'cohort-builder', 'members', selectedCohortId],
  queryFn: () => listResearchCohortMembers(leaseQuery.data.value!, selectedCohortId.value),
  enabled: () => Boolean(leaseQuery.data.value && selectedCohortId.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? cohortsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? cohortsQuery.error.value) : null);
const cohorts = computed(() => cohortsQuery.data.value ?? []);
const snapshots = computed(() => snapshotsQuery.data.value ?? []);
const members = computed(() => membersQuery.data.value ?? []);
const selectedCohort = computed(() => cohorts.value.find((cohort) => cohort.research_cohort_id === selectedCohortId.value) ?? null);
const activeCount = computed(() => cohorts.value.filter((cohort) => cohort.status === 'ACTIVE').length);
const detailIssue = computed(() => (snapshotsQuery.error.value ?? membersQuery.error.value)
  ? toClinicalIssue(snapshotsQuery.error.value ?? membersQuery.error.value) : null);

const form = reactive({ cohortCode: '', cohortName: '', inclusionCriteria: '', exclusionCriteria: '' });
const snapshotForm = reactive({ memberCount: 0 });
const memberForm = reactive({ patientId: clinicalContext.patientId });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() {
  notice.value = '';
  await cohortsQuery.refetch();
}

async function selectCohort(cohortId: string) {
  selectedCohortId.value = cohortId;
  notice.value = '';
  if (cohortId) await Promise.all([snapshotsQuery.refetch(), membersQuery.refetch()]);
}

async function createCohort() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.cohortCode.trim() || !form.cohortName.trim() || !form.inclusionCriteria.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await defineResearchCohort(lease, {
      cohort_code: form.cohortCode.trim(),
      cohort_name: form.cohortName.trim(),
      inclusion_criteria: form.inclusionCriteria.trim(),
      exclusion_criteria: form.exclusionCriteria.trim() ? form.exclusionCriteria.trim() : undefined,
    });
    form.cohortCode = ''; form.cohortName = ''; form.inclusionCriteria = ''; form.exclusionCriteria = '';
    notice.value = '研究队列已定义，审计链与事件出箱已同步记录。';
    await cohortsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(cohort: ResearchCohortWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || cohort.status !== 'ACTIVE') return;
  busy.value = cohort.research_cohort_id; notice.value = '';
  try {
    await deactivateResearchCohort(lease, cohort);
    notice.value = `队列 ${cohort.cohort_name} 已停用。`;
    await cohortsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function recordSnapshot() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedCohortId.value) return;
  busy.value = 'snapshot'; notice.value = '';
  try {
    await recordResearchCohortSnapshot(lease, {
      research_cohort_id: selectedCohortId.value,
      member_count: snapshotForm.memberCount,
      computed_at: new Date().toISOString(),
    });
    notice.value = '队列快照已记录，判据哈希已生成。';
    await snapshotsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function computeMember() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedCohortId.value || !memberForm.patientId.trim()) return;
  busy.value = 'member'; notice.value = '';
  try {
    await computeResearchCohortMember(lease, {
      research_cohort_id: selectedCohortId.value,
      patient_id: memberForm.patientId.trim(),
      computed_at: new Date().toISOString(),
    });
    notice.value = '患者成员已计算并加入队列。';
    await membersQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 科研</p>
        <h1>研究队列构建器</h1>
        <p>定义入排判据的研究队列，记录成员快照与判据哈希，并计算符合入排标准的患者成员；停用不物理删除。</p>
      </div>
      <div class="admin-inline-tools">
        <label class="admin-code-input"><span>状态筛选</span>
          <select v-model="status"><option value="">全部状态</option><option value="ACTIVE">有效</option><option value="INACTIVE">已停用</option></select>
        </label>
        <button class="button secondary" :disabled="Boolean(busy)" @click="reload">查询</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || cohortsQuery.isPending.value" kind="loading" message="正在读取研究队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="队列统计">
        <article><span>队列总数</span><strong>{{ cohorts.length }}</strong><small>当前筛选</small></article>
        <article><span>有效队列</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
        <article><span>快照数</span><strong>{{ selectedCohort ? snapshots.length : 0 }}</strong><small>{{ selectedCohort ? selectedCohort.cohort_code : '未选择' }}</small></article>
        <article><span>成员数</span><strong>{{ selectedCohort ? members.length : 0 }}</strong><small>{{ selectedCohort ? selectedCohort.cohort_code : '未选择' }}</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>队列台账</h2><p>选择队列后可在下方查看快照与成员。</p></div>
            <button class="button secondary" @click="cohortsQuery.refetch()">刷新</button>
          </header>
          <div v-if="cohorts.length === 0" class="admin-empty" role="status">暂无研究队列，可在右侧定义。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>队列编码</th><th>名称</th><th>入排判据</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="cohort in cohorts" :key="cohort.research_cohort_id">
                  <td><code>{{ cohort.cohort_code }}</code></td>
                  <td><strong>{{ cohort.cohort_name }}</strong><small>…{{ cohort.research_cohort_id.slice(-8) }}</small></td>
                  <td class="admin-criteria"><small>入组：{{ cohort.inclusion_criteria }}</small><small v-if="cohort.exclusion_criteria">排除：{{ cohort.exclusion_criteria }}</small></td>
                  <td><span class="admin-status" :class="cohort.status.toLowerCase()">{{ cohort.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td class="admin-actions">
                    <button class="task-action" :disabled="Boolean(busy)" @click="selectCohort(cohort.research_cohort_id)">详情</button>
                    <button class="task-action" :disabled="cohort.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(cohort)">{{ busy === cohort.research_cohort_id ? '处理中…' : '停用' }}</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>定义队列</h2><p>队列编码、名称与入组判据必填，排除判据可选。</p></div></header>
          <form class="admin-form" @submit.prevent="createCohort">
            <label><span>队列编码</span><input v-model="form.cohortCode" maxlength="96" required placeholder="例：COHORT-DM2-2026" /></label>
            <label><span>队列名称</span><input v-model="form.cohortName" maxlength="256" required placeholder="例：2 型糖尿病队列" /></label>
            <label><span>入组判据</span><textarea v-model="form.inclusionCriteria" required placeholder="例：诊断为 2 型糖尿病且年龄 ≥ 18" /></label>
            <label><span>排除判据（可选）</span><textarea v-model="form.exclusionCriteria" placeholder="例：妊娠期糖尿病" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在定义…' : '定义并生效' }}</button>
          </form>
        </section>
      </div>

      <section v-if="selectedCohort" class="admin-panel">
        <header>
          <div><h2>快照与成员 · {{ selectedCohort.cohort_code }}</h2><p>快照记录成员数与判据哈希；成员由患者入排计算得出。</p></div>
          <button class="button secondary" @click="selectCohort('')">关闭</button>
        </header>
        <ClinicalPageState v-if="snapshotsQuery.isPending.value || membersQuery.isPending.value" kind="loading" message="正在读取队列快照与成员" />
        <ClinicalPageState v-else-if="detailIssue" kind="error" :code="detailIssue.code" :message="detailIssue.message" @retry="snapshotsQuery.refetch()" />
        <div v-else class="admin-layout">
          <section>
            <h3>成员快照</h3>
            <div v-if="snapshots.length === 0" class="admin-empty" role="status">暂无快照，可在右侧记录。</div>
            <div v-else class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr><th>成员数</th><th>判据哈希</th><th>计算时间</th></tr></thead>
                <tbody>
                  <tr v-for="snapshot in snapshots" :key="snapshot.research_cohort_snapshot_id">
                    <td>{{ snapshot.member_count }}</td>
                    <td><code>{{ snapshot.criteria_hash }}</code></td>
                    <td>{{ formatDate(snapshot.computed_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <h3>成员列表</h3>
            <div v-if="members.length === 0" class="admin-empty" role="status">暂无成员，可在右侧计算。</div>
            <div v-else class="admin-table-wrap">
              <table class="admin-table">
                <thead><tr><th>患者 ID</th><th>计算时间</th></tr></thead>
                <tbody>
                  <tr v-for="member in members" :key="member.cohort_member_id">
                    <td><code>{{ member.patient_id }}</code></td>
                    <td>{{ formatDate(member.computed_at) }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
          <section class="admin-form-panel">
            <form class="admin-form" @submit.prevent="recordSnapshot">
              <h3>记录快照</h3>
              <label><span>成员数</span><input v-model.number="snapshotForm.memberCount" type="number" min="0" step="1" required /></label>
              <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'snapshot' ? '正在记录…' : '记录快照' }}</button>
            </form>
            <form class="admin-form" @submit.prevent="computeMember">
              <h3>计算成员</h3>
              <label><span>患者 ID</span><input v-model="memberForm.patientId" maxlength="36" required placeholder="UUID" /></label>
              <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'member' ? '正在计算…' : '计算并加入' }}</button>
            </form>
          </section>
        </div>
      </section>
    </template>
  </section>
</template>
