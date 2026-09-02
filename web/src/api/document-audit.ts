import { z } from 'zod';

import { request, scopedHeaders } from '../clinical-api';
import type { ContextLeaseWire } from '../generated/contracts';

export const documentAuditEventSchema = z.object({
  audit_event_id: z.string().uuid(),
  occurred_at: z.string().datetime(),
  actor_user_id: z.string().uuid().nullable(),
  action_code: z.string(),
  resource_type: z.string(),
  resource_id: z.string().uuid(),
  trace_id: z.string(),
  previous_hash: z.string().nullable(),
  event_hash: z.string(),
  details: z.record(z.string(), z.unknown()),
});

export type DocumentAuditEvent = z.infer<typeof documentAuditEventSchema>;

export async function listDocumentAuditEvents(
  lease: ContextLeaseWire,
  documentId: string,
): Promise<DocumentAuditEvent[]> {
  return documentAuditEventSchema.array().parse(await request(
    `/documents/${encodeURIComponent(documentId)}/audit-events`,
    { headers: scopedHeaders(lease) },
  ));
}
