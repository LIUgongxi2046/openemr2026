import {
  outpatientFollowupCompleteRequestWireSchema,
  outpatientFollowupCreateRequestWireSchema,
  outpatientFollowupWireSchema,
  type ContextLeaseWire,
  type OutpatientFollowupWire,
} from '../generated/contracts';
import { clinicalContext, explicitContextHeaders, issueContextLease, request, scopedHeaders } from '../clinical-api';

export function issueFollowupPatientLease(): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, null, 'OPD_FOLLOWUP');
}
export function issueFollowupEncounterLease(): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, 'OPD_FOLLOWUP');
}

export async function listOutpatientFollowups(lease: ContextLeaseWire): Promise<OutpatientFollowupWire[]> {
  return outpatientFollowupWireSchema.array().parse(await request(
    `/outpatient-followups?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: explicitContextHeaders(lease, clinicalContext.patientId, null) },
  ));
}

export async function createOutpatientFollowup(
  lease: ContextLeaseWire,
  input: { followup_type: string; content: string; due_at?: string | null },
): Promise<OutpatientFollowupWire> {
  return outpatientFollowupWireSchema.parse(await request('/outpatient-followups', {
    method: 'POST',
    headers: { ...scopedHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(outpatientFollowupCreateRequestWireSchema.parse({
      patient_id: clinicalContext.patientId,
      encounter_id: clinicalContext.encounterId,
      ...input,
    })),
  }));
}

export async function completeOutpatientFollowup(
  lease: ContextLeaseWire,
  followup: OutpatientFollowupWire,
  outcome: string,
): Promise<OutpatientFollowupWire> {
  return outpatientFollowupWireSchema.parse(await request(
    `/outpatient-followups/${followup.followup_id}/completions`, {
      method: 'POST',
      headers: { ...scopedHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(outpatientFollowupCompleteRequestWireSchema.parse({
        outcome,
        expected_row_version: followup.row_version,
      })),
    },
  ));
}
