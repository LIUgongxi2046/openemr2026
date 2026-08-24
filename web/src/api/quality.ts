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

function infectionHeaders(lease: ContextLeaseWire) {
  return explicitContextHeaders(lease, clinicalContext.patientId, null);
}

export async function listInfectionMonitoringEvents(lease: ContextLeaseWire): Promise<InfectionMonitoringEventWire[]> {
  return infectionMonitoringEventWireSchema.array().parse(await request(
    `/infection-monitoring-events?patient_id=${encodeURIComponent(clinicalContext.patientId)}`,
    { headers: infectionHeaders(lease) },
  ));
}

export async function reportInfectionMonitoringEvent(
  lease: ContextLeaseWire,
  input: { infection_type: string; organism_code?: string | null; reported_at: string },
): Promise<InfectionMonitoringEventWire> {
  return infectionMonitoringEventWireSchema.parse(await request('/infection-monitoring-events', {
    method: 'POST',
    headers: { ...infectionHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(infectionMonitoringEventReportRequestWireSchema.parse({
      organization_id: clinicalContext.organizationId,
      facility_id: clinicalContext.facilityId,
      patient_id: clinicalContext.patientId,
      encounter_id: clinicalContext.encounterId,
      ...input,
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
      headers: { ...infectionHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
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
