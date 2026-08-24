import {
  medicalRecordAssetBorrowRequestWireSchema,
  medicalRecordAssetReturnRequestWireSchema,
  medicalRecordAssetWireSchema,
  type ContextLeaseWire,
  type MedicalRecordAssetWire,
} from '../generated/contracts';
import { clinicalContext, issueContextLease, request } from '../clinical-api';

/**
 * 病历与病案（RECORD）域客户端。
 *
 * 复用 `clinical-api.ts` 既有的文书、归档与结果函数；本模块只补齐缺口的
 * 病案资产（V97 编目/借阅/内容哈希硬门）薄客户端。DTO 一律消费
 * `generated/contracts.ts` 生成物，禁止手写枚举绕过契约。
 */

/** 病案资产为患者级上下文（可无就诊），签发一次租约后复用。 */
export function issueMedicalRecordAssetLease(): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, null, 'MEDICAL_RECORD_ASSET_WORKFLOW');
}

function assetHeaders(lease: ContextLeaseWire) {
  return {
    'X-Context-Lease-Id': lease.lease_id,
    'X-Authorization-Watermark': lease.authorization_watermark,
    'X-Organization-Context': clinicalContext.organizationId,
    'X-Facility-Context': clinicalContext.facilityId,
    'X-Patient-Context': clinicalContext.patientId,
  };
}

function orgFacilityPatient() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
  };
}

export async function listMedicalRecordAssets(lease: ContextLeaseWire): Promise<MedicalRecordAssetWire[]> {
  return medicalRecordAssetWireSchema.array().parse(await request(
    `/medical-record-assets?patient_id=${clinicalContext.patientId}`,
    { headers: assetHeaders(lease) },
  ));
}

export async function borrowMedicalRecordAsset(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
  dueAt: string,
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/borrows`, {
      method: 'POST',
      headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetBorrowRequestWireSchema.parse({
        ...orgFacilityPatient(),
        expected_row_version: asset.row_version,
        due_at: dueAt,
      })),
    },
  ));
}

export async function returnMedicalRecordAsset(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/returns`, {
      method: 'POST',
      headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetReturnRequestWireSchema.parse({
        ...orgFacilityPatient(),
        expected_row_version: asset.row_version,
      })),
    },
  ));
}
