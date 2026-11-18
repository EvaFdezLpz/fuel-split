import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, vp, scheme] of [['d-perfil-dark', { width: 1440, height: 1500 }, 'dark'], ['m-perfil-light', { width: 390, height: 2400 }, 'light']]) {
  const c = await b.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=carmen#/perfil');
  await p.waitForTimeout(900);
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
}
await b.close();
