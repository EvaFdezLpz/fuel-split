import { chromium } from 'playwright-core';
import { readFileSync, writeFileSync } from 'node:fs';
const [max = 900, rot = 0, bright = 1, angle = 0, H = 180] = process.argv.slice(2).map(Number);
const b64 = readFileSync('tests/fixtures/c3-odometro-101566.png').toString('base64');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage();
await page.goto('http://localhost:5173/?demo#/');
const out = await page.evaluate(async ({ b64, max, rot, bright, angle, H }) => {
  const m = await import('/src/odometer-vision.ts');
  const bmp = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d'); ctx.filter = `brightness(${bright})`;
  ctx.translate(c.width / 2, c.height / 2); ctx.rotate((rot * Math.PI) / 180); ctx.translate(-c.width / 2, -c.height / 2);
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const r = m.readSevenSegment(ctx.getImageData(0, 0, c.width, c.height), { debugAngle: angle, debugH: H });
  const d = m.debugOut();
  const o = document.createElement('canvas'); o.width = d.w; o.height = d.h;
  const octx = o.getContext('2d'); const id = octx.createImageData(d.w, d.h);
  for (let i = 0; i < d.mask.length; i++) { const v = d.mask[i] ? 0 : 255; id.data[i*4]=v; id.data[i*4+1]=v; id.data[i*4+2]=v; id.data[i*4+3]=255; }
  octx.putImageData(id, 0, 0);
  return { url: o.toDataURL(), r, dbg: d.dbg };
}, { b64, max, rot, bright, angle, H });
writeFileSync('.impeccable/review/mask.png', Buffer.from(out.url.split(',')[1], 'base64'));
console.log(JSON.stringify(out.r.debug), out.r.lcd, '\n' + out.dbg.join('\n'));
await browser.close();
