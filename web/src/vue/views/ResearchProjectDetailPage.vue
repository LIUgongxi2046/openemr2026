<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import type { ResearchProjectWire } from '../../generated/contracts';
import { issueResearchProjectLease, listResearchProjects } from '../../api/research';
import { toClinicalIssue } from '../clinical-error';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const route = useRoute();
const projectId = computed(() => String(route.params.projectId ?? ''));

const typeLabels: Record<ResearchProjectWire['project_type'], string> = {
  OBSERVATIONAL: '观察性研究', RETROSPECTIVE: '回顾性研究', INTERVENTIONAL: '干预性研究',
};

const leaseQuery = useQuery({
  queryKey: ['research-project-detail', 'lease'], queryFn: issueResearchProjectLease,
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const projectsQuery = useQuery({
  queryKey: ['research-project-detail', 'projects'],
  queryFn: () => listResearchProjects(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});

const project = computed<ResearchProjectWire | null>(() =>
  (projectsQuery.data.value ?? []).find((item) => item.project_id === projectId.value) ?? null);
const issue = computed(() => {
  const error = leaseQuery.error.value ?? projectsQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});

function formatDate(value: string | null | undefined): string {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '—';
}
function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'medium' }).format(new Date(value));
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav class="admin-breadcrumb" aria-label="科研中心层级导航"><RouterLink to="/research">← 返回科研项目</RouterLink></nav>
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">数据中心 / 科研统计 / 项目详情</p>
        <h1>科研项目详情</h1>
        <p>{{ project?.project_code ?? '…' }} · 项目身份、批准用途与数据范围只读展示。</p>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || projectsQuery.isPending.value" kind="loading" message="正在读取科研项目详情" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="projectsQuery.refetch()" />
    <ClinicalPageState v-else-if="!project" kind="empty" message="未找到该科研项目，可能已被停用或无权访问。" />
    <template v-else>
      <section class="admin-metrics">
        <article><span>项目类型</span><strong>{{ typeLabels[project.project_type] }}</strong><small>登记类型不可变</small></article>
        <article><span>主要研究者</span><strong>{{ project.principal_investigator }}</strong><small>{{ project.registry_number ?? '未登记统一登记号' }}</small></article>
        <article><span>状态</span><strong>{{ project.status === 'ACTIVE' ? '在研' : '停用' }}</strong><small>成员 {{ project.member_count }} 人</small></article>
        <article><span>有效期至</span><strong>{{ formatDate(project.expires_at) }}</strong><small>到期即停止数据访问</small></article>
      </section>

      <div class="project-detail-layout">
        <section class="admin-panel">
          <header><div><h2>批准用途与数据范围</h2><p>用途、伦理批件与数据范围三者一致,患者级数据须另行申请。</p></div></header>
          <div class="detail-grid">
            <div class="folder-row"><span>显示名</span><strong>{{ project.display_name }}</strong></div>
            <div class="folder-row"><span>项目编码</span><strong><code>{{ project.project_code }}</code></strong></div>
            <div class="folder-row"><span>批准用途</span><strong>{{ project.approved_purpose }}</strong></div>
            <div class="folder-row"><span>伦理批件</span><strong>{{ project.ethics_approval ?? '—' }}</strong></div>
            <div class="folder-row"><span>统一登记号</span><strong>{{ project.registry_number ?? '—' }}</strong></div>
            <div class="folder-row"><span>批准数据范围</span><strong>{{ project.data_scope.length ? project.data_scope.join('、') : '—' }}</strong></div>
          </div>
        </section>

        <aside class="admin-panel">
          <header><div><h2>数据利用入口</h2><p>项目相关队列、统计与受控交付分别进入对应台账。</p></div></header>
          <div class="detail-links">
            <RouterLink class="button secondary" to="/cohort-builder">队列构建 →</RouterLink>
            <RouterLink class="button secondary" to="/research-stats">统计分析 →</RouterLink>
            <RouterLink class="button secondary" to="/research-dataset">数据交付 →</RouterLink>
          </div>
          <div class="detail-meta">
            <div class="folder-row"><span>创建时间</span><strong>{{ formatDateTime(project.created_at) }}</strong></div>
            <div class="folder-row"><span>更新时间</span><strong>{{ formatDateTime(project.updated_at) }}</strong></div>
            <div class="folder-row"><span>行版本</span><strong>v{{ project.row_version }}</strong></div>
          </div>
        </aside>
      </div>
    </template>
  </section>
</template>

<style scoped>
.project-detail-layout { display: grid; grid-template-columns: minmax(0, 1fr) 320px; gap: 14px; align-items: start; }
.detail-grid { padding: 4px 15px 15px; }
.detail-grid .folder-row { gap: 14px; }
.detail-grid .folder-row strong { max-width: 70%; overflow-wrap: anywhere; text-align: right; }
.detail-links { display: grid; gap: 8px; padding: 14px 15px; }
.detail-links .button { text-align: center; }
.detail-meta { padding: 0 15px 15px; }
.detail-meta .folder-row strong { text-align: right; }
@media (max-width: 900px) { .project-detail-layout { grid-template-columns: minmax(0, 1fr); } }
</style>
