import type { ZodType } from 'zod';

import { ClinicalApiError } from './clinical-api';

type ContractPhase = 'request' | 'response';

function firstIssuePath(error: { issues: Array<{ path: PropertyKey[] }> }): string {
  const path = error.issues[0]?.path.map(String).join('.');
  return path || '根对象';
}

function parseClinicalContract<T>(schema: ZodType<T>, value: unknown, phase: ContractPhase): T {
  const result = schema.safeParse(value);
  if (result.success) return result.data;

  const field = firstIssuePath(result.error);
  if (phase === 'request') {
    throw new ClinicalApiError(
      'REQUEST_CONTRACT_MISMATCH',
      `提交内容不符合临床契约（字段：${field}），请重新选择患者、就诊或任务范围`,
      400,
    );
  }
  throw new ClinicalApiError(
    'RESPONSE_CONTRACT_MISMATCH',
    `服务响应不符合临床契约（字段：${field}），已阻止继续操作`,
    502,
  );
}

export function parseClinicalRequest<T>(schema: ZodType<T>, value: unknown): T {
  return parseClinicalContract(schema, value, 'request');
}

export function parseClinicalResponse<T>(schema: ZodType<T>, value: unknown): T {
  return parseClinicalContract(schema, value, 'response');
}
