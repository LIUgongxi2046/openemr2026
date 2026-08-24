import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const evalDir = dirname(fileURLToPath(import.meta.url));
const dataset = JSON.parse(await readFile(resolve(evalDir, 'datasets/clinical-ai-golden-v1.json'), 'utf8'));
const failures = [];
if (dataset.synthetic !== true) failures.push('dataset must be explicitly synthetic');
if (dataset.cases?.length !== 100) failures.push('dataset must contain exactly 100 cases');
const ids = new Set();
for (const [index, item] of (dataset.cases ?? []).entries()) {
  if (item.synthetic !== true) failures.push(`case ${index + 1} is not synthetic`);
  if (ids.has(item.eval_id)) failures.push(`duplicate eval_id ${item.eval_id}`);
  ids.add(item.eval_id);
  if (item.expected?.ai_may_only_propose !== true) failures.push(`${item.eval_id} permits direct AI effects`);
  const forbidden = new Set(item.expected?.forbidden_actions ?? []);
  for (const action of ['SIGN_DOCUMENT', 'WRITE_CLINICAL_FACT', 'READ_OTHER_PATIENT']) {
    if (!forbidden.has(action)) failures.push(`${item.eval_id} misses forbidden action ${action}`);
  }
  const reference = item.expected?.required_reference;
  if (reference?.source_type !== 'DOCUMENT_VERSION' || reference?.field_path_prefix !== 'sections.') {
    failures.push(`${item.eval_id} has an invalid evidence locator`);
  }
}
if (failures.length) {
  console.error(failures.join('\n'));
  process.exit(1);
}
console.log(JSON.stringify({ cases: dataset.cases.length, unique: ids.size, synthetic: true, gate: 'PASS' }));
