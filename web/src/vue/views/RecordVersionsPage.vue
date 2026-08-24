<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type {
  ContextLeaseWire,
  DocumentCorrectionPropagationWire,
  DocumentGovernanceSnapshotWire,
  DocumentVersionWire,
  SignatureEvidenceDetailWire,
} from '../../generated/contracts';
import {
  clinicalContext,
  createDocumentCorrection,
  issueDocumentLease,
  loadDocumentCorrections,
  loadDocumentGovernance,
  loadDocumentVersions,
  loadEncounterDocuments,
  retryDocumentCorrectionPropagation,
  revokeDocumentSignature,
} from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const queryClient = useQueryClient();
const busy = ref(false);
const actionError = ref('');
const actionNotice = ref('');
const correctionOpen = ref(false);
const correctionType = ref<'CORRECTION' | 'ADDENDUM'>('CORRECTION');
const correctionReason = ref('');
const correctionSections = ref({ chief_complaint: '', present_illness: '', assessment: '', plan: '' });
const revokeTarget = ref<SignatureEvidenceDetailWire | null>(null);
const revokeReason = ref('');
const versionKey = ['clinical', 'record-versions'] as const;

async function loadSelected(lease: ContextLeaseWire, documents: DocumentVersionWire[], documentId: string) {
  const versions = await loadDocumentVersions(lease, documentId);
  const [corrections, governance] = await Promise.all([
    loadDocumentCorrections(lease, documentId),
    Promise.all(versions.map((version) => loadDocumentGovernance(lease, documentId, version.document_version_id))),
  ]);
  return { lease, documents, selected: documentId, versions, corrections, governance };
}

const versionsQuery = useQuery({
  queryKey: versionKey,
  queryFn: async () => {
    const lease = await issueDocumentLease();
    const documents = await loadEncounterDocuments(lease);
    const selected = documents.find((item) => item.document_id === clinicalContext.documentId)?.document_id
      ?? documents[0]?.document_id ?? null;
    if (!selected) return { lease, documents, selected, versions: [], corrections: [], governance: [] };
    return loadSelected(lease, documents, selected);
  },
  retry: false, staleTime: 0, gcTime: 0,
});

const issue = computed(() => versionsQuery.error.value ? toClinicalIssue(versionsQuery.error.value) : null);
const current = computed(() => versionsQuery.data.value?.versions[0]);
const signatures = computed(() => {
  const seen = new Set<string>();
  return (versionsQuery.data.value?.governance ?? []).flatMap((snapshot) => snapshot.signatures)
    .filter((signature) => !seen.has(signature.signature_id) && seen.add(signature.signature_id));
});
const canCreateCorrection = computed(() => current.value && ['SIGNED', 'VOID'].includes(current.value.status));

async function selectDocument(documentId: string) {
  const data = versionsQuery.data.value;
  if (!data || data.selected === documentId || busy.value) return;
  await runAction(async () => {
    queryClient.setQueryData(versionKey, await loadSelected(data.lease, data.documents, documentId));
    correctionOpen.value = false;
    revokeTarget.value = null;
  });
}

async function reloadSelected() {
  const data = versionsQuery.data.value;
  if (!data?.selected) return;
  const documents = await loadEncounterDocuments(data.lease);
  queryClient.setQueryData(versionKey, await loadSelected(data.lease, documents, data.selected));
}

async function runAction(action: () => Promise<void>) {
  busy.value = true;
  actionError.value = '';
  actionNotice.value = '';
  try { await action(); }
  catch (error) { actionError.value = toClinicalIssue(error).message; }
  finally { busy.value = false; }
}

function beginCorrection() {
  if (!current.value) return;
  const sections = current.value.sections ?? {};
  const text = (key: string) => typeof sections[key] === 'string' ? sections[key] as string : '';
  correctionSections.value = {
    chief_complaint: text('chief_complaint'), present_illness: text('present_illness'),
    assessment: text('assessment'), plan: text('plan'),
  };
  correctionReason.value = '';
  correctionType.value = 'CORRECTION';
  correctionOpen.value = true;
}

async function submitCorrection() {
  const data = versionsQuery.data.value;
  const document = current.value;
  if (!data || !document || correctionReason.value.trim().length < 4) return;
  await runAction(async () => {
    await createDocumentCorrection(data.lease, document, correctionType.value, correctionReason.value, {
      ...(document.sections ?? {}), ...correctionSections.value,
    });
    await reloadSelected();
    correctionOpen.value = false;
    actionNotice.value = '更正草稿已创建，原签名版本保持不可变；请到专注编辑完成质控与重新签署。';
  });
}

async function retryPropagation(propagation: DocumentCorrectionPropagationWire) {
  const data = versionsQuery.data.value;
  if (!data?.selected) return;
  await runAction(async () => {
    const result = await retryDocumentCorrectionPropagation(data.lease, data.selected!, propagation);
    await reloadSelected();
    actionNotice.value = result.status === 'FAILED'
      ? `传播未完成：${result.last_error_code || '外部适配器不可用'}。失败证据已保留，可在接口配置完成后重试。`
      : '更正传播任务已重新执行。';
  });
}

async function confirmRevocation() {
  const data = versionsQuery.data.value;
  const document = current.value;
  if (!data || !document || !revokeTarget.value || revokeReason.value.trim().length < 4) return;
  await runAction(async () => {
    await revokeDocumentSignature(data.lease, document, revokeTarget.value!.signature_id, revokeReason.value);
    await reloadSelected();
    revokeTarget.value = null;
    revokeReason.value = '';
    actionNotice.value = '签名已撤销并生成不可变撤销证据；已签正文和原签名记录均未被删除。';
  });
}

function governanceFor(versionId: string): DocumentGovernanceSnapshotWire | undefined {
  return versionsQuery.data.value?.governance.find((item) => item.document_version_id === versionId);
}
function diffRoute(versions: DocumentVersionWire[]) {
  const [to, from] = versions;
  if (!from || !to) return '/record-versions';
  return `/record-diff/${to.document_id}/${from.document_version_id}/${to.document_version_id}`;
}
function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
}
function statusLabel(status: string) {
  return ({ DRAFT: '草稿', SIGNED: '已签署', VOID: '已作废', PENDING: '待传播', SUCCEEDED: '已送达', FAILED: '传播失败', VALID: '有效', PENDING_CA_EVIDENCE: '待 CA 证据', REVOKED: '已撤销' } as Record<string, string>)[status] ?? status;
}
</script>

<template>
  <main id="main-content" class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">病历主轴 / 版本证据</p><h1>病历版本与法律证据</h1></div><RouterLink v-if="versionsQuery.data.value && versionsQuery.data.value.versions.length >= 2" class="button primary" :to="diffRoute(versionsQuery.data.value.versions)">比较最近两个版本</RouterLink></div>
    <p class="record-center-intro">草稿、审签、更正与撤签形成可追溯证据链；任何操作都不会覆盖已签正文。</p>
    <nav class="record-subnav" aria-label="病历二级导航"><RouterLink to="/record">病历工作台</RouterLink><RouterLink to="/opd-record">专注编辑</RouterLink><RouterLink to="/record-sources">来源与附件</RouterLink><RouterLink to="/record-qc">质控与审签</RouterLink><RouterLink class="active" to="/record-versions">版本证据</RouterLink></nav>
    <section class="patient-strip" aria-label="患者与就诊上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.patientName }}</strong><span>当前门诊就诊</span></div><dl><div><dt>患者标识</dt><dd>…{{ clinicalContext.patientId.slice(-6) }}</dd></div><div><dt>就诊标识</dt><dd>…{{ clinicalContext.encounterId.slice(-6) }}</dd></div><div><dt>工作域</dt><dd>病历中心 / 法律证据</dd></div></dl></section>
    <ClinicalPageState v-if="versionsQuery.isPending.value" kind="loading" message="正在读取病历文书、治理证据与更正台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="versionsQuery.refetch()" />
    <div v-else-if="versionsQuery.data.value?.documents.length === 0" class="record-evidence-empty"><h2>本次就诊尚无病历文书</h2><p>创建文书后，版本与法律证据将在此自动汇聚。</p><RouterLink class="button primary" to="/opd-record">进入病历编辑</RouterLink></div>
    <template v-else-if="versionsQuery.data.value">
      <div v-if="actionError || actionNotice" class="legal-action-message" :class="{ error: actionError }" role="status">{{ actionError || actionNotice }}</div>
      <div class="record-version-layout">
        <aside class="record-document-selector" aria-label="本次就诊文书"><h2>本次就诊文书</h2><button v-for="document in versionsQuery.data.value.documents" :key="document.document_id" type="button" :disabled="busy" :class="{ active: document.document_id === versionsQuery.data.value.selected }" @click="selectDocument(document.document_id)"><span>{{ document.document_type_code || '通用病历' }}</span><small>v{{ document.version_no }} · {{ statusLabel(document.status) }}</small></button></aside>
        <section class="record-version-timeline" aria-label="版本时间轴"><header><div><h2>版本时间轴</h2><p>{{ versionsQuery.data.value.versions.length }} 个不可变版本，新版本在前</p></div><span class="evidence-verified">数据库原始证据</span></header><article v-for="(version, index) in versionsQuery.data.value.versions" :key="version.document_version_id" :class="{ current: index === 0 }"><div class="version-marker">v{{ version.version_no }}</div><div><strong>{{ statusLabel(version.status) }}</strong><span>{{ formatDate(version.created_at) }}</span><small>内容指纹 {{ version.content_hash.slice(0, 16) }}…</small><small v-if="governanceFor(version.document_version_id)?.signatures.length">{{ governanceFor(version.document_version_id)?.signatures.length }} 份签名证据</small></div><div class="version-actions"><code>…{{ version.document_version_id.slice(-8) }}</code><RouterLink v-if="index < versionsQuery.data.value.versions.length - 1" :to="diffRoute([version, versionsQuery.data.value.versions[index + 1]])">与前版比较</RouterLink></div></article></section>
        <aside class="record-legal-rail"><h2>当前证据边界</h2><dl><div><dt>文书 ID</dt><dd>{{ current ? `…${current.document_id.slice(-8)}` : '—' }}</dd></div><div><dt>当前版本</dt><dd>{{ current ? `v${current.version_no} / ${statusLabel(current.status)}` : '—' }}</dd></div><div><dt>内容哈希</dt><dd>{{ current ? `${current.content_hash.slice(0, 18)}…` : '—' }}</dd></div><div><dt>更正记录</dt><dd>{{ versionsQuery.data.value.corrections.length }} 条</dd></div><div><dt>签名证据</dt><dd>{{ signatures.length }} 份</dd></div><div><dt>CA 证据</dt><dd>不伪造第三方结果；真实 CA/时间戳接口待联调</dd></div></dl><p>原版本、撤销理由、操作者、时间和传播结果均保留，历史证据不可删除。</p></aside>
      </div>

      <section class="legal-governance-workspace" aria-label="依法更正与签名治理">
        <article class="legal-correction-card">
          <header><div><p class="eyebrow">受控操作</p><h2>依法更正 / 补记</h2></div><span class="legal-state-chip">原文不覆盖</span></header>
          <div v-if="!canCreateCorrection" class="legal-empty-state"><strong>当前版本尚未签署</strong><p>草稿请在编辑器直接修订；只有已签或已撤签文书才能发起法定更正。</p><RouterLink class="button secondary" to="/opd-record">进入专注编辑</RouterLink></div>
          <div v-else-if="!correctionOpen" class="legal-operation-summary"><p>系统将基于当前已签版本创建新的更正草稿，并强制记录更正类型、理由、来源版本与重新签署证据。</p><button type="button" class="button primary" :disabled="busy" @click="beginCorrection">发起依法更正</button></div>
          <form v-else class="correction-form" @submit.prevent="submitCorrection">
            <label><span>处理类型</span><select v-model="correctionType"><option value="CORRECTION">更正</option><option value="ADDENDUM">补记</option></select></label>
            <label class="wide"><span>更正/补记原因（必填，至少 4 字）</span><textarea v-model="correctionReason" rows="2" maxlength="2000" placeholder="说明发现问题的依据及更正原因"></textarea></label>
            <label><span>主诉</span><textarea v-model="correctionSections.chief_complaint" rows="3"></textarea></label>
            <label><span>现病史</span><textarea v-model="correctionSections.present_illness" rows="3"></textarea></label>
            <label><span>评估</span><textarea v-model="correctionSections.assessment" rows="3"></textarea></label>
            <label><span>诊疗计划</span><textarea v-model="correctionSections.plan" rows="3"></textarea></label>
            <footer><button type="button" class="button secondary" :disabled="busy" @click="correctionOpen = false">取消</button><button type="submit" class="button primary" :disabled="busy || correctionReason.trim().length < 4">{{ busy ? '正在创建…' : '创建更正草稿' }}</button></footer>
          </form>
        </article>

        <article class="legal-ledger-card">
          <header><div><p class="eyebrow">不可变台账</p><h2>更正与外部传播</h2></div><span>{{ versionsQuery.data.value.corrections.length }} 条</span></header>
          <div v-if="versionsQuery.data.value.corrections.length === 0" class="legal-empty-state compact"><strong>暂无更正记录</strong><p>签后更正将在这里串联来源版本、修订版本和外部传播结果。</p></div>
          <div v-for="correction in versionsQuery.data.value.corrections" v-else :key="correction.correction_id" class="correction-ledger-row">
            <div class="ledger-title"><strong>{{ correction.correction_type === 'CORRECTION' ? '更正' : '补记' }} · {{ correction.status === 'DRAFT' ? '更正草稿' : statusLabel(correction.status) }}</strong><time>{{ formatDate(correction.requested_at) }}</time></div>
            <p>{{ correction.reason }}</p><code>来源 …{{ correction.source_document_version_id.slice(-8) }} → 更正 …{{ correction.correction_document_version_id.slice(-8) }}</code>
            <div v-for="propagation in correction.propagations" :key="propagation.propagation_id" class="propagation-row"><div><span :class="['propagation-status', propagation.status.toLowerCase()]">{{ statusLabel(propagation.status) }}</span><b>{{ propagation.destination_code }}</b><small>尝试 {{ propagation.attempt_count }} 次<span v-if="propagation.last_error_code"> · {{ propagation.last_error_code }}</span></small></div><button v-if="propagation.status !== 'SUCCEEDED'" type="button" class="text-button" :disabled="busy" @click="retryPropagation(propagation)">重试传播</button></div>
          </div>
        </article>
      </section>

      <section class="signature-evidence-card" aria-label="签名与撤销证据">
        <header><div><p class="eyebrow">签名治理</p><h2>签名与撤销证据</h2></div><span>{{ signatures.length }} 份签名</span></header>
        <div v-if="signatures.length === 0" class="legal-empty-state compact"><strong>暂无签名证据</strong><p>完成质控和签署后，这里将展示签署人、角色、内容哈希与证据状态。</p></div>
        <div v-else class="signature-evidence-grid"><article v-for="signature in signatures" :key="signature.signature_id"><div><strong>{{ signature.signer_display_name }}</strong><span>{{ signature.signature_role }} · {{ formatDate(signature.signed_at) }}</span></div><span :class="['signature-status', signature.signature_status.toLowerCase()]">{{ statusLabel(signature.signature_status) }}</span><code>签名 …{{ signature.signature_id.slice(-8) }} · 哈希 {{ signature.content_hash.slice(0, 12) }}…</code><button v-if="signature.signature_status !== 'REVOKED'" type="button" class="text-button danger" :disabled="busy" @click="revokeTarget = signature; revokeReason = ''">撤销签名</button></article></div>
        <form v-if="revokeTarget" class="revocation-confirm" @submit.prevent="confirmRevocation"><div><strong>确认撤销 {{ revokeTarget.signer_display_name }} 的签名</strong><p>撤销后生成独立证据，原签名与正文仍保留；如撤销当前版本签名，文书头状态将转为作废。</p></div><label><span>撤销原因（必填，至少 4 字）</span><textarea v-model="revokeReason" rows="2" maxlength="2000" placeholder="填写撤销依据"></textarea></label><footer><button type="button" class="button secondary" @click="revokeTarget = null">取消</button><button type="submit" class="button danger" :disabled="busy || revokeReason.trim().length < 4">确认撤销并留痕</button></footer></form>
      </section>
    </template>
  </main>
</template>
