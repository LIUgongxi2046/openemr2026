<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import type { PatientMatchCandidateWire, PatientMergeCaseWire } from '../../generated/contracts';
import { approvePatientMerge, approvePatientMergeReversal, clinicalContext, loadPatientMatchCandidates, loadPatientMergeCases, requestPatientMerge, requestPatientMergeReversal } from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const route = useRoute();
const query = useQuery({ queryKey: ['mpi', 'merge-cases'], queryFn: async () => ({ candidates: await loadPatientMatchCandidates('OPEN'), cases: await loadPatientMergeCases() }), retry: false, staleTime: 0, gcTime: 0 });
const issue = computed(() => query.error.value ? toClinicalIssue(query.error.value) : null);
const candidates = computed(() => query.data.value?.candidates ?? []); const cases = computed(() => query.data.value?.cases ?? []);
const form = reactive({ candidateId: String(route.query.candidate ?? ''), sourcePatientId: '', targetPatientId: '', reason: '', nameChoice: 'TARGET', identifierChoice: 'RETAIN_ALL', clinicalLinks: 'PRESERVE_SOURCE_REFERENCES' });
const reversalReasons = reactive<Record<string, string>>({}); const busy = ref(''); const notice = ref('');
const pending = computed(() => cases.value.filter((item) => item.status === 'PENDING_SECOND_REVIEW').length);
const reversalPending = computed(() => cases.value.filter((item) => item.status === 'REVERSAL_PENDING').length);
function candidateSelected(item: PatientMatchCandidateWire) { Object.assign(form, { candidateId: item.candidate_id, sourcePatientId: item.patient_a_id, targetPatientId: item.patient_b_id }); }
function canApprove(item: PatientMergeCaseWire) { return item.status === 'PENDING_SECOND_REVIEW' && item.requested_by !== clinicalContext.userId; }
function canApproveReversal(item: PatientMergeCaseWire) { return item.status === 'REVERSAL_PENDING' && item.reversal_requested_by !== clinicalContext.userId; }
async function run(id: string, action: () => Promise<unknown>, success: string) { if (busy.value) return; busy.value = id; notice.value = ''; try { await action(); notice.value = success; await query.refetch(); } catch (error) { const next = toClinicalIssue(error); notice.value = `${next.code}：${next.message}`; } finally { busy.value = ''; } }
async function create() {
  if (!form.sourcePatientId || !form.targetPatientId || form.reason.trim().length < 8) return;
  await run('create', () => requestPatientMerge({ candidate_id: form.candidateId || null, source_patient_id: form.sourcePatientId, target_patient_id: form.targetPatientId, reason: form.reason, conflict_resolution: { display_name: form.nameChoice, identifiers: form.identifierChoice, clinical_links: form.clinicalLinks } }), '合并案已创建，等待另一位患者主索引管理员独立审批。');
}
</script>

<template>
  <section data-page-root class="content admin-content vue-native-page mpi-page">
    <div class="page-heading admin-heading"><div><p class="eyebrow">病历中心 / 患者主索引</p><h1>患者合并与可逆撤销</h1><p>合并只建立源患者到目标患者的规范映射，保留全部标识符、就诊、医嘱、结果和病历原始引用；申请人与审批人必须是不同用户。</p></div><RouterLink class="button secondary" to="/patient-registry">返回患者主索引</RouterLink></div>
    <ClinicalPageState v-if="query.isPending.value" kind="loading" message="正在读取合并与撤销审批队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="query.refetch()" />
    <template v-else><section class="admin-metrics mpi-metrics"><article><span>待二审</span><strong>{{ pending }}</strong><small>申请人不可自批</small></article><article><span>撤销待审</span><strong>{{ reversalPending }}</strong><small>仍需第二人</small></article><article><span>开放候选</span><strong>{{ candidates.length }}</strong><small>可创建合并案</small></article><article><span>引用重写</span><strong>0</strong><small>原始临床事实不搬迁</small></article></section><p v-if="notice" class="admin-notice" role="status">{{ notice }}</p>
      <div class="mpi-merge-layout"><section class="admin-panel"><header><div><h2>合并与撤销台账</h2><p>每次状态变化都有乐观锁、幂等键、审计链和事件出箱。</p></div><button class="button secondary" @click="query.refetch()">刷新</button></header><div class="merge-card-list"><article v-for="item in cases" :key="item.merge_case_id" class="merge-case-card"><header><div><span class="admin-status" :class="item.status === 'MERGED' ? 'active' : ''">{{ item.status }}</span><strong>{{ item.source_patient_name }} → {{ item.target_patient_name }}</strong></div><small>案号 …{{ item.merge_case_id.slice(-8) }} · v{{ item.row_version }}</small></header><div class="merge-patient-map"><div><span>源档案（保留原始引用）</span><code>{{ item.source_patient_id }}</code></div><b>建立规范映射</b><div><span>目标主档案</span><code>{{ item.target_patient_id }}</code></div></div><p>{{ item.merge_reason }}</p><dl><div><dt>姓名冲突</dt><dd>{{ item.conflict_resolution.display_name }}</dd></div><div><dt>标识符</dt><dd>{{ item.conflict_resolution.identifiers }}</dd></div><div><dt>临床链接</dt><dd>{{ item.conflict_resolution.clinical_links }}</dd></div></dl><footer><button v-if="item.status === 'PENDING_SECOND_REVIEW'" :disabled="!canApprove(item) || Boolean(busy)" @click="run(item.merge_case_id, () => approvePatientMerge(item), '合并已由独立管理员批准，原临床引用保持不变。')">{{ item.requested_by === clinicalContext.userId ? '申请人不可自批' : '独立审批合并' }}</button><template v-if="item.status === 'MERGED'"><input v-model="reversalReasons[item.merge_case_id]" placeholder="填写撤销理由（至少 8 字）" /><button :disabled="(reversalReasons[item.merge_case_id]?.length ?? 0) < 8 || Boolean(busy)" @click="run(item.merge_case_id, () => requestPatientMergeReversal(item, reversalReasons[item.merge_case_id]), '撤销申请已登记，等待另一位管理员审批。')">申请撤销</button></template><button v-if="item.status === 'REVERSAL_PENDING'" :disabled="!canApproveReversal(item) || Boolean(busy)" @click="run(item.merge_case_id, () => approvePatientMergeReversal(item), '规范映射已撤销，源患者状态准确恢复。')">{{ item.reversal_requested_by === clinicalContext.userId ? '撤销申请人不可自批' : '独立审批撤销' }}</button></footer></article><div v-if="!cases.length" class="mpi-empty">尚无患者合并案。</div></div></section>
        <aside class="admin-panel admin-form-panel merge-create-panel"><header><div><h2>创建合并案</h2><p>先选择开放候选，再明确源档案、目标主档案及冲突处置。</p></div></header><div class="candidate-picker"><button v-for="item in candidates" :key="item.candidate_id" :class="{ selected: form.candidateId === item.candidate_id }" @click="candidateSelected(item)"><strong>{{ item.patient_a_name }} / {{ item.patient_b_name }}</strong><small>相似度 {{ Math.round(item.match_score * 100) }}%</small></button></div><form class="admin-form" @submit.prevent="create"><label><span>源患者 ID</span><input v-model="form.sourcePatientId" required /></label><label><span>目标患者 ID</span><input v-model="form.targetPatientId" required /></label><label><span>合并理由</span><textarea v-model="form.reason" required minlength="8" rows="3"></textarea></label><label><span>姓名冲突</span><select v-model="form.nameChoice"><option value="TARGET">采用目标档案</option><option value="SOURCE">采用源档案</option><option value="MANUAL_REVIEW">人工另行核验</option></select></label><label><span>标识符策略</span><select v-model="form.identifierChoice"><option value="RETAIN_ALL">全部保留</option></select></label><label><span>临床链接策略</span><select v-model="form.clinicalLinks"><option value="PRESERVE_SOURCE_REFERENCES">保持源引用，仅查询时归并</option></select></label><button class="button primary full" :disabled="Boolean(busy)">{{ busy === 'create' ? '正在创建…' : '提交第二人审批' }}</button></form></aside></div>
    </template>
  </section>
</template>
