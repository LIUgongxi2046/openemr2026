import { describe, expect, it } from 'vitest';

import {
  decodeDepartmentSupportAssessment,
  resolveSpecialtyRouteAccess,
} from './specialty-support';

const assessment = {
  department_support_assessment_id: '018f0f4c-1f44-7b2f-9f60-f41f2046682f',
  facility_id: '018f0f4c-1f44-7b2f-9f60-f41f20466830',
  department_id: '018f0f4c-1f44-7b2f-9f60-f41f20466831',
  clinical_scope_code: 'OBGYN',
  support_level: 'BASIC_CLOSED_LOOP' as const,
  pack_release_id: '018f0f4c-1f44-7b2f-9f60-f41f20466832',
  evidence_bundle_hash: 'a'.repeat(64),
  missing_safety_gates: [],
  assessed_by: '018f0f4c-1f44-7b2f-9f60-f41f20466833',
  assessed_at: '2026-08-14T08:00:00Z',
  expires_at: '2027-08-14T08:00:00Z',
  row_version: 1,
};

describe('specialty route support guard', () => {
  it('opens a specialty flow only for a verified closed loop', () => {
    const decoded = decodeDepartmentSupportAssessment(assessment);

    expect(resolveSpecialtyRouteAccess(decoded)).toEqual({
      mode: 'SPECIALTY_ENABLED',
      reason: 'VERIFIED_CLOSED_LOOP',
    });
    expect(resolveSpecialtyRouteAccess({ ...decoded, support_level: 'GENERAL_AVAILABLE' })).toEqual({
      mode: 'GENERAL_CORE_ONLY',
      reason: 'NO_VERIFIED_SPECIALTY_CLOSED_LOOP',
    });
  });

  it('shows gaps or blocks instead of treating a route or page as production support', () => {
    const decoded = decodeDepartmentSupportAssessment(assessment);

    expect(resolveSpecialtyRouteAccess({
      ...decoded,
      support_level: 'PACK_PENDING',
      missing_safety_gates: ['EVIDENCE_EXPIRED'],
    })).toEqual({
      mode: 'GAP_ONLY',
      reason: 'PACK_OR_EVIDENCE_PENDING',
      missingSafetyGates: ['EVIDENCE_EXPIRED'],
    });
    expect(resolveSpecialtyRouteAccess({
      ...decoded,
      support_level: 'UNSUPPORTED',
      missing_safety_gates: ['WORKFLOW_NOT_DESIGNED'],
    }).mode).toBe('BLOCKED');
  });

  it('rejects unrecognized support states from the wire', () => {
    expect(() => decodeDepartmentSupportAssessment({
      ...assessment,
      support_level: 'PROTOTYPE_COMPLETE',
    })).toThrow();
  });
});
