// 轻量骨架 dump：只输出 tag + class + 直接文本（无计算样式），用于快速对比原型与生产的 DOM 结构。
// 用法: node scripts/dump-skeleton.mjs <url> [rootSelector]
import { chromium } from 'playwright';

const url = process.argv[2];
const sel = process.argv[3] || 'main';
if (!url) { console.error('usage: node dump-skeleton.mjs <url> [rootSelector]'); process.exit(2); }

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1500);
const root = await page.$(sel);
if (!root) { console.log('NO ROOT'); await browser.close(); process.exit(0); }
const out = await root.evaluate((el) => {
  const rows = [];
  const walk = (n, d) => {
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    const cls = (typeof n.className === 'string' ? n.className.trim() : '').slice(0, 56);
    let txt = '';
    for (const ch of n.childNodes) if (ch.nodeType === 3) txt += ch.textContent;
    txt = txt.replace(/\s+/g, ' ').trim().slice(0, 44);
    rows.push(`${'  '.repeat(d)}<${tag} .${cls}> ${txt}`);
    for (const ch of n.children) walk(ch, d + 1);
  };
  walk(el, 0);
  return rows.join('\n');
});
console.log(out);
await browser.close();
