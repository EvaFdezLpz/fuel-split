import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const shots = [
  ['d-home', '#/', 'light', 1440, 1600],
  ['m-home', '#/', 'dark', 390, 2400],
  ['d-reservas', '#/reservas', 'light', 1440, 900],
  ['d-res-form', '#/reservas/nueva', 'dark', 1440, 900],
  ['d-cal2', '#/calendario', 'light', 1440, 900],
  ['d-gastos2', '#/gastos', 'light', 1440, 900],
  ['m-tab', '#/reservas', 'light', 390, 900],
];
for (const [name, hash, scheme, w, hgt] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log(name, 'console', m.text()));
  await p.goto(`http://localhost:5173/?demo&como=marta${hash}`);
  await p.waitForTimeout(800);
  if (name === 'd-cal2') console.log('cal scroll', await p.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  if (name === 'd-res-form') {
    await p.click('#res-day');
    await p.waitForTimeout(200);
    await p.screenshot({ path: `.impeccable/review/${name}-picker.png` });
    await p.click('.drp-presets .chip:nth-child(3)');
    await p.fill('#res-note', 'Llevar a la abuela al médico');
  }
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
  if (name === 'd-res-form') {
    await p.click('button[type=submit]');
    await p.waitForTimeout(500);
    console.log('tras guardar:', p.url().split('#')[1], await p.locator('.res-tile').count(), 'tarjetas');
  }
  await p.close();
}
// Menú plegado
const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
await p.goto('http://localhost:5173/?demo&como=marta#/');
await p.waitForTimeout(600);
await p.click('.rail-toggle');
await p.waitForTimeout(300);
console.log('rail ancho', await p.evaluate(() => document.querySelector('.rail').getBoundingClientRect().width));
await p.screenshot({ path: '.impeccable/review/d-rail-mini.png' });
await p.reload();
await p.waitForTimeout(600);
console.log('tras recargar, plegado:', await p.evaluate(() => document.documentElement.hasAttribute('data-rail-mini')));
await b.close();
