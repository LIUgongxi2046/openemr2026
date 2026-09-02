import {
  qualityGovernanceAgentProposalRequestWireSchema,
  qualityGovernanceAgentProposalWireSchema,
  qualityGovernanceRecordCreateRequestWireSchema,
  qualityGovernanceRecordUpdateRequestWireSchema,
  qualityGovernanceRecordVoidRequestWireSchema,
  qualityGovernanceRecordWireSchema,
  type ContextLeaseWire,
  type QualityGovernanceAgentProposalWire,
  type QualityGovernanceRecordCreateRequestWire,
  type QualityGovernanceRecordUpdateRequestWire,
  type QualityGovernanceRecordWire,
} from '../generated/contracts';
import { request, wardHeaders } from '../clinical-api';

export type QualityGovernanceModule =
  | 'QUALITY_CENTER' | 'DEPARTMENT_QC' | 'QUALITY_RATING' | 'INFECTION_EVENTS' | 'CREDENTIALS' | 'ARCHIVE_ASSET';
export type QualityGovernanceKind = 'ACTION' | 'EVIDENCE' | 'REVIEW';

function root(module: QualityGovernanceModule, parentId: string) {
  return `/quality-governance/${encodeURIComponent(module)}/${encodeURIComponent(parentId)}`;
}

function commandHeaders(lease: ContextLeaseWire) {
  return { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() };
}

export async function listQualityGovernanceRecords(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string, kind?: QualityGovernanceKind,
): Promise<QualityGovernanceRecordWire[]> {
  const query = kind ? `?record_kind=${encodeURIComponent(kind)}` : '';
  return qualityGovernanceRecordWireSchema.array().parse(await request(`${root(module, parentId)}/records${query}`, {
    headers: wardHeaders(lease),
  }));
}

export async function createQualityGovernanceRecord(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string,
  input: Omit<QualityGovernanceRecordCreateRequestWire, 'organization_id' | 'facility_id'>,
): Promise<QualityGovernanceRecordWire> {
  const body = qualityGovernanceRecordCreateRequestWireSchema.parse({
    ...input, organization_id: lease.organization_id, facility_id: lease.facility_id,
  });
  return qualityGovernanceRecordWireSchema.parse(await request(`${root(module, parentId)}/records`, {
    method: 'POST', headers: commandHeaders(lease), body: JSON.stringify(body),
  }));
}

export async function updateQualityGovernanceRecord(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string, recordId: string,
  input: Omit<QualityGovernanceRecordUpdateRequestWire, 'organization_id' | 'facility_id'>,
): Promise<QualityGovernanceRecordWire> {
  const body = qualityGovernanceRecordUpdateRequestWireSchema.parse({
    ...input, organization_id: lease.organization_id, facility_id: lease.facility_id,
  });
  return qualityGovernanceRecordWireSchema.parse(await request(
    `${root(module, parentId)}/records/${encodeURIComponent(recordId)}`,
    { method: 'PUT', headers: commandHeaders(lease), body: JSON.stringify(body) },
  ));
}

export async function voidQualityGovernanceRecord(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string, record: QualityGovernanceRecordWire,
  reason: string,
): Promise<QualityGovernanceRecordWire> {
  const body = qualityGovernanceRecordVoidRequestWireSchema.parse({
    organization_id: lease.organization_id, facility_id: lease.facility_id,
    expected_version: record.row_version, reason,
  });
  return qualityGovernanceRecordWireSchema.parse(await request(
    `${root(module, parentId)}/records/${encodeURIComponent(record.quality_governance_record_id)}/void`,
    { method: 'POST', headers: commandHeaders(lease), body: JSON.stringify(body) },
  ));
}

export async function listQualityGovernanceAgentProposals(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string,
): Promise<QualityGovernanceAgentProposalWire[]> {
  return qualityGovernanceAgentProposalWireSchema.array().parse(await request(`${root(module, parentId)}/agent-proposals`, {
    headers: wardHeaders(lease),
  }));
}

export async function createQualityGovernanceAgentProposal(
  lease: ContextLeaseWire, module: QualityGovernanceModule, parentId: string,
): Promise<QualityGovernanceAgentProposalWire> {
  const body = qualityGovernanceAgentProposalRequestWireSchema.parse({
    organization_id: lease.organization_id, facility_id: lease.facility_id,
  });
  return qualityGovernanceAgentProposalWireSchema.parse(await request(`${root(module, parentId)}/agent-proposals`, {
    method: 'POST', headers: commandHeaders(lease), body: JSON.stringify(body),
  }));
}
