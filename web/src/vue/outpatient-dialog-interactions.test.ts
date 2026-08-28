import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('outpatient workspace interaction contract', () => {
  it('keeps all seven outpatient secondary routes visible', () => {
    const shell = source('./components/ClinicalShell.vue');
    for (const route of ['outpatient', 'opd-record', 'opd-diagnosis', 'opd-orders', 'opd-results', 'opd-consult', 'opd-followup']) {
      expect(shell).toContain(`'${route}'`);
    }
    for (const label of ['门诊工作台', '门诊病历', '诊断', '医嘱处方', '检查检验', '会诊转诊', '随访终诊']) {
      expect(shell).toContain(`'${label}'`);
    }
  });

  it.each([
    ['./views/DiagnosisWorkspacePage.vue', ['新增诊断', '更正诊断', '停止诊断']],
    ['./views/OrdersWorkspacePage.vue', ['新建医嘱草稿', '停止医嘱', '取消医嘱']],
    ['./views/ResultsWorkspacePage.vue', ['录入已审核结果', '追加结果更正版本', '完成危急值处置']],
    ['./views/OutpatientConsultPage.vue', ['新建会诊 / 转诊', '拒绝会诊 / 转诊']],
    ['./views/OpdFollowupPage.vue', ['登记随访计划', '填写随访结局']],
  ])('%s uses shared modal interactions', (path, titles) => {
    const component = source(path);
    expect(component).toContain('BusinessActionDialog');
    expect(component).not.toMatch(/window\.(?:prompt|confirm)\s*\(/);
    for (const title of titles) expect(component).toContain(title);
  });

  it('describes clinical deletion as an auditable lifecycle transition', () => {
    expect(source('./views/DiagnosisWorkspacePage.vue')).toContain('停止代替物理删除');
    expect(source('./views/ResultsWorkspacePage.vue')).toContain('原报告不可覆盖或删除');
    expect(source('./views/OutpatientConsultPage.vue')).toContain('拒绝代替物理删除');
  });
});
