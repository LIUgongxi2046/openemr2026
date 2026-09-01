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
    expect(handoff.match(/<AdminActionDialog/g)?.length).toBeGreaterThanOrEqual(2);
    expect(handoff.match(/<AdminConfirmDialog/g)?.length).toBeGreaterThanOrEqual(2);
    expect(handoff).toContain('删除');
  });

  it('connects emergency logical deletion to audited backend endpoints', () => {
    const source = api['../api/emergency.ts'];
    for (const fn of ['voidEmergencyTriageAssessment', 'voidEmergencyObservation', 'voidEmergencyResuscitation', 'voidEmergencyNursingNote', 'voidEmergencyPreadmission', 'voidEmergencyCoordinationCase', 'voidEncounterDomainSwitch']) {
      expect(source).toContain(`function ${fn}`);
    }
    expect(source.match(/\/voids/g)?.length).toBeGreaterThanOrEqual(9);
  });

  it('uses atomic correction endpoints for immutable emergency facts and nested handoff objects', () => {
    const source = api['../api/emergency.ts'];
    for (const fn of ['correctEmergencyNursingNote', 'updateEmergencyPreadmission', 'updateEmergencyCoordinationCase', 'transitionEmergencyCoordinationCase', 'correctEncounterDomainSwitch']) {
      expect(source).toContain(`function ${fn}`);
    }
    expect(source.match(/\/corrections/g)?.length).toBeGreaterThanOrEqual(4);
    expect(views['./views/EmergencyNursingPage.vue']).toContain('correctEmergencyNursingNote');
    expect(views['./views/EmergencyTriagePage.vue']).toContain('先救治后补登');
    expect(views['./views/EmergencyHandoffPage.vue']).toContain('voidEmergencyCoordinationCase');
    expect(views['./views/EmergencyHandoffPage.vue']).toContain("transition(item,'ACKNOWLEDGE')");
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

  it('keeps every emergency subpage aligned with the prototype clinical layout', () => {
    const expectations: Record<string, string[]> = {
      'EmergencyTriagePage.vue': ['急诊预检分诊与分区', 'WS/T 390—2012', '分诊决策与改区', '申请改级或改区'],
      'EmergencyRecordPage.vue': ['时间轴与文书', '急诊抢救记录', '时间质控与来源', '提交抢救负责人审签'],
      'EmergencyObservationPage.vue': ['急诊留观占用事实', '留观患者与去向台账', '去向门禁', '打开会诊交接与转运'],
      'EmergencyNursingPage.vue': ['扫描腕带', '护理执行轴', '生命体征与床旁门禁', '管路与输液'],
      'EmergencyHandoffPage.vue': ['当前急诊协同单', '急会诊', '域切换与接收门禁', '接收人门禁'],
    };
    for (const [page, markers] of Object.entries(expectations)) {
      const source = views[`./views/${page}`];
      for (const marker of markers) expect(source, `${page} missing ${marker}`).toContain(marker);
      expect(source).toMatch(/emergency-(?:record-)?prototype/);
    }
  });
});
