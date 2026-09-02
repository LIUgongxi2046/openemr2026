import {
  medicalRecordAssetActionRequestWireSchema,
  medicalRecordAssetBorrowRequestWireSchema,
  medicalRecordAssetBorrowUpdateRequestWireSchema,
  medicalRecordAssetDistributionCreateRequestWireSchema,
  medicalRecordAssetDistributionDeliveryRequestWireSchema,
  medicalRecordAssetDistributionPackageWireSchema,
  medicalRecordAssetIngestRequestWireSchema,
  medicalRecordAssetIntegrityCheckRequestWireSchema,
  medicalRecordAssetIntegrityEventWireSchema,
  medicalRecordAssetRegisterRequestWireSchema,
  medicalRecordAssetRetireRequestWireSchema,
  medicalRecordAssetReturnRequestWireSchema,
  medicalRecordAssetUpdateRequestWireSchema,
  medicalRecordAssetWireSchema,
  type ContextLeaseWire,
  type MedicalRecordAssetDistributionPackageWire,
  type MedicalRecordAssetIntegrityEventWire,
  type MedicalRecordAssetWire,
} from '../generated/contracts';
import { clinicalContext, issueContextLease, request, requestBinary, type ClinicalBinaryResponse } from '../clinical-api';

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

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk));
  }
  return btoa(binary);
}

export async function ingestMedicalRecordAsset(
  lease: ContextLeaseWire,
  input: {
    assetType: MedicalRecordAssetWire['asset_type']; location: string; displayName: string;
    mediaType: string; pageCount: number; sourceSystem: string; file: File;
    cdaStatus?: MedicalRecordAssetWire['cda_status']; retentionYears: number;
  },
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request('/medical-record-assets/ingestions', {
    method: 'POST',
    headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetIngestRequestWireSchema.parse({
      ...orgFacilityPatient(), encounter_id: clinicalContext.encounterId,
      asset_type: input.assetType, location: input.location, display_name: input.displayName,
      original_filename: input.file.name, media_type: input.mediaType, page_count: input.pageCount,
      source_system: input.sourceSystem, content_base64: await fileToBase64(input.file),
      cda_status: input.cdaStatus, retention_years: input.retentionYears,
    })),
  }));
}

export function downloadMedicalRecordAsset(lease: ContextLeaseWire, assetId: string): Promise<ClinicalBinaryResponse> {
  return requestBinary(`/medical-record-assets/${assetId}/content`, assetHeaders(lease));
}

export async function runMedicalRecordAssetOcr(lease: ContextLeaseWire, asset: MedicalRecordAssetWire): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(`/medical-record-assets/${asset.medical_record_asset_id}/ocr-runs`, {
    method: 'POST', headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetActionRequestWireSchema.parse({ ...orgFacilityPatient(), expected_row_version: asset.row_version })),
  }));
}

export async function validateMedicalRecordAssetCda(lease: ContextLeaseWire, asset: MedicalRecordAssetWire): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(`/medical-record-assets/${asset.medical_record_asset_id}/cda-validations`, {
    method: 'POST', headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetActionRequestWireSchema.parse({ ...orgFacilityPatient(), expected_row_version: asset.row_version })),
  }));
}

export async function verifyMedicalRecordAssetStorage(lease: ContextLeaseWire, asset: MedicalRecordAssetWire): Promise<MedicalRecordAssetIntegrityEventWire> {
  return medicalRecordAssetIntegrityEventWireSchema.parse(await request(`/medical-record-assets/${asset.medical_record_asset_id}/storage-verifications`, {
    method: 'POST', headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetActionRequestWireSchema.parse({ ...orgFacilityPatient(), expected_row_version: asset.row_version })),
  }));
}

export async function listMedicalRecordAssetDistributionPackages(lease: ContextLeaseWire, assetId: string): Promise<MedicalRecordAssetDistributionPackageWire[]> {
  return medicalRecordAssetDistributionPackageWireSchema.array().parse(await request(
    `/medical-record-assets/${assetId}/distribution-packages`, { headers: assetHeaders(lease) },
  ));
}

export async function createMedicalRecordAssetDistribution(
  lease: ContextLeaseWire, asset: MedicalRecordAssetWire, input: {
    purpose: string; recipientName: string; requesterType: MedicalRecordAssetDistributionPackageWire['requester_type'];
    identityVerificationMethod: string; authorizationBasis: string; copyScope: string;
    separateConsentConfirmed: boolean; deliveryChannel: MedicalRecordAssetDistributionPackageWire['delivery_channel'];
    expiresAt: string;
  },
): Promise<MedicalRecordAssetDistributionPackageWire> {
  return medicalRecordAssetDistributionPackageWireSchema.parse(await request(`/medical-record-assets/${asset.medical_record_asset_id}/distribution-packages`, {
    method: 'POST', headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetDistributionCreateRequestWireSchema.parse({
      ...orgFacilityPatient(), expected_row_version: asset.row_version,
      purpose: input.purpose, recipient_name: input.recipientName, requester_type: input.requesterType,
      identity_verification_method: input.identityVerificationMethod, authorization_basis: input.authorizationBasis,
      copy_scope: input.copyScope, separate_consent_confirmed: input.separateConsentConfirmed,
      delivery_channel: input.deliveryChannel, expires_at: input.expiresAt,
    })),
  }));
}

export async function deliverMedicalRecordAssetDistribution(
  lease: ContextLeaseWire, asset: MedicalRecordAssetWire, pkg: MedicalRecordAssetDistributionPackageWire,
  hospitalSealNo: string, deliveryReceiptNo: string,
): Promise<MedicalRecordAssetDistributionPackageWire> {
  return medicalRecordAssetDistributionPackageWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/distribution-packages/${pkg.distribution_package_id}/deliveries`, {
      method: 'POST', headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetDistributionDeliveryRequestWireSchema.parse({
        ...orgFacilityPatient(), expected_row_version: pkg.row_version,
        hospital_seal_no: hospitalSealNo, delivery_receipt_no: deliveryReceiptNo,
      })),
    },
  ));
}

export function downloadMedicalRecordAssetDistribution(
  lease: ContextLeaseWire, assetId: string, packageId: string,
): Promise<ClinicalBinaryResponse> {
  return requestBinary(`/medical-record-assets/${assetId}/distribution-packages/${packageId}/content`, assetHeaders(lease));
}

export async function listMedicalRecordAssets(lease: ContextLeaseWire): Promise<MedicalRecordAssetWire[]> {
  return medicalRecordAssetWireSchema.array().parse(await request(
    `/medical-record-assets?patient_id=${clinicalContext.patientId}`,
    { headers: assetHeaders(lease) },
  ));
}

export async function registerMedicalRecordAsset(
  lease: ContextLeaseWire,
  input: {
    assetType: MedicalRecordAssetWire['asset_type']; location: string; contentHash: string;
    displayName?: string; mediaType?: string; pageCount?: number; sourceSystem?: string;
    cdaStatus?: MedicalRecordAssetWire['cda_status']; scanStatus?: MedicalRecordAssetWire['scan_status'];
    preservationStatus?: MedicalRecordAssetWire['preservation_status']; retentionYears?: number;
  },
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request('/medical-record-assets', {
    method: 'POST',
    headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetRegisterRequestWireSchema.parse({
      ...orgFacilityPatient(),
      encounter_id: clinicalContext.encounterId,
      asset_type: input.assetType,
      location: input.location,
      content_hash: input.contentHash,
      display_name: input.displayName,
      media_type: input.mediaType,
      page_count: input.pageCount,
      source_system: input.sourceSystem,
      cda_status: input.cdaStatus,
      scan_status: input.scanStatus,
      preservation_status: input.preservationStatus,
      retention_years: input.retentionYears,
    })),
  }));
}

export async function updateMedicalRecordAsset(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
  input: Pick<MedicalRecordAssetWire, 'display_name' | 'media_type' | 'page_count' | 'source_system' |
    'custody_location' | 'cda_status' | 'scan_status' | 'preservation_status' | 'retention_years'>,
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(`/medical-record-assets/${asset.medical_record_asset_id}`, {
    method: 'PATCH',
    headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(medicalRecordAssetUpdateRequestWireSchema.parse({
      ...orgFacilityPatient(), ...input, expected_row_version: asset.row_version,
    })),
  }));
}

export async function retireMedicalRecordAsset(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
  reason: string,
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/retirements`, {
      method: 'POST',
      headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetRetireRequestWireSchema.parse({
        ...orgFacilityPatient(), reason, expected_row_version: asset.row_version,
      })),
    },
  ));
}

export async function verifyMedicalRecordAssetIntegrity(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
  observedHash: string,
): Promise<MedicalRecordAssetIntegrityEventWire> {
  return medicalRecordAssetIntegrityEventWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/integrity-events`, {
      method: 'POST',
      headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetIntegrityCheckRequestWireSchema.parse({
        ...orgFacilityPatient(), observed_hash: observedHash, expected_row_version: asset.row_version,
      })),
    },
  ));
}

export async function listMedicalRecordAssetIntegrityEvents(
  lease: ContextLeaseWire,
  assetId: string,
): Promise<MedicalRecordAssetIntegrityEventWire[]> {
  return medicalRecordAssetIntegrityEventWireSchema.array().parse(await request(
    `/medical-record-assets/${assetId}/integrity-events`, { headers: assetHeaders(lease) },
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

export async function updateMedicalRecordAssetBorrow(
  lease: ContextLeaseWire,
  asset: MedicalRecordAssetWire,
  dueAt: string,
): Promise<MedicalRecordAssetWire> {
  return medicalRecordAssetWireSchema.parse(await request(
    `/medical-record-assets/${asset.medical_record_asset_id}/borrow`, {
      method: 'PATCH',
      headers: { ...assetHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(medicalRecordAssetBorrowUpdateRequestWireSchema.parse({
        ...orgFacilityPatient(), expected_row_version: asset.row_version, due_at: dueAt,
      })),
    },
  ));
}
