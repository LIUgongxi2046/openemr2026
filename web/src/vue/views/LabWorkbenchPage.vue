<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import type { LabSpecimenWire } from '../../generated/contracts';
import { developmentCopy } from '../../development-copy';
import { collectLabSpecimen, createLabSpecimen, issueExecutionLease, listLabSpecimens, receiveLabSpecimen } from '../../api/execution';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

type SpecimenType = LabSpecimenWire['specimen_type'];
const specimenTypes: SpecimenType[] = ['BLOOD', 'URINE', 'STOOL', 'TISSUE', 'SWAB', 'OTHER'];
const specimenLabels: Record<SpecimenType, string> = {
  BLOOD: '血液', URINE: '尿液', STOOL: '粪便', TISSUE: '组织', SWAB: '拭子', OTHER: '其他',
};
const statusLabels: Record<LabSpecimenWire['collection_status'], string> = {
  ORDERED: '已申请', COLLECTED: '已采集', RECEIVED: '已接收', REJECTED: '已拒收',
};

const leaseQuery = useQuery({
  queryKey: ['execution', 'lab-workbench', 'lease'],
  queryFn: () => issueExecutionLease('LAB_WORKFLOW'),
  retry: false, staleTime: 5 * 60_000, gcTime: 0,
});
const specimensQuery = useQuery({
  queryKey: ['execution', 'lab-workbench', 'specimens'],
  queryFn: () => listLabSpecimens(leaseQuery.data.value!),
  enabled: () => Boolean(leaseQuery.data.value),
  retry: false,
});
const issue = computed(() => (leaseQuery.error.value ?? specimensQuery.error.value)
  ? toClinicalIssue(leaseQuery.error.value ?? specimensQuery.error.value) : null);
const specimens = computed(() => specimensQuery.data.value ?? []);
const collectedCount = computed(() => specimens.value.filter((s) => s.collection_status === 'COLLECTED').length);
const receivedCount = computed(() => specimens.value.filter((s) => s.collection_status === 'RECEIVED').length);

const form = reactive({ orderItemId: '', specimenType: 'BLOOD' as SpecimenType });
const busy = ref('');
const notice = ref('');

function formatDate(value: string | null | undefined) {
  return value ? new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)) : '—';
}

async function reload() { notice.value = ''; await specimensQuery.refetch(); }

async function create() {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value || !form.orderItemId.trim()) return;
  busy.value = 'create'; notice.value = '';
  try {
    await createLabSpecimen(lease, { order_item_id: form.orderItemId.trim(), specimen_type: form.specimenType });
    form.orderItemId = '';
    notice.value = '标本已申请，等待采集与接收闭环。';
    await specimensQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function collect(specimen: LabSpecimenWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = `collect:${specimen.specimen_id}`; notice.value = '';
  try {
    await collectLabSpecimen(lease, specimen);
    notice.value = '标本已采集，采集人与时间已留痕。';
    await specimensQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}

async function receive(specimen: LabSpecimenWire) {
  const lease = leaseQuery.data.value;
  if (!lease || busy.value) return;
  busy.value = `receive:${specimen.specimen_id}`; notice.value = '';
  try {
    await receiveLabSpecimen(lease, specimen);
    notice.value = '标本已接收，进入检验流程。';
    await specimensQuery.refetch();
  } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; }
  finally { busy.value = ''; }
}
</script>

<template>
  <section data-page-root class="content vue-native-page">
    <div class="page-heading">
      <div><p class="eyebrow">医疗协同执行 / 检验</p><h1>检验工作台</h1><p>标本申请 → 采集 → 接收三步闭环，采集人与时间强制留痕。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="Boolean(busy)" @click="reload">刷新</button></div>
    </div>
    <section class="patient-strip"><div class="patient-avatar">{{ developmentCopy.patientAvatar }}</div><div><strong>{{ developmentCopy.outpatientPatientName }}</strong><span>当前就诊检验标本</span></div><dl><div><dt>采集</dt><dd>采集人留痕</dd></div><div><dt>接收</dt><dd>接收人留痕</dd></div></dl><span class="lease-badge">当前患者 / 当前就诊</span></section>
    <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

    <ClinicalPageState v-if="leaseQuery.isPending.value || specimensQuery.isPending.value" kind="loading" message="正在读取检验标本台账" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="reload" />

    <template v-else>
      <section class="admin-metrics" aria-label="检验标本统计">
        <article><span>标本数</span><strong>{{ specimens.length }}</strong><small>当前就诊</small></article>
        <article><span>已采集</span><strong>{{ collectedCount }}</strong><small>COLLECTED</small></article>
        <article><span>已接收</span><strong>{{ receivedCount }}</strong><small>RECEIVED</small></article>
      </section>

      <div class="admin-layout">
        <section class="admin-panel">
          <header><div><h2>标本台账</h2><p>状态机：ORDERED → COLLECTED → RECEIVED。</p></div><button class="button secondary" @click="specimensQuery.refetch()">刷新</button></header>
          <div v-if="specimens.length === 0" class="empty-state"><span>检</span><p>当前就诊暂无标本</p><small>在右侧录入医嘱条目创建标本申请</small></div>
          <div v-else class="admin-table-wrap">
            <table class="admin-table">
              <thead><tr><th>标本</th><th>医嘱条目</th><th>采集人 / 时间</th><th>接收人 / 时间</th><th>状态</th><th>操作</th></tr></thead>
              <tbody>
                <tr v-for="specimen in specimens" :key="specimen.specimen_id">
                  <td><strong>{{ specimenLabels[specimen.specimen_type] }}</strong><small>…{{ specimen.specimen_id.slice(-8) }}</small></td>
                  <td><code>…{{ specimen.order_item_id.slice(-8) }}</code></td>
                  <td><small>{{ specimen.collected_by ? `…${specimen.collected_by.slice(-8)}` : '—' }}</small><small>{{ formatDate(specimen.collected_at) }}</small></td>
                  <td><small>{{ specimen.received_by ? `…${specimen.received_by.slice(-8)}` : '—' }}</small><small>{{ formatDate(specimen.received_at) }}</small></td>
                  <td><span class="admin-status" :class="specimen.collection_status.toLowerCase()">{{ statusLabels[specimen.collection_status] }}</span></td>
                  <td class="admin-actions">
                    <button v-if="specimen.collection_status === 'ORDERED'" class="task-action" :disabled="Boolean(busy)" @click="collect(specimen)">采集</button>
                    <button v-if="specimen.collection_status === 'COLLECTED'" class="task-action" :disabled="Boolean(busy)" @click="receive(specimen)">接收</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section class="admin-panel admin-form-panel">
          <header><div><h2>标本申请</h2><p>关联医嘱条目 ID 与标本类型。</p></div></header>
          <form class="admin-form" @submit.prevent="create">
            <label><span>医嘱条目 ID</span><input v-model="form.orderItemId" maxlength="36" required placeholder="UUID" /></label>
            <label><span>标本类型</span><select v-model="form.specimenType"><option v-for="type in specimenTypes" :key="type" :value="type">{{ specimenLabels[type] }}</option></select></label>
            <button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在申请…' : '创建标本申请' }}</button>
          </form>
        </section>
      </div>
    </template>
  </section>
</template>
