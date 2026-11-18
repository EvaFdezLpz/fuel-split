import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const shots = [
  ['d-stats', '#/estadisticas', 'light', 1440, 1100],
  ['d-stats-dark', '#/estadisticas', 'dark', 1440, 1100],
  ['m-stats', '#/estadisticas', 'light', 390, 1700],
  ['d-viajes3', '#/viajes', 'dark', 1440, 1300],
  ['m-viajes3', '#/viajes', 'light', 390, 1500],
  ['d-reservas3', '#/reservas', 'dark', 1440, 800],
  ['m-reservas3', '#/reservas', 'light', 390, 900],
  ['d-gastos3', '#/gastos', 'dark', 1440, 800],
];
for (const [name, hash, scheme, w, hgt] of shots) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  p.on('console', (m) => m.type() === 'error' && console.log(name, 'console', m.text()));
  await p.goto(`http://localhost:5173/?demo&como=marta${hash}`);
  await p.waitForTimeout(800);
  if (name === 'd-stats') {
    await p.hover('.chart-col:nth-of-type(6)');
    await p.waitForTimeout(150);
  }
  if (name === 'd-gastos3') { await p.click('.seg-control button:nth-child(3)'); await p.waitForTimeout(200); }
  if (name === 'd-viajes3') {
    await p.click('.sel-trigger');
    await p.waitForTimeout(150);
    await p.screenshot({ path: `.impeccable/review/${name}-sel.png`, clip: { x: 0, y: 0, width: 1440, height: 500 } });
    await p.keyboard.press('Escape');
  }
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
  await p.close();
}
await b.close();
