<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { BloodTransfusionWire } from '../../generated/contracts';
import { clinicalContext } from '../../clinical-api';
import { developmentCopy } from '../../development-copy';
import { issueExecutionLease, listBloodTransfusions, recordBloodTransfusion, recordBloodTransfusionReaction } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import AdminActionDialog from '../components/AdminActionDialog.vue';
import ExecutionPatientContextBar from '../components/ExecutionPatientContextBar.vue';
import { toClinicalIssue } from '../clinical-error';

type BloodProduct = BloodTransfusionWire['blood_product'];
type BloodType = BloodTransfusionWire['blood_type'];
type Reaction = Exclude<BloodTransfusionWire['reaction_type'], null | undefined>;
const bloodProducts: BloodProduct[] = ['RED_CELLS', 'PLATELETS', 'PLASMA', 'CRYO', 'WHOLE_BLOOD'];
const bloodTypes: BloodType[] = ['A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG', 'O_POS', 'O_NEG'];
const reactions: Reaction[] = ['FEBRILE', 'ALLERGIC', 'HEMOLYTIC', 'TRALI', 'TACO', 'NONE'];
const productLabels: Record<BloodProduct, string> = {
  RED_CELLS: '红细胞', PLATELETS: '血小板', PLASMA: '血浆', CRYO: '冷沉淀', WHOLE_BLOOD: '全血',
};
const reactionLabels: Record<Reaction, string> = {
  FEBRILE: '发热', ALLERGIC: '过敏', HEMOLYTIC: '溶血', TRALI: '输血相关急性肺损伤', TACO: '输血相关循环超负荷', NONE: '无反应',
};

const leaseQuery = useQuery({
  queryKey: ['execution', 'transfusion', 'lease'],
  queryFn: () => issueExecutionLease('TRANSFUSION_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const transfusionsQuery = useQuery({
  queryKey: ['execution', 'transfusion', 'transfusions'],
  queryFn: () => listBloodTransfusions(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? transfusionsQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? transfusionsQuery.error.value) : null);
const transfusions = computed(() => transfusionsQuery.data.value ?? []);
const reactedCount = computed(() => transfusions.value.filter((t) => t.reaction_type && t.reaction_type !== 'NONE').length);

const form = reactive({ bloodProduct: 'RED_CELLS' as BloodProduct, bloodType: 'O_POS' as BloodType, unitNumber: '', volumeMl: 200, verifiedBy: clinicalContext.collaboratorUserId, verificationNote: '' });
const busy = ref('');
const notice = ref('');
const createDialogOpen = ref(false);
const reactionDialogOpen = ref(false);
const reactionTarget = ref<BloodTransfusionWire | null>(null);
const selectedReaction = ref<Reaction>('NONE');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await transfusionsQuery.refetch(); }

async function record() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.unitNumber.trim() || form.volumeMl <= 0 || !form.verifiedBy.trim()) return;
  busy.value = 'record'; notice.value = '';
  try {
    await recordBloodTransfusion(lease, {
      blood_product: form.bloodProduct, blood_type: form.bloodType,
      unit_number: form.unitNumber.trim(), volume_ml: form.volumeMl,
      started_at: new Date().toISOString(), verified_by: form.verifiedBy.trim(),
      verification_note: form.verificationNote.trim() || null,
    });
    form.unitNumber = ''; form.verificationNote = '';
    createDialogOpen.value = false;
    notice.value = '输血已双人核验并开始输注，输注反应需在反应发生时记录。';
    await transfusionsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

function beginReaction(transfusion: BloodTransfusionWire) {
  reactionTarget.value = transfusion;
  selectedReaction.value = 'NONE';
  reactionDialogOpen.value = true;
}

function closeReactionDialog() {
  reactionDialogOpen.value = false;
  reactionTarget.value = null;
  selectedReaction.value = 'NONE';
}

function handleReactionDialogOpen(open: boolean) {
  if (open) reactionDialogOpen.value = true;
  else closeReactionDialog();
}

async function react() {
  const transfusion = reactionTarget.value;
  const reactionType = selectedReaction.value;
  const lease = leaseQuery.data.value;
  if (!lease || !transfusion || busy.value) return;
  busy.value = `react:${transfusion.transfusion_id}`; notice.value = '';
  try {
    await recordBloodTransfusionReaction(lease, transfusion, reactionType);
    notice.value = reactionType === 'NONE' ? '已记录无输注反应。' : '输注反应已记录，进入不良事件/处置闭环。';
    closeReactionDialog();
    await transfusionsQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">诊疗执行 / 输血</p><h1>输血全链工作台</h1><p>输血双人核验后开始输注，输注反应显式记录并触发处置闭环。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button><button class="button primary" @click="createDialogOpen = true">新增输血记录</button></div>
    </div>
    <ExecutionPatientContextBar />
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.outpatientPatientName }}</strong><span>当前就诊输血记录</span></div><dl><div><dt>双人核验</dt><dd>强制第二人</dd></div><div><dt>反应记录</dt><dd>六类显式</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || transfusionsQuery.isPending.value" kind="loading" message="正在读取输血台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="输血统计">
        <article><span>输血记录</span><strong>{{ transfusions.length }}</strong><small>当前就诊</small></article>
        <article><span>反应记录</span><strong>{{ reactedCount }}</strong><small>非 NONE</small></article>
        <article><span>血型</span><strong>{{ transfusions[0] ? transfusions[0].blood_type.replace('_', ' ') : '—' }}</strong><small>最近一次</small></article>
      </section>

      <section class="admin-panel">
          <header><div><h2>输血台账</h2><p>双人核验后开始输注，反应按类型显式记录。</p></div><button class="button secondary" @click="transfusionsQuery.refetch()">刷新</button></header>
          <div v-if="transfusions.length === 0" class="empty-state"><span>血</span><p>当前就诊暂无输血记录</p><small>在右侧录入血制品开始输注</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>血制品 / 血型</th><th>单位号</th><th>容量</th><th>执行 / 核验</th><th>反应</th><th>开始时间</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="transfusion in transfusions" :key="transfusion.transfusion_id">
                  <td><strong>{{ productLabels[transfusion.blood_product] }}</strong><small>{{ transfusion.blood_type.replace('_', ' ') }} · …{{ transfusion.transfusion_id.slice(-8) }}</small></td>
                  <td>{{ transfusion.unit_number }}</td>
                  <td>{{ transfusion.volume_ml }} ml</td>
                  <td><small>执行 …{{ transfusion.administered_by.slice(-8) }}</small><small>核验 …{{ transfusion.verified_by.slice(-8) }}</small></td>
                  <td>{{ transfusion.reaction_type ? reactionLabels[transfusion.reaction_type as Reaction] : '待记录' }}</td>
                  <td>{{ formatDate(transfusion.started_at) }}</td>
                  <td class="admin-actions">
                    <button v-if="!transfusion.reaction_type" class="task-action" :disabled="Boolean(busy)" @click="beginReaction(transfusion)">记录反应</button>
                    <span v-else class="admin-status" :class="transfusion.reaction_type === 'NONE' ? 'none' : 'danger'">{{ reactionLabels[transfusion.reaction_type as Reaction] }}</span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
      </section>

      <AdminActionDialog v-model:open="createDialogOpen" title="新增输血记录" description="血制品、血型、单位号、容量与第二核验人必填。" eyebrow="诊疗执行 / 输血" size="large" :busy="busy === 'record'">
        <form class="admin-form" @submit.prevent="record">
          <label><span>血制品</span><select v-model="form.bloodProduct"><option v-for="product in bloodProducts" :key="product" :value="product">{{ productLabels[product] }}</option></select></label>
          <label><span>血型</span><select v-model="form.bloodType"><option v-for="type in bloodTypes" :key="type" :value="type">{{ type.replace('_', ' ') }}</option></select></label>
          <label><span>单位号</span><input v-model="form.unitNumber" maxlength="64" required placeholder="例：UNIT-2026-0001" /></label>
          <label><span>容量（ml）</span><input v-model.number="form.volumeMl" type="number" min="1" required /></label>
          <label><span>第二核验人 ID</span><input v-model="form.verifiedBy" maxlength="36" required placeholder="UUID" /></label>
          <label><span>核验备注</span><input v-model="form.verificationNote" maxlength="256" placeholder="可选" /></label>
          <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'record' ? '正在录入…' : '双人核验并开始输注' }}</button>
        </form>
      </AdminActionDialog>

      <AdminActionDialog :open="reactionDialogOpen" title="记录输注反应" description="请选择本次输注观察结果。提交后将写入患者记录；不良反应会进入处置闭环。" eyebrow="诊疗执行 / 输血观察" :tone="selectedReaction === 'NONE' ? 'default' : 'danger'" :busy="busy.startsWith('react:')" @update:open="handleReactionDialogOpen">
        <form class="admin-form" @submit.prevent="react">
          <label><span>输注单位</span><input :value="reactionTarget?.unit_number ?? ''" disabled /></label>
          <label><span>观察结果</span><select v-model="selectedReaction"><option v-for="reaction in reactions" :key="reaction" :value="reaction">{{ reactionLabels[reaction] }}</option></select></label>
          <p v-if="selectedReaction !== 'NONE'" class="inline-notice error">确认后将登记为输血不良反应，并触发临床处置与审计留痕。</p>
          <button class="button full" :class="selectedReaction === 'NONE' ? 'primary' : 'danger'" :disabled="Boolean(busy)">{{ busy.startsWith('react:') ? '正在提交…' : '确认记录' }}</button>
        </form>
      </AdminActionDialog>
    </template>
  </section>
</template>
