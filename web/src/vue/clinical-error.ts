import { ZodError } from 'zod';

import { ClinicalApiError } from '../clinical-api';

export type ClinicalIssue = { code: string; message: string };

export function toClinicalIssue(error: unknown): ClinicalIssue {
  if (error instanceof ClinicalApiError) return { code: error.code, message: error.message };
  if (error instanceof ZodError) return { code: 'CONTRACT_MISMATCH', message: '服务响应与临床契约不一致，已阻止继续操作' };
  return { code: 'NETWORK_UNAVAILABLE', message: '无法连接临床服务，未提交任何更改' };
}
