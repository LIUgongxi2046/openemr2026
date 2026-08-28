import { describe, expect, it } from 'vitest';
import type { WorkforceIdentityWire } from '../generated/contracts';
import { analyzeRoleGovernance, SYSTEM_ADMINISTRATION_DICTIONARY_CODES } from './system-administration';

function identity(personId: string, roleCode: string, overrides: Partial<WorkforceIdentityWire> = {}): WorkforceIdentityWire {
  return {
    person_id: personId, person_code: `EMP-${personId.slice(-4)}`, person_display_name: '王雪 / Xue Wang',
    person_status: 'ACTIVE', person_row_version: 1, user_id: '018f0000-0000-7000-8000-00000000aa01',
    external_subject: 'test', account_status: 'ACTIVE', account_row_version: 1,
    role_assignment_id: crypto.randomUUID(), role_code: roleCode, role_status: 'ACTIVE',
    role_valid_from: '2026-01-01T00:00:00Z', role_valid_until: null, role_row_version: 1,
    organization_id: null, facility_id: null, department_id: null, ward_id: null,
    position_code: 'ADMIN', active_credential_count: 0, ...overrides,
  };
}

describe('analyzeRoleGovernance', () => {
  it('detects incompatible effective roles assigned to the same person', () => {
    const personId = '018f0000-0000-7000-8000-000000001111';
    const result = analyzeRoleGovernance([
      identity(personId, 'SYSTEM_ADMIN'), identity(personId, 'SECURITY_AUDITOR'),
    ], new Date('2026-08-25T00:00:00Z').getTime());
    expect(result.assignmentCount).toBe(2);
    expect(result.privilegedAssignmentCount).toBe(2);
    expect(result.conflicts).toEqual([expect.objectContaining({ personId, roleCodes: ['SYSTEM_ADMIN', 'SECURITY_AUDITOR'] })]);
  });

  it('ignores expired and inactive role assignments', () => {
    const personId = '018f0000-0000-7000-8000-000000002222';
    const result = analyzeRoleGovernance([
      identity(personId, 'SYSTEM_ADMIN'),
      identity(personId, 'SECURITY_AUDITOR', { role_valid_until: '2026-01-01T00:00:00Z' }),
      identity(personId, 'AUTHORIZATION_ADMIN', { role_status: 'INACTIVE' }),
    ], new Date('2026-08-25T00:00:00Z').getTime());
    expect(result.assignmentCount).toBe(1);
    expect(result.conflicts).toHaveLength(0);
  });
});

describe('system administration dictionary catalog', () => {
  it('loads the complete tertiary-hospital dictionary catalog instead of a small demo subset', () => {
    expect(SYSTEM_ADMINISTRATION_DICTIONARY_CODES).toHaveLength(15);
    expect(SYSTEM_ADMINISTRATION_DICTIONARY_CODES).toEqual(expect.arrayContaining([
      'ADMISSION_SOURCE', 'DISCHARGE_DISPOSITION', 'TRIAGE_LEVEL', 'DOCUMENT_STATUS',
      'CREDENTIAL_TYPE', 'PAYMENT_TYPE', 'CONSENT_STATUS', 'BED_CLASS',
    ]));
    expect(SYSTEM_ADMINISTRATION_DICTIONARY_CODES.every((code) => !code.startsWith('DICT-'))).toBe(true);
  });
});
