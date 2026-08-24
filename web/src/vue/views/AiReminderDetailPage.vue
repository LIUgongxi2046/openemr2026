<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { ClinicalReminderWire } from '../../generated/contracts';
import { acknowledgeClinicalReminder, createClinicalReminder, issueAssistantEncounterLease, listClinicalReminders, silenceClinicalReminder } from '../../api/assistant';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const leaseQuery = useQuery({ queryKey: ['assistant', 'reminder', 'lease'], queryFn: () => issueAssistantEncounterLease('REMINDER_DETAIL'), retry: false, staleTime: 5 * 60_000, gcTime: 0 });
const remindersQuery = useQuery({ queryKey: ['assistant', 'reminder', 'items'], queryFn: () => listClinicalReminders(leaseQuery.data.value!), enabled: () => Boolean(leaseQuery.data.value), retry: false });
const issue = computed(() => (leaseQuery.error.value ?? remindersQuery.error.value) ? toClinicalIssue(leaseQuery.error.value ?? remindersQuery.error.value) : null);
const reminders = computed(() => remindersQuery.data.value ?? []);
const pending = computed(() => reminders.value.filter((r) => r.status === 'PENDING').length);
const form = reactive({ reminderType: 'DRUG_INTERACTION', message: '', severity: 'WARNING' });
const busy = ref(false);
const notice = ref('');

function sevLabel(s: string) { const m: Record<string, string> = { INFO: '提示', WARNING: '警告', CRITICAL: '危急' }; return m[s] ?? s; }
function statusLabel(s: string) { const m: Record<string, string> = { PENDING: '待处理', ACKNOWLEDGED: '已确认', SILENCED: '已静默' }; return m[s] ?? s; }

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.message.trim()) return;
  busy.value = true; notice.value = '';
  try {
    await createClinicalReminder(lease, { reminder_type: form.reminderType, message: form.message.trim(), severity: form.severity });
    form.message = ''; notice.value = '提醒已创建。'; await remindersQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
async function acknowledge(reminder: ClinicalReminderWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = true; notice.value = '';
  try { await acknowledgeClinicalReminder(lease, reminder); notice.value = '提醒已确认。'; await remindersQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
async function silence(reminder: ClinicalReminderWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = true; notice.value = '';
  try { await silenceClinicalReminder(lease, reminder); notice.value = '提醒已静默。'; await remindersQuery.refetch(); }
  catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = false; }
}
</script>

<template>
  <main id="main-content" class="content admin-content vue-native-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">AI 助手 / 提醒</p><h1>主动提醒详情</h1><p>提醒可确认或静默；一提醒可转一任务（限频由服务端收敛）。</p></div></div>
    <ClinicalPageState v-if="leaseQuery.isPending.value || remindersQuery.isPending.value" kind="loading" message="正在读取提醒" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="remindersQuery.refetch()" />
    <template v-else>
      <section class="admin-metrics"><article><span>提醒</span><strong>{{ reminders.length }}</strong><small>当前就诊</small></article><article><span>待处理</span><strong>{{ pending }}</strong><small>PENDING</small></article></section>
      <p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="admin-layout">
        <section class="admin-panel"><header><div><h2>提醒台账</h2><p>按严重度分级。</p></div><button class="button secondary" @click="remindersQuery.refetch()">刷新</button></header>
          <div v-if="!reminders.length" class="admin-empty">暂无提醒。</div>
          <div v-else class="admin-table-wrap"><table class="admin-table"><thead><tr><th>类型</th><th>消息</th><th>严重度</th><th>状态</th><th>操作</th></tr></thead><tbody>
            <tr v-for="reminder in reminders" :key="reminder.reminder_id">
              <td><strong>{{ reminder.reminder_type }}</strong><small>…{{ reminder.reminder_id.slice(-8) }}</small></td>
              <td>{{ reminder.message }}</td>
              <td><span class="admin-status">{{ sevLabel(reminder.severity) }}</span></td>
              <td><span class="admin-status" :class="reminder.status.toLowerCase()">{{ statusLabel(reminder.status) }}</span></td>
              <td>
                <button v-if="reminder.status === 'PENDING'" class="task-action" :disabled="busy" @click="acknowledge(reminder)">确认</button>
                <button v-if="reminder.status === 'PENDING'" class="task-action" :disabled="busy" @click="silence(reminder)">静默</button>
              </td>
            </tr>
          </tbody></table></div>
        </section>
        <section class="admin-panel admin-form-panel"><header><div><h2>新增提醒</h2><p>消息必填。</p></div></header>
          <form class="admin-form" @submit.prevent="create">
            <label><span>类型</span><select v-model="form.reminderType"><option value="DRUG_INTERACTION">药物相互作用</option><option value="ALLERGY">过敏</option><option value="DOSE">剂量</option><option value="FOLLOW_UP">随访</option><option value="OTHER">其他</option></select></label>
            <label><span>严重度</span><select v-model="form.severity"><option value="INFO">提示</option><option value="WARNING">警告</option><option value="CRITICAL">危急</option></select></label>
            <label><span>消息</span><textarea v-model="form.message" rows="3" required /></label>
            <button class="button primary full" :disabled="busy || !form.message.trim()">创建提醒</button>
          </form>
        </section>
      </div>
    </template>
  </main>
</template>
