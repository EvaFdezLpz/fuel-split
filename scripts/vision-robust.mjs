import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const b64 = readFileSync('tests/fixtures/c3-odometro-101566.png').toString('base64');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/?demo#/');
const res = await page.evaluate(async (b64) => {
  const m = await import('/src/odometer-vision.ts');
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const out = [];
  for (const max of [1920, 1600, 1200, 900, 700]) for (const rot of [0, -3, 3]) for (const bright of [1, 0.75, 1.25]) {
    const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const ctx = c.getContext('2d');
    ctx.filter = `brightness(${bright})`;
    ctx.translate(c.width / 2, c.height / 2); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-c.width / 2, -c.height / 2);
    ctx.drawImage(bmp, 0, 0, c.width, c.height);
    const r = m.readSevenSegment(ctx.getImageData(0, 0, c.width, c.height));
    out.push(`${max}px rot${rot} luz${bright}: ${r.digits || '—'}`);
  }
  return out;
}, b64);
const ok = res.filter((r) => r.endsWith('101566')).length;
console.log(`${ok}/${res.length} correctas`);
console.log(res.filter((r) => !r.endsWith('101566')).join('\n'));
await browser.close();
