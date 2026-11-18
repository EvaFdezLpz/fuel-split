import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [n, w, scheme] of [['d', 1440, 'light'], ['m', 390, 'dark']]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/');
  await p.waitForTimeout(800);
  await (await p.$('.quicks')).screenshot({ path: `.impeccable/review/r9-q-${n}.png` });
  await (await (await p.$('.pays')).evaluateHandle((e) => e.closest('section'))).asElement().screenshot({ path: `.impeccable/review/r9-pay-${n}.png` });
  await p.goto('http://localhost:5173/?demo&como=marta#/reservas');
  await p.waitForTimeout(600);
  await p.click('details.more summary');
  await p.waitForTimeout(200);
  await p.screenshot({ path: `.impeccable/review/r9-res-${n}.png`, fullPage: true });
  await p.close();
}
await b.close();
