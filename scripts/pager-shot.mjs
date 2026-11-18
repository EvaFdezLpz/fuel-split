import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, vp, scheme] of [['d-pager-dark', { width: 1440, height: 900 }, 'dark'], ['m-pager-light', { width: 390, height: 800 }, 'light']]) {
  const p = await b.newPage({ viewport: vp, colorScheme: scheme });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/viajes');
  await p.waitForTimeout(700);
  console.log(name, 'p1 depósitos:', await p.locator('.deposit').count(), '|', await p.locator('.pager-info').innerText());
  await p.click('.pager-n:has-text("2")'); await p.waitForTimeout(300);
  console.log(name, 'p2 depósitos:', await p.locator('.deposit h2').allInnerTexts());
  await p.locator('.pager').scrollIntoViewIfNeeded();
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
}
await b.close();
