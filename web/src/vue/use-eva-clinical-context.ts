import { ref } from 'vue';
import { z } from 'zod';
import {
  clinicalContext,
  issueContextLease,
  issuePatientSearchLease,
  listPatientEncounters,
  searchPatientsForAdmission,
} from '../clinical-api';
import type { EncounterWire, PatientSummaryWire } from '../generated/contracts';
import { toClinicalIssue } from './clinical-error';

export interface EvaPatientContext {
  patientId: string;
  encounterId: string;
  patientName: string;
  patientSummary: string;
  label: string;
  scene: string;
}

const configuredPatientContexts: EvaPatientContext[] = [
  { patientId: clinicalContext.patientId, encounterId: clinicalContext.encounterId, patientName: '王某某', patientSummary: '男 · 52岁 · 心内科复诊', label: '门诊接诊', scene: '门诊' },
  { patientId: clinicalContext.emergencyPatientId, encounterId: clinicalContext.emergencyEncounterId, patientName: '赵某某', patientSummary: '女 · 68岁 · 胸痛待评估', label: '急诊抢救', scene: '急诊' },
  { patientId: clinicalContext.inpatientPatientId, encounterId: clinicalContext.inpatientEncounterId, patientName: '李某某', patientSummary: '男 · 61岁 · 心内科一病区', label: '住院日常', scene: '住院' },
];

const uuidSchema = z.string().uuid();

export function hasEvaPatientContext(context: Pick<EvaPatientContext, 'patientId' | 'encounterId'>): boolean {
  return uuidSchema.safeParse(context.patientId).success && uuidSchema.safeParse(context.encounterId).success;
}

export const evaDefaultPatientContexts = configuredPatientContexts.filter(hasEvaPatientContext);

const emptyPatientContext: EvaPatientContext = {
  patientId: '',
  encounterId: '',
  patientName: '未选择患者',
  patientSummary: '请搜索患者并选择一次有效就诊',
  label: '待绑定',
  scene: '未绑定',
};

const encounterLabels: Record<EncounterWire['encounter_type'], { label: string; scene: string }> = {
  OUTPATIENT: { label: '门诊接诊', scene: '门诊' },
  EMERGENCY: { label: '急诊处置', scene: '急诊' },
  INPATIENT: { label: '住院诊疗', scene: '住院' },
};

function patientSummary(patient: PatientSummaryWire) {
  const age = Math.max(0, new Date().getFullYear() - new Date(patient.birth_date).getFullYear());
  return `${patient.sex_code === 'M' ? '男' : patient.sex_code === 'F' ? '女' : '未知'} · ${age}岁`;
}

export function useEvaClinicalContext(initial?: EvaPatientContext) {
  const current = ref<EvaPatientContext>(initial && hasEvaPatientContext(initial)
    ? initial : evaDefaultPatientContexts[0] ?? emptyPatientContext);
  const results = ref<PatientSummaryWire[]>([]);
  const encounters = ref<EncounterWire[]>([]);
  const selectedPatient = ref<PatientSummaryWire | null>(null);
  const searching = ref(false);
  const loadingEncounters = ref(false);
  const notice = ref('');

  async function search(query: string) {
    if (searching.value || !query.trim()) return;
    searching.value = true;
    notice.value = '';
    encounters.value = [];
    selectedPatient.value = null;
    try {
      const lease = await issuePatientSearchLease();
      results.value = await searchPatientsForAdmission(lease, query);
      if (!results.value.length) notice.value = '没有找到匹配患者，请调整姓名或编号后重试。';
    } catch (error) {
      const issue = toClinicalIssue(error);
      notice.value = `${issue.code}：${issue.message}`;
    } finally { searching.value = false; }
  }

  async function selectPatient(patient: PatientSummaryWire) {
    selectedPatient.value = patient;
    loadingEncounters.value = true;
    notice.value = '';
    try {
      const lease = await issueContextLease(patient.patient_id, null, 'PATIENT_TIMELINE');
      encounters.value = await listPatientEncounters(lease, patient.patient_id);
      const encounter = encounters.value.find((item) => ['IN_PROGRESS', 'ARRIVED'].includes(item.status)) ?? encounters.value[0];
      if (!encounter) {
        notice.value = '该患者在当前院区没有可绑定的就诊记录。';
        return;
      }
      selectEncounter(encounter);
    } catch (error) {
      const issue = toClinicalIssue(error);
      notice.value = `${issue.code}：${issue.message}`;
    } finally { loadingEncounters.value = false; }
  }

  function selectEncounter(encounter: EncounterWire) {
    const patient = selectedPatient.value;
    const labels = encounterLabels[encounter.encounter_type];
    current.value = {
      patientId: encounter.patient_id,
      encounterId: encounter.encounter_id,
      patientName: patient?.display_name ?? current.value.patientName,
      patientSummary: patient ? patientSummary(patient) : current.value.patientSummary,
      label: labels.label,
      scene: labels.scene,
    };
    notice.value = `已绑定${current.value.patientName}的${labels.label}。`;
  }

  function selectDefault(context: EvaPatientContext) {
    current.value = context;
    selectedPatient.value = null;
    encounters.value = [];
    results.value = [];
    notice.value = `已绑定${context.patientName}的${context.label}。`;
  }

  return { current, results, encounters, selectedPatient, searching, loadingEncounters, notice, search, selectPatient, selectEncounter, selectDefault };
}
