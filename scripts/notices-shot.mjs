import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=javier#/'); await p.waitForTimeout(1000);
  await p.screenshot({ path: `.impeccable/review/notices-home-${w}.png` });
  await p.evaluate(() => (location.hash = '#/avisos')); await p.waitForTimeout(800);
  await p.screenshot({ path: `.impeccable/review/notices-${w}.png`, fullPage: true });
  console.log(w, 'desborda', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.close();
}
await b.close();
