import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 360, height: 780 }, colorScheme: 'light', hasTouch: true, isMobile: true });
for (const r of ['#/', '#/reservas', '#/gastos', '#/repostajes', '#/estadisticas', '#/perfil', '#/viajes']) {
  await p.goto(`http://localhost:5173/?demo&como=marta&mucho${r}`);
  await p.waitForTimeout(600);
  await p.screenshot({ path: `.impeccable/review/mm-${r.replace(/[#/]+/g, '') || 'home'}.png`, fullPage: true });
}
await b.close();
