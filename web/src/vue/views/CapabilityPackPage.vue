<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import type { CapabilityPackReleaseWire, CapabilityPackWire } from '../../generated/contracts';
import type { ConfigurationItemWire } from '../../generated/contracts';
import {
  createCapabilityPackRelease, defineCapabilityPack, deactivateCapabilityPack, issueGovernanceLease,
  listCapabilityPackReleases, listCapabilityPacks, promoteCapabilityPackRelease, retireCapabilityPackRelease,
  rollbackCapabilityPackRelease, startCapabilityPackReleaseCanary,
} from '../../api/governance';
import { defineConfiguration, issueConfigurationLease, listConfigurations, updateConfiguration } from '../../api/config';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({
  queryKey: ['governance', 'capability', 'lease'],
  queryFn: () => issueGovernanceLease('CAPABILITY_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const packsQuery = useQuery({
  queryKey: ['governance', 'capability', 'packs'],
  queryFn: () => listCapabilityPacks(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? packsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? packsQuery.error.value) : null);
const syntheticPacks: CapabilityPackWire[] = [
  { capability_pack_id: '018f0000-0000-7000-8000-00000000c301', pack_code: 'SYN-CORE-CLINICAL', pack_name: '临床核心能力包', inherits_from: null, status: 'ACTIVE' },
  { capability_pack_id: '018f0000-0000-7000-8000-00000000c302', pack_code: 'SYN-TERTIARY-HOSPITAL', pack_name: '三级医院增强能力包', inherits_from: 'SYN-CORE-CLINICAL', status: 'ACTIVE' },
  { capability_pack_id: '018f0000-0000-7000-8000-00000000c303', pack_code: 'SYN-CARDIOLOGY', pack_name: '心血管专科能力包', inherits_from: 'SYN-TERTIARY-HOSPITAL', status: 'ACTIVE' },
];
const packs = computed(() => packsQuery.data.value?.length ? packsQuery.data.value : syntheticPacks);

const selectedPackId = ref('');
const selectedPack = computed(() => packs.value.find((p) => p.capability_pack_id === selectedPackId.value) ?? null);
const releasesQuery = useQuery({
  queryKey: ['governance', 'capability', 'releases', selectedPackId],
  queryFn: () => listCapabilityPackReleases(leaseQuery.data.value!, selectedPackId.value || undefined),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const releases = computed(() => releasesQuery.data.value ?? []);

const packForm = reactive({ packCode: '', packName: '', inheritsFrom: '' });
const releaseForm = reactive({ releaseVersion: '', releasedAt: new Date().toISOString() });
const busy = ref('');
const notice = ref('');
const compositionLease = useQuery({ queryKey: ['capability', 'composition-lease'], queryFn: issueConfigurationLease, retry: false, staleTime: 300000, gcTime: 0 });
const compositionsQuery = useQuery({ queryKey: ['capability', 'compositions'], queryFn: () => listConfigurations(compositionLease.data.value!, 'CAPABILITY_PACK_COMPOSITION'), enabled: () => Boolean(compositionLease.data.value), retry: false });
const composition = ref<ConfigurationItemWire | null>(null);
const selectedModules = ref<string[]>(['CORE_PATIENT', 'CLINICAL_RECORD', 'ORDER_RESULT', 'DIGITAL_SIGNATURE', 'AUDIT_OUTBOX', 'SPECIALTY_CARDIOLOGY']);
const moduleCatalog = [
  { code: 'CORE_PATIENT', name: '患者与就诊核心', group: '公共内核', protected: true, requires: [] },
  { code: 'CLINICAL_RECORD', name: '结构化病历', group: '公共内核', protected: true, requires: ['CORE_PATIENT'] },
  { code: 'ORDER_RESULT', name: '医嘱与结果闭环', group: '临床业务', protected: false, requires: ['CORE_PATIENT'] },
  { code: 'DIGITAL_SIGNATURE', name: '数字签署', group: '安全治理', protected: true, requires: ['CLINICAL_RECORD'] },
  { code: 'AUDIT_OUTBOX', name: '审计与可靠事件', group: '安全治理', protected: true, requires: ['CORE_PATIENT'] },
  { code: 'SPECIALTY_CARDIOLOGY', name: '心血管专科增强', group: '专科能力', protected: false, requires: ['CLINICAL_RECORD', 'ORDER_RESULT'] },
  { code: 'SPECIALTY_PEDIATRICS', name: '儿科剂量与生长曲线', group: '专科能力', protected: false, requires: ['CLINICAL_RECORD', 'ORDER_RESULT'] },
  { code: 'LEGACY_EXPORT', name: '旧版全量导出', group: '兼容能力', protected: false, requires: ['CORE_PATIENT'] },
] as const;
const missingDependencies = computed(() => moduleCatalog.flatMap(module => selectedModules.value.includes(module.code)
  ? module.requires.filter(required => !selectedModules.value.includes(required)).map(required => `${module.name} 依赖 ${moduleCatalog.find(item => item.code === required)?.name ?? required}`) : []));
const conflicts = computed(() => selectedModules.value.includes('LEGACY_EXPORT') && selectedModules.value.includes('SPECIALTY_CARDIOLOGY') ? ['旧版全量导出与心血管专科最小必要范围冲突'] : []);
const rating = computed(() => missingDependencies.value.length || conflicts.value.length ? '阻断发布' : selectedModules.value.includes('SPECIALTY_CARDIOLOGY') ? '专科闭环 · A' : '通用可用 · B');

watch(packs, (value) => { if (!selectedPackId.value && value[0]) selectedPackId.value = value[0].capability_pack_id; }, { immediate: true });
watch([selectedPack, () => compositionsQuery.data.value], ([pack, configs]) => {
  if (!pack) return;
  const key = `composition-${pack.pack_code.toLowerCase()}`;
  composition.value = (configs ?? []).find(item => item.config_key === key) ?? null;
  const modules = composition.value?.payload?.selected_modules;
  selectedModules.value = Array.isArray(modules) ? modules.map(String) : ['CORE_PATIENT', 'CLINICAL_RECORD', 'ORDER_RESULT', 'DIGITAL_SIGNATURE', 'AUDIT_OUTBOX', ...(pack.pack_code.includes('CARDIOLOGY') ? ['SPECIALTY_CARDIOLOGY'] : [])];
}, { immediate: true });

async function saveComposition() {
  const lease = compositionLease.data.value; const pack = selectedPack.value;
  if (!lease || !pack || busy.value) return;
  busy.value = 'composition'; notice.value = '';
  const payload = {
    schema_version: 2, capability_pack_id: pack.capability_pack_id, inherits_from: pack.inherits_from,
    selected_modules: selectedModules.value,
    dependencies: moduleCatalog.flatMap(module => module.requires.map(required => ({ module: module.code, requires: required }))),
    conflicts: [{ left: 'LEGACY_EXPORT', right: 'SPECIALTY_CARDIOLOGY' }],
    protected_modules: moduleCatalog.filter(module => module.protected).map(module => module.code),
    scope_overrides: [{ scope: '心血管内科', module: 'SPECIALTY_CARDIOLOGY', effect: 'ENABLE' }],
    rating_impact: rating.value, rollout_tasks: ['运行依赖解析', '合成病例回放', '科室负责人联合签署'],
  };
  try {
    composition.value = composition.value
      ? await updateConfiguration(lease, composition.value.config_id, { display_name: `${pack.pack_name} · 能力组合`, payload, expected_version: composition.value.row_version })
      : await defineConfiguration(lease, { config_type: 'CAPABILITY_PACK_COMPOSITION', config_key: `composition-${pack.pack_code.toLowerCase()}`, display_name: `${pack.pack_name} · 能力组合`, payload });
    notice.value = '能力组合、依赖、范围覆盖和评级影响已写入数据库。'; await compositionsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    ACTIVE: '有效', INACTIVE: '已停用', DRAFT: '草稿', CANARY: '灰度', RETIRED: '已退休', ROLLED_BACK: '已回退',
  };
  return map[status] ?? status;
}

async function createPack() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !packForm.packCode.trim() || !packForm.packName.trim()) return;
  busy.value = 'pack'; notice.value = '';
  try {
    await defineCapabilityPack(lease, {
      pack_code: packForm.packCode.trim(), pack_name: packForm.packName.trim(),
      inherits_from: packForm.inheritsFrom.trim() || null,
    });
    packForm.packCode = ''; packForm.packName = ''; packForm.inheritsFrom = '';
    notice.value = '能力包已定义。'; await packsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function deactivate(pack: CapabilityPackWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || pack.status !== 'ACTIVE') return;
  busy.value = pack.capability_pack_id; notice.value = '';
  try { await deactivateCapabilityPack(lease, pack); notice.value = `${pack.pack_name} 已停用。`; await packsQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function createRelease() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !selectedPack.value || !releaseForm.releaseVersion.trim()) return;
  busy.value = 'release'; notice.value = '';
  try {
    await createCapabilityPackRelease(lease, {
      capability_pack_id: selectedPack.value.capability_pack_id,
      release_version: releaseForm.releaseVersion.trim(), released_at: releaseForm.releasedAt,
    });
    releaseForm.releaseVersion = ''; notice.value = '发布已创建。'; await releasesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function transition(release: CapabilityPackReleaseWire, action: 'canary' | 'promote' | 'retire' | 'rollback') {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = release.release_id; notice.value = '';
  try {
    if (action === 'canary') await startCapabilityPackReleaseCanary(lease, release);
    else if (action === 'promote') await promoteCapabilityPackRelease(lease, release);
    else if (action === 'retire') await retireCapabilityPackRelease(lease, release);
    else await rollbackCapabilityPackRelease(lease, release, '灰度回退（管理员确认）');
    notice.value = `发布 ${release.release_version} 状态已推进。`; await releasesQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div><p class="eyebrow">配置中心 / 机构能力包</p><h1>能力包与灰度发布</h1><p>能力包按机构差异化配置，继承不可自指；发布走草稿→灰度→全量→退休状态机，回退必附原因。</p></div>
    </div>

    <p v-if="issue" class="admin-notice" role="alert">{{ issue.code }}：{{ issue.message }}。当前展示确定性仿真能力包，登录后可写入数据库。</p>
    <template v-if="true">
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>能力包台账</h2><p>编码唯一，停用保留继承历史。</p></div><button class="button secondary" @click="packsQuery.refetch()">刷新</button></header>
          <div v-if="packs.length === 0" class="admin-empty">暂无能力包，可在下方新增。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>编码 / 名称</th><th>继承</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="pack in packs" :key="pack.capability_pack_id" :class="{ 'is-selected': pack.capability_pack_id === selectedPackId }">
              <td><button class="link-button" @click="selectedPackId = pack.capability_pack_id"><strong>{{ pack.pack_name }}</strong><small><code>{{ pack.pack_code }}</code></small></button></td>
              <td>{{ pack.inherits_from ? '继承自其他包' : '独立' }}</td>
              <td><span class="admin-status" :class="pack.status.toLowerCase()">{{ statusLabel(pack.status) }}</span></td>
              <td><button class="task-action" :disabled="pack.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(pack)">{{ busy === pack.capability_pack_id ? '处理中…' : '停用' }}</button></td>
            </tr>
          </tbody></table></div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增能力包</h2><p>自继承会被硬门拒绝。</p></div></header>
          <form class="admin-form" @submit.prevent="createPack">
            <label><span>能力包编码</span><input v-model="packForm.packCode" maxlength="96" required placeholder="例：PACK-TERTIARY" /></label>
            <label><span>能力包名称</span><input v-model="packForm.packName" maxlength="256" required placeholder="例：三级医院标准包" /></label>
            <label><span>继承编码（可选）</span><input v-model="packForm.inheritsFrom" maxlength="96" placeholder="留空为独立包" /></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'pack' ? '正在创建…' : '定义能力包' }}</button>
          </form>
        </section>
      </div>

      <section class="admin-panel composition-panel" v-if="selectedPack">
        <header><div><h2>能力组合与依赖解析 · {{ selectedPack.pack_name }}</h2><p>勾选模块后实时解析依赖、互斥、保护边界、科室覆盖与评级影响。</p></div><button class="button primary" :disabled="Boolean(busy)" @click="saveComposition">{{ busy === 'composition' ? '保存中…' : '保存能力组合' }}</button></header>
        <div class="composition-layout">
          <div class="module-catalog"><label v-for="module in moduleCatalog" :key="module.code" :class="{ selected: selectedModules.includes(module.code), protected: module.protected }"><input v-model="selectedModules" type="checkbox" :value="module.code" :disabled="module.protected" /><span><b>{{ module.name }}</b><code>{{ module.code }}</code></span><em>{{ module.group }}{{ module.protected ? ' · 受保护' : '' }}</em></label></div>
          <aside class="composition-summary"><h3>最终生效解析</h3><div class="rating" :class="{ blocked: missingDependencies.length || conflicts.length }"><span>能力评级</span><b>{{ rating }}</b></div><section><b>继承链</b><p>平台安全基线 → {{ selectedPack.inherits_from || '独立能力包' }} → {{ selectedPack.pack_code }} → 科室范围覆盖</p></section><section><b>依赖与冲突</b><p v-if="!missingDependencies.length && !conflicts.length" class="ok">依赖完整，无互斥冲突</p><ul><li v-for="item in missingDependencies" :key="item">{{ item }}</li><li v-for="item in conflicts" :key="item">{{ item }}</li></ul></section><section><b>发布任务</b><p>合成病例回放 · 科室负责人联合签署 · 灰度观察 · 审计留痕</p></section></aside>
        </div>
      </section>

      <section class="admin-panel" v-if="selectedPack">
        <header><div><h2>灰度发布 · {{ selectedPack.pack_name }}</h2><p>同一能力包至多一个 ACTIVE 发布。</p></div>
          <form class="admin-inline-form" @submit.prevent="createRelease">
            <input v-model="releaseForm.releaseVersion" maxlength="64" required placeholder="发布版本，例：1.2.0" />
            <button class="button primary" :disabled="Boolean(busy)">{{ busy === 'release' ? '创建中…' : '创建发布' }}</button>
          </form>
        </header>
        <div v-if="releases.length === 0" class="admin-empty">该能力包暂无发布。</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>版本</th><th>状态</th><th>发布时间</th><th>操作</th></tr></thead><tbody>
          <tr v-for="release in releases" :key="release.release_id">
            <td><strong>v{{ release.release_version }}</strong><small>…{{ release.release_id.slice(-8) }} · v{{ release.row_version }}</small></td>
            <td><span class="admin-status" :class="release.lifecycle_status.toLowerCase()">{{ statusLabel(release.lifecycle_status) }}</span></td>
            <td>{{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(release.released_at)) }}</td>
            <td>
              <button v-if="release.lifecycle_status === 'DRAFT'" class="task-action" :disabled="Boolean(busy)" @click="transition(release, 'canary')">启动灰度</button>
              <template v-else-if="release.lifecycle_status === 'CANARY'">
                <button class="task-action" :disabled="Boolean(busy)" @click="transition(release, 'promote')">提升全量</button>
                <button class="task-action danger" :disabled="Boolean(busy)" @click="transition(release, 'rollback')">回退</button>
              </template>
              <button v-else-if="release.lifecycle_status === 'ACTIVE'" class="task-action" :disabled="Boolean(busy)" @click="transition(release, 'retire')">退休</button>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody></table></div>
      </section>
    </template>
  </section>
</template>

<style scoped>
.composition-panel{margin-top:16px}.composition-layout{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(280px,.8fr);gap:16px;padding:16px}.module-catalog{display:grid;grid-template-columns:1fr 1fr;gap:9px}.module-catalog label{display:grid;grid-template-columns:auto 1fr auto;gap:9px;align-items:center;padding:11px;border:1px solid #dce4eb;border-radius:8px;background:#fff;cursor:pointer}.module-catalog label.selected{border-color:#75acd3;background:#f2f8fc}.module-catalog label.protected{border-color:#dfc682;background:#fffaf0}.module-catalog span{display:grid;gap:3px}.module-catalog code{font-size:9px;color:#6c7887}.module-catalog em{font-style:normal;font-size:9px;color:#657487}.composition-summary{display:grid;gap:10px;padding:14px;border:1px solid #dce4eb;border-radius:9px;background:#f7f9fb}.composition-summary h3{margin:0;font-size:14px}.composition-summary section{padding-top:9px;border-top:1px solid #dfe6ec}.composition-summary p{margin:5px 0;color:#647386;font-size:11px;line-height:1.55}.composition-summary ul{margin:6px 0 0;padding-left:18px;color:#a33131;font-size:11px}.rating{display:flex;justify-content:space-between;padding:11px;border:1px solid #abd9bf;border-radius:7px;background:#edf9f2;color:#236a42}.rating.blocked{border-color:#edb7b7;background:#fff0f0;color:#9b3131}.ok{color:#28764a!important}@media(max-width:800px){.composition-layout{grid-template-columns:1fr}.module-catalog{grid-template-columns:1fr}}
</style>
