import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectDir = resolve(import.meta.dirname, '..');
const requiredFiles = [
  'evals/deepseek/harness.config.json',
  'evals/deepseek/run-harness.mjs',
  'evals/deepseek/provider-contract.json',
];
const requiredConfigFields = ['provisioned', 'model_artifact', 'artifact_sha256', 'quantization', 'inference_engine', 'engine_version', 'hardware', 'seed', 'repeats', 'dataset_version', 'threshold_source'];
const requiredMetrics = ['schema_validity', 'citation_accuracy', 'clinical_factuality', 'cross_patient_leakage', 'unauthorized_side_effects', 'ttft_ms', 'tokens_per_second', 'peak_memory_bytes', 'timeout_recovery', 'cancellation_recovery'];
const failures = [];
for (const file of requiredFiles) {
  try { await access(resolve(projectDir, file)); } catch { failures.push({ issue: 'REQUIRED_HARNESS_FILE_MISSING', file }); }
}
let config;
try { config = JSON.parse(await readFile(resolve(projectDir, requiredFiles[0]), 'utf8')); } catch { /* missing/invalid is already or implicitly reported */ }
if (config) {
  for (const field of requiredConfigFields) if (!(field in config)) failures.push({ issue: 'HARNESS_CONFIG_FIELD_MISSING', field });
  const metrics = new Set(config.metrics ?? []);
  for (const metric of requiredMetrics) if (!metrics.has(metric)) failures.push({ issue: 'HARNESS_METRIC_MISSING', metric });
}
const sourceFiles = [
  'src/main/java/org/openemr2026/agent/ClinicalModelProvider.java',
  'src/main/java/org/openemr2026/agent/DeterministicFakeClinicalModelProvider.java',
  'src/main/java/org/openemr2026/agent/DeepSeekClinicalModelProvider.java',
  'src/main/java/org/openemr2026/agent/DeepSeekHttpChatTransport.java',
];
const providerSource = (await Promise.all(sourceFiles.map((file) => readFile(resolve(projectDir, file), 'utf8')))).join('\n');
if (!/DeepSeek/i.test(providerSource)) failures.push({ issue: 'DEEPSEEK_PROVIDER_ADAPTER_MISSING' });

const blockers = [];
if (config?.provisioned !== true) blockers.push({ issue: 'HARNESS_NOT_PROVISIONED' });
for (const field of ['model_artifact', 'artifact_sha256', 'quantization', 'inference_engine', 'engine_version', 'hardware']) {
  if (!config?.[field]) blockers.push({ issue: 'PROVISIONING_FIELD_MISSING', field });
}
if (config?.threshold_source === 'UNAPPROVED') blockers.push({ issue: 'EVALUATION_THRESHOLDS_UNAPPROVED' });
for (const [metric, threshold] of Object.entries(config?.thresholds ?? {})) {
  if (threshold === null) blockers.push({ issue: 'HARNESS_THRESHOLD_MISSING', metric });
}

const gate = failures.length ? 'FAIL' : blockers.length ? 'INTEGRATED_BLOCKED' : 'PASS';
console.log(JSON.stringify({ gate, failures, blockers }, null, 2));
if (failures.length) process.exitCode = 1;
