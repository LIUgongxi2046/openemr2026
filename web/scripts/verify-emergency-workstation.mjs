import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectDir = resolve(webDir, '..');
const outputDir = resolve(projectDir, 'output/playwright/emergency-workstation-20260828');
const baseUrl = (process.env.OPENEMR2026_BROWSER_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const prototypeUrl = (process.env.OPENEMR2026_PROTOTYPE_BASE_URL || 'http://127.0.0.1:4180').replace(/\/$/, '');
const credentials = {
  username: process.env.OPENEMR2026_BROWSER_USERNAME || 'linwei',
  password: process.env.OPENEMR2026_BROWSER_PASSWORD || 'OpenEMR2026-dev!',
};
const routes = [
  { id: 'emergency', heading: '急诊工作台', dataText: '时间关键诊疗轴' },
  { id: 'er-triage', heading: '急诊预检分诊', dataText: '分诊台账', dialogs: ['新建分诊'] },
  { id: 'er-record', heading: '急诊病历与抢救记录', dataText: '急诊病历文档', dialogs: ['新建抢救记录'] },
  { id: 'er-observation', heading: '急诊抢救留观与去向', dataText: '留观台账', dialogs: ['新建留观'] },
  { id: 'er-nursing', heading: '急诊护理、输液与执行', dataText: '护理记录台账', dialogs: ['新建护理记录'] },
  { id: 'er-handoff', heading: '急诊会诊、交接与转运', dataText: '交接班台账', dialogs: ['新建交接班', '记录域切换'] },
];

await mkdir(outputDir, { recursive: true });
const browser = await chromium.launch({ headless: true });
const failures = [];
const checks = [];
const apiResponses = [];

async function check(name, action) {
  try {
    checks.push({ name, status: 'PASS', detail: await action() });
  } catch (error) {
    failures.push(`${name}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function login(page) {
  await page.goto(`${baseUrl}/#/login`, { waitUntil: 'domcontentloaded' });
  const button = page.getByRole('button', { name: '登录系统', exact: true });
  await button.waitFor({ timeout: 20_000 });
  await page.getByLabel('用户名').fill(credentials.username);
  await page.getByLabel('密码', { exact: true }).fill(credentials.password);
  await button.click();
  await page.waitForURL(/#\/clinical$/, { timeout: 20_000 });
}

async function openRoute(page, route) {
  await page.goto(`${baseUrl}/#/${route.id}`, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction((id) => document.documentElement.dataset.routeId === id, route.id, { timeout: 20_000 });
  await page.getByRole('heading', { name: route.heading, exact: true }).waitFor({ timeout: 20_000 });
  try {
    await page.waitForFunction((text) => {
      const root = document.querySelector('[data-page-root]');
      return root && !root.querySelector('.state-page') && (root.textContent || '').includes(text);
    }, route.dataText, { timeout: 20_000 });
  } catch (error) {
    const state = await page.locator('[data-page-root]').innerText().catch(() => '页面根节点不存在');
    throw new Error(`${route.id} 数据未就绪：${state.slice(0, 500)}; ${error instanceof Error ? error.message : String(error)}`);
  }
  await page.waitForTimeout(250);
}

async function assertNoOverflow(page, label) {
  const result = await page.evaluate(() => ({
    document: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    offenders: [...document.querySelectorAll('body *')].filter((element) => {
      const box = element.getBoundingClientRect();
      return box.right > document.documentElement.clientWidth + 1 || box.left < -1;
    }).slice(0, 8).map((element) => ({ tag: element.tagName, className: element.className, right: Math.round(element.getBoundingClientRect().right) })),
  }));
  if (result.document > 1) throw new Error(`${label} 水平溢出 ${result.document}px: ${JSON.stringify(result.offenders)}`);
}

async function assertNoControlOverlap(page, label) {
  const overlaps = await page.evaluate(() => {
    const controls = [...document.querySelectorAll('[data-page-root] button, [data-page-root] a')]
      .filter((element) => {
        const style = getComputedStyle(element);
        const rect = element.getBoundingClientRect();
        return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
      })
      .map((element) => ({ element, rect: element.getBoundingClientRect(), text: (element.textContent || '').trim().slice(0, 36) }));
    const hits = [];
    for (let left = 0; left < controls.length; left += 1) {
      for (let right = left + 1; right < controls.length; right += 1) {
        const a = controls[left];
        const b = controls[right];
        if (a.element.contains(b.element) || b.element.contains(a.element)) continue;
        const width = Math.min(a.rect.right, b.rect.right) - Math.max(a.rect.left, b.rect.left);
        const height = Math.min(a.rect.bottom, b.rect.bottom) - Math.max(a.rect.top, b.rect.top);
        if (width > 1 && height > 1) hits.push(`${a.text} <> ${b.text}`);
      }
    }
    return hits.slice(0, 8);
  });
  if (overlaps.length) throw new Error(`${label} 控件相互遮挡: ${overlaps.join('; ')}`);
}

async function assertEmergencyWorkspaceStructure(page, mobile = false) {
  const result = await page.evaluate(() => {
    const grid = document.querySelector('.emergency-grid');
    const queue = document.querySelector('.emergency-queue-rail');
    const timeline = document.querySelector('.emergency-timeline-card');
    const right = document.querySelector('.emergency-right-rail');
    const strip = document.querySelector('.emergency-patient-strip');
    if (!grid || !queue || !timeline || !right || !strip) return null;
    const boxes = [queue, timeline, right].map((element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
    });
    return {
      columns: getComputedStyle(grid).gridTemplateColumns,
      boxes,
      rightText: right.textContent || '',
      stripHeight: strip.getBoundingClientRect().height,
    };
  });
  if (!result) throw new Error('急诊原型核心结构缺失');
  for (const marker of ['阻断', '团队任务', '去向闭环', '交接门禁']) {
    if (!result.rightText.includes(marker)) throw new Error(`急诊右侧栏缺少「${marker}」`);
  }
  if (result.stripHeight < 50) throw new Error('急诊患者上下文条未正确展示');
  if (!mobile) {
    if (result.columns.trim().split(/\s+/).length !== 3) throw new Error(`宽屏急诊工作台不是三栏：${result.columns}`);
    if (result.boxes[2].width < 280 || result.boxes[2].x <= result.boxes[1].x) throw new Error(`右侧栏尺寸/位置异常：${JSON.stringify(result.boxes)}`);
  } else if (result.boxes[2].y <= result.boxes[1].y) {
    throw new Error(`移动端右侧栏未顺序下排：${JSON.stringify(result.boxes)}`);
  }
}

async function openAndCancelDialog(page, buttonName, routeId) {
  const trigger = page.getByRole('button', { name: buttonName, exact: true }).first();
  await trigger.waitFor({ timeout: 10_000 });
  if (await trigger.isDisabled()) return `${buttonName} 因当前流程占用被正确禁用`;
  await trigger.click();
  const dialog = page.locator('dialog.admin-action-dialog[open]');
  await dialog.waitFor({ timeout: 10_000 });
  if (await dialog.count() !== 1) throw new Error(`${routeId}/${buttonName} 未打开唯一弹窗`);
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport || bounds.x < -1 || bounds.y < -1 || bounds.x + bounds.width > viewport.width + 1 || bounds.y + bounds.height > viewport.height + 1) {
    throw new Error(`${routeId}/${buttonName} 弹窗越界`);
  }
  const cancel = dialog.getByRole('button', { name: '取消', exact: true });
  if (await cancel.count()) await cancel.click();
  else await page.keyboard.press('Escape');
  await dialog.waitFor({ state: 'hidden', timeout: 10_000 });
  return `${buttonName} 弹窗可打开、可关闭、不越界`;
}

const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const page = await context.newPage();
page.on('pageerror', (error) => failures.push(`pageerror: ${error.message}`));
page.on('response', (response) => {
  if (response.url().includes('/api/v1/')) {
    apiResponses.push({ status: response.status(), url: response.url() });
    if (response.status() >= 500) failures.push(`${response.status()} ${response.url()}`);
  }
});

try {
  await login(page);
  await check('desktop-six-routes-live-data-and-layout', async () => {
    for (const route of routes) {
      await openRoute(page, route);
      const links = page.locator('.center-nav.domain a');
      if (await links.count() !== 6) throw new Error(`${route.id} 急诊二级导航不是 6 项`);
      if (await page.locator('.center-nav.domain a.router-link-active').count() !== 1) throw new Error(`${route.id} 活动导航不唯一`);
      await assertNoOverflow(page, `${route.id}/1440`);
      await assertNoControlOverlap(page, `${route.id}/1440`);
      if (route.id === 'emergency') await assertEmergencyWorkspaceStructure(page);
      await page.screenshot({ path: resolve(outputDir, `${route.id}-1440x1000.png`), fullPage: true });
    }
    return '6/6 路由、实时数据区、导航与宽屏布局通过';
  });

  await check('all-primary-create-dialogs', async () => {
    const details = [];
    for (const route of routes.filter((item) => item.dialogs)) {
      await openRoute(page, route);
      for (const buttonName of route.dialogs) details.push(await openAndCancelDialog(page, buttonName, route.id));
    }
    return details;
  });

  await check('existing-row-edit-delete-dialogs', async () => {
    const details = [];
    for (const route of routes.filter((item) => ['er-triage', 'er-record', 'er-observation', 'er-nursing', 'er-handoff'].includes(item.id))) {
      await openRoute(page, route);
      for (const pattern of [/^\u7f16\u8f91/, /^\u5220\u9664$/]) {
        const candidates = page.getByRole('button', { name: pattern });
        for (let index = 0; index < await candidates.count(); index += 1) {
          const candidate = candidates.nth(index);
          if (await candidate.isVisible() && !await candidate.isDisabled()) {
            details.push(await openAndCancelDialog(page, (await candidate.innerText()).trim(), route.id));
            break;
          }
        }
      }
    }
    if (details.length < 4) throw new Error(`可操作的编辑/删除弹窗覆盖不足：${details.length}`);
    return details;
  });

  await check('mobile-six-routes-and-dialog-layout', async () => {
    const mobileContext = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const mobile = await mobileContext.newPage();
    try {
      // The clinical session intentionally lives in sessionStorage, which is not
      // transferred by browserContext.storageState(). Authenticate the mobile
      // tab independently so the layout audit covers the actual clinical pages.
      await login(mobile);
      for (const route of routes) {
        await openRoute(mobile, route);
        await mobile.waitForFunction(() => document.querySelectorAll('.center-nav.domain a').length === 6, null, { timeout: 10_000 });
        if (await mobile.locator('.center-nav.domain a').count() !== 6) throw new Error(`${route.id} 移动端导航不完整`);
        await assertNoOverflow(mobile, `${route.id}/390`);
        await assertNoControlOverlap(mobile, `${route.id}/390`);
        if (route.id === 'emergency') await assertEmergencyWorkspaceStructure(mobile, true);
      }
      await openRoute(mobile, routes.find((item) => item.id === 'er-nursing'));
      await openAndCancelDialog(mobile, '新建护理记录', 'er-nursing/mobile');
      await mobile.screenshot({ path: resolve(outputDir, 'er-nursing-390x844.png'), fullPage: true });
      return '6/6 路由在 390px 无页面溢出，业务弹窗不越界';
    } finally {
      await mobileContext.close();
    }
  });

  await check('prototype-reference-captured', async () => {
    const prototype = await context.newPage();
    try {
      await prototype.goto(`${prototypeUrl}/#emergency`, { waitUntil: 'domcontentloaded' });
      await prototype.waitForTimeout(1_000);
      await prototype.screenshot({ path: resolve(outputDir, 'prototype-emergency-1440x1000.png'), fullPage: true });
      return '已保存 4180 原型急诊工作台对照证据';
    } finally {
      await prototype.close();
    }
  });
} finally {
  await context.close();
  await browser.close();
}

const emergencyApi = apiResponses.filter((item) => /emergency|triage|observation|resuscitation|nursing|shift-handover|domain-switch/.test(item.url));
if (emergencyApi.length < 10) failures.push(`急诊 API 覆盖不足：${emergencyApi.length}`);
const result = {
  run_at: new Date().toISOString(),
  base_url: baseUrl,
  prototype_url: prototypeUrl,
  passed: checks.length,
  failed: failures.length,
  checks,
  api_response_count: emergencyApi.length,
  api_statuses: [...new Set(emergencyApi.map((item) => item.status))],
  failures,
};
const artifact = resolve(outputDir, 'emergency-workstation-acceptance.json');
await writeFile(artifact, `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ ...result, artifact }, null, 2));
if (failures.length) process.exitCode = 1;
