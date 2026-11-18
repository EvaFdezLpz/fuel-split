import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&como=marta#/repostajes/nuevo'); await p.waitForTimeout(900);
await p.fill('#r-amount', '61,50'); await p.fill('#r-price', '1,549');
const odo = await p.$('#odo-km');
for (const km of ['190000', '182800']) {
  await odo.fill(km); await odo.dispatchEvent('input'); await p.waitForTimeout(400);
  console.log(km, '| aviso:', await p.$eval('.split-note', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '-'));
  console.log(km, '| tramo:', await p.$eval('.tramo-line', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '-'));
}
await (await p.$('.split-note'))?.screenshot({ path: 'C:/Users/evafe/AppData/Local/Temp/claude/545a0b153ca02059/3538cf9d-5f71-4ede-b8b6-75efe78aee32/scratchpad/other-open.png' });
await b.close();
