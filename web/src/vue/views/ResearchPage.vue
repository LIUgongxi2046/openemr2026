<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext } from '../../clinical-api';
import type { ResearchProjectWire } from '../../generated/contracts';
import {
  createResearchProject,
  deactivateResearchProject,
  issueResearchProjectLease,
  listResearchProjects,
} from '../../api/research';
import { toClinicalIssue } from '../clinical-error';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import AgentInlineReview from '../components/AgentInlineReview.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const typeLabels: Record<ResearchProjectWire['project_type'], string> = {
  OBSERVATIONAL: '观察性研究', RETROSPECTIVE: '回顾性研究', INTERVENTIONAL: '干预性研究',
};
const statusTone: Record<ResearchProjectWire['status'], string> = { ACTIVE: 'green', INACTIVE: 'gray' };

const createOpen = ref(false);
const deactivateOpen = ref(false);
const busy = ref('');
const notice = ref('');
const selected = ref<ResearchProjectWire | null>(null);
const form = reactive({
  projectCode: '', displayName: '', projectType: 'OBSERVATIONAL' as ResearchProjectWire['project_type'],
  principalInvestigator: '', registryNumber: '', ethicsApproval: '', approvedPurpose: '',
  dataScope: '', memberCount: 1, expiresAt: '',
});

const leaseQuery = useQuery({
  queryKey: ['research', 'lease'], queryFn: issueResearchProjectLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const projectsQuery = useQuery({
  queryKey: ['research', 'projects'],
  queryFn: () => listResearchProjects(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});

const projects = computed(() => projectsQuery.data.value ?? []);
const issue = computed(() => {
  const error = leaseQuery.error.value ?? projectsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

const agentPatientId = computed(() => clinicalContext.patientId || null);
const agentEncounterId = computed(() => clinicalContext.encounterId || null);
const researchFollowupObjective = computed(() => '对当前科研项目进行随访计划建议，输出候选，仅供医生审阅。');

function openCreate() {
  form.projectCode = ''; form.displayName = ''; form.projectType = 'OBSERVATIONAL';
  form.principalInvestigator = ''; form.registryNumber = ''; form.ethicsApproval = '';
  form.approvedPurpose = ''; form.dataScope = ''; form.memberCount = 1; form.expiresAt = '';
  createOpen.value = true;
}

function requestDeactivate(project: ResearchProjectWire) {
  selected.value = project;
  deactivateOpen.value = true;
}

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.projectCode.trim() || !form.displayName.trim()
    || !form.principalInvestigator.trim() || !form.approvedPurpose.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createResearchProject(lease, {
      project_code: form.projectCode.trim(), display_name: form.displayName.trim(),
      project_type: form.projectType, principal_investigator: form.principalInvestigator.trim(),
      registry_number: form.registryNumber.trim() || null,
      ethics_approval: form.ethicsApproval.trim() || null,
      approved_purpose: form.approvedPurpose.trim(),
      data_scope: form.dataScope.split(/[、,，\n]+/).map((item) => item.trim()).filter(Boolean),
      member_count: form.memberCount, expires_at: form.expiresAt || null,
    });
    notice.value = '科研项目已登记，编码与批准用途不可覆盖修改。';
    createOpen.value = false;
    await projectsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

async function deactivate() {
  const lease = leaseQuery.data.value;
  if (!lease || !selected.value || busy.value) return;
  busy.value = 'deactivate'; notice.value = '';
  try {
    await deactivateResearchProject(lease, selected.value.project_id);
    notice.value = `${selected.value.display_name} 已停用。`;
    deactivateOpen.value = false;
    await projectsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

function formatDate(value: string | null | undefined): string {
  return value ?? '—';
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 科研统计</p>
        <h1>科研项目与统计中心</h1>
        <p>病历数据利用绑定项目、科学性审查、伦理批件、批准用途与有效期；患者级数据必须另行申请。</p>
      </div>
      <div class="toolbar-actions">
        <RouterLink class="button secondary" to="/cohort-builder">队列构建</RouterLink>
        <RouterLink class="button secondary" to="/research-stats">统计分析</RouterLink>
        <button class="button primary" @click="openCreate">新建项目</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value" kind="loading" message="正在读取科研项目" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="projectsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <section class="admin-metrics" aria-label="科研项目指标">
        <article><span>项目总数</span><strong>{{ projects.length }}</strong><small>已登记</small></article>
        <article><span>在研项目</span><strong>{{ projects.filter((item) => item.status === 'ACTIVE').length }}</strong><small>活动状态</small></article>
        <article><span>项目成员</span><strong>{{ projects.reduce((sum, item) => sum + item.member_count, 0) }}</strong><small>累计</small></article>
        <article><span>数据申请</span><RouterLink class="metric-link" to="/research-dataset">受控交付 →</RouterLink><small>需独立审批</small></article>
      </section>

      <AgentInlineReview agent-code="RESEARCH_FOLLOWUP" stage-code="COHORT" :objective="researchFollowupObjective" :patient-id="agentPatientId" :encounter-id="agentEncounterId" target-type="ENCOUNTER" :target-id="agentEncounterId" title="AI 科研随访候选" source-route="research" />

      <section class="admin-panel">
        <header><div><h2>科研项目台账</h2><p>项目编码、类型与批准用途不可覆盖修改；停用保留历史数据利用证据。</p></div></header>
        <div v-if="projects.length === 0" class="admin-empty">暂无科研项目，点击「新建项目」登记项目与批准用途。</div>
        <div v-else class="admin-table-wrap">
          <table class="admin-table">
            <thead><tr><th>编码 / 名称</th><th>类型</th><th>主要研究者</th><th>伦理批件</th><th>批准数据范围</th><th>有效期</th><th>状态</th><th>操作</th></tr></thead>
            <tbody>
              <tr v-for="project in projects" :key="project.project_id">
                <td><RouterLink class="link-button" :to="`/research/${project.project_id}`"><strong>{{ project.display_name }}</strong><small><code>{{ project.project_code }}</code></small></RouterLink></td>
                <td>{{ typeLabels[project.project_type] }}</td>
                <td>{{ project.principal_investigator }}</td>
                <td>{{ project.ethics_approval ?? '—' }}</td>
                <td>{{ project.data_scope.join('、') }}</td>
                <td>{{ formatDate(project.expires_at) }}</td>
                <td><span class="admin-status" :class="statusTone[project.status]">{{ project.status === 'ACTIVE' ? '在研' : '停用' }}</span></td>
                <td>
                  <RouterLink class="task-action" :to="`/research/${project.project_id}`">详情</RouterLink>
                  <button v-if="project.status === 'ACTIVE'" class="task-action danger" :disabled="Boolean(busy)" @click="requestDeactivate(project)">停用</button><span v-else>—</span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </template>

    <AdminActionDialog v-model:open="createOpen" title="新建科研项目" description="项目用途、伦理批件与批准数据范围必须一致；项目到期立即停止新的数据访问。">
      <form class="admin-form" @submit.prevent="create">
        <label><span>项目编码</span><input v-model="form.projectCode" maxlength="128" required /></label>
        <label><span>显示名</span><input v-model="form.displayName" maxlength="256" required /></label>
        <label><span>项目类型</span>
          <select v-model="form.projectType"><option v-for="(label, value) in typeLabels" :key="value" :value="value">{{ label }}</option></select>
        </label>
        <label><span>主要研究者</span><input v-model="form.principalInvestigator" required /></label>
        <label><span>统一登记号</span><input v-model="form.registryNumber" /></label>
        <label><span>伦理批件</span><input v-model="form.ethicsApproval" /></label>
        <label><span>批准用途</span><textarea v-model="form.approvedPurpose" required /></label>
        <label><span>批准数据范围</span><input v-model="form.dataScope" placeholder="例：门诊病历、处方、检验" /></label>
        <label><span>项目成员数</span><input v-model.number="form.memberCount" type="number" min="1" /></label>
        <label><span>有效期至</span><input v-model="form.expiresAt" type="date" /></label>
      </form>
      <template #footer="{ close }"><button class="button secondary" @click="close">取消</button><button class="button primary" :disabled="Boolean(busy)" @click="create">登记</button></template>
    </AdminActionDialog>

    <AdminConfirmDialog v-model:open="deactivateOpen" title="停用科研项目" :description="`停用 ${selected?.display_name ?? '项目'} 后停止新的数据访问，历史数据利用证据保留。`" confirm-label="确认停用" :busy="Boolean(busy)" @confirm="deactivate" />
  </section>
</template>

<style scoped>
.metric-link { color: var(--blue); font-size: 11px; font-weight: 700; text-decoration: none; }
</style>
