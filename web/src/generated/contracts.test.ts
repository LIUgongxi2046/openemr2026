import { describe, expect, it } from 'vitest';

import { contextLeaseWireSchema, decodeContextLease } from './contracts';

const validLease = {
  lease_id: '018f0f4c-1f44-7b2f-9f60-f41f2046682f',
  tenant_id: '018f0f4c-1f44-7b2f-9f60-f41f20466830',
  organization_id: '018f0f4c-1f44-7b2f-9f60-f41f20466831',
  facility_id: '018f0f4c-1f44-7b2f-9f60-f41f20466832',
  user_id: '018f0f4c-1f44-7b2f-9f60-f41f20466833',
  role_assignment_ids: ['018f0f4c-1f44-7b2f-9f60-f41f20466834'],
  patient_id: null,
  encounter_id: null,
  task_id: null,
  purpose_code: 'DOCUMENT_DRAFT',
  allowed_source_types: ['DOCUMENT_VERSION'] as const,
  authorization_watermark: 'watermark-1',
  data_classification_ceiling: 'SENSITIVE' as const,
  model_residency_policy: 'ON_PREM_ONLY' as const,
  expires_at: '2026-08-14T13:30:00+08:00',
};

describe('generated clinical contracts', () => {
  it('maps snake_case wire fields to the camelCase clinical domain', () => {
    const decoded = decodeContextLease(validLease);

    expect(decoded.leaseId).toBe(validLease.lease_id);
    expect(decoded.roleAssignmentIds).toEqual(validLease.role_assignment_ids);
    expect(decoded.modelResidencyPolicy).toBe('ON_PREM_ONLY');
  });

  it('rejects unknown fields and unsupported enum values', () => {
    expect(() => contextLeaseWireSchema.parse({ ...validLease, hidden_scope: 'all-patients' })).toThrow();
    expect(() => contextLeaseWireSchema.parse({ ...validLease, model_residency_policy: 'ANYWHERE' })).toThrow();
  });
});

