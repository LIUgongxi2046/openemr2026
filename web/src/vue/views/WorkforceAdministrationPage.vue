<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { WorkforceIdentityWire, WorkforceOnboardingRequestWire } from '../../generated/contracts';
import { clinicalContext, deactivateWorkforceAccount, endWorkforceRole, loadWorkforceIdentities, onboardWorkforceIdentity } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const query = useQuery({ queryKey: ['admin', 'workforce'], queryFn: loadWorkforceIdentities, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const identities = computed(() => query.data.value ?? []);
const activePeople = computed(() => new Set(identities.value.filter((item) => item.person_status === 'ACTIVE').map((item) => item.person_id)).size);
const activeAccounts = computed(() => new Set(identities.value.filter((item) => item.account_status === 'ACTIVE').map((item) => item.user_id)).size);
const activeRoles = computed(() => identities.value.filter((item) => item.role_status === 'ACTIVE').length);
const credentials = computed(() => new Set(identities.value.filter((item) => item.active_credential_count > 0).map((item) => item.person_id)).size);
const busy = ref(''); const notice = ref('');
const form = reactive({ personCode: '', displayName: '', subject: '', roleCode: 'CLINICIAN', positionCode: 'PHYSICIAN', registrationNumber: '' });
function short(value: string | null) { return value ? `…${value.slice(-8)}` : '—'; }
function formatDate(value: string | null) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium' }).format(new Date(value)) : '长期'; }

async function onboard() {
  if (busy.value || !form.personCode.trim() || !form.displayName.trim() || !form.subject.trim()) return;
  busy.value = 'onboard'; notice.value = '';
  const input: WorkforceOnboardingRequestWire = {
    person_id: crypto.randomUUID(), person_code: form.personCode.trim(), display_name: form.displayName.trim(),
    user_id: crypto.randomUUID(), external_subject: form.subject.trim(), role_assignment_id: crypto.randomUUID(),
    role_code: form.roleCode, position_code: form.positionCode, organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId, valid_from: new Date().toISOString(),
  };
  if (form.registrationNumber.trim()) {
    input.credential_id = crypto.randomUUID(); input.credential_type = 'PHYSICIAN_LICENSE';
    input.registration_number = form.registrationNumber.trim(); input.issuing_authority = '机构管理员录入'; input.practice_scope = { source: 'ADMIN_UI' };
  }
  try { await onboardWorkforceIdentity(input); notice.value = `${input.display_name}的人员、账号、角色和工作范围已原子开通。`; Object.assign(form, { personCode: '', displayName: '', subject: '', registrationNumber: '' }); await query.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function execute(item: WorkforceIdentityWire, action: 'account' | 'role') {
  const key = `${action}-${item.person_id}`; if (busy.value) return; busy.value = key; notice.value = '';
  try { if (action === 'account') await deactivateWorkforceAccount(item, '人员管理员确认停用账号'); else await endWorkforceRole(item, '人员管理员确认结束授权'); notice.value = action === 'account' ? '账号已停用，既有临床上下文授权立即失效。' : '角色与工作范围已同步结束。'; await query.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page"><div class="page-heading admin-heading"><div><p class="eyebrow">配置中心 / 人员与账号</p><h1>用户、人员与工作范围</h1><p>把自然人、登录账号、角色授权、科室病区范围和执业资质分开管理，保留历史姓名与签名证据。</p></div><RouterLink class="button secondary" to="/admin-org">组织机构</RouterLink></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在核对人员、账号、角色与执业资质" /><ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else><section class="admin-metrics"><article><span>有效人员</span><strong>{{ activePeople }}</strong><small>自然人主档</small></article><article><span>活跃账号</span><strong>{{ activeAccounts }}</strong><small>OIDC 主体映射</small></article><article><span>有效角色</span><strong>{{ activeRoles }}</strong><small>当前有效期</small></article><article><span>在效资质</span><strong>{{ credentials }}</strong><small>按人员去重</small></article></section><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout"><section class="admin-panel"><header><div><h2>人员与授权台账</h2><p>停用账号会使未到期上下文租约立即失效；结束角色会同步结束工作范围。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header><div v-if="!identities.length" class="admin-empty">暂无人员记录，可在下方新增。</div><div v-else class="admin-table-wrap"><table class="admin-table workforce-table"><thead><tr><th>人员</th><th>账号</th><th>角色 / 岗位</th><th>组织范围</th><th>资质</th><th>操作</th></tr></thead><tbody><tr v-for="item in identities" :key="`${item.person_id}-${item.role_assignment_id}`"><td><strong>{{ item.person_display_name }}</strong><small>{{ item.person_code }} · {{ short(item.person_id) }}</small></td><td><span class="admin-status" :class="(item.account_status || 'inactive').toLowerCase()">{{ item.account_status || '未开户' }}</span><small>{{ item.external_subject || '—' }}</small></td><td><strong>{{ item.role_code || '未授权' }}</strong><small>{{ item.position_code || '—' }} · {{ formatDate(item.role_valid_until) }}</small></td><td><code>{{ short(item.organization_id) }} / {{ short(item.facility_id) }}</code><small>科室 {{ short(item.department_id) }} · 病区 {{ short(item.ward_id) }}</small></td><td>{{ item.active_credential_count }} 项</td><td><div class="admin-actions"><button class="task-action danger-text" :disabled="item.account_status !== 'ACTIVE' || Boolean(busy)" @click="execute(item, 'account')">停用账号</button><button class="task-action" :disabled="item.role_status !== 'ACTIVE' || Boolean(busy)" @click="execute(item, 'role')">结束角色</button></div></td></tr></tbody></table></div></section>
        <section class="admin-panel admin-form-panel"><header><div><h2>人员入职开通</h2><p>一次事务建立人员、账号、角色和工作范围。</p></div></header><form class="admin-form" @submit.prevent="onboard"><label><span>人员编码</span><input v-model="form.personCode" required placeholder="例：DOC-2026-001" /></label><label><span>姓名</span><input v-model="form.displayName" required placeholder="真实姓名" /></label><label><span>OIDC 外部主体</span><input v-model="form.subject" required placeholder="统一身份平台 subject" /></label><label><span>角色</span><select v-model="form.roleCode"><option value="CLINICIAN">临床医师</option><option value="NURSE">护士</option><option value="CLINICAL_ADMIN">临床管理员</option><option value="SYSTEM_ADMIN">系统管理员</option></select></label><label><span>岗位编码</span><input v-model="form.positionCode" required /></label><label><span>执业证号（可选）</span><input v-model="form.registrationNumber" placeholder="填写后同步建立执业资质" /></label><button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'onboard' ? '正在开通…' : '开通人员与授权' }}</button></form></section></div>
    </template>
  </main>
</template>
