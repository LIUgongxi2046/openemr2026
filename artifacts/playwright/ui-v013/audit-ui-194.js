async page => {
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', message => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.setViewportSize({ width: 1440, height: 1000 });

  const result = await page.evaluate(async () => {
    const [csv, titles] = await Promise.all([
      fetch('/docs/design/ui-delivery/route-design-map.csv').then(response => response.text()),
      fetch('/docs/design/ui-delivery/route-titles.json').then(response => response.json())
    ]);
    const routes = csv.trim().split(/\r?\n/).slice(1)
      .map(line => (line.match(/^"[^"]*","[^"]*","([^"]+)"/) || [])[1])
      .filter(Boolean);
    const failures = [];
    let specialtyChecked = 0;
    let generatedVisualChecked = 0;

    for (const route of routes) {
      location.hash = route;
      await new Promise(resolve => setTimeout(resolve, 45));
      window.decorateUiDelivery?.();
      const h1 = (document.querySelector('h1')?.textContent || '').trim();
      const active = document.querySelectorAll('.nav-item.active').length;
      const fab = Boolean(document.querySelector('.ai-fab'));
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth + 1;
      const screen = document.querySelector('.main')?.dataset.screenId || '';
      const imagesReady = [...document.images].every(image => image.complete && image.naturalWidth > 0);
      const microphoneEmoji = [...document.querySelectorAll('button')].some(button => button.textContent.includes('🎙'));
      const finalNavIcons = document.querySelectorAll('.nav-item .ui-icon').length;
      const isSpecialty = /^(obgyn|reproductive|pediatrics|neonatal|mental|ophthalmology|ent|dental|dermatology|tcm)-(workbench|record|evidence|treatment|care|followup|qc)$/.test(route);
      let specialtyActive = null;
      let verticalOverlap = false;
      if (isSpecialty) {
        specialtyChecked += 1;
        specialtyActive = document.querySelectorAll('.specialty-subnav-v13 button.active').length;
        const top = document.querySelector('.specialty-nav')?.getBoundingClientRect();
        const sub = document.querySelector('.specialty-subnav-v13')?.getBoundingClientRect();
        const head = document.querySelector('.page-head')?.getBoundingClientRect();
        verticalOverlap = Boolean(top && sub && head && (top.bottom > sub.top + 1 || sub.bottom > head.top + 1));
      }
      if (route === 'specialty-center' || route.endsWith('-evidence')) generatedVisualChecked += 1;

      const reasons = [];
      if (h1 !== titles[route]) reasons.push(`h1:${h1}!=${titles[route]}`);
      if (active !== 1) reasons.push(`active:${active}`);
      if (!fab) reasons.push('fab:false');
      if (overflow) reasons.push('overflow:true');
      if (screen !== route) reasons.push(`screen:${screen}`);
      if (!imagesReady) reasons.push('image:false');
      if (microphoneEmoji) reasons.push('microphoneEmoji:true');
      if (finalNavIcons < 14) reasons.push(`finalNavIcons:${finalNavIcons}`);
      if (isSpecialty && specialtyActive !== 1) reasons.push(`specialtyActive:${specialtyActive}`);
      if (verticalOverlap) reasons.push('specialtyVerticalOverlap:true');
      if (reasons.length) failures.push({ route, reasons });
    }

    return { routes: routes.length, specialtyChecked, generatedVisualChecked, failures };
  });

  return { result, consoleErrors, pageErrors };
}
