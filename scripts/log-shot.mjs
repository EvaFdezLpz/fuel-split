// Capturas de «Por revisar» y del registro de movimientos (demo).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, hgt, mob] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:5173/?demo&como=marta#/');
  await p.waitForTimeout(900);
  await (await p.$('.fix-list'))?.screenshot({ path: `.impeccable/review/fix-${w}.png` });
  await p.evaluate(() => (location.hash = '#/gastos'));
  await p.waitForTimeout(600);
  await p.click('.seg-control button:has-text("Registro")');
  await p.waitForTimeout(500);
  await (await p.$('#registro'))?.screenshot({ path: `.impeccable/review/log-${w}.png` });
  console.log(w, 'filas:', await p.$$eval('.log-row', (r) => r.length), '| desborda:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  // Me deben → «Ya me lo pagó»
  await p.click('.seg-control button:has-text("Me deben")');
  await p.waitForTimeout(400);
  console.log(w, 'botones Me deben:', await p.$$eval('.tile-foot button', (bs) => [...new Set(bs.map((x) => x.innerText.trim()))]));
  await p.close();
}
await b.close();
