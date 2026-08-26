import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectDir = resolve(webDir, '..');
const baseUrl = (process.env.OPENEMR2026_BROWSER_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const outputPath = resolve(projectDir, 'output/playwright/topbar-interactions-audit.json');
await mkdir(resolve(projectDir, 'output/playwright'), { recursive: true });

const browser = await chromium.launch({ headless: true });
const findings = [];
const observations = [];

async function verify(viewport, label) {
  const page = await browser.newPage({ viewport });
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) findings.push({ viewport: label, check: 'console', message: message.text() });
  });
  page.on('pageerror', (error) => findings.push({ viewport: label, check: 'pageerror', message: error.message }));

  const step = async (check, action) => {
    try {
      const detail = await action();
      observations.push({ viewport: label, check, status: 'PASS', ...(detail || {}) });
    } catch (error) {
      findings.push({ viewport: label, check, message: error instanceof Error ? error.message : String(error) });
    }
  };

  await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.documentElement.dataset.routeId === 'clinical', { timeout: 8_000 });

  await step('brand-logo-not-distorted', async () => {
    const logo = page.getByTestId('brand-logo');
    await logo.waitFor({ state: 'visible' });
    const geometry = await logo.evaluate((image) => {
      const rect = image.getBoundingClientRect();
      return { width: rect.width, height: rect.height, naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, objectFit: getComputedStyle(image).objectFit };
    });
    if (!geometry.naturalWidth || !geometry.naturalHeight) throw new Error('品牌 Logo 未成功加载');
    const renderedRatio = geometry.width / geometry.height;
    const naturalRatio = geometry.naturalWidth / geometry.naturalHeight;
    if (Math.abs(renderedRatio - naturalRatio) > 0.02) throw new Error(`品牌 Logo 比例失真：${renderedRatio} != ${naturalRatio}`);
    return geometry;
  });

  await step('brand-link', async () => {
    await page.goto(`${baseUrl}/#/patient-registry`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'patient-registry', null, { timeout: 8_000 });
    await page.getByRole('link', { name: 'OpenEMR2026 首页' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'clinical', null, { timeout: 8_000 });
    const productName = page.getByText('OpenEMR2026', { exact: true });
    await productName.waitFor({ state: 'attached' });
    if (viewport.width >= 700) await productName.waitFor({ state: 'visible' });
  });

  await step('specialty-menu-hidden', async () => {
    if (await page.getByRole('navigation', { name: '一级导航' }).getByRole('link', { name: /核心专科工作台/ }).count()) throw new Error('核心专科工作台菜单仍然可见');
  });

  if (viewport.width >= 700) {
    await step('hospital-selector', async () => {
      const trigger = page.getByRole('button', { name: '选择医院' });
      await trigger.click();
      await page.getByRole('menu', { name: '医院列表' }).getByRole('menuitemradio', { name: '江城第二医院' }).click();
      if (!(await trigger.textContent())?.includes('江城第二医院')) throw new Error('医院切换后顶栏未更新');
    });

    await step('role-selector', async () => {
      const trigger = page.getByRole('button', { name: '选择角色' });
      await trigger.click();
      await page.getByRole('menu', { name: '角色列表' }).getByRole('menuitemradio', { name: '质控管理员 · 全院质量中心' }).click();
      if (!(await trigger.textContent())?.includes('质控管理员')) throw new Error('角色切换后顶栏未更新');
    });

    await step('global-search', async () => {
      await page.getByRole('searchbox', { name: '全局搜索' }).fill('张三');
      await page.getByRole('button', { name: '提交全局搜索' }).click();
      await page.waitForFunction(() => document.documentElement.dataset.routeId === 'patient-registry');
      if (!new URL(page.url()).hash.includes('q=%E5%BC%A0%E4%B8%89')) throw new Error(`搜索词未写入目标 URL：${page.url()}`);
      await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
    });
  }

  await step('assistant-button', async () => {
    const trigger = page.getByRole('button', { name: '打开AI医助小南' });
    const triggerMascot = trigger.locator('img[src="/brand/ai-medical-assistant-xiaonan.png"]');
    if (await triggerMascot.count() !== 1 || !(await triggerMascot.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))) throw new Error('AI医助小南顶栏 Logo 未正确加载');
    await trigger.click();
    const dialog = page.getByRole('dialog', { name: 'AI医助小南' });
    await dialog.waitFor({ state: 'visible' });
    try {
      const dialogMascot = dialog.locator('.global-ai-mascot');
      if (await dialogMascot.count() !== 1 || !(await dialogMascot.evaluate((image) => image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))) throw new Error('AI医助小南弹窗 Logo 未正确加载');
      await dialog.getByText('6 个 Agent', { exact: true }).waitFor({ state: 'attached' });
      if (await dialog.locator('.global-ai-agent-grid article').count() !== 6) throw new Error('已启用 Agent 数量不是 6');
      await dialog.getByText('进入门诊工作台、切换患者或准备结束接诊时', { exact: true }).waitFor({ state: 'attached' });
      const shellWidthBeforeSide = await page.locator('.shell').evaluate((element) => element.getBoundingClientRect().width);
      await dialog.getByRole('button', { name: '右侧窗', exact: true }).click();
      const sideDialog = page.getByRole('dialog', { name: 'AI医助小南' });
      await sideDialog.waitFor({ state: 'visible' });
      if (viewport.width >= 821) {
        const shellWidthInSide = await page.locator('.shell').evaluate((element) => element.getBoundingClientRect().width);
        if (shellWidthInSide >= shellWidthBeforeSide - 300) throw new Error(`右侧窗未挤压原界面：${shellWidthBeforeSide} -> ${shellWidthInSide}`);
      }
      await page.screenshot({ path: resolve(projectDir, `output/playwright/ai-assistant-side-${label}.png`), fullPage: false });
      await sideDialog.getByRole('button', { name: '中窗', exact: true }).click();
      await page.locator('dialog.global-ai-dialog[open]').waitFor({ state: 'visible' });
      await page.screenshot({ path: resolve(projectDir, `output/playwright/ai-assistant-${label}.png`), fullPage: false });
      const centerDialog = page.getByRole('dialog', { name: 'AI医助小南' });
      await centerDialog.getByRole('button', { name: '生成门诊摘要' }).click();
      await centerDialog.locator('.global-ai-message.assistant').waitFor({ state: 'visible', timeout: 12_000 });
      if (!(await centerDialog.locator('.global-ai-message.user').textContent())?.includes('结构化门诊摘要')) throw new Error('Agent 快捷任务未直接进入执行线程');
    } finally {
      if (await page.getByRole('dialog', { name: 'AI医助小南' }).isVisible()) {
        await page.keyboard.press('Escape');
        await page.getByRole('dialog', { name: 'AI医助小南' }).waitFor({ state: 'detached' });
      }
    }
  });

  await step('operation-guide', async () => {
    const trigger = page.getByRole('button', { name: '打开操作指引' });
    if (await trigger.locator('svg').count() !== 1) throw new Error('操作指引按钮缺少 SVG 图标');
    await trigger.click();
    let dialog = page.getByRole('dialog', { name: '操作指引' });
    await dialog.waitFor({ state: 'visible' });
    const guideBox = await dialog.boundingBox();
    if (!guideBox || guideBox.x < 0 || guideBox.x + guideBox.width > viewport.width + 1) throw new Error('操作指引超出视口');
    await page.screenshot({ path: resolve(projectDir, `output/playwright/operation-guide-${label}.png`), fullPage: false });
    await dialog.getByRole('button', { name: '患者主索引' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'patient-registry');
    await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
    await trigger.click();
    dialog = page.getByRole('dialog', { name: '操作指引' });
    await dialog.getByRole('button', { name: 'AI医助小南' }).click();
    await page.getByRole('dialog', { name: 'AI医助小南' }).waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await trigger.click();
    dialog = page.getByRole('dialog', { name: '操作指引' });
    await dialog.getByRole('button', { name: '关闭操作指引' }).click();
    await dialog.waitFor({ state: 'detached' });
  });

  await step('notifications', async () => {
    const trigger = page.getByRole('button', { name: /通知/ });
    if (await trigger.locator('svg').count() !== 1) throw new Error('通知按钮缺少 SVG 图标');
    await trigger.click();
    let menu = page.getByRole('region', { name: '通知中心' });
    await menu.waitFor({ state: 'visible' });
    const notificationBox = await menu.boundingBox();
    if (!notificationBox || notificationBox.x < 0 || notificationBox.x + notificationBox.width > viewport.width + 1) throw new Error('通知中心超出视口');
    await page.screenshot({ path: resolve(projectDir, `output/playwright/notification-center-${label}.png`), fullPage: false });
    await menu.getByRole('tab', { name: /未读/ }).click();
    await menu.getByRole('button', { name: '标记危急值待确认为已读' }).click();
    if ((await trigger.getAttribute('aria-label')) !== '通知，2 条未读') throw new Error('单条已读后未读数未更新');
    await menu.locator('.notification-main').filter({ hasText: '会诊即将超时' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'clinical-tasks');
    await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
    await trigger.click();
    menu = page.getByRole('region', { name: '通知中心' });
    await menu.getByRole('button', { name: '全部标为已读' }).click();
    if ((await trigger.getAttribute('aria-label')) !== '通知，无未读') throw new Error('清除未读后通知状态未更新');
    await menu.getByRole('tab', { name: /未读/ }).click();
    await menu.getByText('没有未读通知', { exact: true }).waitFor({ state: 'visible' });
  });

  await step('account-and-permission-entry', async () => {
    await page.getByRole('button', { name: '用户登录与账户' }).click();
    const menu = page.getByRole('region', { name: '用户账户' });
    if (viewport.width < 700) {
      await menu.getByLabel('账户菜单选择医院').selectOption('江城儿童医学中心');
      await menu.getByLabel('账户菜单选择角色').selectOption('系统管理员 · 平台治理');
      if ((await menu.getByLabel('账户菜单选择医院').inputValue()) !== '江城儿童医学中心') throw new Error('移动端医院切换失败');
      if ((await menu.getByLabel('账户菜单选择角色').inputValue()) !== '系统管理员 · 平台治理') throw new Error('移动端角色切换失败');
    }
    await menu.getByRole('link', { name: '账号与权限' }).click();
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'admin-users');
  });

  await step('topbar-no-overflow', async () => {
    const overflow = await page.locator('.topbar').evaluate((element) => element.scrollWidth > element.clientWidth + 1);
    if (overflow) throw new Error('顶栏存在横向溢出');
  });

  await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
  await page.screenshot({ path: resolve(projectDir, `output/playwright/topbar-${label}.png`), fullPage: false });
  await page.close();
}

try {
  await verify({ width: 1280, height: 800 }, '1280x800');
  await verify({ width: 390, height: 844 }, '390x844');
} finally {
  await browser.close();
}

const result = { run_at: new Date().toISOString(), checks: observations.length + findings.length, passed: observations.length, failed: findings.length, findings, observations };
await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ checks: result.checks, passed: result.passed, failed: result.failed, artifact: outputPath }));
if (findings.length) process.exitCode = 1;
