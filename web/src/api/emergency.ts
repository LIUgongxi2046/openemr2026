import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
  wardHeaders,
} from '../clinical-api';
import {
  appointmentBookRequestWireSchema,
  appointmentCancelRequestWireSchema,
  appointmentCheckInRequestWireSchema,
  appointmentConsultRequestWireSchema,
  appointmentWireSchema,
  emergencyNursingNoteCreateRequestWireSchema,
  emergencyNursingNoteWireSchema,
  emergencyObservationCompleteRequestWireSchema,
  emergencyObservationStartRequestWireSchema,
  emergencyObservationWireSchema,
  emergencyPreadmissionLinkRequestWireSchema,
  emergencyPreadmissionRegisterRequestWireSchema,
  emergencyPreadmissionWireSchema,
  emergencyResuscitationCompleteRequestWireSchema,
  emergencyResuscitationStartRequestWireSchema,
  emergencyResuscitationWireSchema,
  emergencyTriageAssessmentCreateRequestWireSchema,
  emergencyTriageAssessmentWireSchema,
  encounterDomainSwitchRecordRequestWireSchema,
  encounterDomainSwitchWireSchema,
  referralCreateRequestWireSchema,
  referralTransitionRequestWireSchema,
  referralWireSchema,
  scheduleSlotCreateRequestWireSchema,
  scheduleSlotWireSchema,
  shiftHandoverCompleteRequestWireSchema,
  shiftHandoverCreateRequestWireSchema,
  shiftHandoverPatientCreateRequestWireSchema,
  shiftHandoverPatientWireSchema,
  shiftHandoverWireSchema,
  waitingQueueCallRequestWireSchema,
  waitingQueueEntryWireSchema,
  type AppointmentWire,
  type ContextLeaseWire,
  type EmergencyNursingNoteWire,
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
} from '../generated/contracts';

/** 急诊/门急诊域的患者级租约：authorize 均传 encounter=null，故仅按患者签发。 */
export function issueEmergencyLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.emergencyPatientId, null, purpose);
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

// ── 急诊预检分诊（er-triage）────────────────────────────────
export async function listEmergencyTriageAssessments(lease: ContextLeaseWire): Promise<EmergencyTriageAssessmentWire[]> {
  return emergencyTriageAssessmentWireSchema.array().parse(await request(
    `/emergency-triage-assessments?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  ));
}

export async function createEmergencyTriageAssessment(
  lease: ContextLeaseWire,
  input: { triage_level: 'LEVEL_1' | 'LEVEL_2' | 'LEVEL_3' | 'LEVEL_4'; chief_complaint: string; triaged_at: string; immediate_action_required: boolean },
): Promise<EmergencyTriageAssessmentWire> {
  return emergencyTriageAssessmentWireSchema.parse(await request('/emergency-triage-assessments', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyTriageAssessmentCreateRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
  }));
}

// ── 急诊抢救留观与去向（er-observation）─────────────────────
export async function listEmergencyObservations(lease: ContextLeaseWire): Promise<EmergencyObservationWire[]> {
  return emergencyObservationWireSchema.array().parse(await request(
    `/emergency-observations?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  ));
}

export async function startEmergencyObservation(
  lease: ContextLeaseWire,
  input: { observation_started_at: string },
): Promise<EmergencyObservationWire> {
  return emergencyObservationWireSchema.parse(await request('/emergency-observations', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
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
      headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(emergencyObservationCompleteRequestWireSchema.parse({
        ...emergencyPatientEncounter(), expected_row_version: observation.row_version, disposition,
      })),
    },
  ));
}

// ── 急诊抢救记录（er-record）────────────────────────────────
export async function listEmergencyResuscitations(lease: ContextLeaseWire): Promise<EmergencyResuscitationWire[]> {
  return emergencyResuscitationWireSchema.array().parse(await request(
    `/emergency-resuscitations?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  ));
}

export async function startEmergencyResuscitation(
  lease: ContextLeaseWire,
  input: { started_at: string },
): Promise<EmergencyResuscitationWire> {
  return emergencyResuscitationWireSchema.parse(await request('/emergency-resuscitations', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
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
      headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(emergencyResuscitationCompleteRequestWireSchema.parse({
        ...emergencyPatientEncounter(), expected_row_version: resuscitation.row_version, outcome,
      })),
    },
  ));
}

// ── 急诊护理记录（er-nursing）───────────────────────────────
export async function listEmergencyNursingNotes(lease: ContextLeaseWire): Promise<EmergencyNursingNoteWire[]> {
  return emergencyNursingNoteWireSchema.array().parse(await request(
    `/emergency-nursing-notes?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  ));
}

export async function createEmergencyNursingNote(
  lease: ContextLeaseWire,
  input: { assessment: string; intervention: string; risk_flag: boolean; recorded_at: string },
): Promise<EmergencyNursingNoteWire> {
  return emergencyNursingNoteWireSchema.parse(await request('/emergency-nursing-notes', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(emergencyNursingNoteCreateRequestWireSchema.parse({ ...emergencyPatientEncounter(), ...input })),
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

// ── 域切换（er-handoff 转运 / opd-consult 转诊）──────────────
export async function listEncounterDomainSwitches(lease: ContextLeaseWire): Promise<EncounterDomainSwitchWire[]> {
  return encounterDomainSwitchWireSchema.array().parse(await request(
    `/encounter-domain-switches?patient_id=${encodeURIComponent(clinicalContext.emergencyPatientId)}`,
    { headers: emergencyPatientHeaders(lease) },
  ));
}

export async function recordEncounterDomainSwitch(
  lease: ContextLeaseWire,
  input: { from_encounter_id: string; to_encounter_id: string; from_domain: 'OUTPATIENT' | 'EMERGENCY'; to_domain: 'OUTPATIENT' | 'EMERGENCY'; reason: string; switched_at: string },
): Promise<EncounterDomainSwitchWire> {
  return encounterDomainSwitchWireSchema.parse(await request('/encounter-domain-switches', {
    method: 'POST',
    headers: { ...emergencyPatientHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(encounterDomainSwitchRecordRequestWireSchema.parse({ ...emergencyPatientOnly(), ...input })),
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
  const queryDate = date ?? new Date().toISOString().slice(0, 10);
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
  transition: 'SEND' | 'ACCEPT' | 'REJECT',
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
