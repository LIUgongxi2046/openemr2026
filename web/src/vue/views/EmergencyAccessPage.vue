<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { clinicalContext, loadOwnEmergencyAccess, requestEmergencyAccess } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const query = useQuery({ queryKey: ['clinical', 'emergency-access'], queryFn: loadOwnEmergencyAccess, retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const grants = computed(() => query.data.value ?? []); const busy = ref(false); const notice = ref('');
const form = reactive({ reason: '', duration: 15, acknowledged: false });
function formatDate(value: string) { return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)); }
function remaining(value: string) { const minutes = Math.max(0, Math.ceil((new Date(value).getTime() - Date.now()) / 60000)); return minutes ? `${minutes} 分钟` : '已到期'; }
async function requestGrant() { if (busy.value || !form.acknowledged || form.reason.trim().length < 10) return; busy.value = true; notice.value = ''; try { await requestEmergencyAccess({ role_assignment_id: clinicalContext.roleId, patient_id: clinicalContext.patientId, encounter_id: clinicalContext.encounterId, resource_types: ['CLINICAL_CONTEXT', 'DOCUMENT'], action_codes: ['LEASE_ISSUE', 'READ'], reason: form.reason.trim(), duration_minutes: form.duration, risk_acknowledged: form.acknowledged }); notice.value = '紧急访问已生效，请仅访问当前救治必需信息，所有使用将进入事后复核。'; form.reason = ''; form.acknowledged = false; await query.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = false; } }
</script>

<template>
  <section data-page-root class="content emergency-access-page vue-native-page"><div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 安全越权</p><h1>紧急访问</h1><p>只用于患者危急且常规授权无法及时建立的场景。必须填写具体理由、选择短时限、明确确认风险，且不会绕过显式保护规则。</p></div><RouterLink class="button secondary" to="/outpatient">返回门诊</RouterLink></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在核对本人紧急访问记录" /><ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p><div class="emergency-layout"><section class="emergency-request-card"><header><span>!</span><div><h2>申请最小必要紧急访问</h2><p>当前范围：患者 …{{ clinicalContext.patientId.slice(-8) }} · 就诊 …{{ clinicalContext.encounterId.slice(-8) }} · 临床上下文/病历只读。</p></div></header><form class="emergency-form" @submit.prevent="requestGrant"><p class="step-up-note">提交时必须完成身份提供方的高强度二次认证；认证时间超过 5 分钟会失败关闭。</p><label><span>临床紧急理由</span><textarea v-model="form.reason" rows="5" required minlength="10" placeholder="说明患者危急情况、为什么常规授权来不及建立，以及需要查看的最小信息" /></label><label><span>授权时限</span><select v-model="form.duration"><option :value="5">5 分钟</option><option :value="15">15 分钟</option><option :value="30">30 分钟</option><option :value="60">60 分钟（上限）</option></select></label><label class="risk-confirm"><input v-model="form.acknowledged" type="checkbox" /><span>我确认该访问仅用于当前紧急救治，所有查看和使用将永久审计并由独立安全管理员复核。</span></label><button class="button danger full" :disabled="busy || !form.acknowledged || form.reason.trim().length < 10">{{ busy ? '正在建立限时授权…' : '二次认证并建立紧急访问' }}</button></form></section><section class="emergency-history"><header><h2>本人紧急访问记录</h2><span>{{ grants.length }} 条</span></header><div v-if="!grants.length" class="emergency-empty">尚无紧急访问记录</div><article v-for="grant in grants" :key="grant.emergency_access_grant_id" :class="grant.status.toLowerCase()"><div><strong>{{ grant.status === 'ACTIVE' ? `生效中 · 剩余 ${remaining(grant.expires_at)}` : grant.status }}</strong><small>{{ formatDate(grant.requested_at) }} → {{ formatDate(grant.expires_at) }}</small></div><p>{{ grant.reason }}</p><dl><div><dt>资源</dt><dd>{{ grant.resource_types.join(' / ') }}</dd></div><div><dt>动作</dt><dd>{{ grant.action_codes.join(' / ') }}</dd></div><div><dt>事后复核</dt><dd>{{ grant.review_outcome || '待复核' }}</dd></div></dl></article></section></div></template>
  </section>
</template>
