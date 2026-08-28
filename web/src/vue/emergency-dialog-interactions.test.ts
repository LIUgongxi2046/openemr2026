import { describe, expect, it } from 'vitest';

const views = import.meta.glob('./views/Emergency*.vue', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;
const api = import.meta.glob('../api/emergency.ts', { eager: true, query: '?raw', import: 'default' }) as Record<string, string>;

describe('emergency workbench CRUD interactions', () => {
  it('uses accessible modal components for every emergency write surface', () => {
    for (const page of ['EmergencyTriagePage.vue', 'EmergencyObservationPage.vue', 'EmergencyRecordPage.vue', 'EmergencyNursingPage.vue']) {
      const source = views[`./views/${page}`];
      expect(source, `${page} should use action dialogs`).toContain('<AdminActionDialog');
      expect(source, `${page} should confirm logical deletion`).toContain('<AdminConfirmDialog');
      expect(source, `${page} should expose create`).toMatch(/新建/);
      expect(source, `${page} should expose edit or correction`).toMatch(/编辑|更正|复评/);
      expect(source, `${page} should expose delete`).toContain('删除');
    }
    const handoff = views['./views/EmergencyHandoffPage.vue'];
    expect(handoff.match(/<AdminActionDialog/g)?.length).toBeGreaterThanOrEqual(4);
    expect(handoff).toContain('<AdminConfirmDialog');
    expect(handoff).toContain('删除');
  });

  it('connects emergency logical deletion to audited backend endpoints', () => {
    const source = api['../api/emergency.ts'];
    for (const fn of ['voidEmergencyTriageAssessment', 'voidEmergencyObservation', 'voidEmergencyResuscitation', 'voidEmergencyNursingNote', 'voidShiftHandover']) {
      expect(source).toContain(`function ${fn}`);
    }
    expect(source.match(/\/voids/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it('keeps logically voided facts out of the active workspace metrics', () => {
    const source = views['./views/EmergencyWorkspacePage.vue'];
    expect(source.match(/filter\(\(item\) => !item\.voided_at\)/g)?.length).toBe(5);
  });

  it('restores the prototype patient context, three-column workspace and operational right rail', () => {
    const source = views['./views/EmergencyWorkspacePage.vue'];
    for (const marker of ['emergency-patient-strip', 'emergency-queue-rail', 'emergency-timeline-card', 'emergency-right-rail', '团队任务', '去向闭环', '交接门禁']) {
      expect(source).toContain(marker);
    }
    expect(source).toContain('listShiftHandovers');
  });
});
