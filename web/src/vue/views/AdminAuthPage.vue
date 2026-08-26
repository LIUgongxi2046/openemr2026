<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { loadAuthenticationAdministration } from '../../api/system-administration';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import SimulationWorkbenchPage from '../components/SimulationWorkbenchPage.vue';
import { toClinicalIssue } from '../clinical-error';
import { simulationWorkbench } from '../simulation-workbenches';

const activeTab = ref<'POLICY' | 'SIMULATION'>('POLICY');
const showBaseline = ref(false);
const definition = simulationWorkbench('admin-auth');
const query = useQuery({
  queryKey: ['admin', 'authentication-administration'], queryFn: loadAuthenticationAdministration,
  retry: false, staleTime: 0, gcTime: 0,
});
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const snapshot = computed(() => query.data.value);
const settings = computed(() => (snapshot.value?.parameters ?? []).map((item) => ({
  key: item.config_key,
  name: item.display_name,
  value: stringPayload(item.payload, 'configured_value') || stringPayload(item.payload, 'inheritance') || '尚未配置',
  state: item.status,
})));
const identitiesByUser = computed(() => new Map((snapshot.value?.workforce ?? []).filter((item) => item.user_id).map((item) => [item.user_id!, item.person_display_name])));
const events = computed(() => (snapshot.value?.events ?? []).slice(0, 20).map((event) => ({
  id: event.audit_event_id,
  time: formatDateTime(event.occurred_at),
  subject: event.actor_user_id ? (identitiesByUser.value.get(event.actor_user_id) ?? `用户 …${event.actor_user_id.slice(-8)}`) : '未知主体',
  source: `${event.resource_type} · …${event.resource_id.slice(-8)}`,
  method: event.action_code === 'LOGOUT_SUCCEEDED' ? '会话令牌' : '用户名与口令',
  result: actionLabel(event.action_code),
  tone: event.action_code === 'LOGIN_FAILED' ? 'red' : event.action_code === 'LOGOUT_SUCCEEDED' ? 'blue' : 'green',
})));
const failedEvents = computed(() => (snapshot.value?.events ?? []).filter((event) => event.action_code === 'LOGIN_FAILED').length);
const inactiveAccounts = computed(() => new Set((snapshot.value?.workforce ?? []).filter((item) => item.user_id
  && item.account_status !== 'ACTIVE'
  && !/(合成|测试|验收|Acceptance)/i.test(item.person_display_name)).map((item) => item.user_id)).size);
const pendingReviews = computed(() => (snapshot.value?.emergencyAccess ?? []).filter((item) => !item.reviewed_at).length);
const unpublishedSettings = computed(() => settings.value.filter((item) => item.state !== 'ACTIVE').length);

function stringPayload(payload: Record<string, unknown> | undefined, key: string) { const value = payload?.[key]; return typeof value === 'string' ? value : ''; }
function formatDateTime(value: string) { return new Intl.DateTimeFormat('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' }).format(new Date(value)); }
function actionLabel(action: string) { return ({ LOGIN_SUCCEEDED: '登录成功', LOGIN_FAILED: '登录失败', LOGOUT_SUCCEEDED: '退出成功' } as Record<string, string>)[action] ?? action; }
function stateLabel(state: string) { return ({ DRAFT: '草稿', PENDING_APPROVAL: '待审批', APPROVED: '已批准', ACTIVE: '已生效', ARCHIVED: '已归档' } as Record<string, string>)[state] ?? '待治理'; }
</script>

<template>
  <section v-if="activeTab === 'POLICY'" data-page-root class="content admin-content vue-native-page">
    <div class="page-head"><div class="page-title"><h1>认证与账户安全策略</h1><p>密码、MFA/证书/SSO、会话、设备、高风险再认证和服务账户凭据轮换</p></div><div class="head-actions"><button class="btn" type="button" @click="showBaseline = !showBaseline">安全基线差异</button><RouterLink class="btn primary" to="/admin-parameters">创建策略草稿</RouterLink></div></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取安全参数和认证审计" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else>
      <section v-if="showBaseline" class="admin-panel admin-form-panel"><header><div><h2>生产认证策略 / 安全基线差异</h2><p>依据数据库版本状态逐项核对，草稿和待审批项不会伪装成已生效。</p></div></header><div class="admin-diff-list"><article v-for="item in settings" :key="item.key"><b>{{ item.name }}</b><span>{{ item.value }}</span><span class="status" :class="item.state === 'ACTIVE' ? 'green' : 'amber'">{{ stateLabel(item.state) }}</span></article><div v-if="!settings.length" class="admin-empty">暂无安全参数，请先创建策略草稿。</div></div></section>
      <div class="grid auth-layout">
        <section class="card"><div class="card-head">生产认证策略 · 数据库当前版本 <span class="status" :class="unpublishedSettings ? 'amber' : 'green'">{{ unpublishedSettings ? `${unpublishedSettings} 项待发布` : '全部已生效' }}</span></div><div class="card-body"><div class="setting-grid" aria-label="认证安全设置"><article v-for="item in settings" :key="item.key"><span>{{ item.name }}</span><b>{{ item.value }}</b><small>{{ stateLabel(item.state) }}</small></article><div v-if="!settings.length" class="admin-empty">数据库中暂无认证安全参数，请进入参数管理创建。</div></div><div class="notice rule"><div class="notice-title">安全配置全程留痕</div>认证参数使用版本化配置、独立审批与回退；登录和退出事件进入不可覆盖审计链。</div></div></section>
        <aside class="card"><div class="card-head">高风险账户</div><div class="card-body"><div class="queue-item"><div class="queue-title">登录失败事件 <b>{{ failedEvents }}</b><span class="status" :class="failedEvents ? 'red' : 'green'">{{ failedEvents ? '待复核' : '通过' }}</span></div></div><div class="queue-item"><div class="queue-title">停用/非活动账户 <b>{{ inactiveAccounts }}</b><span class="status" :class="inactiveAccounts ? 'amber' : 'green'">{{ inactiveAccounts ? '待处置' : '通过' }}</span></div></div><div class="queue-item"><div class="queue-title">紧急访问待复核 <b>{{ pendingReviews }}</b><span class="status" :class="pendingReviews ? 'red' : 'green'">{{ pendingReviews ? '待复核' : '通过' }}</span></div></div><div class="queue-item"><div class="queue-title">未发布安全参数 <b>{{ unpublishedSettings }}</b><span class="status" :class="unpublishedSettings ? 'amber' : 'green'">{{ unpublishedSettings ? '待发布' : '通过' }}</span></div></div><button class="btn" type="button" style="width:100%;margin-top:12px" @click="activeTab = 'SIMULATION'">打开账户安全复核</button></div></aside>
      </div>
      <section class="card admin-secondary-ledger"><div class="card-head">最近认证事件 <span class="status blue">数据库审计</span></div><div class="admin-table-wrap"><table class="table"><thead><tr><th>时间</th><th>主体</th><th>审计对象</th><th>认证方式</th><th>结果</th></tr></thead><tbody><tr v-for="item in events" :key="item.id"><td>{{ item.time }}</td><td><b>{{ item.subject }}</b></td><td>{{ item.source }}</td><td>{{ item.method }}</td><td><span class="status" :class="item.tone">{{ item.result }}</span></td></tr><tr v-if="!events.length"><td colspan="5" class="admin-empty">审计链中暂无登录或退出事件。</td></tr></tbody></table></div></section>
    </template>
  </section>
  <div v-else><div class="auth-backbar"><button class="btn" type="button" @click="activeTab = 'POLICY'">← 返回安全策略</button></div><SimulationWorkbenchPage :definition="definition" /></div>
</template>

<style scoped>
.setting-grid article { border: 1px solid var(--line); border-radius: 8px; padding: 12px; background: #fbfdff; }.setting-grid span,.setting-grid b,.setting-grid small { display:block; }.setting-grid span { margin-bottom:6px;color:var(--muted);font-size:9px }.setting-grid b{font-size:11px;line-height:1.45}.setting-grid small{margin-top:7px;color:var(--muted);font-size:9px}.auth-backbar { margin-bottom: 10px; }
@media(max-width:900px){.auth-layout,.setting-grid{grid-template-columns:minmax(0,1fr)}}
</style>
