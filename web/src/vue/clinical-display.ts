const labels: Readonly<Record<string, string>> = {
  APPOINTMENT: '预约',
  WALK_IN: '现场挂号',
  EMERGENCY: '急诊',
  BOOKED: '已预约',
  CHECKED_IN: '已报到',
  CANCELLED: '已取消',
  NO_SHOW: '未到诊',
  COMPLETED: '已完成',
  WAITING: '候诊中',
  CALLED: '已叫号',
  IN_CONSULTATION: '接诊中',
  SKIPPED: '已过号',
  ACTIVE: '生效中',
  EXPIRED: '已到期',
  REVOKED: '已撤销',
  REVIEWED: '已复核',
  DRAFT: '草稿',
  PUBLISHED: '已发布',
  PENDING_APPROVAL: '待审批',
  APPROVED: '已批准',
  INACTIVE: '已停用',
  DISABLED: '已停用',
  LOCKED: '已锁定',
  RETIRED: '已退役',
  ALLOW: '允许',
  DENY: '拒绝',
  APPROPRIATE: '复核通过',
  INAPPROPRIATE: '复核不通过',
  ESCALATED: '已升级处理',
  CLINICAL_CONTEXT: '临床上下文',
  DOCUMENT: '病历文书',
  CLINICAL_DOCUMENT: '临床病历',
  WORKFORCE_PERSON: '人员主档',
  RESEARCH_DATASET: '科研数据集',
  LEASE_ISSUE: '建立限时授权',
  READ: '查看',
  WRITE_DRAFT: '起草',
  MANAGE: '管理',
  EXPORT: '导出',
  CLINICIAN: '临床医师',
  NURSE: '护士',
  CLINICAL_ADMIN: '临床管理员',
  SYSTEM_ADMIN: '系统管理员',
  ATTENDING_PHYSICIAN: '主治医师',
  CHIEF_PHYSICIAN: '科主任',
  MEDICAL_RECORDS: '病案管理员',
  SECURITY_AUDITOR: '安全审计员',
  AUTHORIZATION_ADMIN: '授权管理员',
  CONFIG_AUTHOR: '配置作者',
  CONFIG_APPROVER: '配置审批人',
  PHYSICIAN: '医师',
  RESEARCHER: '科研人员',
  CARE_TEAM: '当前照护团队',
  DIRECT_CARE: '直接诊疗',
  DOCUMENT_DRAFT: '病历起草',
  ADMINISTRATION: '系统管理',
  SECONDARY_USE: '二次利用',
  RESEARCH: '科研',
  M: '男',
  F: '女',
  O: '其他',
  U: '未知',
};

export function clinicalCodeLabel(code: string | null | undefined, fallback = '待处理'): string {
  if (!code) return fallback;
  return labels[code] ?? '未知状态';
}

export function joinClinicalCodeLabels(codes: readonly string[]): string {
  return codes.map((code) => clinicalCodeLabel(code)).join(' / ');
}

export function patientAge(birthDate: string, today = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDelta = today.getMonth() - birth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < birth.getDate())) age -= 1;
  return Math.max(0, age);
}
