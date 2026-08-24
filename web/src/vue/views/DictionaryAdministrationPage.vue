<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DictionaryItemWire } from '../../generated/contracts';
import { createDictionaryItem, deactivateDictionaryItem, issueGovernanceLease, listDictionaryItems } from '../../api/governance';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const code = ref('SEX');
const leaseQuery = useQuery({
  queryKey: ['governance', 'dictionary', 'lease'],
  queryFn: () => issueGovernanceLease('DICTIONARY_ADMIN'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const itemsQuery = useQuery({
  queryKey: ['governance', 'dictionary', 'items', code],
  queryFn: () => listDictionaryItems(leaseQuery.data.value!, code.value),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const activeCount = computed(() => items.value.filter((item) => item.status === 'ACTIVE').length);

const form = reactive({ itemCode: '', itemName: '', effectiveFrom: new Date().toISOString() });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '长期有效';
}

async function reload() {
  notice.value = '';
  await Promise.all([itemsQuery.refetch()]);
}

async function createItem() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.itemCode.trim() || !form.itemName.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createDictionaryItem(lease, {
      dictionary_code: code.value.trim(),
      item_code: form.itemCode.trim(),
      item_name: form.itemName.trim(),
      effective_from: form.effectiveFrom,
    });
    form.itemCode = ''; form.itemName = '';
    notice.value = '字典项已生效，审计链与事件出箱已同步记录。';
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function deactivate(item: DictionaryItemWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || item.status !== 'ACTIVE') return;
  busy.value = item.dictionary_item_id; notice.value = '';
  try {
    await deactivateDictionaryItem(lease, item);
    notice.value = `字典项 ${item.item_name} 已停用。`;
    await itemsQuery.refetch();
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading">
      <div>
        <p class="eyebrow">配置中心 / 字典与术语</p>
        <h1>字典主数据</h1>
        <p>按字典编码管理术语与值集；所有变更使用版本号、幂等键、审计链与事件出箱，停用不物理删除。</p>
      </div>
      <div class="admin-inline-tools">
        <label class="admin-code-input"><span>字典编码</span><input v-model="code" placeholder="例：SEX / MARITAL_STATUS" maxlength="96" /></label>
        <button class="button secondary" :disabled="Boolean(busy) || !code.trim()" @click="reload">查询</button>
      </div>
    </div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取字典值集" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="字典项统计">
        <article><span>字典项</span><strong>{{ items.length }}</strong><small>当前编码</small></article>
        <article><span>有效项</span><strong>{{ activeCount }}</strong><small>ACTIVE</small></article>
      </section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>

      <div class="admin-layout">
        <section class="admin-panel">
          <header>
            <div><h2>值集台账 · {{ code }}</h2><p>编码不可变；停用保留历史语义。</p></div>
            <button class="button secondary" @click="itemsQuery.refetch()">刷新</button>
          </header>
          <div v-if="items.length === 0" class="admin-empty" role="status">该编码下暂无字典项，可在右侧新增。</div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>项编码</th><th>名称</th><th>生效</th><th>失效</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="item in items" :key="item.dictionary_item_id">
                  <td><code>{{ item.item_code }}</code></td>
                  <td><strong>{{ item.item_name }}</strong><small>…{{ item.dictionary_item_id.slice(-8) }} · v{{ item.row_version }}</small></td>
                  <td>{{ formatDate(item.effective_from) }}</td>
                  <td>{{ formatDate(item.effective_to) }}</td>
                  <td><span class="admin-status" :class="item.status.toLowerCase()">{{ item.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td>
                  <td><button class="task-action" :disabled="item.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(item)">{{ busy === item.dictionary_item_id ? '处理中…' : '停用' }}</button></td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>新增字典项</h2><p>编码与名称均为必填，生效时间默认当前。</p></div></header>
          <form class="admin-form" @submit.prevent="createItem">
            <label><span>项编码</span><input v-model="form.itemCode" maxlength="96" required placeholder="例：M" /></label>
            <label><span>项名称</span><input v-model="form.itemName" maxlength="256" required placeholder="例：男性" /></label>
            <label><span>生效时间</span><input v-model="form.effectiveFrom" type="datetime-local" required /></label>
            <button class="button primary full" :disabled="Boolean(busy) || !code.trim()">{{ busy === 'create' ? '正在创建…' : '创建并生效' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
