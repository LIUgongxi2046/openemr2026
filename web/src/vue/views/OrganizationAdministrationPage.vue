<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { OrganizationUnitCreateRequestWire, OrganizationUnitWire } from '../../generated/contracts';
import { clinicalContext, createOrganizationUnit, deactivateOrganizationUnit, loadOrganizationUnits } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type UnitType = OrganizationUnitWire['unit_type'];
const unitTypeLabels: Record<UnitType, string> = { ORGANIZATION: '医疗机构', FACILITY: '院区', DEPARTMENT: '科室', WARD: '病区', BED: '床位' };
const query = useQuery({ queryKey: ['admin', 'organization-units'], queryFn: loadOrganizationUnits, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const busy = ref('');
const notice = ref('');
const form = reactive({ unitType: 'DEPARTMENT' as UnitType, code: '', name: '', parentId: '', subtype: '' });
const units = computed(() => query.data.value ?? []);
const activeUnits = computed(() => units.value.filter((unit) => unit.status === 'ACTIVE'));
const metrics = computed(() => Object.fromEntries((Object.keys(unitTypeLabels) as UnitType[]).map((type) => [type, activeUnits.value.filter((unit) => unit.unit_type === type).length])) as Record<UnitType, number>);
const parents = computed(() => {
  const type: UnitType | null = form.unitType === 'FACILITY' ? 'ORGANIZATION'
    : form.unitType === 'DEPARTMENT' ? 'DEPARTMENT'
      : form.unitType === 'WARD' ? 'DEPARTMENT'
        : form.unitType === 'BED' ? 'WARD' : 'ORGANIZATION';
  return activeUnits.value.filter((unit) => unit.unit_type === type);
});
const parentRequired = computed(() => ['FACILITY', 'WARD', 'BED'].includes(form.unitType));

function label(unit: OrganizationUnitWire) { return `${unitTypeLabels[unit.unit_type]} · ${unit.display_name}`; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '长期有效'; }
function parentName(unit: OrganizationUnitWire) { return units.value.find((candidate) => candidate.unit_id === unit.parent_unit_id)?.display_name ?? '—'; }

async function createUnit() {
  if (busy.value || !form.code.trim() || !form.name.trim() || (parentRequired.value && !form.parentId)) return;
  busy.value = 'create'; notice.value = '';
  const input: OrganizationUnitCreateRequestWire = {
    unit_type: form.unitType, unit_id: crypto.randomUUID(), unit_code: form.code.trim(),
    display_name: form.name.trim(), effective_from: new Date().toISOString(),
  };
  if (form.subtype.trim()) input.subtype = form.subtype.trim();
  if (form.unitType === 'ORGANIZATION' && form.parentId) input.parent_unit_id = form.parentId;
  if (form.unitType === 'FACILITY') input.organization_id = form.parentId;
  if (form.unitType === 'DEPARTMENT') {
    input.facility_id = clinicalContext.facilityId;
    if (form.parentId) input.parent_unit_id = form.parentId;
  }
  if (form.unitType === 'WARD') { input.facility_id = clinicalContext.facilityId; input.department_id = form.parentId; }
  if (form.unitType === 'BED') input.parent_unit_id = form.parentId;
  try {
    await createOrganizationUnit(input); Object.assign(form, { code: '', name: '', parentId: '', subtype: '' });
    notice.value = `${unitTypeLabels[input.unit_type]}已生效，审计事件和事件出箱已同步记录。`; await query.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function deactivate(unit: OrganizationUnitWire) {
  if (busy.value || unit.status !== 'ACTIVE') return;
  busy.value = unit.unit_id; notice.value = '';
  try { await deactivateOrganizationUnit(unit, '组织管理员确认停用'); notice.value = `${unit.display_name}已停用。`; await query.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">配置中心 / 组织与工作单元</p><h1>组织机构管理</h1><p>统一管理医疗机构、院区、科室、病区和床位的有效期层级；子单元未退出时不允许直接停用上级。</p></div><RouterLink class="button secondary" to="/admin-users">人员与账号</RouterLink></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取组织有效期层级" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <section class="admin-metrics" aria-label="组织单元统计"><article v-for="(name, type) in unitTypeLabels" :key="type"><span>{{ name }}</span><strong>{{ metrics[type] }}</strong><small>当前有效</small></article></section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout"><section class="admin-panel"><header><div><h2>有效期组织台账</h2><p>所有变更都使用版本号、幂等键、审计链与事件出箱。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header><div v-if="!units.length" class="admin-empty">暂无组织单元，可在右侧新增。</div><div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>类型 / 名称</th><th>编码</th><th>上级</th><th>有效期</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="unit in units" :key="unit.unit_id"><td><strong>{{ label(unit) }}</strong><small>…{{ unit.unit_id.slice(-8) }} · v{{ unit.row_version }}</small></td><td><code>{{ unit.unit_code }}</code></td><td>{{ parentName(unit) }}</td><td>{{ formatDate(unit.effective_until) }}</td><td><span class="admin-status" :class="unit.status.toLowerCase()">{{ unit.status === 'ACTIVE' ? '有效' : '已停用' }}</span></td><td><button class="task-action" :disabled="unit.status !== 'ACTIVE' || Boolean(busy)" @click="deactivate(unit)">{{ busy === unit.unit_id ? '处理中…' : '停用' }}</button></td></tr></tbody></table></div></section>
        <section class="admin-panel admin-form-panel"><header><div><h2>新增工作单元</h2><p>根据类型选择必要上级范围。</p></div></header><form class="admin-form" @submit.prevent="createUnit"><label><span>单元类型</span><select v-model="form.unitType" @change="form.parentId = ''"><option v-for="(name, type) in unitTypeLabels" :key="type" :value="type">{{ name }}</option></select></label><label><span>单元编码</span><input v-model="form.code" maxlength="96" required placeholder="例：CARD-WARD-02" /></label><label><span>显示名称</span><input v-model="form.name" maxlength="256" required placeholder="例：心内二病区" /></label><label><span>上级单元{{ parentRequired ? '' : '（可选）' }}</span><select v-model="form.parentId" :required="parentRequired"><option value="">无上级</option><option v-for="parent in parents" :key="parent.unit_id" :value="parent.unit_id">{{ label(parent) }}</option></select></label><label><span>类型 / 时区补充</span><input v-model="form.subtype" placeholder="可选，例：NURSING_UNIT" /></label><button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '创建并生效' }}</button></form></section></div>
    </template>
  </section>
</template>
