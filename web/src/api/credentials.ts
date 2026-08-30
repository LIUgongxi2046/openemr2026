import { adminRequest } from '../clinical-api';
import {
  practitionerCredentialWireSchema,
  type PractitionerCredentialWire,
} from '../generated/contracts';

export type PractitionerCredential = PractitionerCredentialWire;
export interface CredentialWriteInput {
  person_id: string; credential_type: PractitionerCredential['credential_type']; registration_number: string;
  issuing_authority: string; practice_scope: Record<string, unknown>; valid_from: string; valid_until: string | null;
}

export async function listPractitionerCredentials(): Promise<PractitionerCredential[]> {
  return practitionerCredentialWireSchema.array().parse(await adminRequest('/admin/credentials'));
}
export async function createPractitionerCredential(input: CredentialWriteInput): Promise<PractitionerCredential> {
  return practitionerCredentialWireSchema.parse(await adminRequest('/admin/credentials', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ ...input, expected_row_version: 0 }),
  }));
}
export async function updatePractitionerCredential(item: PractitionerCredential, input: CredentialWriteInput): Promise<PractitionerCredential> {
  return practitionerCredentialWireSchema.parse(await adminRequest(`/admin/credentials/${item.credential_id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ ...input, expected_row_version: item.row_version }),
  }));
}
export async function revokePractitionerCredential(item: PractitionerCredential, reason: string): Promise<PractitionerCredential> {
  return practitionerCredentialWireSchema.parse(await adminRequest(`/admin/credentials/${item.credential_id}/revoke`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ expected_row_version: item.row_version, reason }),
  }));
}
