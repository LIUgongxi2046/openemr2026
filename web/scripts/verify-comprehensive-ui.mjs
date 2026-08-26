import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const webDir = resolve(fileURLToPath(new URL('..', import.meta.url)));
const projectDir = resolve(webDir, '..');
const contract = JSON.parse(await readFile(resolve(projectDir, 'contracts/generated/route-contract.generated.json'), 'utf8'));
const requestedRoutes = new Set((process.env.OPENEMR2026_BROWSER_ROUTES || '').split(',').filter(Boolean));
const routes = contract.routes.filter((route) => requestedRoutes.size === 0 || requestedRoutes.has(route.route_id));
const baseUrl = (process.env.OPENEMR2026_BROWSER_BASE_URL || 'http://127.0.0.1:4177').replace(/\/$/, '');
const viewportText = process.env.OPENEMR2026_UI_VIEWPORTS || '1280x800,390x844';
const viewports = viewportText.split(',').map((item) => {
  const [width, height] = item.split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height)) throw new Error(`Invalid viewport: ${item}`);
  return { width, height, label: `${width}x${height}` };
});
const outputDir = resolve(projectDir, 'output/playwright');
await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const findings = [];
const observations = [];

const pushFindings = (route, viewport, issues) => {
  for (const issue of issues) findings.push({ route, viewport, ...issue });
};

try {
  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    const consoleIssues = [];
    let currentRoute = 'bootstrap';
    page.on('console', (message) => {
      if (['error', 'warning'].includes(message.type())) consoleIssues.push({ route: currentRoute, type: message.type(), text: message.text() });
    });
    page.on('pageerror', (error) => consoleIssues.push({ route: currentRoute, type: 'pageerror', text: error.message }));

    for (const route of routes) {
      currentRoute = route.route_id;
      await page.goto(`${baseUrl}/#/${route.route_id}`, { waitUntil: 'domcontentloaded', timeout: 15_000 }).catch(() => null);
      await page.waitForFunction((routeId) => document.documentElement.dataset.routeId === routeId, route.route_id, { timeout: 8_000 }).catch(() => {});
      await page.waitForTimeout(200);
      const audit = await page.evaluate(({ expectedRoute, width }) => {
        const issues = [];
        const visible = (element) => {
          const rect = element.getBoundingClientRect();
          const style = getComputedStyle(element);
          return rect.width > 0 && rect.height > 0 && style.visibility !== 'hidden' && style.display !== 'none';
        };
        const h1 = [...document.querySelectorAll('main h1')].filter(visible);
        const routeId = document.documentElement.dataset.routeId;
        if (routeId !== expectedRoute) issues.push({ issue: 'ROUTE_RENDER_MISMATCH', expected: expectedRoute, actual: routeId });
        if (h1.length !== 1) issues.push({ issue: 'VISIBLE_H1_COUNT', expected: 1, actual: h1.length });
        if (document.documentElement.scrollWidth > window.innerWidth + 1) issues.push({ issue: 'HORIZONTAL_OVERFLOW', scroll_width: document.documentElement.scrollWidth, viewport_width: window.innerWidth });

        const mainContentIds = document.querySelectorAll('#main-content').length;
        if (mainContentIds !== 1) issues.push({ issue: 'MAIN_CONTENT_ID_COUNT', expected: 1, actual: mainContentIds });
        const nestedMains = document.querySelectorAll('main main').length;
        if (nestedMains) issues.push({ issue: 'NESTED_MAIN_LANDMARK', actual: nestedMains });

        const shellMain = document.querySelector('.main');
        if (shellMain) {
          const style = getComputedStyle(shellMain);
          const expectedPadding = width <= 600 ? 12 : 22;
          const left = Number.parseFloat(style.paddingLeft);
          const right = Number.parseFloat(style.paddingRight);
          if (Math.abs(left - expectedPadding) > 0.5 || Math.abs(right - expectedPadding) > 0.5) {
            issues.push({ issue: 'MAIN_INLINE_SPACING_DRIFT', expected_px: expectedPadding, actual_left_px: left, actual_right_px: right });
          }
        }
        const content = document.querySelector('.main > [data-page-root].content');
        if (content) {
          const style = getComputedStyle(content);
          if (Number.parseFloat(style.paddingLeft) !== 0 || Number.parseFloat(style.paddingRight) !== 0) {
            issues.push({ issue: 'DOUBLE_CONTENT_PADDING', left: style.paddingLeft, right: style.paddingRight });
          }
        }
        const prototypeHead = document.querySelector('.page-head');
        if (prototypeHead && Math.abs(prototypeHead.getBoundingClientRect().height - 72) > 1) {
          issues.push({ issue: 'PAGE_HEAD_HEIGHT_DRIFT', expected_px: 72, actual_px: prototypeHead.getBoundingClientRect().height });
        }
        const prototypeTitle = document.querySelector('.page-title h1, .page-heading h1');
        if (prototypeTitle) {
          const size = Number.parseFloat(getComputedStyle(prototypeTitle).fontSize);
          if (Math.abs(size - 21) > 0.5) issues.push({ issue: 'PAGE_TITLE_SIZE_DRIFT', expected_px: 21, actual_px: size });
        }
        const adminLayout = document.querySelector('.admin-layout');
        if (adminLayout && width > 1100) {
          const columns = getComputedStyle(adminLayout).gridTemplateColumns.split(' ').map(Number.parseFloat);
          if (columns.length >= 2 && columns[0] < columns[1] * 1.5) issues.push({ issue: 'ADMIN_PRIMARY_COLUMN_COLLAPSED', columns });
        }

        const typographyViolations = [];
        const textNodes = [...document.querySelectorAll('p,li,td,th,label,button,a,small')].filter(visible).slice(0, 600);
        for (const element of textNodes) {
          const text = element.textContent?.trim();
          if (!text) continue;
          const style = getComputedStyle(element);
          const fontSize = Number.parseFloat(style.fontSize);
          const lineHeight = Number.parseFloat(style.lineHeight);
          if (Number.isFinite(fontSize) && Number.isFinite(lineHeight) && lineHeight / fontSize < 1.2) {
            typographyViolations.push({ tag: element.tagName, class_name: element.className?.toString().slice(0, 80), ratio: Number((lineHeight / fontSize).toFixed(2)), text: text.slice(0, 60) });
          }
        }
        if (typographyViolations.length) issues.push({ issue: 'LINE_HEIGHT_BELOW_1_2', count: typographyViolations.length, samples: typographyViolations.slice(0, 5) });

        const unnamed = [...document.querySelectorAll('button,input,textarea,select')].filter(visible).filter((element) => {
          if (element.getAttribute('aria-label') || element.getAttribute('aria-labelledby') || element.getAttribute('title')) return false;
          if (element instanceof HTMLInputElement && ['hidden', 'submit', 'button'].includes(element.type)) return false;
          if (element.matches('button') && element.textContent?.trim()) return false;
          if (element.getAttribute('placeholder')) return false;
          if (element.id && document.querySelector(`label[for="${CSS.escape(element.id)}"]`)) return false;
          if (element.closest('label')) return false;
          return true;
        });
        if (unnamed.length) issues.push({ issue: 'UNNAMED_FORM_CONTROLS', count: unnamed.length, samples: unnamed.slice(0, 5).map((element) => ({ tag: element.tagName, type: element.getAttribute('type'), class_name: element.className?.toString().slice(0, 80) })) });

        const aiLauncher = document.querySelector('[aria-label="打开AI医助小南"]');
        if (!aiLauncher || !visible(aiLauncher)) issues.push({ issue: 'GLOBAL_AI_LAUNCHER_MISSING' });
        return {
          issues,
          h1: h1[0]?.textContent?.trim() ?? null,
          routeId,
          aiLauncherTag: aiLauncher?.tagName ?? null,
          bodyTextLength: document.body.innerText.length,
        };
      }, { expectedRoute: route.route_id, width: viewport.width });
      pushFindings(route.route_id, viewport.label, audit.issues);
      observations.push({ route: route.route_id, viewport: viewport.label, ...audit });
    }

    currentRoute = 'clinical';
    await page.goto(`${baseUrl}/#/clinical`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.documentElement.dataset.routeId === 'clinical', { timeout: 8_000 }).catch(() => {});
    const beforeUrl = page.url();
    const launcher = page.locator('[aria-label="打开AI医助小南"]');
    if (await launcher.count()) {
      await launcher.click();
      await page.waitForTimeout(150);
      const dialogCount = await page.getByRole('dialog').count();
      const routePreserved = page.url() === beforeUrl;
      if (dialogCount !== 1) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_NOT_OPENED_AS_DIALOG', expected: 1, actual: dialogCount });
      if (!routePreserved) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_LAUNCH_CHANGED_ROUTE', before: beforeUrl, after: page.url() });
      if (dialogCount === 1 && routePreserved) {
        const dialog = page.getByRole('dialog');
        await dialog.getByLabel('输入问题或任务').fill('验证当前页面上下文');
        await dialog.getByRole('button', { name: /^交给/ }).click();
        const responseVisible = await dialog.getByText('这是开发合成环境的确定性假模型回复', { exact: false })
          .waitFor({ state: 'visible', timeout: 8_000 }).then(() => true).catch(() => false);
        if (!responseVisible) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_DIALOG_RESPONSE_MISSING' });
        if (page.url() !== beforeUrl) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_DIALOG_INTERACTION_CHANGED_ROUTE', before: beforeUrl, after: page.url() });
        await page.keyboard.press('Escape');
        await page.waitForTimeout(100);
        if (await page.getByRole('dialog').count()) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_DIALOG_ESCAPE_DID_NOT_CLOSE' });
        const focusReturned = await page.evaluate(() => document.activeElement?.getAttribute('aria-label') === '打开AI医助小南');
        if (!focusReturned) findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_DIALOG_FOCUS_NOT_RESTORED' });
      }
    } else {
      findings.push({ route: 'clinical', viewport: viewport.label, issue: 'AI_DIALOG_FLOW_UNTESTABLE_NO_LAUNCHER' });
    }
    pushFindings('browser-console', viewport.label, consoleIssues.map((item) => ({ issue: 'CONSOLE_ISSUE', ...item })));
    await page.close();
  }
} finally {
  await browser.close();
}

const affectedRoutes = new Set(findings.filter((item) => !['browser-console'].includes(item.route)).map((item) => `${item.viewport}:${item.route}`));
const result = {
  run_at: new Date().toISOString(),
  routes: routes.length,
  viewports,
  route_viewports: routes.length * viewports.length,
  verified_route_viewports: routes.length * viewports.length - affectedRoutes.size,
  findings,
  observations,
};
await writeFile(resolve(outputDir, 'comprehensive-ui-audit.json'), `${JSON.stringify(result, null, 2)}\n`);
console.log(JSON.stringify({ routes: result.routes, route_viewports: result.route_viewports, verified_route_viewports: result.verified_route_viewports, findings: findings.length, artifact: resolve(outputDir, 'comprehensive-ui-audit.json') }));
if (findings.length) process.exitCode = 1;
