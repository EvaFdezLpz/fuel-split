import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1.5, isMobile: mob, hasTouch: mob });
  await p.goto('http://localhost:5173/?demo&como=pablo#/viajes/nuevo'); await p.waitForTimeout(900);
  await p.click('button:has-text("Ya he llegado")'); await p.waitForTimeout(200);
  await (await p.$('form')).screenshot({ path: `.impeccable/review/form-${w}.png` });
  await p.goto('http://localhost:5173/?demo&como=pablo#/repostajes/nuevo'); await p.waitForTimeout(900);
  await (await p.$('form')).screenshot({ path: `.impeccable/review/rform-${w}.png` });
  await p.close();
}
await b.close();
