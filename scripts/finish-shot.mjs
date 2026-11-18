import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 1000 }, deviceScaleFactor: 1.5, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=javier#/viajes'); await p.waitForTimeout(900);
  const id = await p.evaluate(() => [...document.querySelectorAll('a[href*="/editar"]')].map((a) => a.getAttribute('href'))[0]);
  // viaje en curso de Javier: abrir desde el resumen
  await p.goto('http://localhost:5173/?demo&como=javier#/'); await p.waitForTimeout(800);
  await p.click('a:has-text("Terminar viaje")'); await p.waitForTimeout(800);
  await p.screenshot({ path: `.impeccable/review/finish-${w}.png`, fullPage: true });
  await p.goto('http://localhost:5173/?demo&como=pablo#/viajes/nuevo'); await p.waitForTimeout(900);
  await p.click('button:has-text("Ya he llegado")'); await p.waitForTimeout(200);
  await p.screenshot({ path: `.impeccable/review/new-${w}.png`, fullPage: true });
  console.log(w, 'desborda:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  await p.close();
}
await b.close();
