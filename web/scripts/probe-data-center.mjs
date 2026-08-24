// 诊断 data-center 页：捕捉网络请求 + DOM 状态随时间变化
import { chromium } from 'playwright';

const url = 'http://127.0.0.1:4177/#/data-center';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
const reqs = [];
page.on('response', (r) => {
  const u = r.url();
  if (u.includes('/api/v1')) reqs.push({ method: r.request().method(), url: u.replace('http://127.0.0.1:4177', ''), status: r.status() });
});
page.on('requestfailed', (r) => reqs.push({ method: r.request().method(), url: r.url().replace('http://127.0.0.1:4177', ''), status: 'FAILED:' + r.failure()?.errorText }));

await page.goto(url, { waitUntil: 'domcontentloaded' }).catch(() => {});
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(1000);
  const state = await page.evaluate(() => {
    const main = document.querySelector('main');
    if (!main) return { stage: 'NO_MAIN' };
    const txt = main.innerText.replace(/\s+/g, ' ').trim();
    return {
      stage: txt.includes('正在读取') ? 'LOADING' : txt.includes('加载失败') ? 'ERROR' : txt.includes('暂无指标快照') ? 'EMPTY' : 'READY',
      rows: main.querySelectorAll('tbody tr').length,
      hasEmpty: !!main.querySelector('.empty-state'),
      notice: main.querySelector('.inline-notice')?.textContent?.trim() ?? null,
      snippet: txt.slice(0, 160),
    };
  });
  console.log(`t=${i + 1}s`, JSON.stringify(state));
}
console.log('--- network ---');
for (const r of reqs) console.log(r.method, r.status, r.url);
await browser.close();
