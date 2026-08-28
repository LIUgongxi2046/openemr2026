import { afterEach, describe, expect, it } from 'vitest';
import type { InpatientWorklistItemWire, WaitingQueueEntryWire } from '../generated/contracts';
import { clinicalContext } from '../clinical-api';
import {
  activateExecutionPatient,
  executionPatientFlowRouteIds,
  executionRouteConfigs,
  filterExecutionPatientRows,
  mapInpatientWorklist,
  mapOutpatientQueue,
} from './execution-patient-flow';

const originalContext = {
  patientId: clinicalContext.patientId,
  encounterId: clinicalContext.encounterId,
  inpatientPatientId: clinicalContext.inpatientPatientId,
  inpatientEncounterId: clinicalContext.inpatientEncounterId,
  inpatientAdmissionId: clinicalContext.inpatientAdmissionId,
};

afterEach(() => Object.assign(clinicalContext, originalContext));

describe('诊疗执行中心患者下转流程', () => {
  it('覆盖全部 12 个二级菜单，且住院药房使用住院列表', () => {
    expect(executionPatientFlowRouteIds.size).toBe(12);
    expect(executionRouteConfigs['care-operations'].title).toBe('执行总览');
    expect(executionRouteConfigs['inpatient-pharmacy'].mode).toBe('INPATIENT');
    expect(Object.values(executionRouteConfigs).filter((item) => item.mode === 'OUTPATIENT')).toHaveLength(11);
  });

  it('把真实候诊条目映射成可检索、可下转的门诊患者行', () => {
    const entries: WaitingQueueEntryWire[] = [{
      waiting_queue_entry_id: '018f0000-0000-7000-8000-00000000c001',
      appointment_id: '018f0000-0000-7000-8000-00000000c002',
      patient_id: '018f0000-0000-7000-8000-000000000001',
      patient_display_name: '李明', patient_sex_code: 'M', patient_birth_date: '1982-04-19',
      encounter_id: '018f0000-0000-7000-8000-000000000101',
      facility_id: '018f0000-0000-7000-8000-00000000aa03', queue_date: '2026-08-28',
      sequence_no: 12, status: 'WAITING', row_version: 0,
    }];
    const rows = mapOutpatientQueue(entries, '检验标本执行');

    expect(rows[0]).toMatchObject({ patientDisplayName: '李明', visitType: '门诊', location: '候诊序号 12', pendingCount: 1 });
    expect(filterExecutionPatientRows(rows, '李明', 'WAITING')).toHaveLength(1);
    expect(filterExecutionPatientRows(rows, '不存在', 'ALL')).toHaveLength(0);
  });

  it('选择门诊或住院患者时切换对应患者与就诊上下文', () => {
    const outpatient = mapOutpatientQueue([{
      waiting_queue_entry_id: '018f0000-0000-7000-8000-00000000c001',
      appointment_id: '018f0000-0000-7000-8000-00000000c002',
      patient_id: '018f0000-0000-7000-8000-000000000011', patient_display_name: '门诊患者',
      patient_sex_code: 'F', patient_birth_date: '1990-01-01', encounter_id: '018f0000-0000-7000-8000-000000000111',
      facility_id: '018f0000-0000-7000-8000-00000000aa03', queue_date: '2026-08-28', sequence_no: 1,
      status: 'CALLED', row_version: 1,
    }], '门诊任务')[0];
    activateExecutionPatient(outpatient);
    expect(clinicalContext.patientId).toBe(outpatient.patientId);
    expect(clinicalContext.encounterId).toBe(outpatient.encounterId);

    const inpatient: InpatientWorklistItemWire = {
      admission_id: '018f0000-0000-7000-8000-00000000bb13',
      encounter_id: '018f0000-0000-7000-8000-000000000112',
      patient_id: '018f0000-0000-7000-8000-000000000012', patient_display_name: '住院患者', bed_label: '08',
      attending_user_id: '018f0000-0000-7000-8000-00000000aa04', admitted_at: '2026-08-20T08:00:00Z',
      overdue_task_count: 1, pending_task_count: 3, row_version: 2,
    };
    const inpatientRow = mapInpatientWorklist([inpatient], '住院摆药与发药')[0];
    activateExecutionPatient(inpatientRow);
    expect(clinicalContext.inpatientPatientId).toBe(inpatient.patient_id);
    expect(clinicalContext.inpatientEncounterId).toBe(inpatient.encounter_id);
    expect(clinicalContext.inpatientAdmissionId).toBe(inpatient.admission_id);
  });
});
