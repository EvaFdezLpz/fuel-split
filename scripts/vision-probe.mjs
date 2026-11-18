// Ejecuta el lector de 7 segmentos sobre una foto real en el navegador (vía servidor de desarrollo).
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const file = process.argv[2] ?? 'tests/fixtures/c3-odometro-101566.png';
const b64 = readFileSync(file).toString('base64');
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/?demo#/');
const res = await page.evaluate(async (b64) => {
  const m = await import('/src/odometer-vision.ts');
  const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob();
  const bmp = await createImageBitmap(blob);
  // Igual que la app: primero se reduce a 1600 px como máximo.
  const s = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const ctx = c.getContext('2d');
  ctx.drawImage(bmp, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  return m.readSevenSegment(img);
}, b64);
console.log(JSON.stringify(res));
await browser.close();
