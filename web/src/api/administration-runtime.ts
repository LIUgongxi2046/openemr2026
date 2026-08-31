import { z } from 'zod';
import { adminRequest } from '../clinical-api';

const jobRunSchema = z.object({
  run_id: z.string().uuid(), config_id: z.string().uuid(), job_kind: z.string(), status: z.string(),
  requested_by: z.string().uuid(), attempt: z.number().int(), processed_count: z.number().int(),
  succeeded_count: z.number().int(), failed_count: z.number().int(), result: z.record(z.string(), z.unknown()),
  error_code: z.string().nullable(), error_message: z.string().nullable(), started_at: z.string().nullable(),
  finished_at: z.string().nullable(), row_version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});

const governanceFindingSchema = z.object({
  finding_id: z.string().uuid(), run_id: z.string().uuid(), finding_type: z.string(), severity: z.string(),
  resource_type: z.string(), resource_id: z.string().uuid().nullable(), summary: z.string(), recommendation: z.string(),
  evidence: z.record(z.string(), z.unknown()), status: z.string(), resolved_by: z.string().uuid().nullable(),
  resolved_at: z.string().nullable(), row_version: z.number().int(), created_at: z.string(), updated_at: z.string(),
});

const masterDataRecordSchema = z.object({
  record_id: z.string().uuid(), config_id: z.string().uuid(), code_system: z.string(), national_code: z.string().nullable(),
  local_code: z.string(), display_name: z.string(), category_path: z.string(), national_version: z.string().nullable(),
  authoritative_source: z.string(), mapping_status: z.string(), status: z.string(), effective_from: z.string(),
  effective_until: z.string().nullable(), attributes: z.record(z.string(), z.unknown()), row_version: z.number().int(),
  created_by: z.string().uuid(), created_at: z.string(), updated_at: z.string(),
});

const workgroupMemberSchema = z.object({
  member_id: z.string().uuid(), person_id: z.string().uuid(), person_name: z.string(), role_code: z.string(),
  responsibility: z.string(), status: z.string(), effective_from: z.string(), effective_until: z.string().nullable(),
  row_version: z.number().int(),
});
const workgroupSchema = z.object({
  workgroup_id: z.string().uuid(), workgroup_code: z.string(), display_name: z.string(), purpose: z.string(),
  organization_id: z.string().uuid(), facility_id: z.string().uuid().nullable(), department_id: z.string().uuid().nullable(),
  owner_person_id: z.string().uuid(), owner_name: z.string(), status: z.string(), effective_from: z.string(),
  effective_until: z.string().nullable(), row_version: z.number().int(), members: z.array(workgroupMemberSchema),
  created_at: z.string(), updated_at: z.string(),
});

export type AdministrationJobRun = z.infer<typeof jobRunSchema>;
export type AdministrationGovernanceFinding = z.infer<typeof governanceFindingSchema>;
export type MasterDataRecord = z.infer<typeof masterDataRecordSchema>;
export type AdministrationWorkgroup = z.infer<typeof workgroupSchema>;
export type AdministrationWorkgroupMember = z.infer<typeof workgroupMemberSchema>;
export type MasterDataInput = Omit<MasterDataRecord, 'record_id' | 'status' | 'row_version' | 'created_by' | 'created_at' | 'updated_at'>;

export async function listAdministrationJobRuns(configId?: string): Promise<AdministrationJobRun[]> {
  const query = configId ? `?config_id=${encodeURIComponent(configId)}` : '';
  return jobRunSchema.array().parse(await adminRequest(`/admin/runtime/job-runs${query}`));
}

export async function startAdministrationJob(configId: string): Promise<AdministrationJobRun> {
  return jobRunSchema.parse(await adminRequest(`/admin/runtime/jobs/${encodeURIComponent(configId)}/runs`, {
    method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
  }));
}

export async function cancelAdministrationJob(run: AdministrationJobRun): Promise<AdministrationJobRun> {
  return jobRunSchema.parse(await adminRequest(`/admin/runtime/job-runs/${run.run_id}/cancel`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ expected_version: run.row_version }),
  }));
}

export async function retryAdministrationJob(runId: string): Promise<AdministrationJobRun> {
  return jobRunSchema.parse(await adminRequest(`/admin/runtime/job-runs/${runId}/retry`, {
    method: 'POST', headers: { 'Idempotency-Key': crypto.randomUUID() },
  }));
}

export async function listAdministrationFindings(runId: string): Promise<AdministrationGovernanceFinding[]> {
  return governanceFindingSchema.array().parse(await adminRequest(`/admin/runtime/job-runs/${runId}/findings`));
}

export async function resolveAdministrationFinding(
  finding: AdministrationGovernanceFinding, resolution: string,
): Promise<AdministrationGovernanceFinding> {
  return governanceFindingSchema.parse(await adminRequest(`/admin/runtime/findings/${finding.finding_id}/resolve`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ expected_version: finding.row_version, resolution }),
  }));
}

export async function listMasterDataRecords(filters: { configId?: string; keyword?: string; status?: string } = {}): Promise<MasterDataRecord[]> {
  const query = new URLSearchParams();
  if (filters.configId) query.set('config_id', filters.configId);
  if (filters.keyword) query.set('keyword', filters.keyword);
  if (filters.status) query.set('status', filters.status);
  const suffix = query.size ? `?${query}` : '';
  return masterDataRecordSchema.array().parse(await adminRequest(`/admin/master-data-records${suffix}`));
}

export async function createMasterDataRecord(input: MasterDataInput): Promise<MasterDataRecord> {
  return masterDataRecordSchema.parse(await adminRequest('/admin/master-data-records', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  }));
}

export async function updateMasterDataRecord(record: MasterDataRecord, input: MasterDataInput): Promise<MasterDataRecord> {
  return masterDataRecordSchema.parse(await adminRequest(`/admin/master-data-records/${record.record_id}`, {
    method: 'PUT', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ ...input, expected_version: record.row_version }),
  }));
}

export async function deactivateMasterDataRecord(record: MasterDataRecord, reason: string): Promise<MasterDataRecord> {
  return masterDataRecordSchema.parse(await adminRequest(`/admin/master-data-records/${record.record_id}/deactivate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ expected_version: record.row_version, reason }),
  }));
}

export async function listAdministrationWorkgroups(): Promise<AdministrationWorkgroup[]> {
  return workgroupSchema.array().parse(await adminRequest('/admin/workgroups'));
}

export async function createAdministrationWorkgroup(input: {
  workgroup_id: string; workgroup_code: string; display_name: string; purpose: string;
  organization_id: string; facility_id?: string; department_id?: string; owner_person_id: string;
  effective_from: string; effective_until?: string;
}): Promise<AdministrationWorkgroup> {
  return workgroupSchema.parse(await adminRequest('/admin/workgroups', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  }));
}

export async function addAdministrationWorkgroupMember(workgroupId: string, input: {
  member_id: string; person_id: string; role_code: string; responsibility: string;
  effective_from: string; effective_until?: string;
}): Promise<AdministrationWorkgroup> {
  return workgroupSchema.parse(await adminRequest(`/admin/workgroups/${workgroupId}/members`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(input),
  }));
}

export async function endAdministrationWorkgroupMember(
  workgroupId: string, member: AdministrationWorkgroupMember,
): Promise<AdministrationWorkgroup> {
  return workgroupSchema.parse(await adminRequest(`/admin/workgroups/${workgroupId}/members/${member.member_id}/end`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ expected_version: member.row_version, reason: '工作组负责人确认结束成员职责任期' }),
  }));
}

export async function deactivateAdministrationWorkgroup(workgroup: AdministrationWorkgroup): Promise<AdministrationWorkgroup> {
  return workgroupSchema.parse(await adminRequest(`/admin/workgroups/${workgroup.workgroup_id}/deactivate`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ expected_version: workgroup.row_version, reason: '工作组负责人确认停用且已完成任务转派' }),
  }));
}
