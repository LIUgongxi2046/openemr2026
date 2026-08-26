import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  scopedHeaders,
} from '../clinical-api';
import {
  artCycleRecordCreateRequestWireSchema,
  artCycleRecordWireSchema,
  dentalRecordCreateRequestWireSchema,
  dentalRecordWireSchema,
  dermatologyRecordCreateRequestWireSchema,
  dermatologyRecordWireSchema,
  entRecordCreateRequestWireSchema,
  entRecordWireSchema,
  mentalHealthRecordCreateRequestWireSchema,
  mentalHealthRecordWireSchema,
  neonatalRecordCreateRequestWireSchema,
  neonatalRecordWireSchema,
  obstetricRecordCreateRequestWireSchema,
  obstetricRecordWireSchema,
  ophthalmologyRecordCreateRequestWireSchema,
  ophthalmologyRecordWireSchema,
  pediatricRecordCreateRequestWireSchema,
  pediatricRecordWireSchema,
  tcmRecordCreateRequestWireSchema,
  tcmRecordWireSchema,
  type ArtCycleRecordCreateRequestWire,
  type ArtCycleRecordWire,
  type ContextLeaseWire,
  type DentalRecordCreateRequestWire,
  type DentalRecordWire,
  type DermatologyRecordCreateRequestWire,
  type DermatologyRecordWire,
  type EntRecordCreateRequestWire,
  type EntRecordWire,
  type MentalHealthRecordCreateRequestWire,
  type MentalHealthRecordWire,
  type NeonatalRecordCreateRequestWire,
  type NeonatalRecordWire,
  type ObstetricRecordCreateRequestWire,
  type ObstetricRecordWire,
  type OphthalmologyRecordCreateRequestWire,
  type OphthalmologyRecordWire,
  type PediatricRecordCreateRequestWire,
  type PediatricRecordWire,
  type TcmRecordCreateRequestWire,
  type TcmRecordWire,
} from '../generated/contracts';

/**
 * 专科记录层（妇产/生殖/儿科/新生儿/精神心理/眼科/耳鼻喉/口腔/皮肤/中医）API 客户端。
 * LIST 端点按 (org, facility, patient, null) 授权 → 患者级租约；CREATE 端点按 (org, facility, patient, encounter) 授权 → 患者+就诊租约。
 */
export function issueSpecialtyPatientLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, null, purpose);
}

export function issueSpecialtyEncounterLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, purpose);
}

/** 患者 + 就诊级别的命令上下文（所有专科记录写操作都需要）。 */
function scoped() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
    encounter_id: clinicalContext.encounterId,
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

// ── 妇产 ────────────────────────────────────────────────────
export async function listObstetricRecords(lease: ContextLeaseWire): Promise<ObstetricRecordWire[]> {
  return obstetricRecordWireSchema.array().parse(await request(
    `/obstetric-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createObstetricRecord(
  lease: ContextLeaseWire,
  input: Omit<ObstetricRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ObstetricRecordWire> {
  return obstetricRecordWireSchema.parse(await request(
    '/obstetric-records',
    createInit(lease, obstetricRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 生殖 ────────────────────────────────────────────────────
export async function listArtCycleRecords(lease: ContextLeaseWire): Promise<ArtCycleRecordWire[]> {
  return artCycleRecordWireSchema.array().parse(await request(
    `/art-cycle-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createArtCycleRecord(
  lease: ContextLeaseWire,
  input: Omit<ArtCycleRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<ArtCycleRecordWire> {
  return artCycleRecordWireSchema.parse(await request(
    '/art-cycle-records',
    createInit(lease, artCycleRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 儿科 ────────────────────────────────────────────────────
export async function listPediatricRecords(lease: ContextLeaseWire): Promise<PediatricRecordWire[]> {
  return pediatricRecordWireSchema.array().parse(await request(
    `/pediatric-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createPediatricRecord(
  lease: ContextLeaseWire,
  input: Omit<PediatricRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<PediatricRecordWire> {
  return pediatricRecordWireSchema.parse(await request(
    '/pediatric-records',
    createInit(lease, pediatricRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 新生儿 ──────────────────────────────────────────────────
export async function listNeonatalRecords(lease: ContextLeaseWire): Promise<NeonatalRecordWire[]> {
  return neonatalRecordWireSchema.array().parse(await request(
    `/neonatal-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createNeonatalRecord(
  lease: ContextLeaseWire,
  input: Omit<NeonatalRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<NeonatalRecordWire> {
  return neonatalRecordWireSchema.parse(await request(
    '/neonatal-records',
    createInit(lease, neonatalRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 精神心理 ────────────────────────────────────────────────
export async function listMentalHealthRecords(lease: ContextLeaseWire): Promise<MentalHealthRecordWire[]> {
  return mentalHealthRecordWireSchema.array().parse(await request(
    `/mental-health-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createMentalHealthRecord(
  lease: ContextLeaseWire,
  input: Omit<MentalHealthRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<MentalHealthRecordWire> {
  return mentalHealthRecordWireSchema.parse(await request(
    '/mental-health-records',
    createInit(lease, mentalHealthRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 眼科 ────────────────────────────────────────────────────
export async function listOphthalmologyRecords(lease: ContextLeaseWire): Promise<OphthalmologyRecordWire[]> {
  return ophthalmologyRecordWireSchema.array().parse(await request(
    `/ophthalmology-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createOphthalmologyRecord(
  lease: ContextLeaseWire,
  input: Omit<OphthalmologyRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<OphthalmologyRecordWire> {
  return ophthalmologyRecordWireSchema.parse(await request(
    '/ophthalmology-records',
    createInit(lease, ophthalmologyRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 耳鼻喉 ──────────────────────────────────────────────────
export async function listEntRecords(lease: ContextLeaseWire): Promise<EntRecordWire[]> {
  return entRecordWireSchema.array().parse(await request(
    `/ent-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createEntRecord(
  lease: ContextLeaseWire,
  input: Omit<EntRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<EntRecordWire> {
  return entRecordWireSchema.parse(await request(
    '/ent-records',
    createInit(lease, entRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 口腔 ────────────────────────────────────────────────────
export async function listDentalRecords(lease: ContextLeaseWire): Promise<DentalRecordWire[]> {
  return dentalRecordWireSchema.array().parse(await request(
    `/dental-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDentalRecord(
  lease: ContextLeaseWire,
  input: Omit<DentalRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DentalRecordWire> {
  return dentalRecordWireSchema.parse(await request(
    '/dental-records',
    createInit(lease, dentalRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 皮肤 ────────────────────────────────────────────────────
export async function listDermatologyRecords(lease: ContextLeaseWire): Promise<DermatologyRecordWire[]> {
  return dermatologyRecordWireSchema.array().parse(await request(
    `/dermatology-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createDermatologyRecord(
  lease: ContextLeaseWire,
  input: Omit<DermatologyRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<DermatologyRecordWire> {
  return dermatologyRecordWireSchema.parse(await request(
    '/dermatology-records',
    createInit(lease, dermatologyRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}

// ── 中医 ────────────────────────────────────────────────────
export async function listTcmRecords(lease: ContextLeaseWire): Promise<TcmRecordWire[]> {
  return tcmRecordWireSchema.array().parse(await request(
    `/tcm-records?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createTcmRecord(
  lease: ContextLeaseWire,
  input: Omit<TcmRecordCreateRequestWire, 'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id'>,
): Promise<TcmRecordWire> {
  return tcmRecordWireSchema.parse(await request(
    '/tcm-records',
    createInit(lease, tcmRecordCreateRequestWireSchema.parse({ ...scoped(), ...input })),
  ));
}
