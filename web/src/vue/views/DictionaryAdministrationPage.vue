<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { DictionaryItemWire } from '../../generated/contracts';
import { createDictionaryItem, deactivateDictionaryItem, issueGovernanceLease, listDictionaryItems } from '../../api/governance';
import { SYSTEM_ADMINISTRATION_DICTIONARY_CODES } from '../../api/system-administration';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import { toClinicalIssue } from '../clinical-error';

const code = ref('GENDER');
const catalogSearch = ref('');
const catalogSort = ref<'RISK' | 'NAME' | 'COUNT'>('RISK');
const dictionaryCodes = SYSTEM_ADMINISTRATION_DICTIONARY_CODES;
const dictionaryLabels: Readonly<Record<string, string>> = Object.freeze({
  GENDER: '性别', ENCOUNTER_TYPE: '就诊类型', ALLERGY_SEVERITY: '过敏严重程度', LAB_UNIT: '检验单位值集',
  BLOOD_TYPE: 'ABO 血型', RH_TYPE: 'Rh 血型', ADMISSION_SOURCE: '入院来源', DISCHARGE_DISPOSITION: '离院方式',
  TRIAGE_LEVEL: '急诊分级', DOCUMENT_STATUS: '病历文书状态', CREDENTIAL_TYPE: '执业资质类型', MARITAL_STATUS: '婚姻状况',
  PAYMENT_TYPE: '医疗付费方式', CONSENT_STATUS: '知情同意状态', BED_CLASS: '床位类型',
});
const dictionaryStandards: Readonly<Record<string, string>> = Object.freeze({
  GENDER: '机构基础值集', ENCOUNTER_TYPE: '电子病历基本数据集', ALLERGY_SEVERITY: '临床安全值集', LAB_UNIT: 'UCUM + 机构扩展',
  BLOOD_TYPE: '临床输血基础值集', RH_TYPE: '临床输血基础值集', ADMISSION_SOURCE: '住院登记值集', DISCHARGE_DISPOSITION: '住院病案首页值集',
  TRIAGE_LEVEL: '院前与急诊分级值集', DOCUMENT_STATUS: '电子病历生命周期值集', CREDENTIAL_TYPE: '卫生专业人员资质目录', MARITAL_STATUS: '患者基本信息值集',
  PAYMENT_TYPE: '医疗保障与结算值集', CONSENT_STATUS: '知情同意生命周期值集', BED_CLASS: '床位主数据值集',
});
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
const catalogQuery = useQuery({
  queryKey: ['governance', 'dictionary', 'catalog'],
  queryFn: async () => (await Promise.all(dictionaryCodes.map((dictionaryCode) => listDictionaryItems(leaseQuery.data.value!, dictionaryCode)))).flat(),
  enabled: () => Boolean(leaseQuery.data.value), retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value ?? catalogQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value ?? catalogQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const catalogRows = computed(() => dictionaryCodes.map((dictionaryCode) => {
  const values = (catalogQuery.data.value ?? []).filter((item) => item.dictionary_code === dictionaryCode);
  return { code: dictionaryCode, name: dictionaryLabels[dictionaryCode], standard: dictionaryStandards[dictionaryCode], count: values.length, inactive: values.filter((item) => item.status !== 'ACTIVE').length };
}).filter((catalog) => {
  const keyword = catalogSearch.value.trim().toLocaleLowerCase();
  return !keyword || `${catalog.code} ${catalog.name} ${catalog.standard}`.toLocaleLowerCase().includes(keyword);
}).sort((left, right) => catalogSort.value === 'NAME' ? left.name.localeCompare(right.name, 'zh-CN')
  : catalogSort.value === 'COUNT' ? right.count - left.count
    : right.inactive - left.inactive || right.count - left.count));
const activeCount = computed(() => items.value.filter((item) => item.status === 'ACTIVE').length);
const catalogTotalCount = computed(() => (catalogQuery.data.value ?? []).length);

function localDateTimeValue(value = new Date()) {
  const offset = value.getTimezoneOffset() * 60_000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}

const form = reactive({ itemCode: '', itemName: '', effectiveFrom: localDateTimeValue() });
const busy = ref('');
const notice = ref('');
const panel = ref<'NONE' | 'REFERENCES'>('NONE');
const createOpen = ref(false);
const importOpen = ref(false);
const deactivateTarget = ref<DictionaryItemWire | null>(null);
const importText = ref('mmol/L,毫摩尔每升 / millimole per litre\nmg/dL,毫克每分升 / milligram per decilitre');
const selectedItemId = ref('');
const selectedItem = computed(() => items.value.find((item) => item.dictionary_item_id === selectedItemId.value) ?? items.value[0] ?? null);

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '长期有效';
}

async function reload() {
  notice.value = '';
  await Promise.all([itemsQuery.refetch(), catalogQuery.refetch()]);
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
      effective_from: new Date(form.effectiveFrom).toISOString(),
    });
    form.itemCode = ''; form.itemName = '';
    notice.value = '字典项已生效，审计链与事务事件记录已同步保存。';
    createOpen.value = false;
    await Promise.all([itemsQuery.refetch(), catalogQuery.refetch()]);
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
    deactivateTarget.value = null;
    await Promise.all([itemsQuery.refetch(), catalogQuery.refetch()]);
  } catch (error) {
    const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`;
  } finally { busy.value = ''; }
}

async function importVersion() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  const rows = importText.value.split(/\r?\n/).map((line) => line.split(',').map((value) => value.trim())).filter((row) => row.some(Boolean));
  busy.value = 'import'; notice.value = ''; let created = 0;
  try {
    for (const [itemCode, itemName] of rows) {
      if (!itemCode || !itemName) throw new Error(`第 ${created + 1} 行缺少项编码或名称`);
      await createDictionaryItem(lease, { dictionary_code: code.value.trim(), item_code: itemCode, item_name: itemName, effective_from: new Date().toISOString() }); created += 1;
    }
    notice.value = `版本导入完成：${created} 个字典项已写入数据库，并记录审计与事务事件。`; importOpen.value = false;
  } catch (error) { const next = toClinicalIssue(error); notice.value = `已成功 ${created} 项；第 ${created + 1} 项停止：${next.code}：${next.message}`; }
  finally { await Promise.all([itemsQuery.refetch(), catalogQuery.refetch()]); busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-head"><div class="page-title"><h1>字典、术语与值集中心</h1><p>标准术语、产品内置和机构扩展分层；历史记录始终按原版本解释</p></div><div class="head-actions"><button class="btn" :disabled="Boolean(busy) || !code.trim()" @click="importOpen = true">导入版本</button><button class="btn" @click="panel = panel === 'REFERENCES' ? 'NONE' : 'REFERENCES'">引用分析</button><button class="btn primary" @click="createOpen = true">新建字典</button></div></div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value || catalogQuery.isPending.value" kind="loading" message="正在读取字典值集" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <section v-if="panel === 'REFERENCES'" class="admin-panel admin-form-panel"><header><div><h2>{{ dictionaryLabels[code] ?? code }} · 引用分析</h2><p>按当前数据库值集版本核对可用性与历史语义保留策略。</p></div></header><div class="admin-impact-grid"><div><span>数据库条目</span><b>{{ items.length }}</b></div><div><span>当前有效</span><b>{{ activeCount }}</b></div><div><span>已停用</span><b>{{ items.length - activeCount }}</b></div><div><span>变更策略</span><b>仅停用，不物理删除</b></div></div></section>
      <div class="grid admin-list-detail">
        <section class="card"><div class="card-head">三级医院字典目录 <span class="sub">{{ dictionaryCodes.length }} 类 · {{ catalogTotalCount }} 条数据库记录</span></div><div class="toolbar"><input v-model="catalogSearch" class="search" placeholder="字典编码、名称或标准" /><select v-model="catalogSort" class="select" aria-label="字典排序"><option value="RISK">风险优先</option><option value="NAME">名称排序</option><option value="COUNT">条目数量</option></select></div><div class="admin-table-wrap"><table class="table"><thead><tr><th>字典名称 / 编码</th><th>来源 / 标准</th><th>全部条目</th><th>已停用条目</th><th>状态</th></tr></thead><tbody><tr v-for="catalog in catalogRows" :key="catalog.code" :class="{ selected: code === catalog.code }" @click="code = catalog.code; reload()"><td><b>{{ catalog.name }}</b><br><span class="meta">技术编码：{{ catalog.code }}</span></td><td>{{ catalog.standard }}</td><td>{{ catalog.count }}</td><td>{{ catalog.inactive }}</td><td><span class="status" :class="catalog.inactive ? 'amber' : 'green'">{{ catalog.inactive ? '含停用项' : '已发布' }}</span></td></tr></tbody></table></div></section>
        <aside class="card"><div class="card-head">{{ dictionaryLabels[code] ?? code }} · 当前发布值集</div><div class="card-body"><div class="folder-row">字典编码<span>{{ code }}</span></div><div class="folder-row">标准来源<span>{{ dictionaryStandards[code] ?? '机构扩展' }}</span></div><div class="folder-row">有效条目<span>{{ activeCount }} 条</span></div><div class="folder-row">数据库条目<span>{{ items.length }} 条</span></div><div v-for="item in items" :key="item.dictionary_item_id" class="queue-item"><div class="queue-title">{{ item.item_name }} <b>{{ item.item_code }}</b><span class="status" :class="item.status === 'ACTIVE' ? 'green' : 'amber'">{{ item.status === 'ACTIVE' ? '有效' : '已停用' }}</span></div><button class="task-action" type="button" :disabled="item.status !== 'ACTIVE' || Boolean(busy)" @click="deactivateTarget = item">停用</button></div><div class="notice hard"><div class="notice-title">历史引用保留原版本语义</div>已被业务事实引用的字典项不得物理删除，只能设置失效时间。</div><button class="btn primary admin-card-action" type="button" :disabled="Boolean(busy) || !code.trim()" @click="importOpen = true">处理版本差异</button></div></aside>
      </div>
    </template>
    <AdminActionDialog v-model:open="createOpen" title="新增字典条目" description="选择已有字典编码新增条目；新编码会同时建立该字典目录首个条目。" :busy="Boolean(busy)"><form class="admin-form compact-admin-form" @submit.prevent="createItem"><label><span>所属字典编码（系统唯一）</span><input v-model="code" autofocus maxlength="96" required /></label><label><span>条目编码（系统唯一）</span><input v-model="form.itemCode" maxlength="96" required placeholder="例：M" /></label><label><span>条目中文 / 英文名称</span><input v-model="form.itemName" maxlength="256" required placeholder="例：男性 / Male" /></label><label><span>开始生效时间</span><input v-model="form.effectiveFrom" type="datetime-local" required /></label><button class="button primary" :disabled="Boolean(busy) || !code.trim()">{{ busy === 'create' ? '正在创建…' : '创建并生效' }}</button></form></AdminActionDialog>
    <AdminActionDialog v-model:open="importOpen" :title="`${dictionaryLabels[code] ?? code} · 导入版本`" description="每行填写项编码和中英文名称；重复编码会安全失败并保留已成功项。" size="large" :busy="Boolean(busy)"><form class="admin-form import-admin-form" @submit.prevent="importVersion"><textarea v-model="importText" rows="8" required autofocus aria-label="字典版本导入内容" /><button class="button primary" :disabled="Boolean(busy)">{{ busy === 'import' ? '正在导入…' : '校验并导入数据库' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(deactivateTarget)" :title="`停用字典项 ${deactivateTarget?.item_name ?? ''}`" description="停用后不再允许新业务选择该值，已有业务事实仍按原版本解释。" :busy="Boolean(busy)" @update:open="!$event && (deactivateTarget = null)" @confirm="deactivateTarget && deactivate(deactivateTarget)"><div v-if="deactivateTarget" class="admin-impact-grid"><div><span>字典</span><b>{{ deactivateTarget.dictionary_code }}</b></div><div><span>条目编码</span><b>{{ deactivateTarget.item_code }}</b></div><div><span>条目名称</span><b>{{ deactivateTarget.item_name }}</b></div><div><span>当前状态</span><b>{{ deactivateTarget.status === 'ACTIVE' ? '有效' : '已停用' }}</b></div></div></AdminConfirmDialog>
  </section>
</template>
