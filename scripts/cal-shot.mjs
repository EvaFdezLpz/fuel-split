import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const run = async (name, vp, scheme, fn) => {
  const c = await b.newContext({ viewport: vp, colorScheme: scheme, deviceScaleFactor: 1 });
  const p = await c.newPage();
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await fn(p);
  await p.screenshot({ path: `.impeccable/review/${name}.png` });
  await c.close();
};
const D = { width: 1440, height: 1000 }, M = { width: 390, height: 1200 };
await run('d-cal-dark', D, 'dark', async (p) => { await p.goto('http://localhost:5173/?demo&como=carmen#/calendario'); await p.waitForTimeout(800); await p.locator('.cal-day:not(.out) .cal-num').nth(4).click(); await p.waitForTimeout(300); });
await run('m-cal-light', M, 'light', async (p) => { await p.goto('http://localhost:5173/?demo&como=carmen#/calendario'); await p.waitForTimeout(800); await p.locator('.cal-day.has:not(.out)').first().click(); await p.waitForTimeout(300); });
await run('d-filtro-light', D, 'light', async (p) => { await p.goto('http://localhost:5173/?demo&como=carmen#/viajes'); await p.waitForTimeout(800); await p.click('.drp-trigger'); await p.locator('.drp-day:not(.out)').nth(2).click(); await p.locator('.drp-day:not(.out)').nth(12).click(); await p.waitForTimeout(200); });
await run('m-filtro-dark', M, 'dark', async (p) => { await p.goto('http://localhost:5173/?demo&como=carmen#/viajes'); await p.waitForTimeout(800); await p.click('.filter-box summary'); await p.click('.drp-trigger'); await p.waitForTimeout(200); });
await run('d-cal-to-refuel', D, 'light', async (p) => { await p.goto('http://localhost:5173/?demo&como=carmen#/calendario'); await p.waitForTimeout(800); await p.click('.ev-fuel'); await p.waitForTimeout(900); console.log('url', p.url()); });
await b.close();
