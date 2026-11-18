import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1.5, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=javier#/perfil'); await p.waitForTimeout(900);
  await (await p.$('.totem')).screenshot({ path: `.impeccable/review/totem-${w}.png` });
  await p.close();
}
await b.close();
