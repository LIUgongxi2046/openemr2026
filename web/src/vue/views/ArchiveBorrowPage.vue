<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import type { MedicalRecordAssetWire } from '../../generated/contracts';
import { borrowMedicalRecordAsset, issueMedicalRecordAssetLease, listMedicalRecordAssets, returnMedicalRecordAsset } from '../../api/records';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const busy = ref('');
const notice = ref('');
const dueDays = ref(7);
const assetsQuery = useQuery({
  queryKey: ['clinical', 'medical-record-assets'],
  queryFn: async () => {
    const lease = await issueMedicalRecordAssetLease();
    return { lease, assets: await listMedicalRecordAssets(lease) };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => assetsQuery.error.value ? toClinicalIssue(assetsQuery.error.value) : null);
const assets = computed(() => assetsQuery.data.value?.assets ?? []);

const archivedCount = computed(() => assets.value.filter((asset) => asset.status === 'ARCHIVED').length);
const borrowedCount = computed(() => assets.value.filter((asset) => asset.status === 'BORROWED').length);
const overdueCount = computed(() => assets.value.filter((asset) => asset.status === 'BORROWED' && asset.due_at && new Date(asset.due_at).getTime() < Date.now()).length);

async function run(key: string, action: () => Promise<void>, success: string) {
  if (busy.value || !assetsQuery.data.value) return;
  busy.value = key; notice.value = '';
  try { await action(); await assetsQuery.refetch(); notice.value = success; }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function borrow(asset: MedicalRecordAssetWire) {
  const data = assetsQuery.data.value;
  if (!data) return;
  const dueAt = new Date(Date.now() + Math.max(1, dueDays.value) * 86400000).toISOString();
  void run(`borrow:${asset.medical_record_asset_id}`, async () => { await borrowMedicalRecordAsset(data.lease, asset, dueAt); }, '病案资产已按借阅状态机转为借出，归还前不可重复借出');
}

function returnAsset(asset: MedicalRecordAssetWire) {
  const data = assetsQuery.data.value;
  if (!data) return;
  void run(`return:${asset.medical_record_asset_id}`, async () => { await returnMedicalRecordAsset(data.lease, asset); }, '病案资产已归还入库，借阅状态清零');
}

function typeLabel(value: string) { return ({ PAPER: '纸质原件', SCAN: '扫描件', DIGITAL: '数字原生' } as Record<string, string>)[value] || value; }
function statusLabel(value: string) { return ({ ARCHIVED: '在库', BORROWED: '借出中' } as Record<string, string>)[value] || value; }
function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
</script>

<template>
  <section data-page-root class="content vue-native-page archive-content">
    <div class="page-heading archive-heading">
      <div><p class="eyebrow">病历与病案 / 病案借阅</p><h1>病案借阅、复制与对外提供</h1><p>纸质与扫描病案按借阅状态机流转：在库 → 借出 → 归还；借阅必须登记到期时限，内容哈希在编目后不可变更。</p></div>
      <RouterLink class="button secondary" to="/archive-assets">返回病案归档</RouterLink>
    </div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>病案资产借阅 · 患者级上下文</span></div><dl>
        <div><dt>资产归属</dt><dd>当前患者</dd></div>
        <div><dt>借阅规则</dt><dd>在库才可借出</dd></div>
        <div><dt>哈希硬门</dt><dd>编目后不可变</dd></div></dl>
      <span class="lease-badge">患者级租约</span></section>
    <ClinicalPageState v-if="assetsQuery.isPending.value" kind="loading" message="正在加载病案资产借阅状态" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assetsQuery.refetch()" />
    <template v-else>
      <section class="archive-metrics" aria-label="借阅状态摘要">
        <article><span>在库资产</span><strong>{{ archivedCount }}</strong><small>可发起借阅</small></article>
        <article><span>借出中</span><strong>{{ borrowedCount }}</strong><small>归还前锁定</small></article>
        <article :class="overdueCount ? 'metric-danger' : 'metric-success'"><span>逾期未还</span><strong>{{ overdueCount }}</strong><small>到期须催还</small></article>
        <article><span>编目总数</span><strong>{{ assets.length }}</strong><small>内容哈希 64 位 SHA-256</small></article>
      </section>
      <div v-if="notice" class="notice archive-notice" role="status">{{ notice }}</div>
      <section class="archive-panel archive-manifest-panel">
        <div class="archive-panel-heading"><div><span class="archive-step">借</span><h2>病案资产借阅清单</h2></div>
          <label class="archive-field" style="min-width: 180px"><span>借阅期限（天）</span><input v-model.number="dueDays" type="number" min="1" max="365" /></label>
        </div>
        <div v-if="assets.length === 0" class="archive-empty"><span>借</span><p>当前患者尚无已编目的病案资产</p><small>编目入口见病案目录，此处不使用前端示例伪造借阅数据。</small></div>
        <div v-else class="archive-table-wrap">
          <table class="archive-table"><thead><tr><th>载体</th><th>存放位置</th><th>内容哈希</th><th>状态</th><th>借阅人 / 到期</th><th>操作</th></tr></thead>
            <tbody><tr v-for="asset in assets" :key="asset.medical_record_asset_id">
              <td>{{ typeLabel(asset.asset_type) }}</td><td>{{ asset.location }}</td>
              <td><code>{{ asset.content_hash.slice(0, 16) }}…</code></td>
              <td><span class="state-chip" :class="{ signed: asset.status === 'ARCHIVED' }">{{ statusLabel(asset.status) }}</span></td>
              <td>{{ asset.status === 'BORROWED' ? `…${(asset.borrowed_by || '').slice(-8)} · ${formatDate(asset.due_at)}` : '—' }}</td>
              <td>
                <button v-if="asset.status === 'ARCHIVED'" class="button primary" :disabled="Boolean(busy)" @click="borrow(asset)">{{ busy === `borrow:${asset.medical_record_asset_id}` ? '借出中…' : '借阅' }}</button>
                <button v-else class="button secondary" :disabled="Boolean(busy)" @click="returnAsset(asset)">{{ busy === `return:${asset.medical_record_asset_id}` ? '归还中…' : '归还' }}</button>
              </td>
            </tr></tbody>
          </table>
        </div>
        <footer style="padding: 12px 16px; color: #607086; background: #f8fafc; border-top: 1px solid #e7edf4; font-size: 10px;">借阅与归还都是幂等命令：同一借出/归还按键不会重复入账，行版本冲突会提示重新加载后再操作。</footer>
      </section>
    </template>
  </section>
</template>
