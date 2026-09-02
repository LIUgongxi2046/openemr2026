import { z } from 'zod';

import { clinicalContext, request, scopedHeaders } from '../clinical-api';
import type { ContextLeaseWire } from '../generated/contracts';

export const signatureVerificationRunSchema = z.object({
  verification_run_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_version_id: z.string().uuid(),
  outcome: z.enum(['VALID', 'INVALID', 'UNAVAILABLE']),
  verified_count: z.number().int().nonnegative(),
  invalid_count: z.number().int().nonnegative(),
  provider_code: z.string(),
  details: z.array(z.record(z.string(), z.unknown())),
  verified_at: z.string().datetime(),
});

export type SignatureVerificationRun = z.infer<typeof signatureVerificationRunSchema>;

export async function verifyDocumentSignatures(
  lease: ContextLeaseWire,
  documentId: string,
  documentVersionId: string,
): Promise<SignatureVerificationRun> {
  return signatureVerificationRunSchema.parse(await request(
    `/documents/${encodeURIComponent(documentId)}/signature-verifications`, {
      method: 'POST',
      headers: {
        ...scopedHeaders(lease),
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: clinicalContext.patientId,
        encounter_id: clinicalContext.encounterId,
        document_version_id: documentVersionId,
      }),
    },
  ));
}
