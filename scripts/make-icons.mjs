// Genera los iconos de la app instalada (pantalla de inicio) a partir del dibujo del surtidor.
import { chromium } from 'playwright-core';
import { readFileSync } from 'node:fs';
const svg = readFileSync('public/favicon.svg', 'utf8').replace('<svg ', '<svg width="100%" height="100%" ').replaceAll('#2a2f37', '#16191e').replace('#5a4a2e', '#8a6a2a');
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
// scale: parte del lado que ocupa el surtidor (las «maskable» dejan margen para recortes redondos).
const jobs = [
  ['icon-192.png', 192, 0.62, 0.22],
  ['icon-512.png', 512, 0.62, 0.22],
  ['maskable-512.png', 512, 0.5, 0],
  ['apple-touch-icon.png', 180, 0.62, 0],
];
for (const [name, size, scale, radius] of jobs) {
  const p = await b.newPage({ viewport: { width: size, height: size } });
  const box = Math.round(size * scale);
  await p.setContent(`<html><body style="margin:0;background:transparent"><div style="width:${size}px;height:${size}px;display:grid;place-items:center;background:linear-gradient(160deg,#f7c35a,#eaa92c);border-radius:${radius * size}px"><div style="width:${box}px;height:${box}px">${svg}</div></div></body></html>`);
  await p.screenshot({ path: `public/icons/${name}`, omitBackground: radius > 0 });
  await p.close();
}
await b.close();
console.log('iconos listos');
