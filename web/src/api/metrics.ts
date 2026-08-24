import {
  metricSnapshotRecordRequestWireSchema,
  metricSnapshotWireSchema,
  type ContextLeaseWire,
  type MetricSnapshotWire,
} from '../generated/contracts';
import { issueContextLease, request, wardHeaders } from '../clinical-api';

export function issueMetricLease(): Promise<ContextLeaseWire> {
  return issueContextLease(null, null, 'METRIC_SNAPSHOT');
}

export async function listMetricSnapshots(lease: ContextLeaseWire, metricType: string): Promise<MetricSnapshotWire[]> {
  return metricSnapshotWireSchema.array().parse(await request(
    `/metric-snapshots?metric_type=${encodeURIComponent(metricType)}`,
    { headers: wardHeaders(lease) },
  ));
}

export async function recordMetricSnapshot(
  lease: ContextLeaseWire,
  input: { metric_type: string; metric_name: string; metric_value: number; unit?: string | null },
): Promise<MetricSnapshotWire> {
  return metricSnapshotWireSchema.parse(await request('/metric-snapshots', {
    method: 'POST',
    headers: { ...wardHeaders(lease), 'Content-Type': 'application/json', 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify(metricSnapshotRecordRequestWireSchema.parse(input)),
  }));
}

export async function computeMetricSnapshots(lease: ContextLeaseWire, metricType: string): Promise<MetricSnapshotWire[]> {
  return metricSnapshotWireSchema.array().parse(await request(
    `/metric-snapshots/compute?metric_type=${encodeURIComponent(metricType)}`,
    { method: 'POST', headers: { ...wardHeaders(lease), 'Idempotency-Key': crypto.randomUUID() } },
  ));
}
