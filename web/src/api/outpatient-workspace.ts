import {
  clinicalDiagnosisWireSchema,
  clinicalOrderWireSchema,
  clinicalResultWireSchema,
  documentVersionWireSchema,
  patientTimelineWireSchema,
  type ClinicalDiagnosisWire,
  type ClinicalOrderWire,
  type ClinicalResultWire,
  type ContextLeaseWire,
  type DocumentVersionWire,
  type PatientTimelineWire,
} from '../generated/contracts';
import { explicitContextHeaders, issueContextLease, request } from '../clinical-api';

export interface OutpatientWorkspaceSnapshot {
  lease: ContextLeaseWire;
  documents: DocumentVersionWire[];
  diagnoses: ClinicalDiagnosisWire[];
  orders: ClinicalOrderWire[];
  results: ClinicalResultWire[];
  timeline: PatientTimelineWire;
}

export async function loadOutpatientWorkspaceSnapshot(
  patientId: string,
  encounterId: string,
): Promise<OutpatientWorkspaceSnapshot> {
  const lease = await issueContextLease(patientId, encounterId, 'OUTPATIENT_WORKSPACE');
  const timelineLease = await issueContextLease(patientId, null, 'PATIENT_TIMELINE');
  const headers = explicitContextHeaders(lease, patientId, encounterId);
  const [documents, diagnoses, orders, results, timeline] = await Promise.all([
    request(`/encounters/${encodeURIComponent(encounterId)}/documents`, { headers }),
    request(`/diagnoses?encounter_id=${encodeURIComponent(encounterId)}`, { headers }),
    request(`/orders?encounter_id=${encodeURIComponent(encounterId)}`, { headers }),
    request(`/results?encounter_id=${encodeURIComponent(encounterId)}`, { headers }),
    request(`/patients/${encodeURIComponent(patientId)}/timeline?limit=12`, {
      headers: explicitContextHeaders(timelineLease, patientId, null),
    }),
  ]);
  return {
    lease,
    documents: documentVersionWireSchema.array().parse(documents),
    diagnoses: clinicalDiagnosisWireSchema.array().parse(diagnoses),
    orders: clinicalOrderWireSchema.array().parse(orders),
    results: clinicalResultWireSchema.array().parse(results),
    timeline: patientTimelineWireSchema.parse(timeline),
  };
}
