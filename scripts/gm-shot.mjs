import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[390, true], [1280, false]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/viajes'); await p.waitForTimeout(900);
  // responde Sí, 5 km en el primero para ver la barra
  await p.click('.gm-card >> nth=0 >> button:has-text("Sí, lo usé")'); await p.waitForTimeout(300);
  await p.fill('#gap-km', '5'); await p.fill('#gap-day', await p.$eval('#gap-day', (e) => e.min));
  await p.click('dialog[open] .btn.primary'); await p.waitForTimeout(500);
  await (await p.$('#km-sin-apuntar')).screenshot({ path: `.impeccable/review/gm-${w}.png` });
  console.log(w, 'desborda:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.close();
}
await b.close();
