<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { CapabilityPackReleaseWire, CapabilityPackWire } from '../../generated/contracts';
import {
  createCapabilityPackRelease, defineCapabilityPack, deactivateCapabilityPack, issueGovernanceLease,
  listCapabilityPackReleases, listCapabilityPacks, promoteCapabilityPackRelease, retireCapabilityPackRelease,
  rollbackCapabilityPackRelease, startCapabilityPackReleaseCanary,
} from '../../api/governance';
import ClinicalPageState from '../components/ClinicalPageState.vue';
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
const packs = computed(() => packsQuery.data.value ?? []);

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

    <ClinicalPageState v-if="leaseQuery.isPending.value || packsQuery.isPending.value" kind="loading" message="正在读取能力包" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="packsQuery.refetch()" />
    <template v-else>
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
