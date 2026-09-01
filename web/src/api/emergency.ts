import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  wardHeaders,
} from '../clinical-api';
import { z } from 'zod';
import {
  appointmentBookRequestWireSchema,
  appointmentCancelRequestWireSchema,
  appointmentCheckInRequestWireSchema,
  appointmentConsultRequestWireSchema,
  appointmentRescheduleRequestWireSchema,
  appointmentWireSchema,
  emergencyNursingNoteCreateRequestWireSchema,
  emergencyNursingNoteCorrectionRequestWireSchema,
  emergencyNursingNoteWireSchema,
  emergencyIdentityVerificationCreateRequestWireSchema,
  emergencyIdentityVerificationWireSchema,
  emergencyCoordinationCaseCreateRequestWireSchema,
  emergencyCoordinationCaseTransitionRequestWireSchema,
  emergencyCoordinationCaseUpdateRequestWireSchema,
  emergencyCoordinationCaseVoidRequestWireSchema,
  emergencyCoordinationCaseWireSchema,
  emergencyClinicalFactVoidRequestWireSchema,
  emergencyObservationCompleteRequestWireSchema,
  emergencyObservationStartRequestWireSchema,
  emergencyObservationWireSchema,
  emergencyPreadmissionLinkRequestWireSchema,
  emergencyPreadmissionRegisterRequestWireSchema,
  emergencyPreadmissionUpdateRequestWireSchema,
  emergencyPreadmissionVoidRequestWireSchema,
  emergencyPreadmissionWireSchema,
  emergencyResuscitationCompleteRequestWireSchema,
  emergencyResuscitationStartRequestWireSchema,
  emergencyResuscitationWireSchema,
  emergencyTriageAssessmentCreateRequestWireSchema,
  emergencyTriageAssessmentWireSchema,
  encounterDomainSwitchRecordRequestWireSchema,
  encounterDomainSwitchCorrectionRequestWireSchema,
  encounterDomainSwitchVoidRequestWireSchema,
  encounterDomainSwitchWireSchema,
  referralCreateRequestWireSchema,
  referralTransitionRequestWireSchema,
  referralUpdateRequestWireSchema,
  referralWireSchema,
  scheduleSlotCreateRequestWireSchema,
  scheduleSlotWireSchema,
  shiftHandoverCompleteRequestWireSchema,
  shiftHandoverCorrectionRequestWireSchema,
  shiftHandoverCreateRequestWireSchema,
  shiftHandoverPatientCreateRequestWireSchema,
  shiftHandoverPatientCorrectionRequestWireSchema,
  shiftHandoverPatientVoidRequestWireSchema,
  shiftHandoverPatientWireSchema,
  shiftHandoverVoidRequestWireSchema,
  shiftHandoverWireSchema,
  waitingQueueCallRequestWireSchema,
  waitingQueueEntryWireSchema,
  vitalSignRecordRequestWireSchema,
  vitalSignRecordWireSchema,
  type AppointmentWire,
  type ContextLeaseWire,
  type EmergencyNursingNoteWire,
  type EmergencyIdentityVerificationWire,
  type EmergencyCoordinationCaseWire,
  type EmergencyObservationWire,
  type EmergencyPreadmissionWire,
  type EmergencyResuscitationWire,
  type EmergencyTriageAssessmentWire,
  type EncounterDomainSwitchWire,
  type ReferralWire,
  type ScheduleSlotWire,
  type ShiftHandoverPatientWire,
  type ShiftHandoverWire,
  type WaitingQueueEntryWire,
  type VitalSignRecordWire,
} from '../generated/contracts';
import { localCalendarDate } from '../local-date';

/** 急诊/门急诊域的患者级租约：authorize 均传 encounter=null，故仅按患者签发。 */
export function issueEmergencyLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.emergencyPatientId, null, purpose);
}

/** 急诊就诊级租约：用于会产生临床事实的新建、更正、作废和流转动作。 */
export function issueEmergencyEncounterLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.emergencyPatientId, clinicalContext.emergencyEncounterId, purpose);
}

/** 门诊患者级租约：预约与转诊列表必须与普通门诊患者上下文一致。 */
export function issueOutpatientPatientLease(purpose: string, patientId = clinicalContext.patientId): Promise<ContextLeaseWire> {
  return issueContextLease(patientId, null, purpose);
}

export function issueHandoverPatientLease(patientId: string, purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(patientId, null, purpose);
}

/** 患者级（无就诊）请求头：不携带 X-Encounter-Context。 */
function emergencyPatientHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.emergencyPatientId, null);
}

/** 急诊就诊级请求头：与写操作中的 patient/encounter 严格一致。 */
function emergencyEncounterHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.emergencyPatientId, clinicalContext.emergencyEncounterId);
}

function patientOnlyHeaders(lease: ContextLeaseWire, patientId = clinicalContext.patientId) {
  return explicitContextHeaders(lease, patientId, null);
}

/** 机构-院区级租约：用于预检分诊、预入院、候诊队列等院区范围视图。 */
export function issueEmergencyFacilityLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, purpose);
}

function orgFacility() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
  };
}

function emergencyPatientEncounter() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.emergencyPatientId,
    encounter_id: clinicalContext.emergencyEncounterId,
  };
}

function emergencyPatientOnly() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.emergencyPatientId,
  };
}

function patientEncounter() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
    encounter_id: clinicalContext.encounterId,
  };
}

function patientOnly() {
  return {
    organization_id: clinicalContext.organizationId,
    facility_id: clinicalContext.facilityId,
    patient_id: clinicalContext.patientId,
  };
}

// ── 急诊床旁身份与生命体征核验 ────────────────────────
export async function listEmergencyIdentityVerifications(
  lease: ContextLeaseWire,
): Promise<EmergencyIdentityVerificationWire[]> {
  return emergencyIdentityVerificationWireSchema.array().parse(await request(
    `/emergency-identity-verifications?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

export async function verifyEmergencyIdentity(
  lease: ContextLeaseWire,
  identifierValue: string,
  purpose: 'MEDICATION' | 'INFUSION' | 'SPECIMEN' | 'TRANSFER' | 'GENERAL',
): Promise<EmergencyIdentityVerificationWire> {
  return emergencyIdentityVerificationWireSchema.parse(await request('/emergency-identity-verifications', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyIdentityVerificationCreateRequestWireSchema.parse({
      ...emergencyPatientEncounter(), identifier_value: identifierValue, verification_purpose: purpose,
      verified_at: new Date().toISOString(),
    })),
  }));
}

export async function listEmergencyVitalSigns(lease: ContextLeaseWire): Promise<VitalSignRecordWire[]> {
  return vitalSignRecordWireSchema.array().parse(await request(
    `/vital-signs?encounter_id=${encodeURIComponent(clinicalContext.emergencyEncounterId)}`,
    { headers: emergencyEncounterHeaders(lease) },
  ));
}

export async function recordEmergencyVitalSigns(
  lease: ContextLeaseWire,
  input: Omit<import('../generated/contracts').VitalSignRecordRequestWire,
    'organization_id' | 'facility_id' | 'patient_id' | 'encounter_id' | 'admission_id'>,
): Promise<VitalSignRecordWire> {
  return vitalSignRecordWireSchema.parse(await request('/vital-signs', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(vitalSignRecordRequestWireSchema.parse({
      ...emergencyPatientEncounter(), admission_id: null, ...input,
    })),
  }));
}

// ── 急会诊、急诊交接与转运协同 ───────────────────
export async function listEmergencyCoordinationCases(lease: ContextLeaseWire): Promise<EmergencyCoordinationCaseWire[]> {
  return emergencyCoordinationCaseWireSchema.array().parse(await request(
    `/emergency-coordination-cases?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

type CoordinationInput = {
  case_type: 'CONSULTATION' | 'HANDOFF' | 'TRANSFER'; priority: 'IMMEDIATE' | 'URGENT' | 'ROUTINE';
  target_unit: string; requested_to: string | null; summary: string; risk_summary: string; due_at: string;
};

export async function createEmergencyCoordinationCase(lease: ContextLeaseWire, input: CoordinationInput): Promise<EmergencyCoordinationCaseWire> {
  return emergencyCoordinationCaseWireSchema.parse(await request('/emergency-coordination-cases', {
    method: 'POST', headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyCoordinationCaseCreateRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

export async function updateEmergencyCoordinationCase(lease: ContextLeaseWire, item: EmergencyCoordinationCaseWire, input: Omit<CoordinationInput, 'case_type'>): Promise<EmergencyCoordinationCaseWire> {
  return emergencyCoordinationCaseWireSchema.parse(await request(`/emergency-coordination-cases/${item.coordination_case_id}`, {
    method: 'PUT', headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyCoordinationCaseUpdateRequestWireSchema.parse({ ...emergencyPatientEncounter(), expected_row_version: item.row_version, ...input })),
  }));
}

export async function transitionEmergencyCoordinationCase(lease: ContextLeaseWire, item: EmergencyCoordinationCaseWire, transition: 'ACKNOWLEDGE' | 'COMPLETE'): Promise<EmergencyCoordinationCaseWire> {
  return emergencyCoordinationCaseWireSchema.parse(await request(`/emergency-coordination-cases/${item.coordination_case_id}/transitions`, {
    method: 'POST', headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyCoordinationCaseTransitionRequestWireSchema.parse({ ...emergencyPatientEncounter(), expected_row_version: item.row_version, transition })),
  }));
}

export async function voidEmergencyCoordinationCase(lease: ContextLeaseWire, item: EmergencyCoordinationCaseWire, reason: string): Promise<EmergencyCoordinationCaseWire> {
  return emergencyCoordinationCaseWireSchema.parse(await request(`/emergency-coordination-cases/${item.coordination_case_id}/voids`, {
    method: 'POST', headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyCoordinationCaseVoidRequestWireSchema.parse({ ...emergencyPatientEncounter(), expected_row_version: item.row_version, reason })),
  }));
}

// ── 急诊预检分诊（er-triage）────────────────────────────────
export async function listEmergencyTriageAssessments(lease: ContextLeaseWire): Promise<EmergencyTriageAssessmentWire[]> {
  return emergencyTriageAssessmentWireSchema.array().parse(await request(
    `/emergency-triage-assessments?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

export async function createEmergencyTriageAssessment(
  lease: ContextLeaseWire,
  input: { triage_level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; chief_complaint: string; triaged_at: string; immediate_action_required: boolean },
): Promise<EmergencyTriageAssessmentWire> {
  return emergencyTriageAssessmentWireSchema.parse(await request('/emergency-triage-assessments', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyTriageAssessmentCreateRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

export async function voidEmergencyTriageAssessment(lease: ContextLeaseWire, item: EmergencyTriageAssessmentWire, reason: string): Promise<EmergencyTriageAssessmentWire> {
  return emergencyTriageAssessmentWireSchema.parse(await request(`/emergency-triage-assessments/${item.triage_assessment_id}/voids`, {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyClinicalFactVoidRequestWireSchema.parse({
      ...emergencyPatientEncounter(), expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 急诊抢救留观与去向（er-observation）─────────────────────
export async function listEmergencyObservations(lease: ContextLeaseWire): Promise<EmergencyObservationWire[]> {
  return emergencyObservationWireSchema.array().parse(await request(
    `/emergency-observations?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

export async function startEmergencyObservation(
  lease: ContextLeaseWire,
  input: { observation_started_at: string },
): Promise<EmergencyObservationWire> {
  return emergencyObservationWireSchema.parse(await request('/emergency-observations', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyObservationStartRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

export async function completeEmergencyObservation(
  lease: ContextLeaseWire,
  observation: EmergencyObservationWire,
  disposition: 'DISCHARGED' | 'ADMITTED' | 'TRANSFERRED',
): Promise<EmergencyObservationWire> {
  return emergencyObservationWireSchema.parse(await request(
    `/emergency-observations/${observation.observation_id}/completions`, {
      method: 'POST',
      headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(emergencyObservationCompleteRequestWireSchema.parse({
        ...emergencyPatientEncounter(), expected_row_version: observation.row_version, disposition,
      })),
    },
  ));
}

export async function voidEmergencyObservation(lease: ContextLeaseWire, item: EmergencyObservationWire, reason: string): Promise<EmergencyObservationWire> {
  return emergencyObservationWireSchema.parse(await request(`/emergency-observations/${item.observation_id}/voids`, {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyClinicalFactVoidRequestWireSchema.parse({
      ...emergencyPatientEncounter(), expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 急诊抢救记录（er-record）────────────────────────────────
export async function listEmergencyResuscitations(lease: ContextLeaseWire): Promise<EmergencyResuscitationWire[]> {
  return emergencyResuscitationWireSchema.array().parse(await request(
    `/emergency-resuscitations?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

export async function startEmergencyResuscitation(
  lease: ContextLeaseWire,
  input: { started_at: string },
): Promise<EmergencyResuscitationWire> {
  return emergencyResuscitationWireSchema.parse(await request('/emergency-resuscitations', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyResuscitationStartRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

export async function completeEmergencyResuscitation(
  lease: ContextLeaseWire,
  resuscitation: EmergencyResuscitationWire,
  outcome: 'ROSC' | 'DEATH' | 'TRANSFERRED',
): Promise<EmergencyResuscitationWire> {
  return emergencyResuscitationWireSchema.parse(await request(
    `/emergency-resuscitations/${resuscitation.resuscitation_id}/completions`, {
      method: 'POST',
      headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(emergencyResuscitationCompleteRequestWireSchema.parse({
        ...emergencyPatientEncounter(), expected_row_version: resuscitation.row_version, outcome,
      })),
    },
  ));
}

export async function voidEmergencyResuscitation(lease: ContextLeaseWire, item: EmergencyResuscitationWire, reason: string): Promise<EmergencyResuscitationWire> {
  return emergencyResuscitationWireSchema.parse(await request(`/emergency-resuscitations/${item.resuscitation_id}/voids`, {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyClinicalFactVoidRequestWireSchema.parse({
      ...emergencyPatientEncounter(), expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 急诊护理记录（er-nursing）───────────────────────────────
export async function listEmergencyNursingNotes(lease: ContextLeaseWire): Promise<EmergencyNursingNoteWire[]> {
  return emergencyNursingNoteWireSchema.array().parse(await request(
    `/emergency-nursing-notes?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.encounter_id === clinicalContext.emergencyEncounterId);
}

export async function createEmergencyNursingNote(
  lease: ContextLeaseWire,
  input: { assessment: string; intervention: string; risk_flag: boolean; recorded_at: string },
): Promise<EmergencyNursingNoteWire> {
  return emergencyNursingNoteWireSchema.parse(await request('/emergency-nursing-notes', {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyNursingNoteCreateRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

export async function voidEmergencyNursingNote(lease: ContextLeaseWire, item: EmergencyNursingNoteWire, reason: string): Promise<EmergencyNursingNoteWire> {
  return emergencyNursingNoteWireSchema.parse(await request(`/emergency-nursing-notes/${item.note_id}/voids`, {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyClinicalFactVoidRequestWireSchema.parse({
      ...emergencyPatientEncounter(), expected_row_version: item.row_version, reason,
    })),
  }));
}

export async function correctEmergencyNursingNote(
  lease: ContextLeaseWire,
  item: EmergencyNursingNoteWire,
  input: { assessment: string; intervention: string; risk_flag: boolean; recorded_at: string; reason: string },
): Promise<EmergencyNursingNoteWire> {
  return emergencyNursingNoteWireSchema.parse(await request(`/emergency-nursing-notes/${item.note_id}/corrections`, {
    method: 'POST',
    headers: { ...emergencyEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyNursingNoteCorrectionRequestWireSchema.parse({
      ...emergencyPatientEncounter(), expected_row_version: item.row_version, ...input,
    })),
  }));
}

// ── 急诊预入院（er-handoff / emergency 总览共用）─────────────
export async function listEmergencyPreadmissions(lease: ContextLeaseWire): Promise<EmergencyPreadmissionWire[]> {
  return emergencyPreadmissionWireSchema.array().parse(await request(
    `/emergency-preadmissions?facility_id=${encodeURIComponent(clinicalContext.facilityId)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function registerEmergencyPreadmission(
  lease: ContextLeaseWire,
  input: { temporary_identifier: string; reason: string },
): Promise<EmergencyPreadmissionWire> {
  return emergencyPreadmissionWireSchema.parse(await request('/emergency-preadmissions', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyPreadmissionRegisterRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function linkEmergencyPreadmission(
  lease: ContextLeaseWire,
  preadmission: EmergencyPreadmissionWire,
  registeredPatientId: string,
): Promise<EmergencyPreadmissionWire> {
  return emergencyPreadmissionWireSchema.parse(await request(
    `/emergency-preadmissions/${preadmission.preadmission_id}/links`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(emergencyPreadmissionLinkRequestWireSchema.parse({
        ...orgFacility(), registered_patient_id: registeredPatientId, expected_row_version: preadmission.row_version,
      })),
    },
  ));
}

export async function updateEmergencyPreadmission(
  lease: ContextLeaseWire,
  item: EmergencyPreadmissionWire,
  input: { temporary_identifier: string; reason: string },
): Promise<EmergencyPreadmissionWire> {
  return emergencyPreadmissionWireSchema.parse(await request(`/emergency-preadmissions/${item.preadmission_id}`, {
    method: 'PUT',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyPreadmissionUpdateRequestWireSchema.parse({
      ...orgFacility(), ...input, expected_row_version: item.row_version,
    })),
  }));
}

export async function voidEmergencyPreadmission(
  lease: ContextLeaseWire,
  item: EmergencyPreadmissionWire,
  reason: string,
): Promise<EmergencyPreadmissionWire> {
  return emergencyPreadmissionWireSchema.parse(await request(`/emergency-preadmissions/${item.preadmission_id}/voids`, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyPreadmissionVoidRequestWireSchema.parse({
      ...orgFacility(), expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 域切换（er-handoff 转运 / opd-consult 转诊）──────────────
export async function listEncounterDomainSwitches(lease: ContextLeaseWire): Promise<EncounterDomainSwitchWire[]> {
  return encounterDomainSwitchWireSchema.array().parse(await request(
    `/encounter-domain-switches?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  )).filter((item) => item.from_encounter_id === clinicalContext.emergencyEncounterId
    || item.to_encounter_id === clinicalContext.emergencyEncounterId);
}

export async function recordEncounterDomainSwitch(
  lease: ContextLeaseWire,
  input: { from_encounter_id: string; to_encounter_id: string; from_domain: 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT'; to_domain: 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT'; reason: string; switched_at: string },
): Promise<EncounterDomainSwitchWire> {
  return encounterDomainSwitchWireSchema.parse(await request('/encounter-domain-switches', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(encounterDomainSwitchRecordRequestWireSchema.parse({ ...emergencyPatientOnly(), ...input })),
  }));
}

export async function correctEncounterDomainSwitch(
  lease: ContextLeaseWire,
  item: EncounterDomainSwitchWire,
  input: { from_encounter_id: string; to_encounter_id: string; from_domain: 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT'; to_domain: 'OUTPATIENT' | 'EMERGENCY' | 'INPATIENT'; reason: string; switched_at: string; correction_reason: string },
): Promise<EncounterDomainSwitchWire> {
  return encounterDomainSwitchWireSchema.parse(await request(`/encounter-domain-switches/${item.domain_switch_id}/corrections`, {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(encounterDomainSwitchCorrectionRequestWireSchema.parse({
      ...emergencyPatientOnly(), expected_row_version: item.row_version, ...input,
    })),
  }));
}

export async function voidEncounterDomainSwitch(lease: ContextLeaseWire, item: EncounterDomainSwitchWire, reason: string): Promise<EncounterDomainSwitchWire> {
  return encounterDomainSwitchWireSchema.parse(await request(`/encounter-domain-switches/${item.domain_switch_id}/voids`, {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(encounterDomainSwitchVoidRequestWireSchema.parse({
      ...emergencyPatientOnly(), expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 交接班（er-handoff 交接）────────────────────────────────
export async function listShiftHandovers(lease: ContextLeaseWire, wardId: string): Promise<ShiftHandoverWire[]> {
  return shiftHandoverWireSchema.array().parse(await request(
    `/shift-handovers?ward_id=${encodeURIComponent(wardId)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function createShiftHandover(
  lease: ContextLeaseWire,
  input: { ward_id: string; shift_from: string; shift_to: string; incoming_user_id: string; handover_summary: string },
): Promise<ShiftHandoverWire> {
  return shiftHandoverWireSchema.parse(await request('/shift-handovers', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(shiftHandoverCreateRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function completeShiftHandover(
  lease: ContextLeaseWire,
  handover: ShiftHandoverWire,
): Promise<ShiftHandoverWire> {
  return shiftHandoverWireSchema.parse(await request(
    `/shift-handovers/${handover.handover_id}/completions`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(shiftHandoverCompleteRequestWireSchema.parse({
        ...orgFacility(), ward_id: handover.ward_id, expected_row_version: handover.row_version,
      })),
    },
  ));
}

export async function correctShiftHandover(
  lease: ContextLeaseWire,
  handover: ShiftHandoverWire,
  input: { shift_from: string; shift_to: string; incoming_user_id: string; handover_summary: string; reason: string },
): Promise<ShiftHandoverWire> {
  return shiftHandoverWireSchema.parse(await request(`/shift-handovers/${handover.handover_id}/corrections`, {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(shiftHandoverCorrectionRequestWireSchema.parse({
      ...orgFacility(), ward_id: handover.ward_id, expected_row_version: handover.row_version, ...input,
    })),
  }));
}

export async function voidShiftHandover(
  lease: ContextLeaseWire,
  handover: ShiftHandoverWire,
  reason: string,
): Promise<ShiftHandoverWire> {
  return shiftHandoverWireSchema.parse(await request(
    `/shift-handovers/${handover.handover_id}/voids`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(shiftHandoverVoidRequestWireSchema.parse({
        ...orgFacility(), ward_id: handover.ward_id, expected_row_version: handover.row_version, reason,
      })),
    },
  ));
}

export async function listShiftHandoverPatients(lease: ContextLeaseWire, handoverId: string): Promise<ShiftHandoverPatientWire[]> {
  return shiftHandoverPatientWireSchema.array().parse(await request(
    `/shift-handover-patients?handover_id=${encodeURIComponent(handoverId)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function createShiftHandoverPatient(
  lease: ContextLeaseWire,
  input: { ward_id: string; handover_id: string; patient_id: string; summary: string; risk_flag: boolean },
): Promise<ShiftHandoverPatientWire> {
  return shiftHandoverPatientWireSchema.parse(await request('/shift-handover-patients', {
    method: 'POST',
    headers: { ...explicitContextHeaders(lease, input.patient_id, null), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(shiftHandoverPatientCreateRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function correctShiftHandoverPatient(
  lease: ContextLeaseWire,
  item: ShiftHandoverPatientWire,
  wardId: string,
  input: { summary: string; risk_flag: boolean; reason: string },
): Promise<ShiftHandoverPatientWire> {
  return shiftHandoverPatientWireSchema.parse(await request(`/shift-handover-patients/${item.shift_handover_patient_id}/corrections`, {
    method: 'POST',
    headers: { ...explicitContextHeaders(lease, item.patient_id, null), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(shiftHandoverPatientCorrectionRequestWireSchema.parse({
      ...orgFacility(), ward_id: wardId, handover_id: item.handover_id, patient_id: item.patient_id,
      expected_row_version: item.row_version, ...input,
    })),
  }));
}

export async function voidShiftHandoverPatient(
  lease: ContextLeaseWire,
  item: ShiftHandoverPatientWire,
  wardId: string,
  reason: string,
): Promise<ShiftHandoverPatientWire> {
  return shiftHandoverPatientWireSchema.parse(await request(`/shift-handover-patients/${item.shift_handover_patient_id}/voids`, {
    method: 'POST',
    headers: { ...explicitContextHeaders(lease, item.patient_id, null), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(shiftHandoverPatientVoidRequestWireSchema.parse({
      ...orgFacility(), ward_id: wardId, handover_id: item.handover_id, patient_id: item.patient_id,
      expected_row_version: item.row_version, reason,
    })),
  }));
}

// ── 预约挂号 / 班次号源 / 候诊队列（appointment-registration）──
export async function listAppointments(lease: ContextLeaseWire, patientId = clinicalContext.patientId): Promise<AppointmentWire[]> {
  return appointmentWireSchema.array().parse(await request(
    `/appointments?patient_id=${encodeURIComponent(patientId)}`,
    { headers: patientOnlyHeaders(lease, patientId) },
  ));
}

export async function listScheduleSlots(lease: ContextLeaseWire, fromDate: string): Promise<ScheduleSlotWire[]> {
  return scheduleSlotWireSchema.array().parse(await request(
    `/schedule-slots?from_date=${encodeURIComponent(fromDate)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function createScheduleSlot(
  lease: ContextLeaseWire,
  input: { visit_type: 'OUTPATIENT' | 'EMERGENCY'; slot_date: string; start_time: string; end_time: string; total_capacity: number; department_id: string; doctor_user_id: string },
): Promise<ScheduleSlotWire> {
  return scheduleSlotWireSchema.parse(await request('/schedule-slots', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(scheduleSlotCreateRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function bookAppointment(
  lease: ContextLeaseWire,
  input: { patient_id: string; schedule_slot_id: string; source: 'APPOINTMENT' | 'WALK_IN' | 'EMERGENCY' },
): Promise<AppointmentWire> {
  return appointmentWireSchema.parse(await request('/appointments', {
    method: 'POST',
    headers: { ...patientOnlyHeaders(lease, input.patient_id), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(appointmentBookRequestWireSchema.parse({ ...orgFacility(), ...input })),
  }));
}

export async function cancelAppointment(
  lease: ContextLeaseWire,
  appointment: AppointmentWire,
  reason: string,
): Promise<AppointmentWire> {
  return appointmentWireSchema.parse(await request(
    `/appointments/${appointment.appointment_id}/cancellations`, {
      method: 'POST',
      headers: { ...patientOnlyHeaders(lease, appointment.patient_id), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(appointmentCancelRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: appointment.patient_id,
        expected_row_version: appointment.row_version,
        reason,
      })),
    },
  ));
}

export async function rescheduleAppointment(
  lease: ContextLeaseWire,
  appointment: AppointmentWire,
  scheduleSlotId: string,
  reason: string,
): Promise<AppointmentWire> {
  return appointmentWireSchema.parse(await request(
    `/appointments/${appointment.appointment_id}/reschedules`, {
      method: 'POST',
      headers: { ...patientOnlyHeaders(lease, appointment.patient_id), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(appointmentRescheduleRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: appointment.patient_id,
        schedule_slot_id: scheduleSlotId,
        expected_row_version: appointment.row_version,
        reason,
      })),
    },
  ));
}

export async function checkInAppointment(
  lease: ContextLeaseWire,
  appointment: AppointmentWire,
): Promise<WaitingQueueEntryWire> {
  return waitingQueueEntryWireSchema.parse(await request(
    `/appointments/${appointment.appointment_id}/check-ins`, {
      method: 'POST',
      headers: { ...patientOnlyHeaders(lease, appointment.patient_id), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(appointmentCheckInRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: appointment.patient_id,
        expected_row_version: appointment.row_version,
      })),
    },
  ));
}

export async function consultAppointment(
  lease: ContextLeaseWire,
  appointment: AppointmentWire,
): Promise<AppointmentWire> {
  return appointmentWireSchema.parse(await request(
    `/appointments/${appointment.appointment_id}/consults`, {
      method: 'POST',
      headers: { ...patientOnlyHeaders(lease, appointment.patient_id), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(appointmentConsultRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: appointment.patient_id,
        expected_row_version: appointment.row_version,
      })),
    },
  ));
}

export async function listWaitingQueue(lease: ContextLeaseWire, date?: string): Promise<WaitingQueueEntryWire[]> {
  const queryDate = date ?? localCalendarDate();
  return waitingQueueEntryWireSchema.array().parse(await request(
    `/waiting-queue?facility_id=${encodeURIComponent(clinicalContext.facilityId)}&date=${encodeURIComponent(queryDate)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function callWaitingQueueEntry(
  lease: ContextLeaseWire,
  entry: WaitingQueueEntryWire,
): Promise<WaitingQueueEntryWire> {
  return waitingQueueEntryWireSchema.parse(await request(
    `/waiting-queue/${entry.waiting_queue_entry_id}/calls`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(waitingQueueCallRequestWireSchema.parse({
        ...orgFacility(), expected_row_version: entry.row_version,
      })),
    },
  ));
}

// ── 门诊会诊 / 转诊（opd-consult）────────────────────────────
const referralTargetSchema = z.object({
  department_id: z.string().uuid(),
  department_code: z.string().min(1),
  display_name: z.string().min(1),
});
export type ReferralTarget = z.infer<typeof referralTargetSchema>;

export async function listReferralTargets(lease: ContextLeaseWire): Promise<ReferralTarget[]> {
  return referralTargetSchema.array().parse(await request('/referral-targets', {
    headers: patientOnlyHeaders(lease),
  }));
}

export async function listReferrals(lease: ContextLeaseWire): Promise<ReferralWire[]> {
  return referralWireSchema.array().parse(await request(
    `/referrals?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: patientOnlyHeaders(lease) },
  ));
}

export async function createReferral(
  lease: ContextLeaseWire,
  input: { referral_type: 'INTERNAL' | 'EXTERNAL'; target_department?: string | null; target_organization?: string | null; reason: string; clinical_summary: string },
): Promise<ReferralWire> {
  return referralWireSchema.parse(await request('/referrals', {
    method: 'POST',
    headers: { ...patientOnlyHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(referralCreateRequestWireSchema.parse({ ...patientEncounter(), ...input })),
  }));
}

export async function transitionReferral(
  lease: ContextLeaseWire,
  referral: ReferralWire,
  transition: 'SEND' | 'ACCEPT' | 'REJECT' | 'CANCEL',
): Promise<ReferralWire> {
  return referralWireSchema.parse(await request(
    `/referrals/${referral.referral_id}/transitions`, {
      method: 'POST',
      headers: { ...patientOnlyHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(referralTransitionRequestWireSchema.parse({
        ...patientEncounter(), expected_row_version: referral.row_version, transition,
      })),
    },
  ));
}

export async function updateReferral(
  lease: ContextLeaseWire,
  referral: ReferralWire,
  input: { referral_type: 'INTERNAL' | 'EXTERNAL'; target_department?: string | null; target_organization?: string | null; reason: string; clinical_summary: string },
): Promise<ReferralWire> {
  return referralWireSchema.parse(await request(`/referrals/${referral.referral_id}`, {
    method: 'PATCH',
    headers: { ...patientOnlyHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(referralUpdateRequestWireSchema.parse({
      ...patientEncounter(),
      ...input,
      expected_row_version: referral.row_version,
    })),
  }));
}
