import { createHash } from 'node:crypto';
import { access, readFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const projectDir = resolve(import.meta.dirname, '../..');
const configPath = resolve(projectDir, process.env.OPENEMR2026_DEEPSEEK_HARNESS_CONFIG || 'evals/deepseek/harness.config.json');
const config = JSON.parse(await readFile(configPath, 'utf8'));
const blockers = [];
const requiredProvisioning = [
  'model_artifact', 'artifact_sha256', 'quantization', 'inference_engine',
  'engine_version', 'hardware',
];

if (config.provisioned !== true) blockers.push('HARNESS_NOT_PROVISIONED');
for (const field of requiredProvisioning) {
  if (typeof config[field] !== 'string' || !config[field].trim()) blockers.push(`PROVISIONING_FIELD_MISSING:${field}`);
}
if (config.threshold_source === 'UNAPPROVED') blockers.push('EVALUATION_THRESHOLDS_UNAPPROVED');
for (const [metric, threshold] of Object.entries(config.thresholds ?? {})) {
  if (threshold === null) blockers.push(`THRESHOLD_MISSING:${metric}`);
}

if (typeof config.model_artifact === 'string' && config.model_artifact) {
  const artifactPath = resolve(projectDir, config.model_artifact);
  try {
    await access(artifactPath);
    const digest = createHash('sha256').update(await readFile(artifactPath)).digest('hex');
    if (digest !== config.artifact_sha256) blockers.push('MODEL_ARTIFACT_CHECKSUM_MISMATCH');
  } catch {
    blockers.push('MODEL_ARTIFACT_UNAVAILABLE');
  }
}

if (blockers.length) {
  console.log(JSON.stringify({
    status: 'INSUFFICIENT_EVIDENCE',
    release_action: 'NO_GO',
    config: config.config_version,
    blockers: [...new Set(blockers)],
    executed_model_cases: 0,
  }, null, 2));
  process.exitCode = 2;
} else {
  console.log(JSON.stringify({
    status: 'READY_TO_EXECUTE',
    release_action: 'NO_GO_UNTIL_MODEL_RUN_COMPLETES',
    config: config.config_version,
    executed_model_cases: 0,
    next: 'Run the approved provider-specific evaluator and record repeat-level metrics before release.',
  }, null, 2));
}
