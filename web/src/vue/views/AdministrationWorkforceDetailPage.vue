<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed } from 'vue';
import { RouterLink } from 'vue-router';
import { issueAuditLease, listAuditEvents } from '../../api/audit';
import { loadWorkforceIdentities } from '../../clinical-api';
import { clinicalCodeLabel } from '../clinical-display';
import { toClinicalIssue } from '../clinical-error';
import ClinicalPageState from '../components/ClinicalPageState.vue';

const props = defineProps<{ personId: string; section?: string; roleAssignmentId?: string; auditSection?: string; eventId?: string }>();
const workforceQuery = useQuery({ queryKey: ['admin', 'workforce-detail', props.personId], queryFn: loadWorkforceIdentities, retry: false });
const auditQuery = useQuery({ queryKey: ['admin', 'workforce-detail', 'audit', props.personId], queryFn: async () => listAuditEvents(await issueAuditLease()), retry: false });
const roles = computed(() => (workforceQuery.data.value ?? []).filter((item) => item.person_id === props.personId));
const person = computed(() => roles.value[0] ?? null);
const selectedRole = computed(() => roles.value.find((item) => item.role_assignment_id === props.roleAssignmentId) ?? roles.value[0] ?? null);
const auditEvents = computed(() => (auditQuery.data.value ?? []).filter((event) => event.actor_user_id === person.value?.user_id
  || event.resource_id === props.personId || event.resource_id === selectedRole.value?.role_assignment_id));
const selectedEvent = computed(() => auditEvents.value.find((event) => event.audit_event_id === props.eventId) ?? null);
const issue = computed(() => {
  const error = workforceQuery.error.value ?? auditQuery.error.value;
  return error ? toClinicalIssue(error) : null;
});
function format(value: string | null | undefined) { return value ? new Date(value).toLocaleString('zh-CN', { hour12: false }) : '—'; }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page">
    <nav class="admin-breadcrumb" aria-label="人员管理层级"><RouterLink to="/admin-users">用户账户</RouterLink><span>›</span><RouterLink :to="`/admin/users/${personId}`">人员档案</RouterLink><template v-if="section"><span>›</span><RouterLink :to="`/admin/users/${personId}/roles`">角色任期</RouterLink></template><template v-if="roleAssignmentId"><span>›</span><RouterLink :to="`/admin/users/${personId}/roles/${roleAssignmentId}`">任期详情</RouterLink></template><template v-if="auditSection"><span>›</span><RouterLink :to="`/admin/users/${personId}/roles/${roleAssignmentId}/audit`">审计证据</RouterLink></template><template v-if="eventId"><span>›</span><span>事件详情</span></template></nav>
    <ClinicalPageState v-if="workforceQuery.isPending.value || auditQuery.isPending.value" kind="loading" message="正在读取人员、角色任期与审计证据" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="workforceQuery.refetch()" />
    <ClinicalPageState v-else-if="!person" kind="empty" message="未找到该人员，或当前管理范围不可见" />
    <template v-else>
      <div class="page-head"><div class="page-title"><p class="eyebrow">系统管理 / 人员 / 角色 / 审计</p><h1>{{ person.person_display_name }}</h1><p>{{ person.person_code }} · {{ person.external_subject }} · 各层页面均复用同一数据库身份上下文</p></div><div class="head-actions"><RouterLink class="btn" to="/admin-users">返回人员清单</RouterLink><RouterLink class="btn primary" :to="`/admin/users/${personId}/roles`">查看全部角色</RouterLink></div></div>
      <section class="admin-metrics"><article><span>人员状态</span><strong>{{ person.person_status === 'ACTIVE' ? '在职' : '非在职' }}</strong><small>人员主档案</small></article><article><span>账户状态</span><strong>{{ person.account_status ? clinicalCodeLabel(person.account_status) : '未开户' }}</strong><small>统一登录账号</small></article><article><span>角色任期</span><strong>{{ roles.length }}</strong><small>包含历史任期</small></article><article><span>相关审计</span><strong>{{ auditEvents.length }}</strong><small>当前检索窗口</small></article></section>
      <div v-if="!section" class="grid admin-list-detail"><section class="card"><div class="card-head">人员主档案</div><div class="card-body"><div class="folder-row">人员编码<span>{{ person.person_code }}</span></div><div class="folder-row">登录主体<span>{{ person.external_subject }}</span></div><div class="folder-row">执业资质<span>{{ person.active_credential_count }} 项在效</span></div><div class="folder-row">数据库版本<span>人员 v{{ person.person_row_version }} / 账户 v{{ person.account_row_version }}</span></div></div></section><aside class="card"><div class="card-head">下级页面</div><div class="card-body"><RouterLink class="btn primary" :to="`/admin/users/${personId}/roles`">进入角色任期清单</RouterLink></div></aside></div>
      <div v-else-if="section === 'roles' && !roleAssignmentId" class="card"><div class="card-head">角色任期清单</div><div class="admin-table-wrap"><table class="table"><thead><tr><th>角色</th><th>岗位</th><th>组织范围</th><th>有效期</th><th>状态</th><th>详情</th></tr></thead><tbody><tr v-for="role in roles" :key="role.role_assignment_id ?? role.person_id"><td>{{ role.role_code ? clinicalCodeLabel(role.role_code) : '未授权' }}</td><td>{{ role.position_code ? clinicalCodeLabel(role.position_code) : '—' }}</td><td>{{ role.department_id ? `科室 …${role.department_id.slice(-8)}` : '院区范围' }}</td><td>{{ format(role.role_valid_from) }} — {{ format(role.role_valid_until) }}</td><td>{{ role.role_status ? clinicalCodeLabel(role.role_status) : '—' }}</td><td><RouterLink v-if="role.role_assignment_id" class="task-action" :to="`/admin/users/${personId}/roles/${role.role_assignment_id}`">查看任期</RouterLink></td></tr></tbody></table></div></div>
      <div v-else-if="roleAssignmentId && !auditSection && selectedRole" class="grid admin-list-detail"><section class="card"><div class="card-head">角色任期详情</div><div class="card-body"><div class="folder-row">角色<span>{{ selectedRole.role_code ? clinicalCodeLabel(selectedRole.role_code) : '—' }}</span></div><div class="folder-row">岗位<span>{{ selectedRole.position_code ? clinicalCodeLabel(selectedRole.position_code) : '—' }}</span></div><div class="folder-row">状态<span>{{ selectedRole.role_status ? clinicalCodeLabel(selectedRole.role_status) : '—' }}</span></div><div class="folder-row">数据库版本<span>v{{ selectedRole.role_row_version }}</span></div></div></section><aside class="card"><div class="card-head">证据下钻</div><div class="card-body"><RouterLink class="btn primary" :to="`/admin/users/${personId}/roles/${roleAssignmentId}/audit`">查看相关审计证据</RouterLink></div></aside></div>
      <div v-else-if="auditSection && !eventId" class="card"><div class="card-head">角色与人员相关审计证据</div><div v-if="!auditEvents.length" class="admin-empty">当前审计检索窗口内无相关事件。</div><div v-else class="admin-table-wrap"><table class="table"><thead><tr><th>发生时间</th><th>操作</th><th>资源</th><th>追踪号</th><th>详情</th></tr></thead><tbody><tr v-for="event in auditEvents" :key="event.audit_event_id"><td>{{ format(event.occurred_at) }}</td><td>{{ clinicalCodeLabel(event.action_code) }}</td><td>{{ clinicalCodeLabel(event.resource_type) }} · …{{ event.resource_id.slice(-8) }}</td><td>{{ event.trace_id }}</td><td><RouterLink class="task-action" :to="`/admin/users/${personId}/roles/${roleAssignmentId}/audit/${event.audit_event_id}`">查看证据</RouterLink></td></tr></tbody></table></div></div>
      <div v-else-if="selectedEvent" class="card"><div class="card-head">审计事件详情 · …{{ selectedEvent.audit_event_id.slice(-8) }}</div><div class="card-body"><div class="folder-row">发生时间<span>{{ format(selectedEvent.occurred_at) }}</span></div><div class="folder-row">操作名称<span>{{ clinicalCodeLabel(selectedEvent.action_code) }}</span></div><div class="folder-row">资源类型<span>{{ clinicalCodeLabel(selectedEvent.resource_type) }}</span></div><div class="folder-row">追踪号<span>{{ selectedEvent.trace_id }}</span></div><div class="folder-row">前序摘要<span>{{ selectedEvent.previous_hash ?? '创世事件' }}</span></div><div class="folder-row">事件摘要<span>{{ selectedEvent.event_hash }}</span></div><div class="notice info">该页面只展示审计证据，不提供覆盖或删除操作。</div></div></div>
    </template>
  </section>
</template>
