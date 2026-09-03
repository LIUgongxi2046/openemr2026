import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  wardHeaders,
} from '../clinical-api';
import { parseClinicalRequest, parseClinicalResponse } from '../clinical-contract';
import {
  medicalAgentFamilyWireSchema,
  medicalAgentRoutingWireSchema,
  medicalAgentRunCancelRequestWireSchema,
  medicalAgentRunCreateRequestWireSchema,
  medicalAgentRunRetryRequestWireSchema,
  medicalAgentRunWireSchema,
  type ContextLeaseWire,
  type MedicalAgentFamilyWire,
  type MedicalAgentRoutingWire,
  type MedicalAgentRunWire,
} from '../generated/contracts';

export function issueMedicalAgentCatalogLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'MEDICAL_AGENT_CATALOG');
}

export function issueMedicalAgentRunLease(patientId: string | null, encounterId: string | null): Promise<ContextLeaseWire> {
  return issueContextLease(patientId, encounterId, 'MEDICAL_AGENT_COLLABORATION');
}

export async function listMedicalAgentCatalog(lease: ContextLeaseWire): Promise<MedicalAgentFamilyWire[]> {
  return parseClinicalResponse(medicalAgentFamilyWireSchema.array(), await request(
    '/medical-agents/catalog', { headers: wardHeaders(lease) },
  ));
}

export async function resolveMedicalAgentRouting(
  lease: ContextLeaseWire,
  sourceRoute: string,
): Promise<MedicalAgentRoutingWire> {
  return parseClinicalResponse(medicalAgentRoutingWireSchema, await request(
    `/medical-agents/routing?source_route=${encodeURIComponent(sourceRoute)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function createMedicalAgentRun(
  lease: ContextLeaseWire,
  input: {
    patientId: string | null;
    encounterId: string | null;
    mainAgentCode: string | null;
    stageCode: string | null;
    sourceRoute?: string | null;
    targetType?: 'ENCOUNTER' | 'DOCUMENT' | 'RESULT' | 'TASK' | 'CARE_PLAN' | null;
    targetId?: string | null;
    objective: string;
    modelDeploymentId?: string | null;
    authorizationLevel?: 'READ_ONLY' | 'STANDARD' | 'EXTENDED';
    contextScopes?: Array<'RECORDS' | 'ORDERS' | 'RESULTS' | 'TASKS' | 'ATTACHMENTS'>;
  },
): Promise<MedicalAgentRunWire> {
  const command = parseClinicalRequest(medicalAgentRunCreateRequestWireSchema, {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: input.patientId,
    encounter_id: input.encounterId,
    context_lease_id: lease.lease_id,
    main_agent_code: input.mainAgentCode,
    stage_code: input.stageCode,
    source_route: input.sourceRoute ?? null,
    target_type: input.targetType ?? null,
    target_id: input.targetId ?? null,
    objective: input.objective,
    model_deployment_id: input.modelDeploymentId ?? null,
    authorization_level: input.authorizationLevel ?? 'STANDARD',
    context_scopes: input.contextScopes ?? ['RECORDS', 'ORDERS', 'RESULTS', 'TASKS'],
  });
  return parseClinicalResponse(medicalAgentRunWireSchema, await request('/medical-agents/runs', {
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
  return parseClinicalResponse(medicalAgentRunWireSchema.array(), await request(
    `/medical-agents/runs?patient_id=${encodeURIComponent(patientId)}&encounter_id=${encodeURIComponent(encounterId)}`,
    { headers: explicitContextHeaders(lease, patientId, encounterId) },
  ));
}

export async function getMedicalAgentRun(
  lease: ContextLeaseWire,
  patientId: string | null,
  encounterId: string | null,
  runId: string,
): Promise<MedicalAgentRunWire> {
  return parseClinicalResponse(medicalAgentRunWireSchema, await request(
    `/medical-agents/runs/${encodeURIComponent(runId)}`,
    { headers: explicitContextHeaders(lease, patientId, encounterId) },
  ));
}

export async function cancelMedicalAgentRun(
  lease: ContextLeaseWire,
  patientId: string | null,
  encounterId: string | null,
  runId: string,
  expectedRowVersion: number,
  reason = '医生取消当前医助任务',
): Promise<MedicalAgentRunWire> {
  const command = parseClinicalRequest(medicalAgentRunCancelRequestWireSchema, {
    expected_row_version: expectedRowVersion,
    reason,
  });
  return parseClinicalResponse(medicalAgentRunWireSchema, await request(
    `/medical-agents/runs/${encodeURIComponent(runId)}/cancellations`,
    {
      method: 'POST',
      headers: {
        ...explicitContextHeaders(lease, patientId, encounterId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    },
  ));
}

export async function retryMedicalAgentRun(
  lease: ContextLeaseWire,
  patientId: string | null,
  encounterId: string | null,
  runId: string,
  expectedRowVersion: number,
): Promise<MedicalAgentRunWire> {
  const command = parseClinicalRequest(medicalAgentRunRetryRequestWireSchema, {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    context_lease_id: lease.lease_id,
    expected_row_version: expectedRowVersion,
  });
  return parseClinicalResponse(medicalAgentRunWireSchema, await request(
    `/medical-agents/runs/${encodeURIComponent(runId)}/retries`,
    {
      method: 'POST',
      headers: {
        ...explicitContextHeaders(lease, patientId, encounterId),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(command),
    },
  ));
}
