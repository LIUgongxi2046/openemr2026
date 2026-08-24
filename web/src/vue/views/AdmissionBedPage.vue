<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { InpatientBedBoardItemWire, PatientSummaryWire } from '../../generated/contracts';
import {
  admitInpatientFromBedBoard, createInpatientEncounterForAdmission,
  issuePatientSearchLease, issueWardLease, loadInpatientBedBoard, loadInpatientWorklist,
  searchPatientsForAdmission, selectInpatientContext,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import { toClinicalIssue } from '../clinical-error';

const router = useRouter();
const desk = useQuery({
  queryKey: ['clinical', 'admission-bed-board'],
  queryFn: async () => {
    const lease = await issueWardLease();
    const [beds, worklist] = await Promise.all([
      loadInpatientBedBoard(lease),
      loadInpatientWorklist(lease),
    ]);
    return { lease, beds, worklist };
  },
  retry: false,
  staleTime: 0,
  gcTime: 0,
});

const searchLease = ref<Awaited<ReturnType<typeof issuePatientSearchLease>> | null>(null);

const busy = ref('');
const notice = ref('');
const searchQuery = ref('');
const candidates = ref<PatientSummaryWire[]>([]);
const selectedPatient = ref<PatientSummaryWire | null>(null);
const selectedBedId = ref('');
const pendingEncounterId = ref('');
const admittedAtLocal = ref(toLocalInput(new Date()));

const issue = computed(() => desk.error.value ? toClinicalIssue(desk.error.value) : null);
const beds = computed(() => desk.data.value?.beds ?? []);
const worklist = computed(() => desk.data.value?.worklist ?? []);
const availableBeds = computed(() => beds.value.filter((bed) => bed.bed_status === 'ACTIVE' && bed.occupancy_status === 'AVAILABLE'));
const occupiedBeds = computed(() => beds.value.filter((bed) => bed.occupancy_status === 'OCCUPIED'));
const occupancyPercent = computed(() => beds.value.length ? Math.round(occupiedBeds.value.length / beds.value.length * 100) : 0);
const pendingTasks = computed(() => worklist.value.reduce((total, item) => total + item.pending_task_count, 0));
const selectedBed = computed(() => beds.value.find((bed) => bed.bed_id === selectedBedId.value) ?? null);

async function search() {
  if (busy.value || searchQuery.value.trim().length < 1) return;
  busy.value = 'search';
  notice.value = '';
  try {
    searchLease.value ??= await issuePatientSearchLease();
    candidates.value = await searchPatientsForAdmission(searchLease.value, searchQuery.value);
    if (!candidates.value.length) notice.value = '未找到匹配患者，请先在患者登记完成身份核验。';
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

function choosePatient(patient: PatientSummaryWire) {
  selectedPatient.value = patient;
  pendingEncounterId.value = '';
}

function chooseBed(bed: InpatientBedBoardItemWire) {
  if (bed.occupancy_status === 'OCCUPIED' && bed.admission_id && bed.encounter_id && bed.patient_id) {
    selectInpatientContext({
      admission_id: bed.admission_id,
      encounter_id: bed.encounter_id,
      patient_id: bed.patient_id,
    });
    void router.push('/inpatient-overview');
    return;
  }
  selectedBedId.value = bed.bed_id;
}

async function admit() {
  if (busy.value || !selectedPatient.value || !selectedBed.value) return;
  busy.value = 'admit';
  notice.value = '';
  try {
    if (!pendingEncounterId.value) {
      const encounter = await createInpatientEncounterForAdmission(selectedPatient.value.patient_id);
      pendingEncounterId.value = encounter.encounter_id;
    }
    const overview = await admitInpatientFromBedBoard(
      selectedPatient.value.patient_id,
      pendingEncounterId.value,
      selectedBed.value.bed_id,
      new Date(admittedAtLocal.value).toISOString(),
    );
    notice.value = `${overview.patient_display_name} 已入住 ${overview.ward_display_name} ${overview.bed_label}床；入院任务、审计与事件已同事务建立。`;
    await desk.refetch();
    await router.push('/inpatient-overview');
  } catch (error) {
    const next = toClinicalIssue(error);
    notice.value = `${next.code}：${next.message}`;
  } finally {
    busy.value = '';
  }
}

function toLocalInput(value: Date) {
  const offset = value.getTimezoneOffset() * 60000;
  return new Date(value.getTime() - offset).toISOString().slice(0, 16);
}
function formatDate(value?: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(new Date(value));
}
</script>

<template>
  <section data-page-root class="content vue-native-page admission-bed-page">
    <div class="page-heading admission-heading">
      <div><p class="eyebrow">住院 / 入院与床位</p><h1>入院、病区与床位管理</h1><p>患者身份核验、住院就诊、床位占用、入院任务与审计证据在服务端完成一致性校验。</p></div>
      <div class="toolbar-actions"><button class="button secondary" :disabled="desk.isFetching.value" @click="desk.refetch()">刷新床位</button><RouterLink class="button secondary" to="/inpatient">返回住院工作站</RouterLink></div>
    </div>

    <ClinicalPageState v-if="desk.isPending.value" kind="loading" message="正在核验病区岗位、床位占用与住院队列" />
    <ClinicalPageState v-else-if="issue" kind="error" :code="issue.code" :message="issue.message" @retry="desk.refetch()" />
    <template v-else>
      <div class="inpatient-metrics admission-metrics">
        <article><span>当前在院</span><strong>{{ occupiedBeds.length }}</strong><small>当前授权病区</small></article>
        <article><span>可用床位</span><strong>{{ availableBeds.length }}</strong><small>只统计 ACTIVE 空床</small></article>
        <article><span>待办文书</span><strong>{{ pendingTasks }}</strong><small>来自在院患者任务</small></article>
        <article><span>床位占用率</span><strong>{{ occupancyPercent }}%</strong><small>{{ occupiedBeds.length }} / {{ beds.length }} 床</small></article>
      </div>
      <div v-if="notice" class="inline-notice" :class="{ error: notice.includes('：') }" role="status">{{ notice }}</div>

      <div class="admission-layout">
        <section class="admission-bed-board">
          <header><div><p class="eyebrow">实时床位事实</p><h2>当前病区床位图</h2></div><span>{{ beds.length }} 床 · {{ availableBeds.length }} 空床</span></header>
          <div v-if="beds.length" class="bed-card-grid">
            <button
              v-for="bed in beds"
              :key="bed.bed_id"
              type="button"
              :class="['bed-card', bed.occupancy_status.toLowerCase(), { selected: bed.bed_id === selectedBedId }]"
              :disabled="bed.bed_status !== 'ACTIVE'"
              @click="chooseBed(bed)"
            >
              <span><b>{{ bed.bed_label }}床</b><em>{{ bed.occupancy_status === 'AVAILABLE' ? '可入床' : '在院' }}</em></span>
              <strong>{{ bed.patient_display_name || '空床' }}</strong>
              <small v-if="bed.occupancy_status === 'OCCUPIED'">入院 {{ formatDate(bed.admitted_at) }} · 点击进入患者</small>
              <small v-else>{{ bed.bed_status === 'ACTIVE' ? '点击选择此床位' : '床位已停用' }}</small>
            </button>
          </div>
          <div v-else class="clinical-empty-state">当前授权病区没有已配置床位，请先在配置中心建立病区与床位主数据。</div>
          <footer><span>床位占用由数据库唯一约束保护；并发抢床时只有一个请求成功。</span><RouterLink to="/admin-org">管理病区与床位配置</RouterLink></footer>
        </section>

        <aside class="admission-panel">
          <header><div><p class="eyebrow">身份核验后入床</p><h2>办理新入院</h2></div><span>两步可恢复</span></header>
          <form @submit.prevent="admit">
            <label>检索患者
              <div class="admission-search"><input v-model="searchQuery" maxlength="80" placeholder="姓名或患者标识" /><button class="button secondary" type="button" :disabled="busy === 'search' || !searchQuery.trim()" @click="search">{{ busy === 'search' ? '检索中…' : '检索' }}</button></div>
            </label>
            <div v-if="candidates.length" class="admission-candidates" role="listbox" aria-label="患者候选">
              <button v-for="patient in candidates" :key="patient.patient_id" type="button" :class="{ selected: patient.patient_id === selectedPatient?.patient_id }" @click="choosePatient(patient)">
                <span><strong>{{ patient.display_name }}</strong><small>{{ patient.sex_code }} · {{ patient.birth_date }}</small></span><code>…{{ patient.patient_id.slice(-8) }}</code>
              </button>
            </div>
            <div v-else class="admission-empty">先检索并选择已完成身份核验的患者。</div>
            <label>已选床位
              <div class="admission-selection" :class="{ ready: selectedBed }"><strong>{{ selectedBed ? `${selectedBed.bed_label}床` : '尚未选择空床' }}</strong><small>{{ selectedBed ? '提交时服务端再次核验占用状态' : '请在左侧床位图选择可用床位' }}</small></div>
            </label>
            <label>入院时间<input v-model="admittedAtLocal" type="datetime-local" required /></label>
            <div v-if="pendingEncounterId" class="admission-recovery"><strong>住院就诊已建立</strong><small>…{{ pendingEncounterId.slice(-8) }}；如入床冲突，可选择其他空床后重试，不重复建就诊。</small></div>
            <button class="button primary" :disabled="Boolean(busy) || !selectedPatient || !selectedBed || !admittedAtLocal">{{ busy === 'admit' ? '正在创建住院事实…' : '核验并确认入院' }}</button>
          </form>
          <section class="admission-safety"><strong>安全与恢复</strong><ul><li>患者搜索不返回未授权病历正文</li><li>住院就诊创建后入床失败可继续重试</li><li>已占床患者点击后切换为明确患者上下文</li><li>入院成功后自动进入住院患者总览</li></ul></section>
        </aside>
      </div>
    </template>
  </section>
</template>
