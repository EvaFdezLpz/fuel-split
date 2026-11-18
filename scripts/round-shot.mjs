import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const shots = [
  ['d-r-repostajes', '#/repostajes', 'dark', 1440, 900],
  ['m-r-repostajes', '#/repostajes', 'light', 390, 1100],
  ['d-r-detalle', '#/repostajes/demo0000000000000021', 'light', 1440, 1300],
  ['d-r-gastos', '#/gastos', 'dark', 1440, 900],
  ['d-r-perfil', '#/perfil', 'light', 1440, 1700],
  ['d-r-cal', '#/calendario', 'dark', 1440, 900],
  ['d-r-viajes', '#/viajes', 'light', 1440, 900],
];
for (const [name, hash, scheme, w, hgt] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  await p.goto(`http://localhost:5173/?demo&como=marta${hash}`);
  await p.waitForTimeout(800);
  if (name === 'd-r-cal') console.log('cal scroll', await p.evaluate(() => document.documentElement.scrollHeight - innerHeight));
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
  await p.close();
}
// Botón de tema
const p = await b.newPage({ viewport: { width: 1440, height: 700 }, colorScheme: 'light' });
await p.goto('http://localhost:5173/?demo&como=marta#/');
await p.waitForTimeout(600);
await p.click('.rail [data-theme-toggle]');
console.log('tema:', await p.evaluate(() => document.documentElement.dataset.theme), await p.evaluate(() => getComputedStyle(document.body).backgroundColor));
await p.screenshot({ path: '.impeccable/review/d-r-tema.png' });
await b.close();
