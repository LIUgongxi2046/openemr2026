import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectDir = resolve(webDir, '..');
const outputDir = resolve(projectDir, 'output/playwright/quality-center-writes');
const baseUrl = (process.env.OPENEMR2026_BROWSER_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const username = process.env.OPENEMR2026_DEV_LOGIN_USERNAME || 'linwei';
const password = process.env.OPENEMR2026_DEV_LOGIN_PASSWORD || 'OpenEMR2026-dev!';
const suffix = Date.now().toString(36).toUpperCase();
const checks = []; const findings = []; const writes = [];
await mkdir(outputDir, { recursive: true });

async function check(name, action) {
  try { checks.push({ name, status: 'PASS', ...((await action()) || {}) }); }
  catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    findings.push({ name, detail });
    console.error(`[FAIL] ${name}: ${detail}`);
  }
}
async function login(page) {
  await page.goto(`${baseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  const submit = page.getByRole('button', { name: '登录系统', exact: true });
  if (await submit.count()) {
    await page.getByLabel('用户名', { exact: true }).fill(username);
    await page.locator('#system-login-password').fill(password);
    await submit.click();
  }
  try {
    await page.waitForFunction(() => document.documentElement.dataset.routeId !== 'login-context', undefined, { timeout: 20_000 });
  } catch (error) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 700);
    throw new Error(`登录后仍停留在 ${page.url()}；页面=${body}；写请求=${JSON.stringify(writes)}；原因=${error instanceof Error ? error.message : String(error)}`);
  }
}
async function route(page, path, heading) {
  await page.goto(`${baseUrl}/#${path}`, { waitUntil: 'domcontentloaded' });
  try {
    await page.getByRole('heading', { name: heading, exact: false }).first().waitFor({ timeout: 5_000 });
  } catch (error) {
    const body = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500);
    throw new Error(`路由 ${path} 未显示标题 ${heading}；当前 URL=${page.url()}；页面=${body}；原因=${error instanceof Error ? error.message : String(error)}`);
  }
}
async function verifyDetailRoute(page, row, listPath, detailMarker) {
  await row.getByRole('link').first().click();
  await page.waitForURL((url) => url.hash.startsWith(`#${listPath}/`), { timeout: 10_000 });
  await page.locator('nav.quality-breadcrumb b').filter({ hasText: detailMarker }).waitFor({ timeout: 10_000 });
  await page.goto(`${baseUrl}/#${listPath}`, { waitUntil: 'domcontentloaded' });
}
async function genericCrud(page, path, heading, itemLabel, name) {
  await route(page, path, heading);
  await page.getByRole('button', { name: `新建${itemLabel}`, exact: true }).first().click();
  let dialog = page.getByRole('dialog').filter({ hasText: `新建${itemLabel}` });
  await dialog.getByLabel('名称', { exact: true }).fill(name);
  await dialog.getByLabel('责任人 / 责任科室', { exact: true }).fill('医务质控组');
  await dialog.getByLabel('适用范围', { exact: true }).fill('隔离回归院区');
  await dialog.getByLabel('问题 / 证据说明', { exact: true }).fill('端到端回归创建数据');
  await dialog.getByRole('button', { name: '保存并影响流程', exact: true }).click();
  await page.getByText(name, { exact: true }).waitFor();
  let row = page.getByRole('row').filter({ hasText: name });
  await verifyDetailRoute(page, row, path, '处理详情');
  row = page.getByRole('row').filter({ hasText: name });
  await row.getByRole('button', { name: '编辑', exact: true }).click();
  dialog = page.getByRole('dialog').filter({ hasText: `编辑${itemLabel}` });
  await dialog.getByLabel('名称', { exact: true }).fill(`${name}-UPDATED`);
  await dialog.getByRole('button', { name: '保存并影响流程', exact: true }).click();
  await page.getByText(`${name}-UPDATED`, { exact: true }).waitFor();
  row = page.getByRole('row').filter({ hasText: `${name}-UPDATED` });
  await row.getByRole('button', { name: '删除', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: '确认删除', exact: true }).click();
  await page.getByText(`${itemLabel}已逻辑删除`, { exact: false }).waitFor();
}

const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.on('response', (response) => {
    const request = response.request();
    if (request.method() !== 'GET' && response.url().includes('/api/v1/')) writes.push({ method: request.method(), url: response.url().replace(baseUrl, ''), status: response.status() });
  });
  page.on('console', (message) => { if (message.type() === 'error') findings.push({ name: 'console', detail: message.text() }); });
  page.on('pageerror', (error) => findings.push({ name: 'pageerror', detail: error.message }));
  await login(page);

  await check('quality-initiative-create-edit-delete', () => genericCrud(page, '/quality-center/initiatives', '院级质量改进项目', '质量项目', `E2E-QI-${suffix}`));
  await check('department-qc-create-edit-delete', () => genericCrud(page, '/department-qc/cases', '院科质控缺陷与整改', '质控缺陷', `E2E-DQC-${suffix}`));

  await check('rating-assessment-create-edit-delete', async () => {
    const scope = `E2E_${suffix}`;
    await route(page, '/quality-rating/assessments', '医疗质量与电子病历评级看板');
    await page.getByRole('button', { name: '新建评级证据', exact: true }).click();
    let dialog = page.getByRole('dialog').filter({ hasText: '新建评级证据' });
    await dialog.getByLabel('临床范围编码', { exact: true }).fill(scope);
    await dialog.getByRole('button', { name: '保存并重算支持等级', exact: true }).click();
    await page.getByText(scope, { exact: true }).waitFor();
    let row = page.getByRole('row').filter({ hasText: scope });
    await verifyDetailRoute(page, row, '/quality-rating/assessments', '评估详情');
    row = page.getByRole('row').filter({ hasText: scope });
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    dialog = page.getByRole('dialog').filter({ hasText: '编辑评级证据' });
    await dialog.locator('select').selectOption('UNSUPPORTED');
    await dialog.getByRole('button', { name: '保存并重算支持等级', exact: true }).click();
    await page.getByText('评级证据已更新', { exact: false }).waitFor();
    row = page.getByRole('row').filter({ hasText: scope });
    await row.getByRole('button', { name: '删除', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: '确认撤回', exact: true }).click();
    await page.getByText('评级声明已撤回', { exact: false }).waitFor();
  });

  async function reportAndResolve(resolution) {
    const organism = `${resolution}-${suffix}`;
    await page.getByRole('button', { name: '新建院感线索', exact: true }).click();
    let dialog = page.getByRole('dialog').filter({ hasText: '新建院感线索' });
    await dialog.getByLabel('病原体（可选）', { exact: true }).fill(organism);
    await dialog.getByRole('button', { name: '上报线索', exact: true }).click();
    let row = page.getByRole('row').filter({ hasText: organism }); await row.waitFor();
    await verifyDetailRoute(page, row, '/infection-events/clues', '线索详情');
    row = page.getByRole('row').filter({ hasText: organism });
    await row.getByRole('button', { name: resolution === 'CONFIRM' ? '确认' : '排除', exact: true }).click();
    dialog = page.getByRole('dialog').filter({ hasText: resolution === 'CONFIRM' ? '确认院感线索' : '排除院感线索' });
    await dialog.getByLabel('复核结论', { exact: true }).fill(resolution === 'CONFIRM' ? '确认院感并启动防控闭环' : '经人工复核排除院感');
    await dialog.getByRole('button', { name: '确认提交结论', exact: true }).click();
    await page.getByText('线索已复核', { exact: false }).waitFor();
  }
  await check('infection-report-confirm-refute', async () => {
    await route(page, '/infection-events/clues', '院感、传染病与不良事件');
    await reportAndResolve('CONFIRM'); await reportAndResolve('REFUTE');
  });

  await check('credential-create-edit-revoke', async () => {
    const registration = `E2E-LICENSE-${suffix}`;
    await route(page, '/credentials/grants', '临床资质与医疗授权中心');
    await page.getByRole('button', { name: '新建临床资质', exact: true }).click();
    let dialog = page.getByRole('dialog').filter({ hasText: '新建临床资质' });
    await dialog.getByLabel('注册号', { exact: true }).fill(registration);
    await dialog.getByLabel('颁发机构', { exact: true }).fill('隔离回归测试卫健委');
    await dialog.getByRole('button', { name: '保存并立即生效', exact: true }).click();
    await page.getByText(registration, { exact: true }).waitFor();
    let row = page.getByRole('row').filter({ hasText: registration });
    await verifyDetailRoute(page, row, '/credentials/grants', '资质详情');
    row = page.getByRole('row').filter({ hasText: registration });
    await row.getByRole('button', { name: '编辑', exact: true }).click();
    dialog = page.getByRole('dialog').filter({ hasText: '编辑临床资质' });
    await dialog.getByLabel('执业范围 JSON', { exact: true }).fill('{"specialty":"CARDIOLOGY","procedure":"LEVEL_3"}');
    await dialog.getByRole('button', { name: '保存并立即生效', exact: true }).click();
    await page.getByText('临床资质已更新', { exact: false }).waitFor();
    row = page.getByRole('row').filter({ hasText: registration });
    await row.getByRole('button', { name: '撤销', exact: true }).click();
    dialog = page.getByRole('dialog').filter({ hasText: '撤销临床资质' });
    await dialog.getByLabel('撤销原因（至少 4 个字）', { exact: true }).fill('端到端回归撤销验证');
    await dialog.getByRole('button', { name: '确认撤销', exact: true }).click();
    await page.getByText('临床资质已撤销', { exact: false }).waitFor();
  });

  await page.screenshot({ path: resolve(outputDir, 'quality-center-write-regression-1440x1000.png'), fullPage: true });
  const failedWrites = writes.filter((item) => item.status < 200 || item.status >= 300);
  if (writes.length < 17) findings.push({ name: 'write-count', detail: `只观测到 ${writes.length} 个写请求，预期至少 17 个` });
  if (failedWrites.length > 0) findings.push({ name: 'write-status', detail: `存在失败写请求: ${JSON.stringify(failedWrites)}` });
} finally { await browser.close(); }

const result = { run_at: new Date().toISOString(), base_url: baseUrl, data_suffix: suffix, checks, writes, findings, passed: findings.length === 0 };
await writeFile(resolve(outputDir, 'quality-center-write-regression.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ checks: checks.length, writes: writes.length, findings: findings.length, passed: result.passed, artifact: resolve(outputDir, 'quality-center-write-regression.json') }));
if (findings.length) process.exitCode = 1;
