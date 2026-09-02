import { z } from 'zod';

import {
  explicitContextHeaders,
  issueContextLease,
  request,
} from '../clinical-api';
import type { ClinicalApiError } from '../clinical-api';
import type { ContextLeaseWire } from '../generated/contracts';

export const recordCenterWorklistItemSchema = z.object({
  document_id: z.string().uuid(),
  document_version_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  patient_name: z.string(),
  encounter_id: z.string().uuid(),
  encounter_type: z.enum(['OUTPATIENT', 'EMERGENCY', 'INPATIENT']),
  encounter_status: z.string(),
  department_id: z.string().uuid().nullable(),
  department_name: z.string().nullable(),
  document_type_code: z.string(),
  status: z.enum(['DRAFT', 'READY_TO_SIGN', 'SIGNED', 'CORRECTED', 'VOID']),
  version_no: z.number().int().positive(),
  row_version: z.number().int().positive(),
  content_hash: z.string(),
  author_name: z.string(),
  open_finding_count: z.number().int().nonnegative(),
  has_blocking_finding: z.boolean(),
  has_valid_signature: z.boolean(),
  review_case_id: z.string().uuid().nullable(),
  review_status: z.string().nullable(),
  review_priority: z.string().nullable(),
  review_due_at: z.string().datetime().nullable(),
  updated_at: z.string().datetime(),
});

export const recordReviewCaseSchema = z.object({
  review_case_id: z.string().uuid(),
  patient_id: z.string().uuid(),
  patient_name: z.string(),
  encounter_id: z.string().uuid(),
  document_id: z.string().uuid(),
  document_version_id: z.string().uuid(),
  review_scope: z.enum(['RANDOM', 'FOCUSED', 'TERMINAL', 'CORRECTION']),
  reason: z.string(),
  priority: z.enum(['ROUTINE', 'HIGH', 'URGENT']),
  status: z.enum(['OPEN', 'ASSIGNED', 'IN_REVIEW', 'REMEDIATION', 'VERIFIED', 'CLOSED', 'VOID']),
  assignee_user_id: z.string().uuid().nullable(),
  assignee_name: z.string().nullable(),
  due_at: z.string().datetime(),
  created_by: z.string().uuid(),
  created_by_name: z.string(),
  void_reason: z.string().nullable(),
  row_version: z.number().int().positive(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
});

export type RecordCenterWorklistItem = z.infer<typeof recordCenterWorklistItemSchema>;
export type RecordReviewCase = z.infer<typeof recordReviewCaseSchema>;

export function issueRecordCenterLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'RECORD_CENTER_WORKLIST');
}

function recordCenterHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, null, null);
}

export async function listRecordCenterWorklist(
  lease: ContextLeaseWire,
  filters: { status?: string; query?: string } = {},
): Promise<RecordCenterWorklistItem[]> {
  const params = new URLSearchParams();
  if (filters.status && filters.status !== 'ALL') params.set('status', filters.status);
  if (filters.query?.trim()) params.set('query', filters.query.trim());
  const suffix = params.size ? `?${params.toString()}` : '';
  return recordCenterWorklistItemSchema.array().parse(await request(
    `/record-center/worklist${suffix}`,
    { headers: recordCenterHeaders(lease) },
  ));
}

export async function listRecordReviewCases(
  lease: ContextLeaseWire,
  documentId?: string,
): Promise<RecordReviewCase[]> {
  const suffix = documentId ? `?document_id=${encodeURIComponent(documentId)}` : '';
  return recordReviewCaseSchema.array().parse(await request(
    `/record-center/review-cases${suffix}`,
    { headers: recordCenterHeaders(lease) },
  ));
}

export async function createRecordReviewCase(
  lease: ContextLeaseWire,
  input: {
    documentId: string;
    documentVersionId: string;
    reviewScope: RecordReviewCase['review_scope'];
    reason: string;
    priority: RecordReviewCase['priority'];
    assigneeUserId?: string | null;
    dueAt: string;
  },
): Promise<RecordReviewCase> {
  return recordReviewCaseSchema.parse(await request('/record-center/review-cases', {
    method: 'POST',
    headers: {
      ...recordCenterHeaders(lease),
      'Content-Type': 'application/json',
      'Idempotency-Key': crypto.randomUUID(),
    },
    body: JSON.stringify({
      document_id: input.documentId,
      document_version_id: input.documentVersionId,
      review_scope: input.reviewScope,
      reason: input.reason,
      priority: input.priority,
      assignee_user_id: input.assigneeUserId ?? null,
      due_at: input.dueAt,
    }),
  }));
}

export async function transitionRecordReviewCase(
  lease: ContextLeaseWire,
  reviewCase: RecordReviewCase,
  input: { targetStatus: RecordReviewCase['status']; reason: string; assigneeUserId?: string | null },
): Promise<RecordReviewCase> {
  return recordReviewCaseSchema.parse(await request(
    `/record-center/review-cases/${encodeURIComponent(reviewCase.review_case_id)}/transitions`, {
      method: 'POST',
      headers: {
        ...recordCenterHeaders(lease),
        'Content-Type': 'application/json',
        'Idempotency-Key': crypto.randomUUID(),
      },
      body: JSON.stringify({
        expected_row_version: reviewCase.row_version,
        target_status: input.targetStatus,
        reason: input.reason,
        assignee_user_id: input.assigneeUserId ?? null,
      }),
    },
  ));
}

export function isRecordCenterAccessError(error: unknown): error is ClinicalApiError {
  return error instanceof Error && 'code' in error && String((error as { code?: unknown }).code).startsWith('CONTEXT_');
}
