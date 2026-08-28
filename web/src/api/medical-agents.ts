import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  wardHeaders,
} from '../clinical-api';
import {
  medicalAgentFamilyWireSchema,
  medicalAgentRunCreateRequestWireSchema,
  medicalAgentRunWireSchema,
  type ContextLeaseWire,
  type MedicalAgentFamilyWire,
  type MedicalAgentRunWire,
} from '../generated/contracts';

export function issueMedicalAgentCatalogLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'MEDICAL_AGENT_CATALOG');
}

export function issueMedicalAgentRunLease(patientId: string, encounterId: string): Promise<ContextLeaseWire> {
  return issueContextLease(patientId, encounterId, 'MEDICAL_AGENT_COLLABORATION');
}

export async function listMedicalAgentCatalog(lease: ContextLeaseWire): Promise<MedicalAgentFamilyWire[]> {
  return medicalAgentFamilyWireSchema.array().parse(await request(
    '/medical-agents/catalog', { headers: wardHeaders(lease) },
  ));
}

export async function createMedicalAgentRun(
  lease: ContextLeaseWire,
  input: {
    patientId: string;
    encounterId: string;
    mainAgentCode: string;
    stageCode: string;
    targetType?: 'ENCOUNTER' | 'DOCUMENT' | 'RESULT' | 'TASK' | 'CARE_PLAN';
    targetId?: string;
    objective: string;
    modelDeploymentId?: string | null;
    authorizationLevel?: 'READ_ONLY' | 'STANDARD' | 'EXTENDED';
    contextScopes?: Array<'RECORDS' | 'ORDERS' | 'RESULTS' | 'TASKS' | 'ATTACHMENTS'>;
  },
): Promise<MedicalAgentRunWire> {
  const command = medicalAgentRunCreateRequestWireSchema.parse({
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: input.patientId,
    encounter_id: input.encounterId,
    context_lease_id: lease.lease_id,
    main_agent_code: input.mainAgentCode,
    stage_code: input.stageCode,
    target_type: input.targetType ?? 'ENCOUNTER',
    target_id: input.targetId ?? input.encounterId,
    objective: input.objective,
    model_deployment_id: input.modelDeploymentId ?? null,
    authorization_level: input.authorizationLevel ?? 'STANDARD',
    context_scopes: input.contextScopes ?? ['RECORDS', 'ORDERS', 'RESULTS', 'TASKS'],
  });
  return medicalAgentRunWireSchema.parse(await request('/medical-agents/runs', {
    method: 'POST',
    headers: {
      ...explicitContextHeaders(lease, input.patientId, input.encounterId),
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify(command),
  }));
}

export async function listMedicalAgentRuns(
  lease: ContextLeaseWire,
  patientId: string,
  encounterId: string,
): Promise<MedicalAgentRunWire[]> {
  return medicalAgentRunWireSchema.array().parse(await request(
    `/medical-agents/runs?patient_id=${encodeURIComponent(patientId)}&encounter_id=${encodeURIComponent(encounterId)}`,
    { headers: explicitContextHeaders(lease, patientId, encounterId) },
  ));
}

export async function getMedicalAgentRun(
  lease: ContextLeaseWire,
  patientId: string,
  encounterId: string,
  runId: string,
): Promise<MedicalAgentRunWire> {
  return medicalAgentRunWireSchema.parse(await request(
    `/medical-agents/runs/${encodeURIComponent(runId)}`,
    { headers: explicitContextHeaders(lease, patientId, encounterId) },
  ));
}
