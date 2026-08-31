import { clinicalContext, explicitContextHeaders, issueContextLease, request } from '../clinical-api';
import {
  executionWorklistItemWireSchema,
  specialtyExecutionCaseCreateRequestWireSchema,
  specialtyExecutionCaseTransitionRequestWireSchema,
  specialtyExecutionCaseUpdateRequestWireSchema,
  specialtyExecutionCaseWireSchema,
  type ContextLeaseWire,
  type ExecutionWorklistItemWire,
  type SpecialtyExecutionCaseWire,
} from '../generated/contracts';

export type ExecutionDomain =
  | 'CARE_OPERATIONS' | 'BILLING' | 'OUTPATIENT_PHARMACY' | 'INPATIENT_PHARMACY'
  | 'LAB' | 'PATHOLOGY' | 'IMAGING' | 'THERAPY' | 'SURGERY' | 'ANESTHESIA'
  | 'TRANSFUSION' | 'DEVICE_MONITORING';

export function issueExecutionWorklistLease(domain: ExecutionDomain): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, `EXECUTION_WORKLIST_${domain}`);
}

export async function listExecutionWorklist(
  lease: ContextLeaseWire,
  domain: ExecutionDomain,
): Promise<ExecutionWorklistItemWire[]> {
  return executionWorklistItemWireSchema.array().parse(await request(
    `/execution-center/worklists/${encodeURIComponent(domain)}`,
    { headers: explicitContextHeaders(lease, null, null) },
  ));
}

export function useExecutionPatientContext(item: ExecutionWorklistItemWire): void {
  clinicalContext.patientId = item.patient_id;
  clinicalContext.encounterId = item.encounter_id;
}

export type SpecialtyExecutionDomain = 'PATHOLOGY' | 'THERAPY' | 'ANESTHESIA' | 'DEVICE_MONITORING';

export function issueSpecialtyExecutionLease(): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, 'SPECIALTY_EXECUTION_CASE');
}

function specialtyScope() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
    encounter_id: clinicalContext.encounterId,
  };
}

function specialtyJson(lease: ContextLeaseWire, method: 'POST' | 'PUT', body: unknown) {
  return {
    method,
    headers: {
      ...explicitContextHeaders(lease, clinicalContext.patientId, clinicalContext.encounterId),
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(body),
  };
}

export async function listSpecialtyExecutionCases(
  lease: ContextLeaseWire,
  domain: SpecialtyExecutionDomain,
): Promise<SpecialtyExecutionCaseWire[]> {
  const query = new URLSearchParams({ domain, patient_id: clinicalContext.patientId, encounter_id: clinicalContext.encounterId });
  return specialtyExecutionCaseWireSchema.array().parse(await request(`/execution-center/cases?${query}`, {
    headers: explicitContextHeaders(lease, clinicalContext.patientId, clinicalContext.encounterId),
  }));
}

export async function createSpecialtyExecutionCase(
  lease: ContextLeaseWire,
  input: { domain: SpecialtyExecutionDomain; title: string; priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY'; planned_at?: string | null; payload: Record<string, unknown> },
): Promise<SpecialtyExecutionCaseWire> {
  const command = specialtyExecutionCaseCreateRequestWireSchema.parse({ ...specialtyScope(), ...input });
  return specialtyExecutionCaseWireSchema.parse(await request('/execution-center/cases', specialtyJson(lease, 'POST', command)));
}

export async function updateSpecialtyExecutionCase(
  lease: ContextLeaseWire,
  item: SpecialtyExecutionCaseWire,
  input: { title: string; priority: 'ROUTINE' | 'URGENT' | 'EMERGENCY'; planned_at?: string | null; payload: Record<string, unknown> },
): Promise<SpecialtyExecutionCaseWire> {
  const command = specialtyExecutionCaseUpdateRequestWireSchema.parse({ ...specialtyScope(), ...input, expected_row_version: item.row_version });
  return specialtyExecutionCaseWireSchema.parse(await request(
    `/execution-center/cases/${item.specialty_execution_case_id}`,
    specialtyJson(lease, 'PUT', command),
  ));
}

export async function transitionSpecialtyExecutionCase(
  lease: ContextLeaseWire,
  item: SpecialtyExecutionCaseWire,
  action: 'MARK_READY' | 'START' | 'REQUEST_REVIEW' | 'COMPLETE' | 'CANCEL',
  note: string,
): Promise<SpecialtyExecutionCaseWire> {
  const command = specialtyExecutionCaseTransitionRequestWireSchema.parse({
    ...specialtyScope(), action, expected_row_version: item.row_version, note,
  });
  return specialtyExecutionCaseWireSchema.parse(await request(
    `/execution-center/cases/${item.specialty_execution_case_id}/transitions`,
    specialtyJson(lease, 'POST', command),
  ));
}
