// Botones de pagos del resumen, tarjetas de Gastos y diálogo del Bizum olvidado (demo, Javier).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, hgt, mob] of [[390, 844, true], [1280, 900, false]]) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, deviceScaleFactor: 2, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=javier#/');
  await p.waitForTimeout(900);
  await (await p.$('.pays'))?.screenshot({ path: `.impeccable/review/pays-${w}.png` });
  if (w === 390) {
    await p.evaluate(() => (location.hash = '#/gastos')); await p.waitForTimeout(600);
    await (await p.$('.tiles'))?.screenshot({ path: '.impeccable/review/tiles-390.png' });
    await p.goto('http://localhost:5173/?demo&como=marta#/gastos'); await p.waitForTimeout(900);
    await p.click('.seg-control button:has-text("Me deben")'); await p.waitForTimeout(400);
    await p.click('.tile-foot button:has-text("Ya me lo pagó")'); await p.waitForTimeout(400);
    await p.click('dialog[open] .btn.primary'); await p.waitForTimeout(200);
    console.log('vacío:', await p.$eval('dialog[open] .error', (e) => e.textContent));
    await p.fill('#forgot-amount', '25,76'); await p.waitForTimeout(100);
    await (await p.$('dialog[open]')).screenshot({ path: '.impeccable/review/forgot-dialog.png' });
    await p.click('dialog[open] .btn.primary'); await p.waitForTimeout(600);
    console.log('toast:', await p.$eval('.toast', (e) => e.innerText).catch(() => '-'));
    console.log('me deben tras anotarlo:', await p.$$eval('.debt-tile', (t) => t.map((x) => x.innerText.replace(/\s+/g, ' ').slice(0, 90))));
  }
  await p.close();
}
await b.close();
