import { describe, expect, it } from 'vitest';

const views = import.meta.glob('./views/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('住院工作台九子菜单交互契约', () => {
  it('住院工作流的新建、编辑与终止类动作统一使用弹窗', () => {
    for (const page of [
      'InpatientWorkspacePage.vue',
      'InpatientJourneyPage.vue',
      'OrdersWorkspacePage.vue',
      'ResultsWorkspacePage.vue',
      'InpatientConsultationPage.vue',
      'InpatientPathwayPage.vue',
      'WardPage.vue',
    ]) {
      expect(views[`./views/${page}`], `${page} 应使用业务操作弹窗`).toContain('<BusinessActionDialog');
    }
  });

  it('不再使用页面内嵌表单承载新建医嘱、结果、会诊和护理交班', () => {
    expect(views['./views/OrdersWorkspacePage.vue']).not.toContain('class="order-create-panel"');
    expect(views['./views/ResultsWorkspacePage.vue']).not.toContain('class="result-form"');
    expect(views['./views/InpatientConsultationPage.vue']).not.toContain('class="consult-create-card"');
    expect(views['./views/WardPage.vue']).not.toContain('v-if="createOpen" class="admin-form-panel"');
    expect(views['./views/WardPage.vue']).not.toContain('v-if="patientHandoverId" class="admin-form-panel"');
  });

  it('高风险删除语义使用取消、停止、驳回或更正而不是物理删除', () => {
    expect(views['./views/OrdersWorkspacePage.vue']).toContain(":title=\"controlAction === 'stop' ? '停止医嘱' : '取消医嘱'\"");
    expect(views['./views/ResultsWorkspacePage.vue']).toContain('title="追加结果更正版本"');
    expect(views['./views/InpatientConsultationPage.vue']).toContain("action === 'reject'");
    expect(views['./views/InpatientPathwayPage.vue']).toContain('title="新建路径变异申请"');
    expect(views['./views/WardPage.vue']).toContain('title="作废交接班草稿"');
    expect(views['./views/WardPage.vue']).toContain('voidShiftHandover');
  });

  it('原型右侧责任栏覆盖全部九个住院二级菜单', () => {
    expect(views['./views/InpatientWorkspacePage.vue']).toContain('mode="worklist"');
    const journey = views['./views/InpatientJourneyPage.vue'];
    for (const mode of ['overview', 'course', 'discharge']) expect(journey).toContain(`mode="${mode}"`);
    expect(views['./views/OrdersWorkspacePage.vue']).toContain('mode="orders"');
    expect(views['./views/ResultsWorkspacePage.vue']).toContain('mode="results"');
    expect(views['./views/InpatientConsultationPage.vue']).toContain('mode="consult"');
    expect(views['./views/InpatientPathwayPage.vue']).toContain('pathway-variance-panel');
    expect(views['./views/WardPage.vue']).toContain('mode="ward"');
  });

  it('九个二级菜单仍由住院工作台导航契约完整承载', () => {
    const shell = views['./views/InpatientWorkspacePage.vue'];
    expect(shell).toContain('住院医生工作站');

    const journey = views['./views/InpatientJourneyPage.vue'];
    for (const route of ['inpatient-overview', 'inpatient-course', 'inpatient-doc-versions']) {
      expect(journey).toContain(`routeId === '${route}'`);
    }
    expect(journey).toContain('出院病历与病案归档闭环');
  });
});
