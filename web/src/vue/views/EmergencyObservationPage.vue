<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { EmergencyObservationWire } from '../../generated/contracts';
import { completeEmergencyObservation, issueEmergencyLease, listEmergencyObservations, startEmergencyObservation, voidEmergencyObservation } from '../../api/emergency';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import AdminConfirmDialog from '../components/AdminConfirmDialog.vue';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['emergency', 'observation', 'lease'], queryFn: () => issueEmergencyLease('EMERGENCY_OBSERVATION'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const itemsQuery = useQuery({ queryKey: ['emergency', 'observation', 'items'], queryFn: () => listEmergencyObservations(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? itemsQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? itemsQuery.error.value) : null);
const items = computed(() => itemsQuery.data.value ?? []);
const currentItems = computed(() => items.value.filter((i) => !i.voided_at));
const dispositionLabels: Record<string, string> = { PENDING: '待定', DISCHARGED: '离院', ADMITTED: '收住院', TRANSFERRED: '转科/转院' };
const form = reactive({ observation_started_at: new Date().toISOString().slice(0, 16) });
const createOpen = ref(false);
const dispositionTarget = ref<EmergencyObservationWire | null>(null);
const disposition = ref<'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED'>('ADMITTED');
const voidTarget = ref<EmergencyObservationWire | null>(null);
const voidReason = ref('');
const busy = ref(''); const notice = ref('');

function formatDate(value: string | null | undefined) { return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', hour12: false }).format(new Date(value)) : '—'; }
async function reload() { notice.value = ''; await itemsQuery.refetch(); }
async function startObservation() { const lease = leaseQuery.data.value; if (!lease || busy.value) return; busy.value = 'create'; notice.value = ''; try { await startEmergencyObservation(lease, { observation_started_at: new Date(form.observation_started_at).toISOString() }); createOpen.value = false; notice.value = '已开启抢救留观，去向待定。'; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function saveDisposition() { const lease = leaseQuery.data.value; const target = dispositionTarget.value; if (!lease || !target || busy.value) return; busy.value = 'complete'; notice.value = ''; try { await completeEmergencyObservation(lease, target, disposition.value); notice.value = `留观去向已更新为「${dispositionLabels[disposition.value]}」，闭环完成。`; dispositionTarget.value = null; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function confirmVoid() { const lease = leaseQuery.data.value; const target = voidTarget.value; if (!lease || !target || busy.value || voidReason.value.trim().length < 4) return; busy.value = 'void'; notice.value = ''; try { await voidEmergencyObservation(lease, target, voidReason.value.trim()); notice.value = '留观记录已逻辑作废，已退出当前去向门禁。'; voidTarget.value = null; voidReason.value = ''; await itemsQuery.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page emergency-crud-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">临床工作域 / 急诊</p><h1>急诊抢救留观与去向</h1><p>开启留观后必须编辑明确去向形成闭环；删除采用带原因的逻辑作废，不清除历史。</p></div><div class="toolbar-actions"><RouterLink class="button secondary" to="/emergency">返回工作台</RouterLink><button class="button primary" :disabled="currentItems.length>0" @click="createOpen=true">新建留观</button></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || itemsQuery.isPending.value" kind="loading" message="正在读取抢救留观记录" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />
    <template v-else><section class="admin-metrics" aria-label="留观统计"><article><span>留观记录</span><strong>{{ items.length }}</strong><small>含历史作废</small></article><article><span>观察中</span><strong>{{ currentItems.filter((i)=>i.status==='OBSERVING').length }}</strong><small>影响当前流程</small></article></section><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <section class="admin-panel"><header><div><h2>留观台账</h2><p>编辑去向会关闭留观；删除会安全释放当前流程占位。</p></div><button class="button secondary" @click="itemsQuery.refetch()">刷新</button></header>
        <div v-if="!items.length" class="admin-empty rich"><strong>当前患者还没有留观记录</strong><p>符合持续观察或抢救条件时，可新建留观并在结束时填写去向。</p><button class="button primary" @click="createOpen=true">新建留观</button></div>
        <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>开始时间</th><th>完成时间</th><th>去向</th><th>状态</th><th>操作</th></tr></thead><tbody><tr v-for="item in items" :key="item.observation_id" :class="{'is-voided':item.voided_at}"><td>{{ formatDate(item.observation_started_at) }}</td><td>{{ formatDate(item.completed_at) }}</td><td><span class="admin-status" :class="item.voided_at?'muted':item.disposition.toLowerCase()">{{ item.voided_at?'已作废':dispositionLabels[item.disposition] }}</span></td><td>{{ item.voided_at ? '退出流程' : item.status==='OBSERVING'?'观察中':'已完成' }}</td><td><span class="inline-actions"><button class="task-action" :disabled="Boolean(busy)||item.status!=='OBSERVING'||Boolean(item.voided_at)" @click="dispositionTarget=item">编辑去向</button><button class="task-action danger" :disabled="Boolean(busy)||Boolean(item.voided_at)" @click="voidTarget=item">删除</button></span></td></tr></tbody></table></div>
      </section>
    </template>
    <AdminActionDialog v-model:open="createOpen" title="新建抢救留观" description="新建后立即进入留观流程，必须后续记录离院、收住院或转科转院去向。" eyebrow="急诊 / 抢救留观" :busy="busy==='create'"><form class="admin-form" @submit.prevent="startObservation"><label><span>留观开始时间</span><input v-model="form.observation_started_at" type="datetime-local" autofocus required /></label><button class="button primary" :disabled="Boolean(busy)">{{ busy==='create'?'正在开启…':'确认开启留观' }}</button></form></AdminActionDialog>
    <AdminActionDialog :open="Boolean(dispositionTarget)" title="编辑留观去向" description="确认后立即完成留观闭环并影响急诊去向统计。" eyebrow="急诊 / 去向闭环" :busy="busy==='complete'" @update:open="!$event&&(dispositionTarget=null)"><form class="admin-form" @submit.prevent="saveDisposition"><label><span>患者去向</span><select v-model="disposition" autofocus><option value="DISCHARGED">离院</option><option value="ADMITTED">收住院</option><option value="TRANSFERRED">转科 / 转院</option></select></label><button class="button primary" :disabled="Boolean(busy)">{{ busy==='complete'?'正在更新…':'保存去向并完成' }}</button></form></AdminActionDialog>
    <AdminConfirmDialog :open="Boolean(voidTarget)" title="删除留观记录" description="该操作按医疗审计要求执行为逻辑作废，并立即停止这条记录影响去向流程。" confirm-label="确认删除并作废" :busy="busy==='void'" @update:open="!$event&&(voidTarget=null)" @confirm="confirmVoid"><label class="admin-confirm-reason"><span>作废原因（至少 4 字）</span><textarea v-model="voidReason" rows="3" required /></label></AdminConfirmDialog>
  </section>
</template>
