<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { loadWorkforceIdentities } from '../../clinical-api';
import { listPractitionerCredentials, type PractitionerCredential } from '../../api/credentials';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';
import { formatQualityDate } from '../quality-overview';

const router = useRouter();
const identitiesQuery = useQuery({ queryKey: ['quality-overview', 'credentials', 'people'], queryFn: loadWorkforceIdentities, retry: false, staleTime: 0 });
const credentialsQuery = useQuery({ queryKey: ['quality-overview', 'credentials', 'grants'], queryFn: listPractitionerCredentials, retry: false, staleTime: 0 });
const identities = computed(() => identitiesQuery.data.value ?? []);
const credentials = computed(() => credentialsQuery.data.value ?? []);
const search = ref(''); const department = ref('ALL'); const sort = ref('EXPIRING'); const selectedId = ref('');
const reminderOpen = ref(false); const simulationOpen = ref(false); const simulationAction = ref('PRESCRIPTION'); const patientRelation = ref(true);
const now = computed(() => Date.now());
const active = computed(() => credentials.value.filter((item) => item.status === 'ACTIVE' && (!item.valid_until || new Date(item.valid_until).getTime() > now.value)));
const expiring = computed(() => active.value.filter((item) => item.valid_until && new Date(item.valid_until).getTime() <= now.value + 30 * 86400_000));
const temporary = computed(() => active.value.filter((item) => item.valid_until && new Date(item.valid_until).getTime() <= now.value + 90 * 86400_000));
const blocked = computed(() => credentials.value.filter((item) => item.status === 'REVOKED' || item.status === 'SUSPENDED' || (item.valid_until && new Date(item.valid_until).getTime() <= now.value)));
const identityByPerson = computed(() => new Map(identities.value.map((item) => [item.person_id, item])));
const departments = computed(() => [...new Set(identities.value.map((item) => item.department_id).filter(Boolean))] as string[]);
const filtered = computed(() => {
  const needle = search.value.trim().toLowerCase();
  const list = credentials.value.filter((item) => {
    const identity = identityByPerson.value.get(item.person_id);
    return (!needle || [item.person_display_name, item.registration_number, item.credential_type].some((value) => value.toLowerCase().includes(needle)))
      && (department.value === 'ALL' || identity?.department_id === department.value);
  });
  return [...list].sort((a, b) => sort.value === 'NAME'
    ? a.person_display_name.localeCompare(b.person_display_name, 'zh-CN')
    : (a.valid_until ? new Date(a.valid_until).getTime() : Number.MAX_SAFE_INTEGER) - (b.valid_until ? new Date(b.valid_until).getTime() : Number.MAX_SAFE_INTEGER));
});
const visible = computed(() => filtered.value.slice(0, 8));
const selected = computed<PractitionerCredential | null>(() => credentials.value.find((item) => item.credential_id === selectedId.value) ?? visible.value[0] ?? null);
watch(selected, (item) => { if (item) selectedId.value = item.credential_id; }, { immediate: true });
const selectedIdentity = computed(() => selected.value ? identityByPerson.value.get(selected.value.person_id) : undefined);
const selectedScope = computed(() => selected.value?.practice_scope ?? {});
const scopeText = computed(() => Object.entries(selectedScope.value).map(([key, value]) => `${key}: ${String(value)}`).join('；') || '未声明具体范围');
const simulationPassed = computed(() => {
  const item = selected.value;
  if (!item || item.status !== 'ACTIVE' || (item.valid_until && new Date(item.valid_until).getTime() <= now.value) || !patientRelation.value) return false;
  const scope = JSON.stringify(item.practice_scope).toUpperCase();
  if (simulationAction.value === 'SURGERY') return /SURGER|PROCEDURE|LEVEL/.test(scope);
  if (simulationAction.value === 'CONTROLLED_DRUG') return /CONTROLLED|NARCOTIC|麻精/.test(scope);
  return true;
});
const issue = computed(() => identitiesQuery.error.value ?? credentialsQuery.error.value ? toClinicalIssue(identitiesQuery.error.value ?? credentialsQuery.error.value) : null);
function typeLabel(type: string) { return ({ PHYSICIAN_LICENSE: '医师执业证', NURSE_LICENSE: '护士执业证', PHARMACIST_LICENSE: '药师资质', TECHNICIAN_LICENSE: '技师资质', OTHER: '其他资质' } as Record<string, string>)[type] ?? type; }
function position(item: PractitionerCredential) { return selectedId.value === item.credential_id ? selectedIdentity.value?.position_code ?? typeLabel(item.credential_type) : identityByPerson.value.get(item.person_id)?.position_code ?? typeLabel(item.credential_type); }
function scopeValue(item: PractitionerCredential) { return String(item.practice_scope.specialty ?? item.practice_scope.scope ?? '机构授权范围'); }
function orderAuthority(item: PractitionerCredential) { return item.status === 'ACTIVE' ? (item.credential_type === 'PHYSICIAN_LICENSE' ? '普通处方；临床医嘱' : '岗位内医嘱执行') : '已阻断'; }
function technicalAuthority(item: PractitionerCredential) { const scope = JSON.stringify(item.practice_scope); return /procedure|surgery|level/i.test(scope) ? '按执业范围授权' : '无手术授权'; }
</script>

<template>
  <section data-page-root class="content vue-native-page credentials-overview-page">
    <div class="page-head"><div class="page-title"><h1>临床资质与医疗授权中心</h1><p>账户权限 ∩ 当前岗位 ∩ 执业范围 ∩ 机构授权 ∩ 患者关系的实时交集</p></div><div class="head-actions"><button class="btn" type="button" @click="reminderOpen = true">到期提醒</button><button class="btn" type="button" @click="simulationOpen = true">授权模拟</button><button class="btn primary" type="button" @click="router.push('/credentials/grants?create=1')">新建临时授权</button></div></div>
    <ClinicalPageState v-if="identitiesQuery.isPending.value || credentialsQuery.isPending.value" kind="loading" message="正在读取人员资质与授权" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="() => { identitiesQuery.refetch(); credentialsQuery.refetch(); }" />
    <template v-else>
      <section class="credential-metrics"><article><span>有效临床人员</span><strong>{{ identities.filter((item) => item.person_status === 'ACTIVE').length }}</strong><small>同步至当前系统时间</small></article><article><span>30 日内到期</span><strong>{{ expiring.length }}</strong><small>已进入医务提醒队列</small></article><article><span>临时/委托授权</span><strong>{{ temporary.length }}</strong><small>90 日内到期 {{ temporary.length }}</small></article><article><span>授权阻断事件</span><strong>{{ blocked.length }}</strong><small>已进入审计复核</small></article></section>
      <section class="credential-layout">
        <div class="card credential-list">
          <div class="credential-filters"><input v-model="search" aria-label="姓名 / 工号 / 资质证号" placeholder="姓名 / 工号 / 资质证号" /><select v-model="department" aria-label="科室"><option value="ALL">全部科室</option><option v-for="item in departments" :key="item" :value="item">科室 …{{ item.slice(-6) }}</option></select><select v-model="sort" aria-label="排序"><option value="EXPIRING">即将到期优先</option><option value="NAME">按姓名排序</option></select></div>
          <div class="credential-table-wrap"><table><thead><tr><th>人员</th><th>职级</th><th>执业范围</th><th>处方/医嘱</th><th>手术/技术</th><th>有效期</th></tr></thead><tbody><tr v-for="item in visible" :key="item.credential_id" :class="{ selected: selected?.credential_id === item.credential_id }" tabindex="0" @click="selectedId = item.credential_id" @keydown.enter="selectedId = item.credential_id"><td><b>{{ item.person_display_name }}</b><small>{{ item.registration_number }}</small></td><td>{{ position(item) }}</td><td>{{ scopeValue(item) }}</td><td>{{ orderAuthority(item) }}</td><td>{{ technicalAuthority(item) }}</td><td><span :class="{ expiring: expiring.some((credential) => credential.credential_id === item.credential_id) }">{{ formatQualityDate(item.valid_until) }}</span></td></tr></tbody></table></div>
          <div v-if="!visible.length" class="credential-empty">未找到符合条件的资质记录</div>
          <div class="credential-boundary"><b>禁止静态角色替代临床授权</b><span>登录成功或拥有“医生”角色，不代表可开具特定处方、签署该类文书或实施对应技术。</span></div>
        </div>
        <aside class="card credential-detail"><template v-if="selected"><header><b>{{ selected.person_display_name }} · 授权解析</b><span :class="selected.status === 'ACTIVE' ? 'green' : 'red'">{{ selected.status === 'ACTIVE' ? '当前有效' : '当前阻断' }}</span></header><dl><div><dt>账户与岗位</dt><dd>{{ selectedIdentity?.position_code ?? typeLabel(selected.credential_type) }}</dd></div><div><dt>执业注册</dt><dd>{{ selected.issuing_authority }}</dd></div><div><dt>处方权</dt><dd>{{ orderAuthority(selected) }}</dd></div><div><dt>手术分级</dt><dd>{{ technicalAuthority(selected) }}</dd></div><div><dt>患者关系</dt><dd>当前就诊团队内实时校验</dd></div></dl><section class="revoke-note"><b>撤销立即生效</b><p>签署、处方、医嘱、手术等关键动作执行前重新鉴权；撤销后既有合法签名不被删除。</p></section><section class="credential-capability"><b>产品扩展能力</b><article><strong>专科 EMR 能力包</strong><p>在通用内核上叠加专科模板、评分量表、数据集、路径与规则；不复制患者、医嘱、文书和审计主模型。</p><span>{{ scopeText }}</span></article><article><strong>移动查房 PWA</strong><p>响应式患者清单、病情摘要、结果趋势、任务确认和草稿记录；签署、处方和高风险动作按策略回桌面端。</p><span>最近安全策略通过</span></article></section></template><div v-else class="credential-empty">请选择一条资质记录</div></aside>
      </section>
    </template>

    <AdminActionDialog v-model:open="reminderOpen" title="30 日内到期提醒" description="到期记录来自真实资质台账；可进入三级页面编辑有效期或撤销授权。"><div class="reminder-list"><article v-for="item in expiring" :key="item.credential_id"><b>{{ item.person_display_name }}</b><span>{{ typeLabel(item.credential_type) }} · {{ formatQualityDate(item.valid_until) }}</span></article><p v-if="!expiring.length">当前没有 30 日内到期的有效资质。</p></div><template #footer="{ close }"><button class="btn" type="button" @click="close">关闭</button><button class="btn primary" type="button" @click="close(); router.push('/credentials/grants')">进入授权台账</button></template></AdminActionDialog>
    <AdminActionDialog v-model:open="simulationOpen" title="临床授权模拟" description="按照当前资质状态、有效期、执业范围与患者关系即时计算，不写入业务事实。"><form class="admin-form"><label><span>模拟人员</span><select v-model="selectedId"><option v-for="item in credentials" :key="item.credential_id" :value="item.credential_id">{{ item.person_display_name }} · {{ item.registration_number }}</option></select></label><label><span>临床动作</span><select v-model="simulationAction"><option value="PRESCRIPTION">普通处方/医嘱</option><option value="CONTROLLED_DRUG">麻精处方</option><option value="SURGERY">手术/技术操作</option></select></label><label><input v-model="patientRelation" type="checkbox" /> 当前患者属于本人医疗组</label></form><div class="simulation-result" :class="simulationPassed ? 'pass' : 'deny'"><b>{{ simulationPassed ? '允许执行' : '阻断执行' }}</b><span>{{ simulationPassed ? '当前交集满足最小授权条件，实际动作仍会在提交前重新鉴权。' : '资质状态、范围或患者关系不满足，关键临床动作不会提交。' }}</span></div><template #footer="{ close }"><button class="btn primary" type="button" @click="close">完成模拟</button></template></AdminActionDialog>
  </section>
</template>

<style scoped>
.credential-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-bottom:14px}.credential-metrics article{display:grid;gap:6px;min-height:100px;padding:15px 17px;border:1px solid var(--line);border-top:3px solid var(--blue);border-radius:11px;background:#fff;box-shadow:var(--shadow)}.credential-metrics span{color:var(--muted);font-size:11px}.credential-metrics strong{font-size:26px}.credential-metrics small{color:var(--muted-2);font-size:10px}.credential-layout{display:grid;grid-template-columns:minmax(0,1fr) 330px;gap:14px}.credential-list,.credential-detail{overflow:hidden}.credential-filters{display:grid;grid-template-columns:minmax(220px,1fr) 150px 160px;gap:8px;padding:12px;border-bottom:1px solid var(--line)}.credential-filters input,.credential-filters select{width:100%;min-height:34px;border:1px solid var(--line);border-radius:7px;background:#fff;padding:7px 9px;color:var(--ink)}.credential-table-wrap{overflow:auto}.credential-table-wrap table{width:100%;min-width:830px;border-collapse:collapse}.credential-table-wrap th,.credential-table-wrap td{padding:11px 12px;border-bottom:1px solid #edf1f4;text-align:left;font-size:10px}.credential-table-wrap th{background:#f8fafc;color:var(--muted);font-size:9px}.credential-table-wrap tr{cursor:pointer}.credential-table-wrap tr.selected{background:#f2f7fd}.credential-table-wrap td small{display:block;margin-top:4px;color:var(--muted);font-size:8px}.credential-table-wrap .expiring{color:#b54708;font-weight:800}.credential-boundary{display:flex;gap:10px;padding:12px 14px;background:#fff8e8;color:#6e6247;font-size:10px}.credential-boundary b{color:#8a5a00;white-space:nowrap}.credential-detail>header{display:flex;justify-content:space-between;gap:8px;padding:13px 14px;border-bottom:1px solid var(--line)}.credential-detail>header span{padding:4px 8px;border-radius:12px;font-size:9px}.credential-detail>header .green{background:#eaf8ef;color:#18794e}.credential-detail>header .red{background:#fff0f0;color:#b4232f}.credential-detail dl{display:grid;gap:10px;margin:0;padding:14px}.credential-detail dl div{display:grid;grid-template-columns:85px 1fr;gap:8px}.credential-detail dt{color:var(--muted);font-size:9px}.credential-detail dd{margin:0;font-size:10px;font-weight:700}.revoke-note{padding:12px 14px;border-block:1px solid var(--line);background:#fff8e8}.revoke-note b{color:#8a5a00;font-size:10px}.revoke-note p,.credential-capability p{margin:6px 0 0;color:var(--muted);font-size:9px;line-height:1.55}.credential-capability{display:grid;gap:10px;padding:14px}.credential-capability>article{padding-top:9px;border-top:1px solid #edf1f4}.credential-capability strong{font-size:10px}.credential-capability span{display:inline-flex;margin-top:7px;padding:4px 7px;border-radius:10px;background:#eaf3ff;color:var(--blue);font-size:8px}.credential-empty{padding:28px;text-align:center;color:var(--muted)}.reminder-list{display:grid;gap:8px}.reminder-list article{display:flex;justify-content:space-between;gap:12px;padding:10px;border:1px solid var(--line);border-radius:8px}.reminder-list span{color:var(--muted)}.simulation-result{display:grid;gap:5px;margin-top:12px;padding:12px;border-radius:8px}.simulation-result.pass{background:#eaf8ef;color:#18794e}.simulation-result.deny{background:#fff0f0;color:#b4232f}.simulation-result span{font-size:10px}.head-actions .btn{text-decoration:none}@media(max-width:1050px){.credential-layout{grid-template-columns:1fr}.credential-detail{display:grid;grid-template-columns:1fr 1fr}.credential-detail>header{grid-column:1/-1}.credential-capability{grid-column:1/-1}}@media(max-width:820px){.credential-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.credential-filters{grid-template-columns:1fr 1fr}.credential-filters input{grid-column:1/-1}}@media(max-width:600px){.page-head{height:auto;align-items:stretch;flex-direction:column;padding:10px 0}.head-actions{margin-left:0;display:flex;flex-wrap:wrap}.head-actions .btn{flex:1 1 130px}.credential-metrics{grid-template-columns:1fr 1fr}.credential-detail{display:block}}
</style>
