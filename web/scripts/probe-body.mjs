// 捕获 metric-snapshots GET 原始响应体，定位 CONTRACT_MISMATCH 根因
import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
let body = null;
page.on('response', async (r) => {
  if (r.url().includes('/api/v1/metric-snapshots') && r.request().method() === 'GET') {
    try { body = await r.text(); } catch { /* ignore */ }
  }
});
await page.goto('http://127.0.0.1:4177/#/data-center', { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(4000);
console.log(body ?? 'NO BODY');
await browser.close();
