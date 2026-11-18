import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, w, scheme] of [['d-prof2', 1440, 'light'], ['m-prof2', 390, 'dark']]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/perfil');
  await p.waitForTimeout(800);
  await p.setViewportSize({ width: w, height: await p.evaluate(() => document.documentElement.scrollHeight) });
  await p.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  await p.click('#por-viajes .month-nav button:first-child');
  await p.waitForTimeout(200);
  await (await p.$('#por-viajes')).screenshot({ path: `.impeccable/review/${name}-prev.png` });
  await p.close();
}
await b.close();
