import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  scopedHeaders,
} from '../clinical-api';
import {
  artEmbryoTransferRecordCreateRequestWireSchema,
  artEmbryoTransferRecordWireSchema,
  artPregnancyOutcomeCreateRequestWireSchema,
  artPregnancyOutcomeWireSchema,
  dentalTreatmentRecordCreateRequestWireSchema,
  dentalTreatmentRecordWireSchema,
  dermatologyBiologicFollowupCreateRequestWireSchema,
  dermatologyBiologicFollowupWireSchema,
  dermatologyBiologicScreeningCreateRequestWireSchema,
  dermatologyBiologicScreeningWireSchema,
  entAirwayRiskHandoverCreateRequestWireSchema,
  entAirwayRiskHandoverWireSchema,
  mentalHealthCrisisFollowupCreateRequestWireSchema,
  mentalHealthCrisisFollowupWireSchema,
  mentalHealthCrisisHandoverCreateRequestWireSchema,
  mentalHealthCrisisHandoverWireSchema,
  neonatalScreeningRecordCreateRequestWireSchema,
  neonatalScreeningRecordWireSchema,
  neonatalWristbandVerificationCreateRequestWireSchema,
  neonatalWristbandVerificationWireSchema,
  obstetricAntenatalExamCreateRequestWireSchema,
  obstetricAntenatalExamWireSchema,
  obstetricDeliveryRecordCreateRequestWireSchema,
  obstetricDeliveryRecordWireSchema,
  obstetricPostpartumFollowupCreateRequestWireSchema,
  obstetricPostpartumFollowupWireSchema,
  obstetricQcReviewCreateRequestWireSchema,
  obstetricQcReviewWireSchema,
  ophthalmologyPostopFollowupCreateRequestWireSchema,
  ophthalmologyPostopFollowupWireSchema,
  ophthalmologyPreopVerificationCreateRequestWireSchema,
  ophthalmologyPreopVerificationWireSchema,
  pediatricFollowupRecordCreateRequestWireSchema,
  pediatricFollowupRecordWireSchema,
  neonatalFollowupRecordCreateRequestWireSchema,
  neonatalFollowupRecordWireSchema,
  entFollowupRecordCreateRequestWireSchema,
  entFollowupRecordWireSchema,
  dentalFollowupRecordCreateRequestWireSchema,
  dentalFollowupRecordWireSchema,
  tcmFollowupRecordCreateRequestWireSchema,
  tcmFollowupRecordWireSchema,
  obstetricCareNoteCreateRequestWireSchema,
  obstetricCareNoteWireSchema,
  reproductiveCareNoteCreateRequestWireSchema,
  reproductiveCareNoteWireSchema,
  ophthalmologyCareNoteCreateRequestWireSchema,
  ophthalmologyCareNoteWireSchema,
  dentalCareNoteCreateRequestWireSchema,
  dentalCareNoteWireSchema,
  dermatologyCareNoteCreateRequestWireSchema,
  dermatologyCareNoteWireSchema,
  tcmCareNoteCreateRequestWireSchema,
  tcmCareNoteWireSchema,
  entTreatmentCreateRequestWireSchema,
  entTreatmentWireSchema,
  mentalHealthTreatmentCreateRequestWireSchema,
  mentalHealthTreatmentWireSchema,
  neonatalTreatmentCreateRequestWireSchema,
  neonatalTreatmentWireSchema,
  pediatricTreatmentCreateRequestWireSchema,
  pediatricTreatmentWireSchema,
  dermatologyEvidenceCreateRequestWireSchema,
  dermatologyEvidenceWireSchema,
  dentalEvidenceCreateRequestWireSchema,
  dentalEvidenceWireSchema,
  entEvidenceCreateRequestWireSchema,
  entEvidenceWireSchema,
  ophthalmologyEvidenceCreateRequestWireSchema,
  ophthalmologyEvidenceWireSchema,
  mentalHealthEvidenceCreateRequestWireSchema,
  mentalHealthEvidenceWireSchema,
  pediatricEvidenceCreateRequestWireSchema,
  pediatricEvidenceWireSchema,
  reproductiveEvidenceCreateRequestWireSchema,
  reproductiveEvidenceWireSchema,
  pediatricGrowthRecordCreateRequestWireSchema,
  pediatricGrowthRecordWireSchema,
  tcmFourExaminationsCreateRequestWireSchema,
  tcmFourExaminationsWireSchema,
  tcmHerbalPrescriptionCreateRequestWireSchema,
  tcmHerbalPrescriptionWireSchema,
  tcmQcReviewCreateRequestWireSchema,
  tcmQcReviewWireSchema,
  reproductiveQcReviewCreateRequestWireSchema,
  reproductiveQcReviewWireSchema,
  pediatricQcReviewCreateRequestWireSchema,
  pediatricQcReviewWireSchema,
  neonatalQcReviewCreateRequestWireSchema,
  neonatalQcReviewWireSchema,
  mentalHealthQcReviewCreateRequestWireSchema,
  mentalHealthQcReviewWireSchema,
  ophthalmologyQcReviewCreateRequestWireSchema,
  ophthalmologyQcReviewWireSchema,
  entQcReviewCreateRequestWireSchema,
  entQcReviewWireSchema,
  dentalQcReviewCreateRequestWireSchema,
  dentalQcReviewWireSchema,
  dermatologyQcReviewCreateRequestWireSchema,
  dermatologyQcReviewWireSchema,
  type ArtEmbryoTransferRecordCreateRequestWire,
  type ArtEmbryoTransferRecordWire,
  type ArtPregnancyOutcomeCreateRequestWire,
  type ArtPregnancyOutcomeWire,
  type ContextLeaseWire,
  type DentalTreatmentRecordCreateRequestWire,
  type DentalTreatmentRecordWire,
  type DermatologyBiologicFollowupCreateRequestWire,
  type DermatologyBiologicFollowupWire,
  type DermatologyBiologicScreeningCreateRequestWire,
  type DermatologyBiologicScreeningWire,
  type EntAirwayRiskHandoverCreateRequestWire,
  type EntAirwayRiskHandoverWire,
  type MentalHealthCrisisFollowupCreateRequestWire,
  type MentalHealthCrisisFollowupWire,
  type MentalHealthCrisisHandoverCreateRequestWire,
  type MentalHealthCrisisHandoverWire,
  type NeonatalScreeningRecordCreateRequestWire,
  type NeonatalScreeningRecordWire,
  type NeonatalWristbandVerificationCreateRequestWire,
  type NeonatalWristbandVerificationWire,
  type ObstetricAntenatalExamCreateRequestWire,
  type ObstetricAntenatalExamWire,
  type ObstetricDeliveryRecordCreateRequestWire,
  type ObstetricDeliveryRecordWire,
  type ObstetricPostpartumFollowupCreateRequestWire,
  type ObstetricPostpartumFollowupWire,
  type ObstetricQcReviewCreateRequestWire,
  type ObstetricQcReviewWire,
  type OphthalmologyPostopFollowupCreateRequestWire,
  type OphthalmologyPostopFollowupWire,
  type OphthalmologyPreopVerificationCreateRequestWire,
  type OphthalmologyPreopVerificationWire,
  type PediatricFollowupRecordCreateRequestWire,
  type PediatricFollowupRecordWire,
  type NeonatalFollowupRecordCreateRequestWire,
  type NeonatalFollowupRecordWire,
  type EntFollowupRecordCreateRequestWire,
  type EntFollowupRecordWire,
  type DentalFollowupRecordCreateRequestWire,
  type DentalFollowupRecordWire,
  type TcmFollowupRecordCreateRequestWire,
  type TcmFollowupRecordWire,
  type ObstetricCareNoteCreateRequestWire,
  type ObstetricCareNoteWire,
  type ReproductiveCareNoteCreateRequestWire,
  type ReproductiveCareNoteWire,
  type OphthalmologyCareNoteCreateRequestWire,
  type OphthalmologyCareNoteWire,
  type DentalCareNoteCreateRequestWire,
  type DentalCareNoteWire,
  type DermatologyCareNoteCreateRequestWire,
  type DermatologyCareNoteWire,
  type TcmCareNoteCreateRequestWire,
  type TcmCareNoteWire,
  type EntTreatmentCreateRequestWire,
  type EntTreatmentWire,
  type MentalHealthTreatmentCreateRequestWire,
  type MentalHealthTreatmentWire,
  type NeonatalTreatmentCreateRequestWire,
  type NeonatalTreatmentWire,
  type PediatricTreatmentCreateRequestWire,
  type PediatricTreatmentWire,
  type DermatologyEvidenceCreateRequestWire,
  type DermatologyEvidenceWire,
  type DentalEvidenceCreateRequestWire,
  type DentalEvidenceWire,
  type EntEvidenceCreateRequestWire,
  type EntEvidenceWire,
  type OphthalmologyEvidenceCreateRequestWire,
  type OphthalmologyEvidenceWire,
  type MentalHealthEvidenceCreateRequestWire,
  type MentalHealthEvidenceWire,
  type PediatricEvidenceCreateRequestWire,
  type PediatricEvidenceWire,
  type ReproductiveEvidenceCreateRequestWire,
  type ReproductiveEvidenceWire,
  type PediatricGrowthRecordCreateRequestWire,
  type PediatricGrowthRecordWire,
  type TcmFourExaminationsCreateRequestWire,
  type TcmFourExaminationsWire,
  type TcmHerbalPrescriptionCreateRequestWire,
  type TcmHerbalPrescriptionWire,
  type TcmQcReviewCreateRequestWire,
  type TcmQcReviewWire,
  type ReproductiveQcReviewCreateRequestWire,
  type ReproductiveQcReviewWire,
  type PediatricQcReviewCreateRequestWire,
  type PediatricQcReviewWire,
  type NeonatalQcReviewCreateRequestWire,
  type NeonatalQcReviewWire,
  type MentalHealthQcReviewCreateRequestWire,
  type MentalHealthQcReviewWire,
  type OphthalmologyQcReviewCreateRequestWire,
  type OphthalmologyQcReviewWire,
  type EntQcReviewCreateRequestWire,
  type EntQcReviewWire,
  type DentalQcReviewCreateRequestWire,
  type DentalQcReviewWire,
  type DermatologyQcReviewCreateRequestWire,
  type DermatologyQcReviewWire,
} from '../generated/contracts';

/**
 * 专科「其余层」(treatment / evidence / care / followup / qc) API 客户端。
 * LIST 端点按 (org, facility, patient, null) 授权 → 患者级租约；CREATE 端点按
 * (org, facility, patient, encounter) 授权 → 患者+就诊租约（少数端点按
 * (org, facility, patient, null) 授权，见各注释）。
 */
export function issueSpecialtyPatientLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, null, purpose);
}

export function issueSpecialtyEncounterLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, purpose);
}

/** 患者 + 就诊级别的命令上下文（大多数专科「其余层」写操作都需要）。 */
function scoped() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
    encounter_id: clinicalContext.encounterId,
  };
}

/** 仅患者级别的命令上下文（无就诊，供 deliver/transfer/wristband 等端点使用）。 */
function patientScoped() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
  };
}

/** 患者级（无就诊）请求头：不携带 X-Encounter-Context。 */
function patientOnlyHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.patientId, null);
}

function normalizeTemporalBody(body: unknown): unknown {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return body;
  return Object.fromEntries(Object.entries(body as Record<string, unknown>).map(([key, value]) => {
    if (typeof value !== 'string' || !/(?:_at|_date|_datetime)$/.test(key)) return [key, value];
    if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return [key, new Date(`${value}T00:00:00.000Z`).toISOString()];
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2})?$/.test(value)) return [key, new Date(value).toISOString()];
    return [key, value];
  }));
}

function createInit(lease: ContextLeaseWire, body: unknown) {
  return {
    method: 'POST',
    headers: { ...scopedHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(normalizeTemporalBody(body)),
  };
}

function patientCreateInit(lease: ContextLeaseWire, body: unknown) {
  return {
    method: 'POST',
    headers: { ...patientOnlyHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(normalizeTemporalBody(body)),
  };
}

// ── 妇产 · 分娩记录（obgyn-treatment，POST 按 (org,facility,patient,null) 授权，无 encounter_id） ──
export async function listObstetricDeliveryRecords(lease: ContextLeaseWire): Promise<ObstetricDeliveryRecordWire[]> {
  return obstetricDeliveryRecordWireSchema.array().parse(await request(
    `/obstetric-delivery-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricDeliveryRecord(
  lease: ContextLeaseWire,
  input: Omit<ObstetricDeliveryRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricDeliveryRecordWire> {
  return obstetricDeliveryRecordWireSchema.parse(await request(
    '/obstetric-delivery-records',
    patientCreateInit(lease, obstetricDeliveryRecordCreateRequestWireSchema.parse({ ...patientScoped(), ...input })),
  ));
}

// ── 妇产 · 产前检查（obgyn-evidence） ──────────────────────────
export async function listObstetricAntenatalExams(lease: ContextLeaseWire): Promise<ObstetricAntenatalExamWire[]> {
  return obstetricAntenatalExamWireSchema.array().parse(await request(
    `/obstetric-antenatal-exams?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricAntenatalExam(
  lease: ContextLeaseWire,
  input: Omit<ObstetricAntenatalExamCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricAntenatalExamWire> {
  return obstetricAntenatalExamWireSchema.parse(await request(
    '/obstetric-antenatal-exams',
    createInit(lease, obstetricAntenatalExamCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 妇产 · 产后随访（obgyn-followup） ──────────────────────────
export async function listObstetricPostpartumFollowups(lease: ContextLeaseWire): Promise<ObstetricPostpartumFollowupWire[]> {
  return obstetricPostpartumFollowupWireSchema.array().parse(await request(
    `/obstetric-postpartum-followups?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricPostpartumFollowup(
  lease: ContextLeaseWire,
  input: Omit<ObstetricPostpartumFollowupCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricPostpartumFollowupWire> {
  return obstetricPostpartumFollowupWireSchema.parse(await request(
    '/obstetric-postpartum-followups',
    createInit(lease, obstetricPostpartumFollowupCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 妇产 · 质控复核（obgyn-qc） ────────────────────────────────
export async function listObstetricQcReviews(lease: ContextLeaseWire): Promise<ObstetricQcReviewWire[]> {
  return obstetricQcReviewWireSchema.array().parse(await request(
    `/obstetric-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricQcReview(
  lease: ContextLeaseWire,
  input: Omit<ObstetricQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricQcReviewWire> {
  return obstetricQcReviewWireSchema.parse(await request(
    '/obstetric-qc-reviews',
    createInit(lease, obstetricQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 生殖 · 胚胎移植（reproductive-treatment，POST 按 (org,facility,patient,null) 授权，无 encounter_id） ──
export async function listArtEmbryoTransferRecords(lease: ContextLeaseWire): Promise<ArtEmbryoTransferRecordWire[]> {
  return artEmbryoTransferRecordWireSchema.array().parse(await request(
    `/art-embryo-transfer-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createArtEmbryoTransferRecord(
  lease: ContextLeaseWire,
  input: Omit<ArtEmbryoTransferRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ArtEmbryoTransferRecordWire> {
  return artEmbryoTransferRecordWireSchema.parse(await request(
    '/art-embryo-transfer-records',
    patientCreateInit(lease, artEmbryoTransferRecordCreateRequestWireSchema.parse({ ...patientScoped(), ...input })),
  ));
}

// ── 生殖 · 妊娠结局（reproductive-followup） ───────────────────
export async function listArtPregnancyOutcomes(lease: ContextLeaseWire): Promise<ArtPregnancyOutcomeWire[]> {
  return artPregnancyOutcomeWireSchema.array().parse(await request(
    `/art-pregnancy-outcomes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createArtPregnancyOutcome(
  lease: ContextLeaseWire,
  input: Omit<ArtPregnancyOutcomeCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ArtPregnancyOutcomeWire> {
  return artPregnancyOutcomeWireSchema.parse(await request(
    '/art-pregnancy-outcomes',
    createInit(lease, artPregnancyOutcomeCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 儿科 · 生长发育（pediatrics-care） ─────────────────────────
export async function listPediatricGrowthRecords(lease: ContextLeaseWire): Promise<PediatricGrowthRecordWire[]> {
  return pediatricGrowthRecordWireSchema.array().parse(await request(
    `/pediatric-growth-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricGrowthRecord(
  lease: ContextLeaseWire,
  input: Omit<PediatricGrowthRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricGrowthRecordWire> {
  return pediatricGrowthRecordWireSchema.parse(await request(
    '/pediatric-growth-records',
    createInit(lease, pediatricGrowthRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 儿科 · 随访记录（pediatrics-followup） ─────────────────────
export async function listPediatricFollowupRecords(lease: ContextLeaseWire): Promise<PediatricFollowupRecordWire[]> {
  return pediatricFollowupRecordWireSchema.array().parse(await request(
    `/pediatric-followup-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricFollowupRecord(
  lease: ContextLeaseWire,
  input: Omit<PediatricFollowupRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricFollowupRecordWire> {
  return pediatricFollowupRecordWireSchema.parse(await request(
    '/pediatric-followup-records',
    createInit(lease, pediatricFollowupRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 新生儿 · 腕带核对（neonatal-care，POST 按 (org,facility,patient,null) 授权，无 encounter_id） ──
export async function listNeonatalWristbandVerifications(lease: ContextLeaseWire): Promise<NeonatalWristbandVerificationWire[]> {
  return neonatalWristbandVerificationWireSchema.array().parse(await request(
    `/neonatal-wristband-verifications?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalWristbandVerification(
  lease: ContextLeaseWire,
  input: Omit<NeonatalWristbandVerificationCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalWristbandVerificationWire> {
  return neonatalWristbandVerificationWireSchema.parse(await request(
    '/neonatal-wristband-verifications',
    patientCreateInit(lease, neonatalWristbandVerificationCreateRequestWireSchema.parse({ ...patientScoped(), ...input })),
  ));
}

// ── 新生儿 · 筛查记录（neonatal-evidence） ─────────────────────
export async function listNeonatalScreeningRecords(lease: ContextLeaseWire): Promise<NeonatalScreeningRecordWire[]> {
  return neonatalScreeningRecordWireSchema.array().parse(await request(
    `/neonatal-screening-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalScreeningRecord(
  lease: ContextLeaseWire,
  input: Omit<NeonatalScreeningRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalScreeningRecordWire> {
  return neonatalScreeningRecordWireSchema.parse(await request(
    '/neonatal-screening-records',
    createInit(lease, neonatalScreeningRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 精神心理 · 危机交接（mental-care） ─────────────────────────
export async function listMentalHealthCrisisHandovers(lease: ContextLeaseWire): Promise<MentalHealthCrisisHandoverWire[]> {
  return mentalHealthCrisisHandoverWireSchema.array().parse(await request(
    `/mental-health-crisis-handovers?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthCrisisHandover(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthCrisisHandoverCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthCrisisHandoverWire> {
  return mentalHealthCrisisHandoverWireSchema.parse(await request(
    '/mental-health-crisis-handovers',
    createInit(lease, mentalHealthCrisisHandoverCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 精神心理 · 危机随访（mental-followup） ─────────────────────
export async function listMentalHealthCrisisFollowups(lease: ContextLeaseWire): Promise<MentalHealthCrisisFollowupWire[]> {
  return mentalHealthCrisisFollowupWireSchema.array().parse(await request(
    `/mental-health-crisis-followups?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthCrisisFollowup(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthCrisisFollowupCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthCrisisFollowupWire> {
  return mentalHealthCrisisFollowupWireSchema.parse(await request(
    '/mental-health-crisis-followups',
    createInit(lease, mentalHealthCrisisFollowupCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 眼科 · 术前核对（ophthalmology-treatment） ─────────────────
export async function listOphthalmologyPreopVerifications(lease: ContextLeaseWire): Promise<OphthalmologyPreopVerificationWire[]> {
  return ophthalmologyPreopVerificationWireSchema.array().parse(await request(
    `/ophthalmology-preop-verifications?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyPreopVerification(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyPreopVerificationCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyPreopVerificationWire> {
  return ophthalmologyPreopVerificationWireSchema.parse(await request(
    '/ophthalmology-preop-verifications',
    createInit(lease, ophthalmologyPreopVerificationCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 眼科 · 术后随访（ophthalmology-followup） ──────────────────
export async function listOphthalmologyPostopFollowups(lease: ContextLeaseWire): Promise<OphthalmologyPostopFollowupWire[]> {
  return ophthalmologyPostopFollowupWireSchema.array().parse(await request(
    `/ophthalmology-postop-followups?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyPostopFollowup(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyPostopFollowupCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyPostopFollowupWire> {
  return ophthalmologyPostopFollowupWireSchema.parse(await request(
    '/ophthalmology-postop-followups',
    createInit(lease, ophthalmologyPostopFollowupCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 耳鼻喉 · 气道风险交接（ent-care） ──────────────────────────
export async function listEntAirwayRiskHandovers(lease: ContextLeaseWire): Promise<EntAirwayRiskHandoverWire[]> {
  return entAirwayRiskHandoverWireSchema.array().parse(await request(
    `/ent-airway-risk-handovers?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntAirwayRiskHandover(
  lease: ContextLeaseWire,
  input: Omit<EntAirwayRiskHandoverCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntAirwayRiskHandoverWire> {
  return entAirwayRiskHandoverWireSchema.parse(await request(
    '/ent-airway-risk-handovers',
    createInit(lease, entAirwayRiskHandoverCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 口腔 · 治疗记录（dental-treatment） ────────────────────────
export async function listDentalTreatmentRecords(lease: ContextLeaseWire): Promise<DentalTreatmentRecordWire[]> {
  return dentalTreatmentRecordWireSchema.array().parse(await request(
    `/dental-treatment-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalTreatmentRecord(
  lease: ContextLeaseWire,
  input: Omit<DentalTreatmentRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalTreatmentRecordWire> {
  return dentalTreatmentRecordWireSchema.parse(await request(
    '/dental-treatment-records',
    createInit(lease, dentalTreatmentRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 皮肤 · 生物制剂筛查（dermatology-treatment） ──────────────
export async function listDermatologyBiologicScreenings(lease: ContextLeaseWire): Promise<DermatologyBiologicScreeningWire[]> {
  return dermatologyBiologicScreeningWireSchema.array().parse(await request(
    `/dermatology-biologic-screenings?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyBiologicScreening(
  lease: ContextLeaseWire,
  input: Omit<DermatologyBiologicScreeningCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyBiologicScreeningWire> {
  return dermatologyBiologicScreeningWireSchema.parse(await request(
    '/dermatology-biologic-screenings',
    createInit(lease, dermatologyBiologicScreeningCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 皮肤 · 生物制剂随访（dermatology-followup） ───────────────
export async function listDermatologyBiologicFollowups(lease: ContextLeaseWire): Promise<DermatologyBiologicFollowupWire[]> {
  return dermatologyBiologicFollowupWireSchema.array().parse(await request(
    `/dermatology-biologic-followups?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyBiologicFollowup(
  lease: ContextLeaseWire,
  input: Omit<DermatologyBiologicFollowupCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyBiologicFollowupWire> {
  return dermatologyBiologicFollowupWireSchema.parse(await request(
    '/dermatology-biologic-followups',
    createInit(lease, dermatologyBiologicFollowupCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 中医 · 草药处方（tcm-treatment） ───────────────────────────
export async function listTcmHerbalPrescriptions(lease: ContextLeaseWire): Promise<TcmHerbalPrescriptionWire[]> {
  return tcmHerbalPrescriptionWireSchema.array().parse(await request(
    `/tcm-herbal-prescriptions?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmHerbalPrescription(
  lease: ContextLeaseWire,
  input: Omit<TcmHerbalPrescriptionCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmHerbalPrescriptionWire> {
  return tcmHerbalPrescriptionWireSchema.parse(await request(
    '/tcm-herbal-prescriptions',
    createInit(lease, tcmHerbalPrescriptionCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 中医 · 四诊（tcm-evidence） ────────────────────────────────
export async function listTcmFourExaminations(lease: ContextLeaseWire): Promise<TcmFourExaminationsWire[]> {
  return tcmFourExaminationsWireSchema.array().parse(await request(
    `/tcm-four-examinations?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmFourExaminations(
  lease: ContextLeaseWire,
  input: Omit<TcmFourExaminationsCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmFourExaminationsWire> {
  return tcmFourExaminationsWireSchema.parse(await request(
    '/tcm-four-examinations',
    createInit(lease, tcmFourExaminationsCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 中医 · 质控复核（tcm-qc，V133） ─────────────────────────────
export async function listTcmQcReviews(lease: ContextLeaseWire): Promise<TcmQcReviewWire[]> {
  return tcmQcReviewWireSchema.array().parse(await request(
    `/tcm-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmQcReview(
  lease: ContextLeaseWire,
  input: Omit<TcmQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmQcReviewWire> {
  return tcmQcReviewWireSchema.parse(await request(
    '/tcm-qc-reviews',
    createInit(lease, tcmQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── reproductive · 质控复核（reproductive-qc） ─────────────────────────────
export async function listReproductiveQcReviews(lease: ContextLeaseWire): Promise<ReproductiveQcReviewWire[]> {
  return reproductiveQcReviewWireSchema.array().parse(await request(
    `/reproductive-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createReproductiveQcReview(
  lease: ContextLeaseWire,
  input: Omit<ReproductiveQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ReproductiveQcReviewWire> {
  return reproductiveQcReviewWireSchema.parse(await request(
    '/reproductive-qc-reviews',
    createInit(lease, reproductiveQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── pediatrics · 质控复核（pediatrics-qc） ─────────────────────────────
export async function listPediatricQcReviews(lease: ContextLeaseWire): Promise<PediatricQcReviewWire[]> {
  return pediatricQcReviewWireSchema.array().parse(await request(
    `/pediatric-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricQcReview(
  lease: ContextLeaseWire,
  input: Omit<PediatricQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricQcReviewWire> {
  return pediatricQcReviewWireSchema.parse(await request(
    '/pediatric-qc-reviews',
    createInit(lease, pediatricQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── neonatal · 质控复核（neonatal-qc） ─────────────────────────────
export async function listNeonatalQcReviews(lease: ContextLeaseWire): Promise<NeonatalQcReviewWire[]> {
  return neonatalQcReviewWireSchema.array().parse(await request(
    `/neonatal-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalQcReview(
  lease: ContextLeaseWire,
  input: Omit<NeonatalQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalQcReviewWire> {
  return neonatalQcReviewWireSchema.parse(await request(
    '/neonatal-qc-reviews',
    createInit(lease, neonatalQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── mental · 质控复核（mental-qc） ─────────────────────────────
export async function listMentalHealthQcReviews(lease: ContextLeaseWire): Promise<MentalHealthQcReviewWire[]> {
  return mentalHealthQcReviewWireSchema.array().parse(await request(
    `/mental-health-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthQcReview(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthQcReviewWire> {
  return mentalHealthQcReviewWireSchema.parse(await request(
    '/mental-health-qc-reviews',
    createInit(lease, mentalHealthQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ophthalmology · 质控复核（ophthalmology-qc） ─────────────────────────────
export async function listOphthalmologyQcReviews(lease: ContextLeaseWire): Promise<OphthalmologyQcReviewWire[]> {
  return ophthalmologyQcReviewWireSchema.array().parse(await request(
    `/ophthalmology-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyQcReview(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyQcReviewWire> {
  return ophthalmologyQcReviewWireSchema.parse(await request(
    '/ophthalmology-qc-reviews',
    createInit(lease, ophthalmologyQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ent · 质控复核（ent-qc） ─────────────────────────────
export async function listEntQcReviews(lease: ContextLeaseWire): Promise<EntQcReviewWire[]> {
  return entQcReviewWireSchema.array().parse(await request(
    `/ent-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntQcReview(
  lease: ContextLeaseWire,
  input: Omit<EntQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntQcReviewWire> {
  return entQcReviewWireSchema.parse(await request(
    '/ent-qc-reviews',
    createInit(lease, entQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dental · 质控复核（dental-qc） ─────────────────────────────
export async function listDentalQcReviews(lease: ContextLeaseWire): Promise<DentalQcReviewWire[]> {
  return dentalQcReviewWireSchema.array().parse(await request(
    `/dental-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalQcReview(
  lease: ContextLeaseWire,
  input: Omit<DentalQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalQcReviewWire> {
  return dentalQcReviewWireSchema.parse(await request(
    '/dental-qc-reviews',
    createInit(lease, dentalQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dermatology · 质控复核（dermatology-qc） ─────────────────────────────
export async function listDermatologyQcReviews(lease: ContextLeaseWire): Promise<DermatologyQcReviewWire[]> {
  return dermatologyQcReviewWireSchema.array().parse(await request(
    `/dermatology-qc-reviews?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyQcReview(
  lease: ContextLeaseWire,
  input: Omit<DermatologyQcReviewCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyQcReviewWire> {
  return dermatologyQcReviewWireSchema.parse(await request(
    '/dermatology-qc-reviews',
    createInit(lease, dermatologyQcReviewCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── neonatal · 随访（neonatal-followup，V142） ─────────────
export async function listNeonatalFollowupRecords(lease: ContextLeaseWire): Promise<NeonatalFollowupRecordWire[]> {
  return neonatalFollowupRecordWireSchema.array().parse(await request(
    `/neonatal-followup-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalFollowupRecord(
  lease: ContextLeaseWire,
  input: Omit<NeonatalFollowupRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalFollowupRecordWire> {
  return neonatalFollowupRecordWireSchema.parse(await request(
    '/neonatal-followup-records',
    createInit(lease, neonatalFollowupRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ent · 随访（ent-followup，V143） ─────────────
export async function listEntFollowupRecords(lease: ContextLeaseWire): Promise<EntFollowupRecordWire[]> {
  return entFollowupRecordWireSchema.array().parse(await request(
    `/ent-followup-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntFollowupRecord(
  lease: ContextLeaseWire,
  input: Omit<EntFollowupRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntFollowupRecordWire> {
  return entFollowupRecordWireSchema.parse(await request(
    '/ent-followup-records',
    createInit(lease, entFollowupRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dental · 随访（dental-followup，V144） ─────────────
export async function listDentalFollowupRecords(lease: ContextLeaseWire): Promise<DentalFollowupRecordWire[]> {
  return dentalFollowupRecordWireSchema.array().parse(await request(
    `/dental-followup-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalFollowupRecord(
  lease: ContextLeaseWire,
  input: Omit<DentalFollowupRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalFollowupRecordWire> {
  return dentalFollowupRecordWireSchema.parse(await request(
    '/dental-followup-records',
    createInit(lease, dentalFollowupRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── tcm · 随访（tcm-followup，V145） ─────────────
export async function listTcmFollowupRecords(lease: ContextLeaseWire): Promise<TcmFollowupRecordWire[]> {
  return tcmFollowupRecordWireSchema.array().parse(await request(
    `/tcm-followup-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmFollowupRecord(
  lease: ContextLeaseWire,
  input: Omit<TcmFollowupRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmFollowupRecordWire> {
  return tcmFollowupRecordWireSchema.parse(await request(
    '/tcm-followup-records',
    createInit(lease, tcmFollowupRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── obgyn · 护理（obgyn-care） ─────────────────────────────
export async function listObstetricCareNotes(lease: ContextLeaseWire): Promise<ObstetricCareNoteWire[]> {
  return obstetricCareNoteWireSchema.array().parse(await request(
    `/obstetric-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricCareNote(
  lease: ContextLeaseWire,
  input: Omit<ObstetricCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricCareNoteWire> {
  return obstetricCareNoteWireSchema.parse(await request(
    '/obstetric-care-notes',
    createInit(lease, obstetricCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── reproductive · 护理（reproductive-care） ─────────────────────────────
export async function listReproductiveCareNotes(lease: ContextLeaseWire): Promise<ReproductiveCareNoteWire[]> {
  return reproductiveCareNoteWireSchema.array().parse(await request(
    `/reproductive-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createReproductiveCareNote(
  lease: ContextLeaseWire,
  input: Omit<ReproductiveCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ReproductiveCareNoteWire> {
  return reproductiveCareNoteWireSchema.parse(await request(
    '/reproductive-care-notes',
    createInit(lease, reproductiveCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ophthalmology · 护理（ophthalmology-care） ─────────────────────────────
export async function listOphthalmologyCareNotes(lease: ContextLeaseWire): Promise<OphthalmologyCareNoteWire[]> {
  return ophthalmologyCareNoteWireSchema.array().parse(await request(
    `/ophthalmology-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyCareNote(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyCareNoteWire> {
  return ophthalmologyCareNoteWireSchema.parse(await request(
    '/ophthalmology-care-notes',
    createInit(lease, ophthalmologyCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dental · 护理（dental-care） ─────────────────────────────
export async function listDentalCareNotes(lease: ContextLeaseWire): Promise<DentalCareNoteWire[]> {
  return dentalCareNoteWireSchema.array().parse(await request(
    `/dental-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalCareNote(
  lease: ContextLeaseWire,
  input: Omit<DentalCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalCareNoteWire> {
  return dentalCareNoteWireSchema.parse(await request(
    '/dental-care-notes',
    createInit(lease, dentalCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dermatology · 护理（dermatology-care） ─────────────────────────────
export async function listDermatologyCareNotes(lease: ContextLeaseWire): Promise<DermatologyCareNoteWire[]> {
  return dermatologyCareNoteWireSchema.array().parse(await request(
    `/dermatology-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyCareNote(
  lease: ContextLeaseWire,
  input: Omit<DermatologyCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyCareNoteWire> {
  return dermatologyCareNoteWireSchema.parse(await request(
    '/dermatology-care-notes',
    createInit(lease, dermatologyCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── tcm · 护理（tcm-care） ─────────────────────────────
export async function listTcmCareNotes(lease: ContextLeaseWire): Promise<TcmCareNoteWire[]> {
  return tcmCareNoteWireSchema.array().parse(await request(
    `/tcm-care-notes?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmCareNote(
  lease: ContextLeaseWire,
  input: Omit<TcmCareNoteCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmCareNoteWire> {
  return tcmCareNoteWireSchema.parse(await request(
    '/tcm-care-notes',
    createInit(lease, tcmCareNoteCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── reproductive · reproductive-evidence ─────────────────────────────
export async function listReproductiveEvidences(lease: ContextLeaseWire): Promise<ReproductiveEvidenceWire[]> {
  return reproductiveEvidenceWireSchema.array().parse(await request(
    `/reproductive-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createReproductiveEvidence(
  lease: ContextLeaseWire,
  input: Omit<ReproductiveEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ReproductiveEvidenceWire> {
  return reproductiveEvidenceWireSchema.parse(await request(
    '/reproductive-evidence-records',
    createInit(lease, reproductiveEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── pediatrics · pediatrics-evidence ─────────────────────────────
export async function listPediatricEvidences(lease: ContextLeaseWire): Promise<PediatricEvidenceWire[]> {
  return pediatricEvidenceWireSchema.array().parse(await request(
    `/pediatric-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricEvidence(
  lease: ContextLeaseWire,
  input: Omit<PediatricEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricEvidenceWire> {
  return pediatricEvidenceWireSchema.parse(await request(
    '/pediatric-evidence-records',
    createInit(lease, pediatricEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── mental · mental-evidence ─────────────────────────────
export async function listMentalHealthEvidences(lease: ContextLeaseWire): Promise<MentalHealthEvidenceWire[]> {
  return mentalHealthEvidenceWireSchema.array().parse(await request(
    `/mental-health-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthEvidence(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthEvidenceWire> {
  return mentalHealthEvidenceWireSchema.parse(await request(
    '/mental-health-evidence-records',
    createInit(lease, mentalHealthEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ophthalmology · ophthalmology-evidence ─────────────────────────────
export async function listOphthalmologyEvidences(lease: ContextLeaseWire): Promise<OphthalmologyEvidenceWire[]> {
  return ophthalmologyEvidenceWireSchema.array().parse(await request(
    `/ophthalmology-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyEvidence(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyEvidenceWire> {
  return ophthalmologyEvidenceWireSchema.parse(await request(
    '/ophthalmology-evidence-records',
    createInit(lease, ophthalmologyEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ent · ent-evidence ─────────────────────────────
export async function listEntEvidences(lease: ContextLeaseWire): Promise<EntEvidenceWire[]> {
  return entEvidenceWireSchema.array().parse(await request(
    `/ent-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntEvidence(
  lease: ContextLeaseWire,
  input: Omit<EntEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntEvidenceWire> {
  return entEvidenceWireSchema.parse(await request(
    '/ent-evidence-records',
    createInit(lease, entEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dental · dental-evidence ─────────────────────────────
export async function listDentalEvidences(lease: ContextLeaseWire): Promise<DentalEvidenceWire[]> {
  return dentalEvidenceWireSchema.array().parse(await request(
    `/dental-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalEvidence(
  lease: ContextLeaseWire,
  input: Omit<DentalEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalEvidenceWire> {
  return dentalEvidenceWireSchema.parse(await request(
    '/dental-evidence-records',
    createInit(lease, dentalEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── dermatology · dermatology-evidence ─────────────────────────────
export async function listDermatologyEvidences(lease: ContextLeaseWire): Promise<DermatologyEvidenceWire[]> {
  return dermatologyEvidenceWireSchema.array().parse(await request(
    `/dermatology-evidence-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyEvidence(
  lease: ContextLeaseWire,
  input: Omit<DermatologyEvidenceCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyEvidenceWire> {
  return dermatologyEvidenceWireSchema.parse(await request(
    '/dermatology-evidence-records',
    createInit(lease, dermatologyEvidenceCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── pediatrics · pediatrics-treatment ─────────────────────────────
export async function listPediatricTreatments(lease: ContextLeaseWire): Promise<PediatricTreatmentWire[]> {
  return pediatricTreatmentWireSchema.array().parse(await request(
    `/pediatric-treatment-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricTreatment(
  lease: ContextLeaseWire,
  input: Omit<PediatricTreatmentCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricTreatmentWire> {
  return pediatricTreatmentWireSchema.parse(await request(
    '/pediatric-treatment-records',
    createInit(lease, pediatricTreatmentCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── neonatal · neonatal-treatment ─────────────────────────────
export async function listNeonatalTreatments(lease: ContextLeaseWire): Promise<NeonatalTreatmentWire[]> {
  return neonatalTreatmentWireSchema.array().parse(await request(
    `/neonatal-treatment-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalTreatment(
  lease: ContextLeaseWire,
  input: Omit<NeonatalTreatmentCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalTreatmentWire> {
  return neonatalTreatmentWireSchema.parse(await request(
    '/neonatal-treatment-records',
    createInit(lease, neonatalTreatmentCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── mental · mental-treatment ─────────────────────────────
export async function listMentalHealthTreatments(lease: ContextLeaseWire): Promise<MentalHealthTreatmentWire[]> {
  return mentalHealthTreatmentWireSchema.array().parse(await request(
    `/mental-health-treatment-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthTreatment(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthTreatmentCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthTreatmentWire> {
  return mentalHealthTreatmentWireSchema.parse(await request(
    '/mental-health-treatment-records',
    createInit(lease, mentalHealthTreatmentCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}


// ── ent · ent-treatment ─────────────────────────────
export async function listEntTreatments(lease: ContextLeaseWire): Promise<EntTreatmentWire[]> {
  return entTreatmentWireSchema.array().parse(await request(
    `/ent-treatment-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntTreatment(
  lease: ContextLeaseWire,
  input: Omit<EntTreatmentCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntTreatmentWire> {
  return entTreatmentWireSchema.parse(await request(
    '/ent-treatment-records',
    createInit(lease, entTreatmentCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}
