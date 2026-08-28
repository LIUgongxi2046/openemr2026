import type { InpatientWorklistItemWire, WaitingQueueEntryWire } from '../generated/contracts';
import type { ComputedRef, InjectionKey, Ref } from 'vue';
import { clinicalContext, selectInpatientContext } from '../clinical-api';

export type ExecutionQueueMode = 'OUTPATIENT' | 'INPATIENT';

export interface ExecutionRouteConfig {
  title: string;
  subtitle: string;
  taskLabel: string;
  mode: ExecutionQueueMode;
}

export interface ExecutionPatientRow {
  key: string;
  patientId: string;
  encounterId: string;
  admissionId: string | null;
  patientDisplayName: string;
  sexCode: string | null;
  birthDate: string | null;
  visitType: '门诊' | '住院';
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
  'care-operations': { title: '执行总览', subtitle: '先从患者执行队列选择患者，再进入跨专业诊疗执行工作台', taskLabel: '跨专业诊疗执行', mode: 'OUTPATIENT' },
  billing: { title: '费用结算', subtitle: '按患者核对待结算业务，再下转到费用执行明细', taskLabel: '费用核对与结算', mode: 'OUTPATIENT' },
  'outpatient-pharmacy': { title: '门诊药房', subtitle: '从候诊患者列表下转处方，完成审核、调剂与发药闭环', taskLabel: '处方审核与发药', mode: 'OUTPATIENT' },
  'inpatient-pharmacy': { title: '住院药房', subtitle: '从病区在院列表下转患者，完成摆药、配液与发药闭环', taskLabel: '住院摆药与发药', mode: 'INPATIENT' },
  'lab-workbench': { title: '检验', subtitle: '先选择患者，再进入采样、标本接收、结果与危急值闭环', taskLabel: '检验标本执行', mode: 'OUTPATIENT' },
  'pathology-workbench': { title: '病理', subtitle: '先选择患者，再进入病理标本、制片、诊断与签署流程', taskLabel: '病理标本执行', mode: 'OUTPATIENT' },
  'imaging-workbench': { title: '检查影像', subtitle: '先选择患者，再进入预约准备、检查执行与报告签发流程', taskLabel: '影像检查执行', mode: 'OUTPATIENT' },
  'therapy-workbench': { title: '治疗', subtitle: '先选择患者，再进入治疗排程、双核对与执行闭环', taskLabel: '治疗项目执行', mode: 'OUTPATIENT' },
  'surgery-schedule': { title: '手术', subtitle: '先选择患者，再进入手术排程、安全核查与状态流转', taskLabel: '围手术期执行', mode: 'OUTPATIENT' },
  'anesthesia-workbench': { title: '麻醉', subtitle: '先选择患者，再进入术前评估、麻醉事件轴与复苏流程', taskLabel: '麻醉与复苏执行', mode: 'OUTPATIENT' },
  transfusion: { title: '输血', subtitle: '先选择患者，再进入血制品核对、输注与不良反应闭环', taskLabel: '输血执行', mode: 'OUTPATIENT' },
  'device-monitoring': { title: '设备监护', subtitle: '先选择患者，再进入设备绑定、趋势监测与告警处置', taskLabel: '设备监护执行', mode: 'OUTPATIENT' },
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
  clinicalContext.patientId = row.patientId;
  clinicalContext.encounterId = row.encounterId;
  if (row.admissionId) {
    selectInpatientContext({
      admission_id: row.admissionId,
      encounter_id: row.encounterId,
      patient_id: row.patientId,
    });
  }
}
