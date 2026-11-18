import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
for (const r of ['gastos', 'repostajes', 'viajes', 'perfil']) {
  await p.goto(`http://localhost:5173/?demo&como=javier#/${r}`); await p.waitForTimeout(800);
  console.log(r, 'puntos visibles:', await p.$$eval('.dot', (d) => d.filter((x) => x.offsetWidth > 0 && !x.closest('.cal-dots,.cal-key')).length));
}
await p.goto('http://localhost:5173/?demo&como=javier#/gastos'); await p.waitForTimeout(800);
await (await p.$('.tiles')).screenshot({ path: '.impeccable/review/tiles-390.png' });
await b.close();
