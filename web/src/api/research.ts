import {
  researchProjectCreateRequestWireSchema,
  researchProjectDeactivateRequestWireSchema,
  researchProjectWireSchema,
  type ContextLeaseWire,
  type ResearchProjectCreateRequestWire,
  type ResearchProjectWire,
} from '../generated/contracts';
import { clinicalContext, issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueResearchProjectLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'RESEARCH_PROJECT_ADMIN');
}

export async function listResearchProjects(
  lease: ContextLeaseWire,
  status?: string,
): Promise<ResearchProjectWire[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return researchProjectWireSchema.array().parse(await request(`/research-projects${suffix}`, {
    headers: wardHeaders(lease),
  }));
}

export async function createResearchProject(
  lease: ContextLeaseWire,
  input: Omit<ResearchProjectCreateRequestWire, 'organization_id' | 'facility_id'>,
  idempotencyKey = crypto.randomUUID(),
): Promise<ResearchProjectWire> {
  return researchProjectWireSchema.parse(await request('/research-projects', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(researchProjectCreateRequestWireSchema.parse({
      organization_id: clinicalContext.organizationId,
      facility_id: clinicalContext.facilityId,
      ...input,
    })),
  }));
}

export async function deactivateResearchProject(
  lease: ContextLeaseWire,
  projectId: string,
  idempotencyKey = crypto.randomUUID(),
): Promise<ResearchProjectWire> {
  return researchProjectWireSchema.parse(await request(
    `/research-projects/${encodeURIComponent(projectId)}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(researchProjectDeactivateRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
      })),
    },
  ));
}
