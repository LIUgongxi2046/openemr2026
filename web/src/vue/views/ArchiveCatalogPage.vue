<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { issueMedicalRecordAssetLease, listMedicalRecordAssets } from '../../api/records';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const assetsQuery = useQuery({
  queryKey: ['clinical', 'medical-record-assets', 'catalog'],
  queryFn: async () => {
    const lease = await issueMedicalRecordAssetLease();
    return { lease, assets: await listMedicalRecordAssets(lease) };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => assetsQuery.error.value ? toClinicalIssue(assetsQuery.error.value) : null);
const assets = computed(() => assetsQuery.data.value?.assets ?? []);
const paperCount = computed(() => assets.value.filter((asset) => asset.asset_type === 'PAPER').length);
const scanCount = computed(() => assets.value.filter((asset) => asset.asset_type === 'SCAN').length);
const digitalCount = computed(() => assets.value.filter((asset) => asset.asset_type === 'DIGITAL').length);
const verifiedCount = computed(() => assets.value.filter((asset) => asset.content_hash.length === 64).length);

function typeLabel(value: string) { return ({ PAPER: '纸质原件', SCAN: '扫描件', DIGITAL: '数字原生' } as Record<string, string>)[value] || value; }
function statusLabel(value: string) { return ({ ARCHIVED: '在库', BORROWED: '借出中' } as Record<string, string>)[value] || value; }
</script>

<template>
  <section data-page-root class="content vue-native-page archive-content">
    <div class="page-heading archive-heading">
      <div><p class="eyebrow">病历与病案 / 病案目录</p><h1>病案目录与完整性</h1><p>按患者编目的病案资产目录：载体类型、存放位置与 64 位内容哈希；哈希在编目后由数据库触发器强制不可变，编目即验真锚点。</p></div>
      <div class="toolbar-actions"><RouterLink class="button secondary" to="/archive-integrity">完整性与验真</RouterLink><RouterLink class="button primary" to="/archive-borrow">借阅与归还</RouterLink></div>
    </div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>病案资产编目 · 患者级上下文</span></div><dl>
        <div><dt>编目口径</dt><dd>按患者归属</dd></div>
        <div><dt>完整性锚点</dt><dd>64 位 SHA-256</dd></div>
        <div><dt>不可变性</dt><dd>触发器兜底</dd></div></dl>
      <span class="lease-badge">患者级租约</span></section>
    <ClinicalPageState v-if="assetsQuery.isPending.value" kind="loading" message="正在加载病案目录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assetsQuery.refetch()" />
    <template v-else>
      <section class="archive-metrics" aria-label="目录完整性摘要">
        <article><span>纸质原件</span><strong>{{ paperCount }}</strong><small>需扫描/长期保存切片</small></article>
        <article><span>扫描件</span><strong>{{ scanCount }}</strong><small>PDF/A 等载体</small></article>
        <article><span>数字原生</span><strong>{{ digitalCount }}</strong><small>电子文书载体</small></article>
        <article class="metric-success"><span>哈希完整</span><strong>{{ verifiedCount }}/{{ assets.length }}</strong><small>64 位内容哈希齐全</small></article>
      </section>
      <section class="archive-panel archive-manifest-panel">
        <div class="archive-panel-heading"><div><span class="archive-step">目</span><h2>病案资产目录</h2></div><span>{{ assets.length }} 份资产</span></div>
        <div v-if="assets.length === 0" class="archive-empty"><span>目</span><p>当前患者尚无已编目的病案资产</p><small>此处不使用前端示例伪造目录数据；纸档扫描编目属于后续切片。</small></div>
        <div v-else class="archive-table-wrap">
          <table class="archive-table"><thead><tr><th>载体</th><th>存放位置</th><th>内容哈希（SHA-256）</th><th>状态</th><th>关联就诊</th><th>行版本</th><th></th></tr></thead>
            <tbody><tr v-for="asset in assets" :key="asset.medical_record_asset_id">
              <td>{{ typeLabel(asset.asset_type) }}</td><td>{{ asset.location }}</td>
              <td><code>{{ asset.content_hash }}</code></td>
              <td><span class="state-chip" :class="{ signed: asset.status === 'ARCHIVED' }">{{ statusLabel(asset.status) }}</span></td>
              <td><code>{{ asset.encounter_id ? `…${asset.encounter_id.slice(-8)}` : '—' }}</code></td>
              <td>{{ asset.row_version }}</td>
              <td><RouterLink class="task-action" :to="`/asset-detail?asset=${asset.medical_record_asset_id}`">证据详情</RouterLink></td>
            </tr></tbody>
          </table>
        </div>
        <footer style="padding: 12px 16px; color: #607086; background: #f8fafc; border-top: 1px solid #e7edf4; font-size: 10px;">内容哈希由数据库约束强制 64 位长度，编目后 patient_id / asset_type / location / content_hash 由触发器禁止更新，目录即长期验真的不可变锚点。</footer>
      </section>
    </template>
  </section>
</template>
