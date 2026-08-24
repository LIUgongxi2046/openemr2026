async page => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));

  await page.setViewportSize({ width: 1440, height: 1000 });
  const titles = await page.evaluate(() => fetch('/ui-delivery/route-titles.json').then(response => response.json()));
  const newSpecialtyRoutes = Object.keys(titles).filter(route => /^(obgyn|reproductive|pediatrics|neonatal|mental|ophthalmology|ent|dental|dermatology|tcm)-(evidence|treatment|followup)$/.test(route));
  const routes = ['outpatient', 'opd-record', 'record', 'specialty-center', ...newSpecialtyRoutes];
  const results = [];

  for (const route of routes) {
    await page.evaluate(nextRoute => { location.hash = nextRoute; }, route);
    await page.waitForFunction(expected => document.querySelector('.main')?.dataset.screenId === expected, route);
    await page.waitForTimeout(120);
    if (route === 'specialty-center' || route.endsWith('-evidence')) {
      await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
    }
    const audit = await page.evaluate(expectedTitle => ({
      h1: (document.querySelector('h1')?.textContent || '').trim(),
      expectedTitle,
      active: document.querySelectorAll('.nav-item.active').length,
      specialtyActive: document.querySelectorAll('.specialty-subnav-v13 button.active').length,
      fab: Boolean(document.querySelector('.ai-fab')),
      overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      imagesReady: [...document.images].every(image => image.complete && image.naturalWidth > 0),
      microphoneEmoji: [...document.querySelectorAll('button')].some(button => button.textContent.includes('🎙'))
    }), titles[route]);
    await page.screenshot({
      path: `/Users/liuhaoxian/Downloads/我的/AI项目/openEMR2026/ui-delivery/screens/${route}.png`,
      fullPage: true,
      scale: 'css',
      type: 'png'
    });
    results.push({ route, ...audit });
  }

  const failures = results.filter(row =>
    row.h1 !== row.expectedTitle || row.active !== 1 || !row.fab || row.overflow ||
    !row.imagesReady || row.microphoneEmoji ||
    (/-(evidence|treatment|followup)$/.test(row.route) && row.specialtyActive !== 1)
  );
  return {
    captured: results.length,
    newSpecialtyScreens: newSpecialtyRoutes.length,
    refreshedAffectedScreens: routes.length - newSpecialtyRoutes.length,
    failures,
    consoleErrors,
    pageErrors
  };
}
