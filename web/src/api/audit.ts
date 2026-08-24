import { auditEventWireSchema, type AuditEventWire, type ContextLeaseWire } from '../generated/contracts';
import { issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueAuditLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'ADMIN_AUDIT');
}

export interface AuditEventFilters {
  action_code?: string;
  resource_type?: string;
  resource_id?: string;
  from?: string;
  to?: string;
}

export async function listAuditEvents(lease: ContextLeaseWire, filters: AuditEventFilters = {}): Promise<AuditEventWire[]> {
  const params = new URLSearchParams();
  if (filters.action_code) params.set('action_code', filters.action_code);
  if (filters.resource_type) params.set('resource_type', filters.resource_type);
  if (filters.resource_id) params.set('resource_id', filters.resource_id);
  if (filters.from) params.set('from', filters.from);
  if (filters.to) params.set('to', filters.to);
  const query = params.toString();
  return auditEventWireSchema.array().parse(await request(
    `/audit-events${query ? `?${query}` : ''}`,
    { headers: wardHeaders(lease) },
  ));
}
