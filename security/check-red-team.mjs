import { readFile } from 'node:fs/promises';

const dataset = JSON.parse(await readFile(new URL('./red-team-payloads.json', import.meta.url), 'utf8'));
const requiredSurfaces = new Set([
  'document sections', 'patient search', 'document command', 'context lease', 'API body',
  'clinical text', 'model output', 'worker tool', 'proposal decision', 'SSE',
  'signed document', 'tenant foreign key', 'agent objective', 'agent composition', 'agent run',
]);
const ids = new Set();
for (const item of dataset.payloads ?? []) {
  if (!item.id || ids.has(item.id)) throw new Error(`invalid or duplicate red-team id: ${item.id}`);
  ids.add(item.id);
  requiredSurfaces.delete(item.surface);
  if (!item.expected) throw new Error(`${item.id} has no defensive expectation`);
}
if (dataset.synthetic !== true) throw new Error('red-team dataset must be synthetic');
if (requiredSurfaces.size) throw new Error(`missing attack surfaces: ${[...requiredSurfaces].join(', ')}`);
console.log(JSON.stringify({ payloads: ids.size, surfaces: 15, synthetic: true, gate: 'PASS' }));
