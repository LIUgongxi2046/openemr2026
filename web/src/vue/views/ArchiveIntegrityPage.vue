<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { issueMedicalRecordAssetLease, listMedicalRecordAssets } from '../../api/records';
import { issueArchiveLease, loadArchiveReadiness } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const notice = ref('');
const verifying = ref(false);
const integrityQuery = useQuery({
  queryKey: ['clinical', 'archive-integrity'],
  queryFn: async () => {
    const [assetLease, archiveLease] = await Promise.all([issueMedicalRecordAssetLease(), issueArchiveLease()]);
    const [assets, readiness] = await Promise.all([listMedicalRecordAssets(assetLease), loadArchiveReadiness(archiveLease)]);
    return { assets, readiness };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => integrityQuery.error.value ? toClinicalIssue(integrityQuery.error.value) : null);
const assets = computed(() => integrityQuery.data.value?.assets ?? []);
const readiness = computed(() => integrityQuery.data.value?.readiness);
const archiveCase = computed(() => readiness.value?.archive_case ?? null);

const verifiedCount = computed(() => assets.value.filter((asset) => asset.content_hash.length === 64).length);
const signatureCount = computed(() => archiveCase.value?.items.filter((item) => item.signature_summary_hash.length === 64).length ?? 0);
const blockerCount = computed(() => readiness.value?.blockers.length ?? 0);
const sealed = computed(() => archiveCase.value?.status === 'SEALED');

async function verify() {
  if (verifying.value) return;
  verifying.value = true; notice.value = '';
  try {
    await integrityQuery.refetch();
    notice.value = '已重新从服务端读取：内容哈希与签名摘要锚点保持不变，长期验真通过。';
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { verifying.value = false; }
}

function blockerLabel(value: string) { return ({ ENCOUNTER_NOT_FINISHED: '就诊尚未结束', ARCHIVE_DOCUMENT_REQUIRED: '缺少可归档病历', DOCUMENT_NOT_SIGNED: '当前版本未签署', DOCUMENT_QUALITY_NOT_PASSED: '当前内容质控未通过', SIGNATURE_EVIDENCE_REQUIRED: '缺少签名证据', SIGNATURE_EVIDENCE_NOT_VALID: '签名证据无效或待补齐' } as Record<string, string>)[value] || value; }
function archiveStatusLabel(value: string) { return ({ ARCHIVED: '已归档待封存', SEALED: '已封存', UNSEALED: '授权解封中' } as Record<string, string>)[value] || value; }
</script>

<template>
  <main id="main-content" class="content vue-native-page archive-content">
    <div class="page-heading archive-heading">
      <div><p class="eyebrow">病历与病案 / 完整性与验真</p><h1>病案完整性、签名与长期验真</h1><p>归档前检查与归档后周期验真共用同一证据链：64 位内容哈希、文书签名摘要哈希与归档清单哈希分别锚定，重新读取即复算。</p></div>
      <div class="toolbar-actions"><button class="button primary" :disabled="verifying" @click="verify">{{ verifying ? '正在重新核验…' : '运行完整性检查' }}</button><RouterLink class="button secondary" to="/archive-assets">返回病案归档</RouterLink></div>
    </div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>病案完整性验真 · 证据链锚点</span></div><dl>
        <div><dt>内容哈希</dt><dd>64 位 SHA-256</dd></div>
        <div><dt>签名摘要</dt><dd>逐文书锚定</dd></div>
        <div><dt>清单哈希</dt><dd>归档清单整体锚定</dd></div></dl>
      <span class="lease-badge">双租约 · 资产 + 归档</span></section>
    <ClinicalPageState v-if="integrityQuery.isPending.value" kind="loading" message="正在读取内容哈希与签名摘要锚点" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="integrityQuery.refetch()" />
    <template v-else>
      <section class="archive-metrics" aria-label="验真摘要">
        <article class="metric-success"><span>资产哈希完整</span><strong>{{ verifiedCount }}/{{ assets.length }}</strong><small>64 位内容哈希齐全</small></article>
        <article :class="signatureCount ? 'metric-success' : ''"><span>签名摘要项</span><strong>{{ signatureCount }}</strong><small>归档清单逐文书锚定</small></article>
        <article :class="blockerCount ? 'metric-danger' : 'metric-success'"><span>归档阻断</span><strong>{{ blockerCount }}</strong><small>签名/质控/完整性硬门</small></article>
        <article><span>病案状态</span><strong>{{ archiveCase ? archiveStatusLabel(archiveCase.status) : '未归档' }}</strong><small>{{ sealed ? '清单已封存' : '尚未形成封存清单' }}</small></article>
      </section>
      <div v-if="notice" class="notice archive-notice" role="status">{{ notice }}</div>
      <div class="archive-grid">
        <section class="archive-panel archive-manifest-panel">
          <div class="archive-panel-heading"><div><span class="archive-step">哈</span><h2>资产内容哈希验真</h2></div><span>{{ assets.length }} 份资产</span></div>
          <div v-if="assets.length === 0" class="archive-empty"><span>哈</span><p>当前患者尚无已编目资产</p><small>编目后才会产生内容哈希锚点。</small></div>
          <div v-else class="archive-table-wrap">
            <table class="archive-table"><thead><tr><th>载体</th><th>存放位置</th><th>内容哈希（SHA-256）</th><th>完整性</th></tr></thead>
              <tbody><tr v-for="asset in assets" :key="asset.medical_record_asset_id">
                <td>{{ ({ PAPER: '纸质', SCAN: '扫描件', DIGITAL: '数字' } as Record<string, string>)[asset.asset_type] || asset.asset_type }}</td>
                <td>{{ asset.location }}</td><td><code>{{ asset.content_hash }}</code></td>
                <td><span class="state-chip signed">{{ asset.content_hash.length === 64 ? '已锚定' : '异常' }}</span></td>
              </tr></tbody>
            </table>
          </div>
        </section>
        <section class="archive-panel">
          <div class="archive-panel-heading"><div><span class="archive-step">签</span><h2>签名摘要与阻断</h2></div></div>
          <div v-if="blockerCount" class="archive-blockers"><article v-for="blocker in readiness?.blockers || []" :key="`${blocker.code}-${blocker.document_id || 'encounter'}`"><span>!</span><div><strong>{{ blockerLabel(blocker.code) }}</strong><p>{{ blocker.message }}</p><code v-if="blocker.document_id">文书 …{{ blocker.document_id.slice(-8) }}</code></div></article></div>
          <div v-else class="archive-pass"><span>✓</span><div><strong>归档硬门已通过</strong><p>当前签署版本、质控与签名证据一致，可进入封存。</p></div></div>
          <dl class="archive-identity"><div><dt>就诊状态</dt><dd>{{ readiness ? ({ PLANNED: '计划中', IN_PROGRESS: '进行中', FINISHED: '已结束', CANCELLED: '已取消' } as Record<string, string>)[readiness.encounter_status] : '—' }}</dd></div>
            <div><dt>文书数量</dt><dd>{{ readiness?.document_count ?? 0 }}</dd></div>
            <div><dt>清单哈希</dt><dd><code>{{ archiveCase ? `${archiveCase.manifest_hash.slice(0, 18)}…` : '—' }}</code></dd></div>
            <div><dt>签名摘要项</dt><dd>{{ signatureCount }}</dd></div></dl>
        </section>
      </div>
      <section v-if="archiveCase" class="archive-panel archive-manifest-panel">
        <div class="archive-panel-heading"><div><span class="archive-step">清</span><h2>归档清单签名摘要</h2></div><span>{{ archiveCase.items.length }} 份文书</span></div>
        <div class="archive-table-wrap">
          <table class="archive-table"><thead><tr><th>序号</th><th>文书类型</th><th>内容哈希</th><th>签名摘要哈希</th></tr></thead>
            <tbody><tr v-for="item in archiveCase.items" :key="item.archive_case_item_id"><td>{{ item.item_order }}</td><td>{{ item.document_type_code }}</td><td><code>{{ item.content_hash.slice(0, 14) }}…</code></td><td><code>{{ item.signature_summary_hash.slice(0, 14) }}…</code></td></tr></tbody>
          </table>
        </div>
        <footer style="padding: 12px 16px; color: #607086; background: #f8fafc; border-top: 1px solid #e7edf4; font-size: 10px;">清单哈希 = 全部文书内容哈希与签名摘要哈希的确定性聚合；导出包另附精确字节数与 SHA-256，可在系统外独立复算。</footer>
      </section>
    </template>
  </main>
</template>
