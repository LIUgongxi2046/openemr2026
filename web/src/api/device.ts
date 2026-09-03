import {
  deviceCatalogCreateRequestWireSchema,
  deviceCatalogDeactivateRequestWireSchema,
  deviceCatalogWireSchema,
  deviceObservationWireSchema,
  deviceStatusWireSchema,
  deviceTelemetryCollectRequestWireSchema,
  deviceTelemetryCollectResultWireSchema,
  type ContextLeaseWire,
  type DeviceCatalogCreateRequestWire,
  type DeviceCatalogWire,
  type DeviceObservationWire,
  type DeviceStatusWire,
  type DeviceTelemetryCollectRequestWire,
  type DeviceTelemetryCollectResultWire,
} from '../generated/contracts';
import { clinicalContext, issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueDeviceLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'DEVICE_OPERATIONS');
}

export async function listDeviceTelemetry(
  lease: ContextLeaseWire,
  deviceCode?: string,
): Promise<DeviceObservationWire[]> {
  const suffix = deviceCode ? `?device_code=${encodeURIComponent(deviceCode)}` : '';
  return deviceObservationWireSchema.array().parse(await request(`/device-telemetry${suffix}`, {
    headers: wardHeaders(lease),
  }));
}

export async function collectDeviceTelemetry(
  lease: ContextLeaseWire,
  input: Omit<DeviceTelemetryCollectRequestWire, 'organization_id' | 'facility_id'>,
  idempotencyKey = crypto.randomUUID(),
): Promise<DeviceTelemetryCollectResultWire> {
  return deviceTelemetryCollectResultWireSchema.parse(await request('/device-telemetry', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(deviceTelemetryCollectRequestWireSchema.parse({
      organization_id: clinicalContext.organizationId,
      facility_id: clinicalContext.facilityId,
      ...input,
    })),
  }));
}

export async function listDeviceStatuses(
  lease: ContextLeaseWire,
  deviceCode?: string,
): Promise<DeviceStatusWire[]> {
  const suffix = deviceCode ? `?device_code=${encodeURIComponent(deviceCode)}` : '';
  return deviceStatusWireSchema.array().parse(await request(`/device-statuses${suffix}`, {
    headers: wardHeaders(lease),
  }));
}

export async function listDevices(
  lease: ContextLeaseWire,
  status?: string,
): Promise<DeviceCatalogWire[]> {
  const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
  return deviceCatalogWireSchema.array().parse(await request(`/devices${suffix}`, {
    headers: wardHeaders(lease),
  }));
}

export async function createDevice(
  lease: ContextLeaseWire,
  input: Omit<DeviceCatalogCreateRequestWire, 'organization_id' | 'facility_id'>,
  idempotencyKey = crypto.randomUUID(),
): Promise<DeviceCatalogWire> {
  return deviceCatalogWireSchema.parse(await request('/devices', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
    body: JSON.stringify(deviceCatalogCreateRequestWireSchema.parse({
      organization_id: clinicalContext.organizationId,
      facility_id: clinicalContext.facilityId,
      ...input,
    })),
  }));
}

export async function deactivateDevice(
  lease: ContextLeaseWire,
  deviceId: string,
  idempotencyKey = crypto.randomUUID(),
): Promise<DeviceCatalogWire> {
  return deviceCatalogWireSchema.parse(await request(
    `/devices/${encodeURIComponent(deviceId)}/deactivations`, {
      method: 'POST',
      headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey },
      body: JSON.stringify(deviceCatalogDeactivateRequestWireSchema.parse({
        organization_id: clinicalContext.organizationId,
        facility_id: clinicalContext.facilityId,
      })),
    },
  ));
}
