<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRoute } from 'vue-router';
import { issueMedicalRecordAssetLease, listMedicalRecordAssets } from '../../api/records';
import { developmentCopy } from '../../development-copy';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const selectedId = ref(typeof route.query.asset === 'string' ? route.query.asset : '');
const assetsQuery = useQuery({
  queryKey: ['clinical', 'medical-record-assets', 'detail'],
  queryFn: async () => {
    const lease = await issueMedicalRecordAssetLease();
    return { lease, assets: await listMedicalRecordAssets(lease) };
  },
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => assetsQuery.error.value ? toClinicalIssue(assetsQuery.error.value) : null);
const assets = computed(() => assetsQuery.data.value?.assets ?? []);
const selected = computed(() => assets.value.find((asset) => asset.medical_record_asset_id === selectedId.value) ?? assets.value[0] ?? null);

function typeLabel(value: string) { return ({ PAPER: '纸质原件', SCAN: '扫描件', DIGITAL: '数字原生' } as Record<string, string>)[value] || value; }
function statusLabel(value: string) { return ({ ARCHIVED: '在库', BORROWED: '借出中' } as Record<string, string>)[value] || value; }
function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
</script>

<template>
  <main id="main-content" class="content vue-native-page archive-content">
    <div class="page-heading archive-heading">
      <div><p class="eyebrow">病历与病案 / 病案资产证据</p><h1>病案资产证据详情</h1><p>单份病案资产的不可变身份、内容哈希与借阅状态；原件哈希在编目后即长期验真锚点，不可被前端或后续流程改写。</p></div>
      <RouterLink class="button secondary" to="/archive-integrity">返回完整性验真</RouterLink>
    </div>
    <section class="patient-strip" aria-label="患者上下文"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div>
      <div><strong>{{ developmentCopy.patientName }}</strong><span>病案资产证据 · 患者级上下文</span></div><dl>
        <div><dt>证据口径</dt><dd>服务端事实</dd></div>
        <div><dt>原件保真</dt><dd>内容哈希锚定</dd></div>
        <div><dt>不可变性</dt><dd>触发器兜底</dd></div></dl>
      <span class="lease-badge">患者级租约</span></section>
    <ClinicalPageState v-if="assetsQuery.isPending.value" kind="loading" message="正在加载病案资产证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="assetsQuery.refetch()" />
    <div v-else-if="assets.length === 0" class="archive-panel archive-empty" style="min-height: 320px"><span>证</span><p>当前患者尚无已编目资产</p><small>编目后才会产生内容哈希证据。</small></div>
    <div v-else class="archive-grid">
      <section class="archive-panel">
        <div class="archive-panel-heading"><div><span class="archive-step">证</span><h2>资产不可变身份</h2></div><span v-if="selected" class="state-chip" :class="{ signed: selected.status === 'ARCHIVED' }">{{ statusLabel(selected.status) }}</span></div>
        <dl class="archive-identity">
          <div><dt>资产 ID</dt><dd><code>{{ selected?.medical_record_asset_id }}</code></dd></div>
          <div><dt>患者归属</dt><dd><code>…{{ selected?.patient_id.slice(-8) }}</code></dd></div>
          <div><dt>关联就诊</dt><dd><code>{{ selected?.encounter_id ? `…${selected.encounter_id.slice(-8)}` : '无（患者级资产）' }}</code></dd></div>
          <div><dt>载体类型</dt><dd>{{ selected ? typeLabel(selected.asset_type) : '—' }}</dd></div>
          <div><dt>存放位置</dt><dd>{{ selected?.location }}</dd></div>
          <div><dt>行版本</dt><dd>{{ selected?.row_version }}</dd></div>
        </dl>
        <div class="archive-pass" style="margin-top: 14px"><span>✓</span><div><strong>原件内容哈希已锚定</strong><p>编目后 patient_id / 载体 / 位置 / 内容哈希 由数据库触发器禁止更新，原件与转换件不可互相替代。</p></div></div>
        <div class="archive-panel-heading" style="margin-top: 18px"><div><span class="archive-step">哈</span><h2>内容哈希（SHA-256）</h2></div></div>
        <div class="archive-table-wrap"><table class="archive-table"><tbody><tr><td style="font-family: ui-monospace, monospace; word-break: break-all">{{ selected?.content_hash }}</td></tr></tbody></table></div>
        <div class="archive-panel-heading" style="margin-top: 18px"><div><span class="archive-step">借</span><h2>借阅状态</h2></div></div>
        <dl class="archive-identity">
          <div><dt>状态</dt><dd>{{ selected ? statusLabel(selected.status) : '—' }}</dd></div>
          <div><dt>借阅人</dt><dd><code>{{ selected?.borrowed_by ? `…${selected.borrowed_by.slice(-8)}` : '—' }}</code></dd></div>
          <div><dt>借出时间</dt><dd>{{ formatDate(selected?.borrowed_at) }}</dd></div>
          <div><dt>到期时间</dt><dd>{{ formatDate(selected?.due_at) }}</dd></div>
        </dl>
      </section>
      <aside class="archive-panel">
        <div class="archive-panel-heading"><div><span class="archive-step">选</span><h2>选择资产</h2></div><span>{{ assets.length }} 份</span></div>
        <div class="ward-list">
          <button v-for="asset in assets" :key="asset.medical_record_asset_id" :class="{ active: selected?.medical_record_asset_id === asset.medical_record_asset_id }" @click="selectedId = asset.medical_record_asset_id">
            <b>{{ typeLabel(asset.asset_type) }} · {{ asset.location }}</b>
            <span>{{ asset.content_hash.slice(0, 22) }}… · {{ statusLabel(asset.status) }}</span>
          </button>
        </div>
      </aside>
    </div>
  </main>
</template>
