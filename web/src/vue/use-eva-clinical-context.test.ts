import { describe, expect, it } from 'vitest';

import { hasEvaPatientContext } from './use-eva-clinical-context';

describe('Eva patient context', () => {
  it('accepts a patient only when both patient and encounter identifiers are UUIDs', () => {
    expect(hasEvaPatientContext({
      patientId: '018f0000-0000-7000-8000-000000000001',
      encounterId: '018f0000-0000-7000-8000-000000000101',
    })).toBe(true);
    expect(hasEvaPatientContext({ patientId: '', encounterId: '' })).toBe(false);
    expect(hasEvaPatientContext({ patientId: '王某某', encounterId: '门诊复诊' })).toBe(false);
  });
});
