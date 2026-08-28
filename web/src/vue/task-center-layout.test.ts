import { describe, expect, it } from 'vitest';
import page from './views/ClinicalTasksPage.vue?raw';

describe('任务中心布局与临床路径规则契约', () => {
  it('消息通知的任务选择框和新建按钮保持同一行且不会溢出', () => {
    expect(page).toContain('toolbar-actions notification-create-toolbar');
    expect(page).toContain('grid-template-columns:minmax(0,360px) auto');
    expect(page).toContain('width:min(480px,100%)');
    expect(page).toContain('.notification-create-toolbar .button{white-space:nowrap}');
    expect(page).toContain('text-overflow:ellipsis');
  });

  it('路径页面明确展示规则、版本快照和可执行必做任务', () => {
    expect(page).toContain('临床路径规则、版本与执行');
    expect(page).toContain('版本是发布快照');
    expect(page).toContain("pathwayRuleCount(item, 'entry_rules')");
    expect(page).toContain("pathwayRuleCount(item, 'variance_rules')");
    expect(page).toContain('pathwayRequiredTaskCount(item)');
    for (const rule of ['entry_rules', 'exclusion_rules', 'variance_rules', 'completion_rules', 'exit_rules']) {
      expect(page).toContain(`${rule}:`);
    }
  });
});
