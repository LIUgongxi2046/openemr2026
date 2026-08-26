const doctorFacingReplacements: ReadonlyArray<readonly [RegExp, string]> = [
  [/DeepSeek\s+Harness/gi, 'DeepSeek 医助协同引擎'],
  [/Medical\s+Harness/gi, '医助协同引擎'],
  [/ContextLease/g, '诊疗范围授权'],
  [/主\s*Agent/gi, '医助团队'],
  [/子\s*Agent/gi, '专科医助'],
  [/协作者/g, '医助'],
  [/候选制/g, '医生确认机制'],
  [/可追溯候选/g, '可追溯草稿'],
  [/候选/g, '草稿'],
  [/Agent/gi, '智能医助'],
  [/Skill/gi, '医助能力'],
  [/Tool/gi, '医助工具'],
];

export function doctorFacingAiText(value: string | null | undefined): string {
  return doctorFacingReplacements.reduce(
    (text, [pattern, replacement]) => text.replace(pattern, replacement),
    value ?? '',
  );
}

export function doctorFacingTeamName(value: string | null | undefined): string {
  return doctorFacingAiText(value).replace(/医助团队$/, '').trim();
}
