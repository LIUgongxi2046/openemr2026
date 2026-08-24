// Dump 实际渲染 DOM 结构 + 关键计算样式到文本，用于对齐高保真原型（DEVELOPMENT_PRINCIPLES.md §六.2）。
// 用法: node scripts/dump-render.mjs <url> [rootSelector] [label]
//   node scripts/dump-render.mjs http://127.0.0.1:4178/app/index.html '#app' proto-clinical
// 只 dump 内容区（默认 main），不输出 body/脚本/样式。
import { chromium } from 'playwright';

const url = process.argv[2];
const rootSelector = process.argv[3] || 'main';
const label = process.argv[4] || 'dump';

const STYLE_PROPS = [
  'display', 'flexDirection', 'gridTemplateColumns', 'gap', 'rowGap', 'columnGap',
  'padding', 'margin', 'borderRadius', 'border', 'background', 'backgroundColor',
  'fontSize', 'fontWeight', 'lineHeight', 'color', 'minHeight',
];

if (!url) {
  console.error('usage: node dump-render.mjs <url> [rootSelector] [label]');
  process.exit(2);
}

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
await page.goto(url, { waitUntil: 'networkidle' }).catch(() => {});
await page.waitForTimeout(1200);

const root = await page.$(rootSelector);
if (!root) {
  console.error(`[${label}] root selector "${rootSelector}" not found`);
  await browser.close();
  process.exit(3);
}

const tree = await root.evaluate((el) => {
  const out = [];
  const walk = (node, depth) => {
    if (node.nodeType !== 1) return;
    const tag = node.tagName.toLowerCase();
    const cls = typeof node.className === 'string' ? node.className.trim() : '';
    const id = node.id ? `#${node.id}` : '';
    // 直接文本（不含子元素），截断
    let text = '';
    for (const child of node.childNodes) {
      if (child.nodeType === 3) text += child.textContent;
    }
    text = text.replace(/\s+/g, ' ').trim().slice(0, 72);
    const cs = getComputedStyle(node);
    const style = {};
    for (const p of ['display', 'flexDirection', 'gridTemplateColumns', 'gap', 'padding', 'borderRadius', 'border', 'background', 'fontSize', 'fontWeight', 'color']) {
      const v = cs[p];
      if (v && v !== 'normal' && v !== 'none' && v !== 'rgba(0, 0, 0, 0)' && v !== 'auto') style[p] = v;
    }
    out.push(`${'  '.repeat(depth)}<${tag}${id} class="${cls}">${text} ${JSON.stringify(style)}`);
    for (const child of node.children) walk(child, depth + 1);
  };
  walk(el, 0);
  return out.join('\n');
});

console.log(`### ${label} — ${url} ${rootSelector}`);
console.log(tree);
await browser.close();
