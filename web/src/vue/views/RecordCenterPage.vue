<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import type { DocumentVersionWire } from '../../generated/contracts';
import {
  clinicalContext, createClinicalDocument, issueDocumentLease, loadEncounterDocuments,
  saveDocumentDraft, voidClinicalDocument,
} from '../../clinical-api';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const router = useRouter();
const busy = ref(false);
const notice = ref('');
const commandError = ref('');
const dialog = ref<'create' | 'edit' | 'void' | null>(null);
const selected = ref<DocumentVersionWire | null>(null);
const documentTypeCode = ref('WS445.2.OUTPATIENT_RECORD');
const sections = ref<Record<string, string>>({});
const voidReason = ref('');
const statusFilter = ref('ALL');
const searchText = ref('');
const showAll = ref(false);

const documentsQuery = useQuery({
  queryKey: ['clinical', 'record-center-documents'],
  queryFn: async () => {
    const lease = await issueDocumentLease();
    return { lease, documents: await loadEncounterDocuments(lease) };
  },
  retry: false,
  staleTime: 0,
  gcTime: 0,
});
const issue = computed(() => documentsQuery.error.value ? toClinicalIssue(documentsQuery.error.value) : null);
const documents = computed(() => documentsQuery.data.value?.documents ?? []);
const activeDocuments = computed(() => documents.value.filter((item) => item.status !== 'VOID'));
const draftCount = computed(() => activeDocuments.value.filter((item) => item.status === 'DRAFT').length);
const signedCount = computed(() => activeDocuments.value.filter((item) => item.status === 'SIGNED').length);
const filledSections = computed(() => activeDocuments.value.reduce((total, item) => total
  + Object.values(item.sections ?? {}).filter((value) => String(value ?? '').trim()).length, 0));
const filteredDocuments = computed(() => documents.value.filter((item) => {
  const matchesStatus = statusFilter.value === 'ALL' || item.status === statusFilter.value;
  const needle = searchText.value.trim().toLowerCase();
  const matchesText = !needle || [item.document_type_code, item.document_id, item.status]
    .some((value) => String(value).toLowerCase().includes(needle));
  return matchesStatus && matchesText;
}));
const visibleDocuments = computed(() => showAll.value ? filteredDocuments.value : filteredDocuments.value.slice(0, 5));
const blockedCount = computed(() => activeDocuments.value.filter((item) => item.status === 'DRAFT'
  && !String(item.sections?.treatment_plan ?? '').trim()).length);
const readiness = computed(() => activeDocuments.value.length === 0 ? 0
  : Math.round((signedCount.value / activeDocuments.value.length) * 1000) / 10);

function blankSections(source?: Record<string, unknown>) {
  return {
    chief_complaint: String(source?.chief_complaint ?? ''),
    present_illness: String(source?.present_illness ?? ''),
    assessment: String(source?.assessment ?? ''),
    treatment_plan: String(source?.treatment_plan ?? ''),
  };
}

function beginCreate() {
  selected.value = null;
  documentTypeCode.value = activeDocuments.value[0]?.document_type_code || 'WS445.2.OUTPATIENT_RECORD';
  sections.value = blankSections();
  dialog.value = 'create';
}

function beginEdit(document: DocumentVersionWire) {
  selected.value = document;
  sections.value = blankSections(document.sections);
  dialog.value = 'edit';
}

function beginVoid(document: DocumentVersionWire) {
  selected.value = document;
  voidReason.value = '';
  dialog.value = 'void';
}

async function runCommand(action: () => Promise<DocumentVersionWire>, success: string) {
  if (busy.value) return;
  busy.value = true;
  notice.value = '';
  commandError.value = '';
  try {
    const document = await action();
    clinicalContext.documentId = document.document_id;
    dialog.value = null;
    notice.value = success;
    await documentsQuery.refetch();
  } catch (error) {
    const failure = toClinicalIssue(error);
    commandError.value = `${failure.code}：${failure.message}`;
  } finally {
    busy.value = false;
  }
}

async function createDocument() {
  const data = documentsQuery.data.value;
  if (!data || !documentTypeCode.value.trim()) return;
  await runCommand(
    () => createClinicalDocument(data.lease, documentTypeCode.value, sections.value),
    '已新建病历草稿，新文书已进入本次就诊完整性清单。',
  );
}

async function updateDocument() {
  const data = documentsQuery.data.value;
  if (!data || !selected.value) return;
  await runCommand(
    () => saveDocumentDraft(data.lease, selected.value!, sections.value),
    '已保存新的不可变草稿版本，旧版本可继续追溯。',
  );
}

async function voidDocument() {
  const data = documentsQuery.data.value;
  if (!data || !selected.value || voidReason.value.trim().length < 4) return;
  await runCommand(
    () => voidClinicalDocument(data.lease, selected.value!, voidReason.value),
    '病历草稿已业务作废，已从待完成与待签署流程中移除，历史证据保留。',
  );
}

function openDocument(document: DocumentVersionWire, target = '/record-editor') {
  clinicalContext.documentId = document.document_id;
  void router.push(target);
}

function statusLabel(status: string) {
  return ({ DRAFT: '草稿', READY_TO_SIGN: '待签署', SIGNED: '已签署', CORRECTED: '已更正', VOID: '已作废' } as Record<string, string>)[status] || status;
}

function exportResponsibilityList() {
  const rows = [
    ['文书ID', '文书类型', '状态', '版本', '内容哈希'],
    ...filteredDocuments.value.map((item) => [item.document_id, item.document_type_code,
      statusLabel(item.status), String(item.version_no), item.content_hash]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(','))
    .join('\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = window.document.createElement('a');
  link.href = url;
  link.download = `全院病历责任清单-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
  notice.value = `已导出 ${filteredDocuments.value.length} 条真实病历责任记录。`;
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading record-center-heading"><div><h1>全院病历中心</h1><p>跨门诊、急诊、住院的文书任务与质量工作队列；进入具体病历前重新建立患者和就诊上下文</p></div>
      <div class="toolbar-actions"><button class="btn" type="button" @click="exportResponsibilityList">导出责任清单</button><button class="btn primary" type="button" @click="beginCreate">创建病历抽查</button></div></div>

    <ClinicalPageState v-if="documentsQuery.isPending.value" kind="loading" message="正在加载本次就诊文书与流程状态" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="documentsQuery.refetch()" />
    <template v-else>
      <p v-if="notice" class="record-command-message" role="status">{{ notice }}</p><p v-if="commandError" class="record-command-error" role="alert">{{ commandError }}</p>
      <section class="metric-grid record-metrics" aria-label="病历指标"><article class="metric"><span class="name">今日应有文书</span><strong class="value">{{ activeDocuments.length }}</strong><small class="trend">已填 {{ filledSections }} 个章节 · 作废 {{ documents.length - activeDocuments.length }} 份</small></article><article class="metric"><span class="name">待审签</span><strong class="value">{{ draftCount }}</strong><small class="trend">当前草稿进入确定性质控</small></article><article class="metric"><span class="name">硬阻断</span><strong class="value danger-text">{{ blockedCount }}</strong><small class="trend">缺少治疗或随访计划</small></article><article class="metric"><span class="name">归档准备度</span><strong class="value">{{ readiness }}%</strong><small class="trend">按真实签署状态实时计算</small></article></section>
      <section class="card record-prototype-workbench"><div class="toolbar record-center-filters"><select v-model="statusFilter" class="select"><option value="ALL">全部状态</option><option value="DRAFT">草稿</option><option value="SIGNED">已签署</option><option value="VOID">已作废</option></select><select class="select" aria-label="全部院区科室"><option>全部院区/科室</option></select><select class="select" aria-label="排序"><option>按风险与时限</option></select><input v-model="searchText" class="search" placeholder="患者、就诊号、病历类型或责任人"><button class="btn" type="button" @click="notice = '当前筛选视图已保存在本次会话。'">保存视图</button></div>
        <div v-if="documents.length === 0" class="record-evidence-empty"><h2>本次就诊尚无病历文书</h2><p>新建第一份草稿后，质控、签署与版本证据会立即接入。</p><button class="button primary" @click="beginCreate">新建病历</button></div>
        <div v-else class="record-prototype-table-wrap"><table class="table"><thead><tr><th>业务域</th><th>文书</th><th>状态</th><th>版本</th><th>质量/时限</th><th>更新时间</th><th></th></tr></thead><tbody><tr v-for="document in visibleDocuments" :key="document.document_id" :class="{ voided: document.status === 'VOID' }"><td><span class="status blue">门诊</span></td><td><b>{{ document.document_type_code }}</b><br><span class="meta">…{{ document.document_id.slice(-8) }}</span></td><td>{{ statusLabel(document.status) }}</td><td>v{{ document.version_no }} / row {{ document.row_version }}</td><td><span class="status" :class="document.status === 'DRAFT' ? 'amber' : document.status === 'SIGNED' ? 'green' : 'red'">{{ document.status === 'DRAFT' ? '待质控' : document.status === 'SIGNED' ? '证据完整' : '已退出流程' }}</span></td><td>{{ document.content_hash.slice(0, 8) }}…</td><td><div class="record-row-actions"><button class="btn sm" type="button" @click="openDocument(document, '/record-versions')">证据</button><button class="btn sm" type="button" :disabled="document.status !== 'DRAFT'" @click="beginEdit(document)">编辑</button><button class="btn sm primary" type="button" :disabled="document.status === 'VOID'" @click="openDocument(document)">处理</button><button class="btn sm danger" type="button" :disabled="document.status !== 'DRAFT'" @click="beginVoid(document)">作废</button></div></td></tr></tbody></table><button v-if="filteredDocuments.length > 5" class="btn record-expand" type="button" @click="showAll = !showAll">{{ showAll ? '收起列表' : `查看全部 ${filteredDocuments.length} 份` }}</button></div>
        <div class="card-body"><div class="notice info"><div class="notice-title">路由与上下文边界</div>全院病历中心聚合真实病历任务和证据。进入具体文书前会重新校验患者关系、岗位权限、未保存草稿和版本租约。</div></div>
      </section>
    </template>

    <BusinessActionDialog :open="dialog === 'create'" title="新建病历草稿" description="新文书将立即进入就诊完整性、质控和签署流程。" eyebrow="病历 / 新建" confirm-label="新建并纳入流程" :busy="busy" :confirm-disabled="!documentTypeCode.trim()" width="wide" @cancel="dialog = null" @confirm="createDocument"><label>文书类型编码<input v-model="documentTypeCode" autocomplete="off"></label><div class="dialog-grid"><label>主诉<textarea v-model="sections.chief_complaint" rows="2" /></label><label>现病史<textarea v-model="sections.present_illness" rows="2" /></label><label>诊断与评估<textarea v-model="sections.assessment" rows="2" /></label><label>治疗与随访计划<textarea v-model="sections.treatment_plan" rows="2" /></label></div></BusinessActionDialog>
    <BusinessActionDialog :open="dialog === 'edit'" :title="`编辑 ${selected?.document_type_code ?? ''}`" description="保存会生成新的不可变草稿版本，不会覆盖原版。" eyebrow="病历 / 编辑" confirm-label="保存新版本" :busy="busy" width="wide" @cancel="dialog = null" @confirm="updateDocument"><div class="dialog-grid"><label>主诉<textarea v-model="sections.chief_complaint" rows="3" /></label><label>现病史<textarea v-model="sections.present_illness" rows="3" /></label><label>诊断与评估<textarea v-model="sections.assessment" rows="3" /></label><label>治疗与随访计划<textarea v-model="sections.treatment_plan" rows="3" /></label></div></BusinessActionDialog>
    <BusinessActionDialog :open="dialog === 'void'" :title="`作废 ${selected?.document_type_code ?? ''}`" description="作废会从待完成与待签署流程移除该草稿，但不会物理删除医疗证据。" eyebrow="病历 / 删除与作废" confirm-label="确认作废并留痕" danger :busy="busy" :confirm-disabled="voidReason.trim().length < 4" @cancel="dialog = null" @confirm="voidDocument"><p class="dialog-warning">仅草稿可作废；已签文书必须走撤签和依法更正流程。</p><label>作废原因（至少 4 字）<textarea v-model="voidReason" rows="4" maxlength="2000" /></label></BusinessActionDialog>
  </section>
</template>
