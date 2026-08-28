import { describe, expect, it } from 'vitest';
import { adminCodeLabel, adminValueLabel, documentFieldLabel, documentTypeLabel } from './admin-display';

describe('system administration display labels', () => {
  it('renders authorization and audit codes as understandable Chinese', () => {
    expect(adminCodeLabel('AUTHORIZATION_POLICY_PUBLISHED')).toBe('发布权限策略');
    expect(adminCodeLabel('CLINICAL_DOCUMENT')).toBe('临床病历');
    expect(adminCodeLabel('LEASE_ISSUE')).toBe('建立限时访问授权');
    expect(adminCodeLabel('CONTEXT_LEASE_ISSUED')).toBe('签发访问上下文');
    expect(adminCodeLabel('DOCUMENT_DRAFT_CREATED')).toBe('创建病历草稿');
    expect(adminCodeLabel('INPATIENT_ADMISSION')).toBe('入院登记');
    expect(adminCodeLabel('VERIFY')).toBe('核验');
  });

  it('keeps unknown technical codes visible as secondary context', () => {
    expect(adminCodeLabel('CUSTOM_SCOPE')).toBe('其他类型（CUSTOM_SCOPE）');
  });

  it('explains authentication, scope and template fields', () => {
    expect(adminValueLabel('Authorization Code + PKCE')).toBe('授权码登录（含客户端安全校验）');
    expect(adminValueLabel('FACILITY -> ORGANIZATION -> GLOBAL')).toBe('院区 → 医疗机构 → 全系统');
    expect(adminValueLabel('平台 8000ms -> 机构 6000ms')).toBe('平台 8000ms → 机构 6000ms');
    expect(adminValueLabel('INTEGER_MILLISECONDS')).toBe('整数（毫秒）');
    expect(documentTypeLabel('OPD_NOTE')).toBe('门诊病历');
    expect(documentFieldLabel('chief_complaint')).toBe('主诉');
  });
});
