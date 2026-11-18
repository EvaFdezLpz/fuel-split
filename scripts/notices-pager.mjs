import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1.5, isMobile: mob, hasTouch: mob });
  for (const who of ['marta', 'javier', 'lucia', 'pablo', 'carmen']) {
    await p.goto(`http://localhost:5173/?demo&mucho&como=${who}#/avisos`); await p.waitForTimeout(1200);
    const pg = await p.$('.notice-group .pager');
    if (pg) { await (await pg.evaluateHandle((e) => e.closest('section'))).asElement().screenshot({ path: `.impeccable/review/notices-pager-${w}.png` }); console.log(w, who, 'ok'); break; }
  }
  await p.close();
}
await b.close();
