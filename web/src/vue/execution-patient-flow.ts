import type { InpatientWorklistItemWire, WaitingQueueEntryWire } from '../generated/contracts';
import type { ExecutionWorklistItemWire } from '../generated/contracts';
import type { ExecutionDomain } from '../api/execution-center';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { selectInpatientContext, selectOutpatientContext } from '../clinical-api';

export type ExecutionQueueMode = 'OUTPATIENT' | 'INPATIENT';

export interface ExecutionRouteConfig {
  title: string;
  subtitle: string;
  taskLabel: string;
  mode: ExecutionQueueMode;
  domain: ExecutionDomain;
}

export interface ExecutionPatientRow {
  key: string;
  patientId: string;
  encounterId: string;
  admissionId: string | null;
  patientDisplayName: string;
  sexCode: string | null;
  birthDate: string | null;
  visitType: '门诊' | '急诊' | '住院';
  location: string;
  sequenceNo: number | null;
  status: string;
  pendingCount: number;
  overdueCount: number;
  taskLabel: string;
}

export interface ExecutionPatientSelectionContext {
  selected: Ref<ExecutionPatientRow | null>;
  config: ComputedRef<ExecutionRouteConfig>;
  returnToList: () => void;
}

export const executionPatientSelectionKey: InjectionKey<ExecutionPatientSelectionContext> = Symbol('execution-patient-selection');

export const executionRouteConfigs = Object.freeze<Record<string, ExecutionRouteConfig>>({
  'care-operations': { title: '执行总览', subtitle: '按已签署医嘱与执行记录聚合患者任务，再进入跨专业执行工作台', taskLabel: '跨专业诊疗执行', mode: 'OUTPATIENT', domain: 'CARE_OPERATIONS' },
  billing: { title: '费用结算', subtitle: '按患者真实费用明细核对待结算业务，再进入费用执行明细', taskLabel: '费用核对与结算', mode: 'OUTPATIENT', domain: 'BILLING' },
  'outpatient-pharmacy': { title: '门诊药房', subtitle: '从门诊处方调剂队列选择患者，完成审核、调剂与发药闭环', taskLabel: '处方审核与发药', mode: 'OUTPATIENT', domain: 'OUTPATIENT_PHARMACY' },
  'inpatient-pharmacy': { title: '住院药房', subtitle: '从住院摆药与配液队列选择患者，完成审核、核对与发药闭环', taskLabel: '住院摆药与发药', mode: 'INPATIENT', domain: 'INPATIENT_PHARMACY' },
  'lab-workbench': { title: '检验', subtitle: '从检验申请和标本队列选择患者，再进入采样、接收、结果与危急值闭环', taskLabel: '检验标本执行', mode: 'OUTPATIENT', domain: 'LAB' },
  'pathology-workbench': { title: '病理', subtitle: '从组织标本和病理申请队列选择患者，再进入取材、制片、诊断与签署流程', taskLabel: '病理标本执行', mode: 'OUTPATIENT', domain: 'PATHOLOGY' },
  'imaging-workbench': { title: '检查影像', subtitle: '从影像检查申请队列选择患者，再进入预约准备、检查执行与报告签发', taskLabel: '影像检查执行', mode: 'OUTPATIENT', domain: 'IMAGING' },
  'therapy-workbench': { title: '治疗', subtitle: '从已签署治疗医嘱队列选择患者，再进入排程、双核对与执行闭环', taskLabel: '治疗项目执行', mode: 'OUTPATIENT', domain: 'THERAPY' },
  'surgery-schedule': { title: '手术', subtitle: '从手术申请与排程队列选择患者，再进入三阶段安全核查与状态流转', taskLabel: '围手术期执行', mode: 'OUTPATIENT', domain: 'SURGERY' },
  'anesthesia-workbench': { title: '麻醉', subtitle: '从手术排程和麻醉申请队列选择患者，再进入术前评估、术中记录与复苏', taskLabel: '麻醉与复苏执行', mode: 'OUTPATIENT', domain: 'ANESTHESIA' },
  transfusion: { title: '输血', subtitle: '从血库发血与床旁输注队列选择患者，再进入双人核对和不良反应闭环', taskLabel: '输血执行', mode: 'OUTPATIENT', domain: 'TRANSFUSION' },
  'device-monitoring': { title: '设备监护', subtitle: '从设备采集和生命体征任务队列选择患者，再进入绑定、趋势与告警处置', taskLabel: '设备监护执行', mode: 'OUTPATIENT', domain: 'DEVICE_MONITORING' },
});

export const executionPatientFlowRouteIds = new Set(Object.keys(executionRouteConfigs));

export function mapOutpatientQueue(
  entries: WaitingQueueEntryWire[],
  taskLabel: string,
): ExecutionPatientRow[] {
  return entries.map((entry) => ({
    key: `OP:${entry.waiting_queue_entry_id}`,
    patientId: entry.patient_id,
    encounterId: entry.encounter_id,
    admissionId: null,
    patientDisplayName: entry.patient_display_name,
    sexCode: entry.patient_sex_code,
    birthDate: entry.patient_birth_date,
    visitType: '门诊',
    location: `候诊序号 ${entry.sequence_no}`,
    sequenceNo: entry.sequence_no,
    status: entry.status,
    pendingCount: entry.status === 'COMPLETED' || entry.status === 'SKIPPED' ? 0 : 1,
    overdueCount: 0,
    taskLabel,
  }));
}

export function mapInpatientWorklist(
  entries: InpatientWorklistItemWire[],
  taskLabel: string,
): ExecutionPatientRow[] {
  return entries.map((entry) => ({
    key: `IP:${entry.admission_id}`,
    patientId: entry.patient_id,
    encounterId: entry.encounter_id,
    admissionId: entry.admission_id,
    patientDisplayName: entry.patient_display_name,
    sexCode: null,
    birthDate: null,
    visitType: '住院',
    location: `${entry.bed_label}床`,
    sequenceNo: null,
    status: entry.overdue_task_count > 0 ? 'OVERDUE' : entry.pending_task_count > 0 ? 'PENDING' : 'READY',
    pendingCount: entry.pending_task_count,
    overdueCount: entry.overdue_task_count,
    taskLabel,
  }));
}

export function mapExecutionWorklist(entries: ExecutionWorklistItemWire[]): ExecutionPatientRow[] {
  return entries.map((entry, index) => ({
    key: `${entry.domain}:${entry.patient_id}:${entry.encounter_id}`,
    patientId: entry.patient_id,
    encounterId: entry.encounter_id,
    admissionId: entry.admission_id ?? null,
    patientDisplayName: entry.patient_display_name,
    sexCode: entry.sex_code,
    birthDate: entry.birth_date,
    visitType: entry.visit_type === 'INPATIENT' ? '住院' : entry.visit_type === 'EMERGENCY' ? '急诊' : '门诊',
    location: entry.location,
    sequenceNo: index + 1,
    status: entry.status,
    pendingCount: entry.pending_count,
    overdueCount: entry.overdue_count,
    taskLabel: entry.task_label,
  }));
}

export function filterExecutionPatientRows(
  rows: ExecutionPatientRow[],
  search: string,
  status: string,
): ExecutionPatientRow[] {
  const normalized = search.trim().toLocaleLowerCase('zh-CN');
  return rows.filter((row) => {
    const matchesStatus = status === 'ALL' || row.status === status;
    if (!matchesStatus) return false;
    if (!normalized) return true;
    return [row.patientDisplayName, row.patientId, row.encounterId, row.location, row.taskLabel]
      .some((value) => value.toLocaleLowerCase('zh-CN').includes(normalized));
  });
}

export function activateExecutionPatient(row: ExecutionPatientRow): void {
  selectOutpatientContext({
    patientId: row.patientId,
    encounterId: row.encounterId,
    patientDisplayName: row.patientDisplayName,
  });
  if (row.admissionId) {
    selectInpatientContext({
      admission_id: row.admissionId,
      encounter_id: row.encounterId,
      patient_id: row.patientId,
    });
  }
}
