import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [n, w] of [['d', 1440], ['m', 390]]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 }, colorScheme: 'light' });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/');
  await p.waitForTimeout(800);
  const el = await p.$('.pays');
  await el.scrollIntoViewIfNeeded();
  await (await el.evaluateHandle((e) => e.closest('section'))).asElement().screenshot({ path: `.impeccable/review/r8-${n}.png` });
  await p.close();
}
await b.close();
