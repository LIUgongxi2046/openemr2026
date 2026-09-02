<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { listDocumentAuditEvents } from '../../api/document-audit';
import {
  clinicalContext,
  issueDocumentLease,
  loadDocumentGovernance,
  loadDocumentSources,
  loadDocumentVersions,
  loadEncounterDocuments,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import RecordPatientStrip from '../components/RecordPatientStrip.vue';
import { toClinicalIssue } from '../clinical-error';

const props = defineProps<{ level: number }>();
const route = useRoute();

const depthQuery = useQuery({
  queryKey: ['clinical', 'record-evidence-depth', route.fullPath],
  queryFn: async () => {
    const lease = await issueDocumentLease();
    const documents = await loadEncounterDocuments(lease);
    const requestedDocumentId = String(route.params.documentId ?? clinicalContext.documentId ?? '');
    const document = documents.find((item) => item.document_id === requestedDocumentId) ?? null;
    if (!document) return { document: null, versions: [], version: null, governance: null, sources: null, audits: [] };
    const versions = await loadDocumentVersions(lease, document.document_id);
    const requestedVersionId = String(route.params.versionId ?? '');
    const version = versions.find((item) => item.document_version_id === requestedVersionId) ?? versions[0] ?? null;
    if (!version) return { document, versions, version: null, governance: null, sources: null, audits: [] };
    const [governance, sources, audits] = await Promise.all([
      loadDocumentGovernance(lease, document.document_id, version.document_version_id),
      loadDocumentSources(lease, version),
      listDocumentAuditEvents(lease, document.document_id),
    ]);
    return { document, versions, version, governance, sources, audits };
  },
  retry: false, staleTime: 0, gcTime: 0,
});

const issue = computed(() => depthQuery.error.value ? toClinicalIssue(depthQuery.error.value) : null);
const data = computed(() => depthQuery.data.value);
const selectedSignature = computed(() => data.value?.governance?.signatures.find(
  (item) => item.signature_id === String(route.params.signatureId ?? ''),
) ?? data.value?.governance?.signatures[0] ?? null);
const selectedSource = computed(() => data.value?.sources?.references.find(
  (item) => item.source_reference_id === String(route.params.sourceId ?? ''),
) ?? data.value?.sources?.references[0] ?? null);
const selectedAudit = computed(() => data.value?.audits.find(
  (item) => item.audit_event_id === String(route.params.auditEventId ?? ''),
) ?? data.value?.audits[0] ?? null);
const documentPath = computed(() => `/record/documents/${data.value?.document?.document_id ?? ''}`);
const versionPath = computed(() => `${documentPath.value}/versions/${data.value?.version?.document_version_id ?? ''}`);
const signaturePath = computed(() => selectedSignature.value
  ? `${versionPath.value}/signatures/${selectedSignature.value.signature_id}` : versionPath.value);
const sourcePath = computed(() => selectedSource.value
  ? `${signaturePath.value}/sources/${selectedSource.value.source_reference_id}` : signaturePath.value);

function format(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—';
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><h1>病历证据链 · 第 {{ level }} 级</h1><p>文书 → 版本 → 签名 → 来源 → 审计事件，所有层级均读取后端证据</p></div><div class="toolbar-actions"><RouterLink class="btn" to="/record-versions">返回版本治理</RouterLink><button class="btn" type="button" @click="depthQuery.refetch()">刷新证据</button></div></div>
    <RecordPatientStrip />
    <ClinicalPageState v-if="depthQuery.isPending.value" kind="loading" message="正在校验病历上下文并加载证据链" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="depthQuery.refetch()" />
    <div v-else-if="!data?.document" class="record-evidence-empty"><h2>文书不存在或当前岗位无权查看</h2><p>系统未使用路由 ID 绕过患者与就诊上下文。</p></div>
    <template v-else-if="data?.version && data.governance && data.sources">
      <nav class="record-subnav" aria-label="病历证据层级"><RouterLink :to="documentPath">3 文书</RouterLink><RouterLink :to="versionPath">4 版本</RouterLink><RouterLink :to="signaturePath" :class="{ disabled: !selectedSignature }">5 签名</RouterLink><RouterLink :to="sourcePath" :class="{ disabled: !selectedSource }">6 来源</RouterLink><RouterLink :to="selectedAudit ? `${sourcePath}/audit/${selectedAudit.audit_event_id}` : sourcePath" :class="{ disabled: !selectedAudit }">7 审计</RouterLink></nav>
      <section class="card"><div class="card-head">第 3 级 · 文书责任头</div><div class="card-body"><div class="folder-row">文书类型<span>{{ data.document.document_type_code }}</span></div><div class="folder-row">文书 ID<span>{{ data.document.document_id }}</span></div><div class="folder-row">当前状态<span>{{ data.document.status }}</span></div><div class="folder-row">版本数<span>{{ data.versions.length }}</span></div></div></section>
      <section v-if="level >= 4" class="card"><div class="card-head">第 4 级 · 不可变版本</div><div class="card-body"><div class="folder-row">版本<span>v{{ data.version.version_no }} / row {{ data.version.row_version }}</span></div><div class="folder-row">内容哈希<span>{{ data.version.content_hash }}</span></div><div class="folder-row">质控结果<span>{{ data.governance.quality_run?.outcome || '未运行' }}</span></div><div class="folder-row">数据水印<span>{{ data.governance.data_watermark }}</span></div></div></section>
      <section v-if="level >= 5" class="card"><div class="card-head">第 5 级 · 签名证据</div><div v-if="selectedSignature" class="card-body"><div class="folder-row">签名人<span>{{ selectedSignature.signer_display_name }} / {{ selectedSignature.signature_role }}</span></div><div class="folder-row">证据状态<span>{{ selectedSignature.signature_status }}</span></div><div class="folder-row">凭据引用<span>{{ selectedSignature.credential_ref || '无' }}</span></div><div class="folder-row">签名时间<span>{{ format(selectedSignature.signed_at) }}</span></div></div><div v-else class="card-body"><div class="notice hard">当前版本无签名证据，不会虚构第 5 级数据。</div></div></section>
      <section v-if="level >= 6" class="card"><div class="card-head">第 6 级 · 来源证据</div><div v-if="selectedSource" class="card-body"><div class="folder-row">来源类型<span>{{ selectedSource.source_type }}</span></div><div class="folder-row">来源对象<span>{{ selectedSource.source_resource_id }}</span></div><div class="folder-row">来源版本<span>{{ selectedSource.source_version_ref }} / {{ selectedSource.freshness }}</span></div><div class="folder-row">目标字段<span>{{ selectedSource.target_field_path }}</span></div><div class="folder-row">摘要哈希<span>{{ selectedSource.excerpt_hash || '无' }}</span></div><RouterLink class="btn" to="/record-sources">管理来源更正/撤销</RouterLink></div><div v-else class="card-body"><div class="notice info">当前版本没有来源引用；辅助检查内容将被确定性质控警告。</div></div></section>
      <section v-if="level >= 7" class="card"><div class="card-head">第 7 级 · 审计哈希链</div><div v-if="selectedAudit" class="card-body"><div class="folder-row">动作<span>{{ selectedAudit.action_code }}</span></div><div class="folder-row">事件 ID<span>{{ selectedAudit.audit_event_id }}</span></div><div class="folder-row">追踪 ID<span>{{ selectedAudit.trace_id }}</span></div><div class="folder-row">前序哈希<span>{{ selectedAudit.previous_hash || 'GENESIS' }}</span></div><div class="folder-row">事件哈希<span>{{ selectedAudit.event_hash }}</span></div><div class="folder-row">发生时间<span>{{ format(selectedAudit.occurred_at) }}</span></div></div><div v-else class="card-body"><div class="notice hard">当前文书没有可读审计事件。</div></div></section>
    </template>
  </section>
</template>
