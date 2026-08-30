<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { loadWorkforceIdentities } from '../../clinical-api';
import {
  createPractitionerCredential, listPractitionerCredentials, revokePractitionerCredential,
  updatePractitionerCredential, type PractitionerCredential,
} from '../../api/credentials';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const props = withDefaults(defineProps<{ credentialId?: string }>(), { credentialId: '' });
const route = useRoute(); const router = useRouter();
const identitiesQuery = useQuery({ queryKey: ['admin', 'credentials', 'people'], queryFn: loadWorkforceIdentities, retry: false, staleTime: 0, gcTime: 0 });
const credentialsQuery = useQuery({ queryKey: ['admin', 'credentials', 'grants'], queryFn: listPractitionerCredentials, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => (identitiesQuery.error.value ?? credentialsQuery.error.value) ? toClinicalIssue(identitiesQuery.error.value ?? credentialsQuery.error.value) : null);
const identities = computed(() => identitiesQuery.data.value ?? []);
const credentials = computed(() => credentialsQuery.data.value ?? []);
const visibleCredentials = computed(() => props.credentialId ? credentials.value.filter((item) => item.credential_id === props.credentialId) : credentials.value);
const active = computed(() => credentials.value.filter((item) => item.status === 'ACTIVE' && (!item.valid_until || new Date(item.valid_until).getTime() > Date.now())).length);
const expiring = computed(() => credentials.value.filter((item) => item.status === 'ACTIVE' && item.valid_until && new Date(item.valid_until).getTime() <= Date.now() + 30 * 86400_000).length);
const revoked = computed(() => credentials.value.filter((item) => item.status === 'REVOKED').length);
const editorOpen = ref(false); const revokeOpen = ref(false); const editing = ref<PractitionerCredential | null>(null);
const revoking = ref<PractitionerCredential | null>(null); const reason = ref(''); const busy = ref(''); const notice = ref('');
const form = reactive({ personId: '', type: 'PHYSICIAN_LICENSE', registrationNumber: '', authority: '', practiceScope: '{"specialty":"GENERAL"}', validFrom: '', validUntil: '' });

function localDate(value?: string | null) {
  const date = value ? new Date(value) : new Date(); return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function reset(item?: PractitionerCredential) {
  editing.value = item ?? null; form.personId = item?.person_id ?? identities.value[0]?.person_id ?? '';
  form.type = item?.credential_type ?? 'PHYSICIAN_LICENSE'; form.registrationNumber = item?.registration_number ?? '';
  form.authority = item?.issuing_authority ?? ''; form.practiceScope = JSON.stringify(item?.practice_scope ?? { specialty: 'GENERAL' }, null, 2);
  form.validFrom = localDate(item?.valid_from); form.validUntil = item?.valid_until ? localDate(item.valid_until) : '';
}
function openCreate() { reset(); notice.value = ''; editorOpen.value = true; }
function openEdit(item: PractitionerCredential) { reset(item); notice.value = ''; editorOpen.value = true; }
function requestRevoke(item: PractitionerCredential) { revoking.value = item; reason.value = ''; revokeOpen.value = true; }
async function save() {
  if (busy.value || !form.personId || !form.registrationNumber.trim() || !form.authority.trim()) return;
  let scope: Record<string, unknown>;
  try { scope = JSON.parse(form.practiceScope) as Record<string, unknown>; }
  catch { notice.value = 'INVALID_PRACTICE_SCOPE：执业范围必须是有效 JSON'; return; }
  busy.value = 'save'; notice.value = '';
  const input = {
    person_id: form.personId, credential_type: form.type as PractitionerCredential['credential_type'],
    registration_number: form.registrationNumber.trim(), issuing_authority: form.authority.trim(), practice_scope: scope,
    valid_from: new Date(form.validFrom).toISOString(), valid_until: form.validUntil ? new Date(form.validUntil).toISOString() : null,
  };
  try {
    if (editing.value) await updatePractitionerCredential(editing.value, input); else await createPractitionerCredential(input);
    editorOpen.value = false; notice.value = editing.value ? '临床资质已更新，新的范围和有效期已用于实时鉴权。' : '临床资质已授予，已进入实时鉴权、审计和 Outbox 证据链。';
    await Promise.all([credentialsQuery.refetch(), identitiesQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
async function revoke() {
  const item = revoking.value; if (!item || busy.value || reason.value.trim().length < 4) return;
  busy.value = 'revoke'; notice.value = '';
  try {
    await revokePractitionerCredential(item, reason.value.trim()); revokeOpen.value = false; revoking.value = null;
    notice.value = '临床资质已撤销，后续签署、处方、医嘱和技术操作将按新状态重新鉴权。';
    await Promise.all([credentialsQuery.refetch(), identitiesQuery.refetch()]);
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
function statusLabel(status: string) { return ({ ACTIVE: '有效', SUSPENDED: '暂停', EXPIRED: '过期', REVOKED: '已撤销' } as Record<string, string>)[status] ?? status; }
watch([() => route.query.create, identities], ([value, people]) => {
  if (value !== '1' || !people.length) return;
  openCreate();
  void router.replace({ query: { ...route.query, create: undefined } });
}, { immediate: true });
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav v-if="$route.path.includes('/grants')" class="quality-breadcrumb" aria-label="临床资质层级导航"><RouterLink to="/quality-center">医疗质量中心</RouterLink><span>/</span><RouterLink to="/credentials">临床资质</RouterLink><span>/</span><RouterLink to="/credentials/grants">资质授权台账</RouterLink><template v-if="credentialId"><span>/</span><b>资质详情</b></template></nav>
    <div class="page-heading admin-heading"><div><p class="eyebrow">质量与安全 / {{ credentialId ? '四级资质详情' : '临床资质' }}</p><h1>临床资质与医疗授权中心</h1><p>账户权限 ∩ 当前岗位 ∩ 执业范围 ∩ 机构授权 ∩ 患者关系的实时交集。</p></div><div class="toolbar-actions"><RouterLink v-if="!$route.path.includes('/grants')" class="button secondary" to="/credentials/grants">打开三级台账</RouterLink><RouterLink v-if="credentialId" class="button secondary" to="/credentials/grants">返回台账</RouterLink><button class="button primary" @click="openCreate">新建临床资质</button></div></div>
    <ClinicalPageState v-if="identitiesQuery.isPending.value || credentialsQuery.isPending.value" kind="loading" message="正在读取人员资质" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="() => { identitiesQuery.refetch(); credentialsQuery.refetch(); }" />
    <template v-else>
      <p v-if="notice" class="admin-notice" :class="{ danger: notice.includes('：') }" role="status">{{ notice }}</p>
      <section class="admin-metrics" aria-label="资质统计"><article><span>资质记录</span><strong>{{ credentials.length }}</strong><small>真实领域记录</small></article><article><span>当前有效</span><strong>{{ active }}</strong><small>参与实时鉴权</small></article><article><span>30 日内到期</span><strong>{{ expiring }}</strong><small>进入到期队列</small></article><article><span>已撤销</span><strong>{{ revoked }}</strong><small>新临床动作立即失效</small></article></section>
      <section class="admin-panel"><header><div><h2>{{ credentialId ? '资质授权详情' : '资质授权台账' }}</h2><p>授予、变更和撤销均使用行版本并发乐观锁，撤销不删除历史证据。</p></div><div class="toolbar-actions"><button class="button secondary" @click="credentialsQuery.refetch()">刷新</button><button class="button primary" @click="openCreate">新建授权</button></div></header>
        <div v-if="visibleCredentials.length === 0" class="admin-empty">{{ credentialId ? '未找到该资质。' : '暂无资质记录。' }}</div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>人员 / 资质</th><th>注册号</th><th>颁发机构</th><th>执业范围</th><th>有效期</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in visibleCredentials" :key="item.credential_id"><td><RouterLink :to="`/credentials/grants/${item.credential_id}`"><strong>{{ item.person_display_name }}</strong></RouterLink><small>{{ item.credential_type }} · v{{ item.row_version }}</small></td><td><code>{{ item.registration_number }}</code></td><td>{{ item.issuing_authority }}</td><td><code>{{ JSON.stringify(item.practice_scope) }}</code></td><td>{{ new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(item.valid_from)) }} — {{ item.valid_until ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(item.valid_until)) : '长期' }}</td><td><span class="admin-status" :class="item.status.toLowerCase()">{{ statusLabel(item.status) }}</span></td><td class="admin-actions"><button class="task-action" :disabled="item.status !== 'ACTIVE'" @click="openEdit(item)">编辑</button><button class="task-action danger" :disabled="item.status !== 'ACTIVE'" @click="requestRevoke(item)">撤销</button></td></tr></tbody></table></div>
      </section>
    </template>
    <AdminActionDialog v-model:open="editorOpen" :title="editing ? '编辑临床资质' : '新建临床资质'" description="资质保存后立即参与签署、处方、医嘱和技术操作的实时鉴权。" size="large" :busy="busy === 'save'"><form class="admin-form credential-dialog-form" @submit.prevent="save"><label><span>人员</span><select v-model="form.personId" :disabled="Boolean(editing)" required><option value="" disabled>请选择</option><option v-for="identity in identities" :key="identity.person_id" :value="identity.person_id">{{ identity.person_display_name }} · {{ identity.person_code }}</option></select></label><label><span>资质类型</span><select v-model="form.type"><option value="PHYSICIAN_LICENSE">医师执业证</option><option value="NURSE_LICENSE">护士执业证</option><option value="PHARMACIST_LICENSE">药师资质</option><option value="TECHNICIAN_LICENSE">技师资质</option><option value="OTHER">其他</option></select></label><label><span>注册号</span><input v-model="form.registrationNumber" required maxlength="128" /></label><label><span>颁发机构</span><input v-model="form.authority" required maxlength="256" /></label><label><span>有效起始</span><input v-model="form.validFrom" type="datetime-local" required /></label><label><span>有效终止</span><input v-model="form.validUntil" type="datetime-local" /></label><label class="full-span"><span>执业范围 JSON</span><textarea v-model="form.practiceScope" rows="5" required /></label></form><template #footer="{ close }"><button class="button secondary" :disabled="busy === 'save'" @click="close">取消</button><button class="button primary" :disabled="busy === 'save'" @click="save">{{ busy === 'save' ? '保存中…' : '保存并立即生效' }}</button></template></AdminActionDialog>
    <AdminConfirmDialog v-model:open="revokeOpen" title="撤销临床资质" description="撤销后该资质不再参与新的关键临床动作鉴权，已完成的合法签名和审计证据不受影响。" confirm-label="确认撤销" :busy="busy === 'revoke'" @confirm="revoke"><label class="admin-form"><span>撤销原因（至少 4 个字）</span><textarea v-model="reason" minlength="4" maxlength="1000" rows="4" required /></label></AdminConfirmDialog>
  </section>
</template>

<style scoped>
.quality-breadcrumb{display:flex;align-items:center;gap:8px;margin-bottom:12px;color:#667085;font-size:13px}.quality-breadcrumb a{color:#245493;text-decoration:none}.credential-dialog-form{grid-template-columns:repeat(2,minmax(0,1fr))}.full-span{grid-column:1/-1}@media(max-width:640px){.credential-dialog-form{grid-template-columns:1fr}.full-span{grid-column:auto}}
</style>
