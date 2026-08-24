<script setup lang="ts">
import { useQuery, useQueryClient } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';

import {
  clinicalContext,
  issueDocumentLease,
  loadDocumentGovernance,
  loadEncounterDocuments,
  signDocument,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const queryClient = useQueryClient();
const warningDisposition = ref('已核对警告并完成处置，不影响本次签署');
const busy = ref(false);
const notice = ref('');
const signMode = computed(() => route.meta.contractId === 'record-sign');

const governance = useQuery({
  queryKey: ['clinical', 'record-governance'],
  queryFn: async () => {
    const lease = await issueDocumentLease();
    const documents = await loadEncounterDocuments(lease);
    const document = documents.find((item) => item.document_id === clinicalContext.documentId) ?? documents[0] ?? null;
    if (!document) return { lease, document: null, snapshot: null };
    return {
      lease,
      document,
      snapshot: await loadDocumentGovernance(lease, document.document_id, document.document_version_id),
    };
  },
  retry: false,
  staleTime: 0,
  gcTime: 0,
});

const issue = computed(() => governance.error.value ? toClinicalIssue(governance.error.value) : null);
const document = computed(() => governance.data.value?.document);
const snapshot = computed(() => governance.data.value?.snapshot);
const qualityRun = computed(() => snapshot.value?.quality_run);
const openFindings = computed(() => snapshot.value?.quality_findings.filter((item) => item.state === 'OPEN') ?? []);
const blocking = computed(() => openFindings.value.filter((item) => item.severity === 'BLOCKING'));
const warnings = computed(() => openFindings.value.filter((item) => item.severity === 'WARNING'));
const canSign = computed(() => Boolean(
  document.value && document.value.status !== 'SIGNED'
  && qualityRun.value && qualityRun.value.outcome !== 'BLOCKED'
  && blocking.value.length === 0,
));

async function signCurrentVersion() {
  const data = governance.data.value;
  if (!data?.document || !canSign.value || busy.value) return;
  busy.value = true;
  notice.value = '';
  try {
    const evidence = await signDocument(data.lease, data.document, warningDisposition.value);
    notice.value = `签署证据已创建：${evidence.signature_status}`;
    await governance.refetch();
    await queryClient.invalidateQueries({ queryKey: ['clinical', 'current-document'] });
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = false;
  }
}

function outcomeLabel(outcome?: string) {
  return ({ PASSED: '已通过', WARNING: '有警告', BLOCKED: '已阻断', NOT_RUN: '未运行' } as Record<string, string>)[outcome ?? 'NOT_RUN'];
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'short', timeStyle: 'short', hour12: false }).format(new Date(value));
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading"><div><p class="eyebrow">病历主轴 / 确定性治理</p><h1>{{ signMode ? '病历签署与法律证据' : '病历质控与审签中心' }}</h1></div>
      <RouterLink class="button secondary" to="/opd-record">返回编辑处理</RouterLink></div>
    <p class="record-center-intro">把质控运行、问题闭环、签名证据与分级审签放在同一版本上下文中；AI 建议与硬性门禁严格分层。</p>
    <ClinicalPageState v-if="governance.isPending.value" kind="loading" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="governance.refetch()" />
    <div v-else-if="!document" class="record-evidence-empty"><h2>本次就诊尚无可治理病历</h2><p>创建病历后才能运行质控并进入审签。</p>
      <RouterLink class="button primary" to="/opd-record">创建病历</RouterLink></div>
    <div v-else-if="snapshot" class="governance-workspace">
      <div v-if="notice" class="notice" role="status">{{ notice }}</div>
      <section class="governance-metrics" aria-label="治理摘要">
        <article class="governance-outcome" :class="(qualityRun?.outcome ?? 'NOT_RUN').toLowerCase()"><span>当前版本质控</span><strong>{{ outcomeLabel(qualityRun?.outcome) }}</strong>
          <small>{{ qualityRun ? `${qualityRun.rule_version} · ${formatDate(qualityRun.executed_at)}` : '尚无绑定当前内容哈希的质控运行' }}</small></article>
        <article><span>阻断问题</span><strong :class="{ 'danger-value': blocking.length }">{{ blocking.length }}</strong><small>未闭环的 BLOCKING 规则</small></article>
        <article><span>未闭环警告</span><strong>{{ warnings.length }}</strong><small>签署前需记录处置意见</small></article>
        <article><span>签名证据</span><strong>{{ snapshot.signatures.length }}</strong><small>{{ snapshot.document_status }} · 当前版本 v{{ document.version_no }}</small></article>
      </section>
      <div v-if="!qualityRun" class="governance-gate blocked" role="status"><strong>当前版本禁止签署</strong><span>尚未运行确定性质控；空问题列表不等于通过。</span>
        <RouterLink to="/opd-record">进入编辑页运行质控</RouterLink></div>
      <div v-else-if="qualityRun.outcome === 'BLOCKED'" class="governance-gate blocked" role="status"><strong>质控未通过</strong><span>处理阻断项、保存新版本并重新质控。</span>
        <RouterLink to="/opd-record">返回病历处理</RouterLink></div>
      <div v-else class="governance-gate passed" role="status"><strong>当前内容已执行确定性质控</strong><span>证据绑定内容指纹 {{ qualityRun.content_hash.slice(0, 16) }}…</span></div>
      <div class="governance-grid">
        <section class="governance-card quality-evidence"><header><div><h2>确定性质控规则与问题闭环</h2><p>只展示服务端规则结果，不把 AI 建议计入数量。</p></div><span class="evidence-verified">数据库原始证据</span></header>
          <div v-if="openFindings.length === 0" class="governance-empty"><span>✓</span><strong>{{ qualityRun ? (qualityRun.finding_count > 0 ? '当前无未闭环规则问题' : '本次运行未发现规则问题') : '暂无问题证据，但尚未运行质控' }}</strong><small>{{ qualityRun ? (qualityRun.finding_count > 0 ? `本次共命中 ${qualityRun.finding_count} 项，均已处置` : '本次未命中规则问题') : '空列表不等于通过' }}</small></div>
          <div v-else class="governance-findings"><article v-for="finding in openFindings" :key="finding.finding_id" :class="finding.severity.toLowerCase()"><div><b>{{ finding.severity }}</b><code>{{ finding.rule_code }}</code></div>
            <strong>{{ finding.message }}</strong><span>{{ finding.field_path || '文书级规则' }} · 规则版本 {{ finding.rule_version }}</span></article></div>
        </section>
        <aside class="governance-card signature-chain"><header><h2>审签与法律证据链</h2><span class="document-state" :class="snapshot.document_status.toLowerCase()">{{ snapshot.document_status }}</span></header>
          <dl v-if="snapshot.signature_policy"><div><dt>要求级别</dt><dd>{{ snapshot.signature_policy.required_signature_level }}</dd></div><div><dt>当前级别</dt><dd>{{ snapshot.signature_policy.current_signature_level || '未开始' }}</dd></div>
            <div><dt>审签状态</dt><dd>{{ snapshot.signature_policy.review_status }}</dd></div><div><dt>签名分离</dt><dd>{{ snapshot.signature_policy.requires_distinct_signers ? '必须不同人员' : '未要求' }}</dd></div></dl>
          <p v-else class="standard-policy">本版本按普通门诊单签流程；不可据此推断已有签名。</p>
          <div class="signature-events"><p v-if="snapshot.signatures.length === 0">尚无签名证据</p><article v-for="signature in snapshot.signatures" v-else :key="signature.signature_id"><span>{{ signature.signature_role }}</span><strong>{{ signature.signer_display_name }}</strong>
            <small>{{ formatDate(signature.signed_at) }} · {{ signature.signature_status }}</small><code>{{ signature.content_hash.slice(0, 16) }}…</code></article></div>
          <footer><span>证据水印</span><code>{{ snapshot.data_watermark }}</code><p>CA 证据未回传时显示 PENDING_CA_EVIDENCE，不伪造有效签名。</p></footer></aside>
      </div>
      <section class="governance-card governance-sign-panel" :class="{ focused: signMode }"><header><div><h2>签署当前不可变版本</h2><p>签署命令仍由服务端复核版本、质控、岗位与签名策略。</p></div>
        <RouterLink v-if="!signMode" to="/record-sign">进入专注签署页</RouterLink></header>
        <label><span>警告处置说明</span><textarea v-model="warningDisposition" rows="3" /></label>
        <button class="button danger" :disabled="!canSign || busy" @click="signCurrentVersion">{{ busy ? '正在签署…' : (document.status === 'SIGNED' ? '当前版本已签署' : '确认签署当前版本') }}</button>
        <small v-if="!canSign && document.status !== 'SIGNED'">必须先完成当前内容确定性质控并清零阻断问题。</small></section>
    </div>
  </section>
</template>
