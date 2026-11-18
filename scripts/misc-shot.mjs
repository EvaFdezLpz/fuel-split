import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const c = await b.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: 'light' });
const p = await c.newPage();
p.on('pageerror', (e) => console.log('pageerror', e.message));
for (const r of ['repostajes', 'gastos', '']) {
  await p.goto(`http://localhost:5173/?demo&como=carmen#/${r}`);
  await p.waitForTimeout(700);
  await p.screenshot({ path: `.impeccable/review/d-${r || 'home'}-names.png` });
}
await b.close();
