import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectDir = resolve(webDir, '..');
const outputDir = resolve(projectDir, 'output/playwright');
const baseUrl = (process.env.OPENEMR2026_BROWSER_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const checks = [];
const findings = [];
let currentRoute = 'bootstrap';
page.on('console', (message) => { if (message.type() === 'error') findings.push({ route: currentRoute, check: 'console', detail: message.text() }); });
page.on('pageerror', (error) => findings.push({ route: currentRoute, check: 'pageerror', detail: error.message }));
page.on('response', (response) => { if (response.status() >= 400 && response.url().includes('/api/v1/')) findings.push({ route: currentRoute, check: 'api-response', status: response.status(), url: response.url() }); });

async function route(id) {
  currentRoute = id;
  await page.goto(`${baseUrl}/#/${id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((routeId) => document.documentElement.dataset.routeId === routeId, id, { timeout: 8_000 });
  await page.locator('main h1').waitFor({ state: 'visible' });
  await page.waitForFunction(() => {
    const root = document.querySelector('main [data-page-root]');
    return root && !root.querySelector('.clinical-page-state.loading,.state-page:not(.error)');
  }, undefined, { timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(150);
}

async function check(name, action) {
  try { checks.push({ name, status: 'PASS', ...(await action() || {}) }); }
  catch (error) { findings.push({ route: currentRoute, check: name, detail: error instanceof Error ? error.message : String(error) }); }
}

try {
  await route('outpatient');
  await check('outpatient-summary-has-data', async () => {
    await page.getByText('原发性高血压 2 级（高危）', { exact: true }).first().waitFor({ state: 'visible' });
    await page.getByText('2 条活动', { exact: true }).waitFor({ state: 'visible' });
    await page.getByText(/^\d+ 份报告$/, { exact: true }).waitFor({ state: 'visible' });
  });
  await page.screenshot({ path: resolve(outputDir, 'outpatient-workspace-1440x1000.png'), fullPage: true });

  await route('opd-diagnosis');
  await check('diagnosis-data-and-filter', async () => {
    const cards = page.locator('.diagnosis-card');
    await cards.first().waitFor({ state: 'visible' });
    if (await cards.count() < 2) throw new Error('诊断合成数据少于 2 条');
    await page.getByLabel('状态').selectOption('PROVISIONAL');
    if (await cards.count() !== 1) throw new Error('诊断状态筛选未收敛到 1 条待确认记录');
    await page.getByLabel('状态').selectOption('ALL');
  });
  await page.screenshot({ path: resolve(outputDir, 'opd-diagnosis-1440x1000.png'), fullPage: true });

  await route('opd-orders');
  await check('orders-data-and-filter', async () => {
    const cards = page.locator('.order-card');
    await cards.first().waitFor({ state: 'visible' });
    if (await cards.count() < 3) throw new Error('医嘱合成数据少于 3 条');
    await page.getByText('苯磺酸氨氯地平片', { exact: true }).waitFor({ state: 'visible' });
    await page.getByLabel('状态').selectOption('ACTIVE');
    if (await cards.count() < 2) throw new Error('活动医嘱筛选结果不足');
    await page.getByLabel('状态').selectOption('ALL');
  });
  await page.screenshot({ path: resolve(outputDir, 'opd-orders-1440x1000.png'), fullPage: true });

  await route('opd-results');
  await check('results-data-and-filter', async () => {
    const cards = page.locator('.result-card');
    await cards.first().waitFor({ state: 'visible' });
    if (await cards.count() < 2) throw new Error('检查检验复杂合成报告少于 2 份');
    await page.getByText('3.3 mmol/L', { exact: true }).waitFor({ state: 'visible' });
    await page.getByLabel('分类').selectOption('ABNORMAL');
    if (await cards.count() < 1) throw new Error('异常结果筛选未保留血钾报告');
  });
  await page.screenshot({ path: resolve(outputDir, 'opd-results-1440x1000.png'), fullPage: true });

  await route('opd-consult');
  await check('consult-data-and-actions', async () => {
    const rows = page.locator('.admin-table tbody tr');
    await rows.first().waitFor({ state: 'visible' });
    if (await rows.count() < 2) throw new Error('会诊转诊合成数据少于 2 条');
    await page.getByText('心血管内科', { exact: true }).waitFor({ state: 'visible' });
    await page.getByText('营养科', { exact: true }).waitFor({ state: 'visible' });
    if (await page.getByRole('button', { name: '发送' }).count() < 1) throw new Error('会诊发送操作缺失');
  });
  await page.screenshot({ path: resolve(outputDir, 'opd-consult-1440x1000.png'), fullPage: true });
} finally { await browser.close(); }

const result = { run_at: new Date().toISOString(), checks: checks.length + findings.length, passed: checks.length, failed: findings.length, findings, observations: checks };
const outputPath = resolve(outputDir, 'outpatient-data-function-audit.json');
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ checks: result.checks, passed: result.passed, failed: result.failed, artifact: outputPath }));
if (findings.length) process.exitCode = 1;
