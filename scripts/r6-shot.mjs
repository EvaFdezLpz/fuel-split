import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, hash, w, scheme] of [['d-stats6', '#/estadisticas', 1440, 'light'], ['m-stats6', '#/estadisticas', 390, 'dark'], ['d-prof6', '#/perfil', 1440, 'light']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto(`http://localhost:5173/?demo&como=marta${hash}`);
  await p.waitForTimeout(800);
  await p.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  await p.close();
}
await b.close();
