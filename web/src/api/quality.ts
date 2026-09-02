import {
  clinicalContext,
  explicitContextHeaders,
  issueContextLease,
  request,
} from '../clinical-api';
import {
  infectionMonitoringEventReportRequestWireSchema,
  infectionMonitoringEventResolveRequestWireSchema,
  infectionMonitoringEventWireSchema,
  type ContextLeaseWire,
  type InfectionMonitoringEventWire,
} from '../generated/contracts';

export function issueInfectionLease(purpose: string): Promise<ContextLeaseWire> {
  // 院感线索为「患者级、无就诊」上下文（authorize 传 encounter=null）
  return issueContextLease(clinicalContext.patientId, null, purpose);
}

export function issueInfectionEncounterLease(purpose: string): Promise<ContextLeaseWire> {
  return issueContextLease(clinicalContext.patientId, clinicalContext.encounterId, purpose);
}

function infectionHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.patientId, null);
}

function infectionEncounterHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.patientId, clinicalContext.encounterId);
}

export async function listInfectionMonitoringEvents(lease: ContextLeaseWire): Promise<InfectionMonitoringEventWire[]> {
  return infectionMonitoringEventWireSchema.array().parse(await request(
    `/infection-monitoring-events?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: infectionHeaders(lease) },
  ));
}

export async function reportInfectionMonitoringEvent(
  lease: ContextLeaseWire,
  input: {
    infection_type: string; organism_code?: string | null;
    event_category: 'HAI_CASE' | 'HAI_OUTBREAK' | 'NOTIFIABLE_DISEASE';
    onset_at?: string | null; detected_at: string; reporting_window_hours: 2 | 24;
    external_report_required: boolean; reporting_policy_code: string; reported_at: string;
  },
): Promise<InfectionMonitoringEventWire> {
  return infectionMonitoringEventWireSchema.parse(await request('/infection-monitoring-events', {
    method: 'POST',
    headers: { ...infectionEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(infectionMonitoringEventReportRequestWireSchema.parse({
      organization_id: clinicalContext.organizationId,
      facility_id: clinicalContext.facilityId,
      patient_id: clinicalContext.patientId,
      encounter_id: clinicalContext.encounterId,
      ...input,
      onset_at: input.onset_at ? new Date(input.onset_at).toISOString() : null,
      detected_at: new Date(input.detected_at).toISOString(),
      reported_at: new Date(input.reported_at).toISOString(),
    })),
  }));
}

export async function resolveInfectionMonitoringEvent(
  lease: ContextLeaseWire,
  event: InfectionMonitoringEventWire,
  resolution: string,
  conclusion: string,
): Promise<InfectionMonitoringEventWire> {
  return infectionMonitoringEventWireSchema.parse(await request(
    `/infection-monitoring-events/${event.infection_event_id}/resolutions`, {
      method: 'POST',
      headers: { ...infectionEncounterHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
      body: JSON.stringify(infectionMonitoringEventResolveRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
        patient_id: clinicalContext.patientId,
        encounter_id: clinicalContext.encounterId,
        expected_row_version: event.row_version,
        resolution,
        conclusion,
      })),
    },
  ));
}
