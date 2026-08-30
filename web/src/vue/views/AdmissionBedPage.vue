<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query';
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import type { InpatientBedBoardItemWire, PatientSummaryWire } from '../../generated/contracts';
import {
  admitInpatientFromBedBoard, createInpatientEncounterForAdmission,
  issuePatientSearchLease, issueWardLease, loadInpatientBedBoard, loadInpatientWorklist,
  searchPatientsForAdmission, selectInpatientContext,
} from '../../clinical-api';
import ClinicalPageState from '../components/ClinicalPageState.vue';
import BusinessActionDialog from '../components/BusinessActionDialog.vue';
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
const admissionDialogOpen = ref(false);
const admittedAtLocal = ref(toLocalInput(new Date()));
const registration = reactive({
  admissionSource: 'OUTPATIENT' as 'OUTPATIENT' | 'EMERGENCY' | 'TRANSFER' | 'OTHER',
  admissionType: 'ELECTIVE' as 'ELECTIVE' | 'URGENT' | 'EMERGENCY',
  conditionLevel: 'GENERAL' as 'GENERAL' | 'SERIOUS' | 'CRITICAL',
  diagnosisCode: '', diagnosisText: '', paymentMethodCode: 'URBMI',
  verificationMethod: 'RESIDENT_ID' as 'RESIDENT_ID' | 'MEDICAL_CARD' | 'OTHER',
  contactName: '', contactRelationship: '', contactPhone: '', certificateNo: '', transferFrom: '', remarks: '',
});

const issue = computed(() => desk.error.value ? toClinicalIssue(desk.error.value) : null);
const beds = computed(() => desk.data.value?.beds ?? []);
const worklist = computed(() => desk.data.value?.worklist ?? []);
const availableBeds = computed(() => beds.value.filter((bed) => bed.bed_status === 'ACTIVE' && bed.occupancy_status === 'AVAILABLE'));
const occupiedBeds = computed(() => beds.value.filter((bed) => bed.occupancy_status === 'OCCUPIED'));
const occupancyPercent = computed(() => beds.value.length ? Math.round(occupiedBeds.value.length / beds.value.length * 100) : 0);
const pendingTasks = computed(() => worklist.value.reduce((total, item) => total + item.pending_task_count, 0));
const selectedBed = computed(() => beds.value.find((bed) => bed.bed_id === selectedBedId.value) ?? null);
const admissionReady = computed(() => Boolean(selectedPatient.value && selectedBed.value && admittedAtLocal.value
  && registration.diagnosisText.trim() && registration.contactName.trim()
  && registration.contactRelationship.trim() && registration.contactPhone.trim()
  && (registration.admissionSource !== 'TRANSFER' || registration.transferFrom.trim())));

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
      {
        bedId: selectedBed.value.bed_id, wardId: selectedBed.value.ward_id,
        departmentId: selectedBed.value.department_id,
        admittedAt: new Date(admittedAtLocal.value).toISOString(), ...registration,
      },
    );
    notice.value = `${overview.patient_display_name} 已入住 ${overview.ward_display_name} ${overview.bed_label}床；入院任务、审计与事件已同事务建立。`;
    admissionDialogOpen.value = false;
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
      <div class="toolbar-actions"><button class="button secondary" :disabled="desk.isFetching.value" @click="desk.refetch()">刷新床位</button><button class="button primary" @click="admissionDialogOpen = true">办理新入院</button><RouterLink class="button secondary" to="/inpatient">返回住院工作站</RouterLink></div>
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
              <span><b>{{ bed.display_bed_no }}</b><em>{{ bed.occupancy_status === 'AVAILABLE' ? '可入床' : '在院' }}</em></span>
              <strong>{{ bed.patient_display_name || '空床' }}</strong>
              <small v-if="bed.occupancy_status === 'OCCUPIED'">入院 {{ formatDate(bed.admitted_at) }} · 点击进入患者</small>
              <small v-else>{{ bed.bed_status === 'ACTIVE' ? '点击选择此床位' : '床位已停用' }}</small>
            </button>
          </div>
          <div v-else class="clinical-empty-state">当前授权病区没有已配置床位，请先在配置中心建立病区与床位主数据。</div>
          <footer><span>床位占用由数据库唯一约束保护；并发抢床时只有一个请求成功。</span><RouterLink to="/admin-org">管理病区与床位配置</RouterLink></footer>
        </section>

        <aside class="admission-panel">
          <header><div><p class="eyebrow">身份核验后入床</p><h2>办理新入院</h2></div><span>弹窗登记</span></header>
          <section class="admission-safety"><strong>真实入院流程</strong><ul><li>在床位图先选择空床，再通过弹窗检索并核验患者</li><li>住院就诊、床位占用和入院任务由后端同事务建立</li><li>并发抢床由数据库唯一约束阻断</li><li>已占床患者点击后切换为明确患者上下文</li></ul></section>
          <div class="admission-selection" :class="{ ready: selectedBed }"><strong>{{ selectedBed ? `${selectedBed.display_bed_no}床已选择` : '尚未选择空床' }}</strong><small>{{ selectedBed ? `${selectedBed.facility_name} · ${selectedBed.ward_name}` : '请在左侧床位图选择可用床位' }}</small></div>
          <button class="button primary full" :disabled="!selectedBed" @click="admissionDialogOpen = true">打开入院登记弹窗</button>
        </aside>
      </div>

      <BusinessActionDialog :open="admissionDialogOpen" title="办理新入院" description="患者身份核验、住院就诊、床位占用、文书任务、审计和 Outbox 将形成真实业务闭环。" confirm-label="核验并确认入院" :busy="busy === 'admit'" :confirm-disabled="!admissionReady" width="wide" @cancel="admissionDialogOpen = false" @confirm="admit">
          <div class="admission-dialog-form">
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
              <div class="admission-selection" :class="{ ready: selectedBed }"><strong>{{ selectedBed ? selectedBed.display_bed_no : '尚未选择空床' }}</strong><small>{{ selectedBed ? `${selectedBed.facility_name} · ${selectedBed.ward_name}` : '请在左侧床位图选择可用床位' }}</small></div>
            </label>
            <label>入院时间<input v-model="admittedAtLocal" type="datetime-local" required /></label>
            <div class="form-row"><label>入院途径<select v-model="registration.admissionSource"><option value="OUTPATIENT">门诊</option><option value="EMERGENCY">急诊</option><option value="TRANSFER">转院</option><option value="OTHER">其他</option></select></label><label>入院类型<select v-model="registration.admissionType"><option value="ELECTIVE">择期</option><option value="URGENT">紧急</option><option value="EMERGENCY">急诊</option></select></label></div>
            <label>入院病情<select v-model="registration.conditionLevel"><option value="GENERAL">一般</option><option value="SERIOUS">病重</option><option value="CRITICAL">病危</option></select></label>
            <div class="form-row"><label>诊断编码<input v-model="registration.diagnosisCode" maxlength="64" placeholder="如 I50.9（选填）" /></label><label>付费方式<select v-model="registration.paymentMethodCode"><option value="URBMI">城镇职工医保</option><option value="URRMI">城乡居民医保</option><option value="SELF_PAY">自费</option><option value="OTHER">其他</option></select></label></div>
            <label>入院诊断<input v-model="registration.diagnosisText" maxlength="1000" required placeholder="填写门/急诊入院诊断" /></label>
            <div class="form-row"><label>身份核验<select v-model="registration.verificationMethod"><option value="RESIDENT_ID">居民身份证</option><option value="MEDICAL_CARD">就诊卡/电子健康卡</option><option value="OTHER">其他证件</option></select></label><label>入院证/医嘱号<input v-model="registration.certificateNo" maxlength="96" /></label></div>
            <div class="form-row"><label>联系人姓名<input v-model="registration.contactName" maxlength="128" required /></label><label>与患者关系<input v-model="registration.contactRelationship" maxlength="64" required /></label></div>
            <label>联系人电话<input v-model="registration.contactPhone" type="tel" maxlength="32" required /></label>
            <label v-if="registration.admissionSource === 'TRANSFER'">转出医疗机构<input v-model="registration.transferFrom" maxlength="256" required /></label>
            <label>登记备注<textarea v-model="registration.remarks" maxlength="1000" rows="2"></textarea></label>
            <div v-if="pendingEncounterId" class="admission-recovery"><strong>住院就诊已建立</strong><small>…{{ pendingEncounterId.slice(-8) }}；如入床冲突，可选择其他空床后重试，不重复建就诊。</small></div>
            <p class="dialog-warning">确认按钮仅在患者、空床、诊断与联系人信息完整时生效；缺少必填信息时后端仍会拒绝提交。</p>
          </div>
      </BusinessActionDialog>
    </template>
  </section>
</template>
