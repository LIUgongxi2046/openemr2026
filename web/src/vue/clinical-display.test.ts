import { describe, expect, it } from 'vitest';
import { clinicalCodeLabel, joinClinicalCodeLabels, patientAge } from './clinical-display';

describe('clinical display labels', () => {
  it('never exposes appointment and emergency-access codes to users', () => {
    expect(clinicalCodeLabel('CHECKED_IN')).toBe('已报到');
    expect(clinicalCodeLabel('ACTIVE')).toBe('生效中');
    expect(joinClinicalCodeLabels(['CLINICAL_CONTEXT', 'DOCUMENT'])).toBe('临床上下文 / 病历文书');
    expect(clinicalCodeLabel('UNMAPPED_CODE')).toBe('未知状态');
  });

  it('calculates whole-year patient age', () => {
    expect(patientAge('1968-09-01', new Date('2026-08-25T12:00:00+08:00'))).toBe(57);
  });
});
