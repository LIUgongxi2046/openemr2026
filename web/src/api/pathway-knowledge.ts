import { clinicalContext, issueContextLease, request, wardHeaders } from '../clinical-api';
import {
  pathwayKnowledgeActionRequestWireSchema,
  pathwayKnowledgeCreateRequestWireSchema,
  pathwayKnowledgeSearchRequestWireSchema,
  pathwayKnowledgeSearchResultWireSchema,
  pathwayKnowledgeVersionCreateRequestWireSchema,
  pathwayKnowledgeVersionWireSchema,
  knowledgeGraphWireSchema,
  knowledgeGraphNeighborsWireSchema,
  knowledgeGraphPathsWireSchema,
  pathwayReviewQueueItemWireSchema,
  pathwayKnowledgeWireSchema,
  type ContextLeaseWire,
  type PathwayKnowledgeCreateRequestWire,
  type PathwayKnowledgeSearchResultWire,
  type PathwayKnowledgeVersionCreateRequestWire,
  type PathwayKnowledgeVersionWire,
  type KnowledgeGraphWire,
  type KnowledgeGraphNeighborsWire,
  type KnowledgeGraphPathsWire,
  type PathwayReviewQueueItemWire,
  type PathwayKnowledgeWire,
} from '../generated/contracts';

export function issuePathwayKnowledgeLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'PATHWAY_KNOWLEDGE');
}

function orgFacility() {
  return { organization_id: clinicalContext.organizationId, facility_id: clinicalContext.facilityId };
}

export async function listPathwayKnowledge(lease: ContextLeaseWire): Promise<PathwayKnowledgeWire[]> {
  return pathwayKnowledgeWireSchema.array().parse(await request('/pathway-knowledge', { headers: wardHeaders(lease) }));
}

export async function createPathwayKnowledge(
  lease: ContextLeaseWire,
  input: Omit<PathwayKnowledgeCreateRequestWire, 'organization_id' | 'facility_id'>,
): Promise<PathwayKnowledgeWire> {
  return pathwayKnowledgeWireSchema.parse(await request('/pathway-knowledge', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(pathwayKnowledgeCreateRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function createPathwayKnowledgeVersion(
  lease: ContextLeaseWire,
  knowledgeId: string,
  input: Omit<PathwayKnowledgeVersionCreateRequestWire, 'organization_id' | 'facility_id'>,
): Promise<PathwayKnowledgeVersionWire> {
  return pathwayKnowledgeVersionWireSchema.parse(await request(`/pathway-knowledge/${knowledgeId}/versions`, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(pathwayKnowledgeVersionCreateRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function listPathwayKnowledgeVersions(lease: ContextLeaseWire, knowledgeId: string): Promise<PathwayKnowledgeVersionWire[]> {
  return pathwayKnowledgeVersionWireSchema.array().parse(await request(`/pathway-knowledge/${knowledgeId}/versions`, {
    headers: wardHeaders(lease),
  }));
}

async function act(lease: ContextLeaseWire, path: string): Promise<PathwayKnowledgeVersionWire> {
  return pathwayKnowledgeVersionWireSchema.parse(await request(path, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(pathwayKnowledgeActionRequestWireSchema.parse({ ...orgFacility() })),
  }));
}

export function submitPathwayKnowledge(lease: ContextLeaseWire, versionId: string): Promise<PathwayKnowledgeVersionWire> {
  return act(lease, `/pathway-versions/${versionId}/submissions`);
}
export function reviewPathwayKnowledge(lease: ContextLeaseWire, versionId: string): Promise<PathwayKnowledgeVersionWire> {
  return act(lease, `/pathway-versions/${versionId}/reviews`);
}
export function approvePathwayKnowledge(lease: ContextLeaseWire, versionId: string): Promise<PathwayKnowledgeVersionWire> {
  return act(lease, `/pathway-versions/${versionId}/approvals`);
}
export function retirePathwayKnowledge(lease: ContextLeaseWire, versionId: string): Promise<PathwayKnowledgeVersionWire> {
  return act(lease, `/pathway-versions/${versionId}/retirements`);
}

export async function getPathwayReviewQueue(lease: ContextLeaseWire): Promise<PathwayReviewQueueItemWire[]> {
  return pathwayReviewQueueItemWireSchema.array().parse(await request('/pathway-review-queue', { headers: wardHeaders(lease) }));
}

export async function getKnowledgeGraph(lease: ContextLeaseWire, limit = 200): Promise<KnowledgeGraphWire> {
  return knowledgeGraphWireSchema.parse(await request(`/knowledge-graph?limit=${limit}`, { headers: wardHeaders(lease) }));
}

export async function getKnowledgeGraphEgo(lease: ContextLeaseWire, conceptId: string, depth = 2, limit = 200): Promise<KnowledgeGraphWire> {
  return knowledgeGraphWireSchema.parse(await request(`/knowledge-graph/ego?concept_id=${conceptId}&depth=${depth}&limit=${limit}`, {
    headers: wardHeaders(lease),
  }));
}

export async function getKnowledgeGraphNeighbors(lease: ContextLeaseWire, conceptId: string): Promise<KnowledgeGraphNeighborsWire> {
  return knowledgeGraphNeighborsWireSchema.parse(await request(`/knowledge-graph/nodes/${conceptId}/neighbors`, {
    headers: wardHeaders(lease),
  }));
}

export async function getKnowledgeGraphPaths(lease: ContextLeaseWire, from: string, to: string, maxDepth = 3): Promise<KnowledgeGraphPathsWire> {
  return knowledgeGraphPathsWireSchema.parse(await request(`/knowledge-graph/paths?from=${from}&to=${to}&max_depth=${maxDepth}`, {
    headers: wardHeaders(lease),
  }));
}

export async function searchPathwayKnowledge(lease: ContextLeaseWire, query: string): Promise<PathwayKnowledgeSearchResultWire> {
  return pathwayKnowledgeSearchResultWireSchema.parse(await request('/pathway-knowledge-search', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json' },
    body: JSON.stringify(pathwayKnowledgeSearchRequestWireSchema.parse({ ...orgFacility(), query, limit: 20 })),
  }));
}
