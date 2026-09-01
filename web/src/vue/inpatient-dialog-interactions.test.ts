import { describe, expect, it } from 'vitest';

const views = import.meta.glob('./views/*.vue', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

describe('住院工作台九子菜单交互契约', () => {
  it('住院工作流的新建、编辑与终止类动作统一使用弹窗', () => {
    for (const page of [
      'InpatientWorkspacePage.vue',
      'InpatientJourneyPage.vue',
      'AdmissionBedPage.vue',
      'InpatientDocumentEditorPage.vue',
      'InpatientPharmacyPage.vue',
      'OrdersWorkspacePage.vue',
      'ResultsWorkspacePage.vue',
      'InpatientConsultationPage.vue',
      'InpatientPathwayPage.vue',
      'WardPage.vue',
    ]) {
      expect(views[`./views/${page}`], `${page} 应使用业务操作弹窗`).toContain('<BusinessActionDialog');
    }
  });

  it('住院三级页的新增、版本修改、退回与摆药作废都由业务弹窗承载', () => {
    const admission = views['./views/AdmissionBedPage.vue'];
    expect(admission).toContain('title="办理新入院"');
    expect(admission).not.toContain('<form @submit.prevent="admit">');

    const editor = views['./views/InpatientDocumentEditorPage.vue'];
    expect(editor).toContain('title="保存住院病历新版本"');
    expect(editor).toContain('title="运行确定性质控"');
    expect(editor).toContain('确认签署并流转');

    const workspace = views['./views/InpatientWorkspacePage.vue'];
    expect(workspace).toContain('title="退回住院病历修改"');
    expect(workspace).toContain('title="建立住院病历草稿"');
    expect(workspace).not.toContain('class="task-reject-panel"');

    const pharmacy = views['./views/InpatientPharmacyPage.vue'];
    expect(pharmacy).toContain('title="编辑待核验摆药"');
    expect(pharmacy).toContain('title="作废摆药记录"');
    expect(pharmacy).toContain('voidInpatientPharmacyDispensing');
    expect(pharmacy).toContain('有效药品医嘱');
    expect(pharmacy).toContain('order_item_id: choice.item.order_item_id');
    expect(pharmacy).not.toContain('<AdminActionDialog');
  });

  it('病区护理页使用住院上下文接口闭环生命体征和护理计划', () => {
    const ward = views['./views/WardPage.vue'];
    expect(ward).toContain('recordInpatientVitalSigns');
    expect(ward).toContain('createInpatientNursingCarePlan');
    expect(ward).toContain('completeInpatientNursingCarePlan');
    expect(ward).toContain('title="记录住院生命体征"');
    expect(ward).toContain('title="新建护理计划"');
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
