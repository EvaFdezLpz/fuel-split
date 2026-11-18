import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const scheme of ['dark']) {
  const c = await b.newContext({ viewport: { width: 1440, height: 1100 }, colorScheme: scheme });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo#/repostajes/nuevo');
  await p.waitForTimeout(800);
  await p.fill('#r-amount', '198,33');
  await p.fill('#r-price', '1,529');
  await p.fill('#odo-km', '182.731');
  await p.waitForTimeout(200);
  await p.locator('#odo-km').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `.impeccable/review/d-tramo-${scheme}.png`, fullPage: true });
}
await b.close();
