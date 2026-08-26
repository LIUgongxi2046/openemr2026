import { describe, expect, it } from 'vitest';

const sources = import.meta.glob('./views/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const contracts = [
  ['DentalEvidencePage.vue', 'dental-evidence', 'DENTAL_EVIDENCE'],
  ['DermatologyEvidencePage.vue', 'dermatology-evidence', 'DERMATOLOGY_EVIDENCE'],
  ['EntEvidencePage.vue', 'ent-evidence', 'ENT_EVIDENCE'],
  ['EntTreatmentPage.vue', 'ent-treatment', 'ENT_TREATMENT'],
  ['MentalHealthTreatmentPage.vue', 'mental-treatment', 'MENTAL_TREATMENT'],
  ['MentalHealthEvidencePage.vue', 'mental-evidence', 'MENTAL_EVIDENCE'],
  ['NeonatalTreatmentPage.vue', 'neonatal-treatment', 'NEONATAL_TREATMENT'],
  ['OphthalmologyEvidencePage.vue', 'ophthalmology-evidence', 'OPHTHALMOLOGY_EVIDENCE'],
  ['PediatricEvidencePage.vue', 'pediatrics-evidence', 'PEDIATRICS_EVIDENCE'],
  ['PediatricTreatmentPage.vue', 'pediatrics-treatment', 'PEDIATRICS_TREATMENT'],
  ['ReproductiveEvidencePage.vue', 'reproductive-evidence', 'REPRODUCTIVE_EVIDENCE'],
  ['DentalFollowupPage.vue', 'dental-followup', 'DENTAL_FOLLOWUP'],
  ['EntFollowupPage.vue', 'ent-followup', 'ENT_FOLLOWUP'],
  ['NeonatalFollowupPage.vue', 'neonatal-followup', 'NEONATAL_FOLLOWUP'],
  ['TcmFollowupPage.vue', 'tcm-followup', 'TCM_FOLLOWUP'],
] as const;

describe('specialty page context isolation', () => {
  for (const [filename, routeId, purpose] of contracts) {
    it(`${routeId} owns its query cache and lease purpose`, () => {
      const source = sources[`./views/${filename}`];
      expect(source).toBeTypeOf('string');
      expect(source).toContain(`'specialty-layers', '${routeId}', 'patient-lease'`);
      expect(source).toContain(`'specialty-layers', '${routeId}', 'encounter-lease'`);
      expect(source).toContain(`issueSpecialtyPatientLease('${purpose}')`);
      expect(source).toContain(`issueSpecialtyEncounterLease('${purpose}')`);
    });
  }
});
