async (page) => {
  const routes = await page.evaluate(async () => (
    await import('/src/generated/route-contract.ts')
  ).generatedRouteContract.routes.map((route) => ({ id: route.route_id, title: route.title })));
  const base = 'http://127.0.0.1:4177/';
  const failures = [];
  const consoleIssues = [];
  let currentRoute = 'bootstrap';
  page.on('console', (message) => {
    if (message.type() === 'error' || message.type() === 'warning') {
      consoleIssues.push({ route: currentRoute, type: message.type(), text: message.text() });
    }
  });
  for (const route of routes) {
    currentRoute = route.id;
    await page.goto(`${base}#/${route.id}`, { waitUntil: 'domcontentloaded' });
    const h1 = await page.locator('h1').first().textContent({ timeout: 3000 }).catch(() => null);
    const activePrimaryNavigation = await page.locator('nav[aria-label="一级导航"] [aria-current="page"]').count();
    const horizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    if (!h1) failures.push({ route: route.id, issue: 'H1_MISSING' });
    if (activePrimaryNavigation !== 1) failures.push({ route: route.id, issue: 'PRIMARY_NAV_ACTIVE_COUNT', actual: activePrimaryNavigation });
    if (horizontalOverflow) failures.push({ route: route.id, issue: 'HORIZONTAL_OVERFLOW' });
  }
  currentRoute = 'unknown';
  await page.goto(`${base}#/route-that-does-not-exist`, { waitUntil: 'domcontentloaded' });
  const unknownBody = await page.locator('body').innerText();
  const unknownSafe = unknownBody.includes('页面不存在或尚未登记') && !unknownBody.includes('合成患者');
  if (!unknownSafe) failures.push({ route: 'unknown', issue: 'UNKNOWN_ROUTE_NOT_FAIL_CLOSED' });
  return {
    routes: routes.length,
    verified: routes.length - new Set(failures.filter((failure) => failure.route !== 'unknown').map((failure) => failure.route)).size,
    failures,
    consoleIssues,
    unknownSafe,
  };
}
