import { chromium } from 'playwright-core';
import { writeFileSync } from 'node:fs';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1280, height: 1000 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&como=marta#/repostajes/nuevo');
await p.waitForTimeout(600);
// Surtidor sintético con etiquetas de texto reales, cifras inclinadas y foto algo girada.
for (const [name, led] of [['lcd', false], ['led', true]]) {
  const url = await p.evaluate((led) => {
    const c = document.createElement('canvas'); c.width = 1400; c.height = 1050;
    const g = c.getContext('2d');
    g.fillStyle = '#5a6068'; g.fillRect(0, 0, 1400, 1050); // carcasa
    g.translate(700, 525); g.rotate(-0.04); g.translate(-700, -525);
    g.fillStyle = led ? '#111' : '#b9c4ad'; g.fillRect(330, 180, 760, 640);
    g.fillStyle = '#eee'; g.font = 'bold 34px sans-serif';
    ['IMPORTE €', 'LITROS', 'PRECIO €/L'].forEach((t, i) => g.fillText(t, 360, 240 + i * 210));
    g.fillStyle = '#ddd'; g.font = '28px sans-serif'; g.fillText('GASÓLEO A  ·  SURTIDOR 4', 420, 960);
    const SEG = { 0: 'abcdef', 1: 'bc', 2: 'abdeg', 3: 'abcdg', 4: 'bcfg', 5: 'acdfg', 6: 'acdefg', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg' };
    const ink = led ? '#ff5533' : '#1c211c', ghost = led ? '#3a1510' : '#a9b49e';
    const draw = (text, x, y, h) => {
      const w = h * 0.55, t = h * 0.12, gp = h * 0.03, half = h / 2;
      for (const ch of text) {
        if (ch === ',') { g.fillStyle = ink; g.fillRect(x - w * 0.25, y + h - t, t, t); continue; }
        const seg = { a: [gp + t / 2, 0, w - 2 * gp - t, t], g: [gp + t / 2, half - t / 2, w - 2 * gp - t, t], d: [gp + t / 2, h - t, w - 2 * gp - t, t], f: [0, gp + t / 2, t, half - 2 * gp - t / 2], b: [w - t, gp + t / 2, t, half - 2 * gp - t / 2], e: [0, half + gp, t, half - 2 * gp - t / 2], c: [w - t, half + gp, t, half - 2 * gp - t / 2] };
        for (const [set, col] of [['abcdefg', ghost], [SEG[ch], ink]]) for (const k of set) {
          const [sx, sy, sw, sh] = seg[k];
          g.save(); g.transform(1, 0, -0.1, 1, (y + h) * 0.1, 0); g.fillStyle = col; g.fillRect(x + sx, y + sy, sw, sh); g.restore();
        }
        x += w + h * 0.25;
      }
    };
    draw('61,75', 640, 200, 130); draw('40,12', 640, 410, 130); draw('1,539', 720, 640, 90);
    g.filter = 'blur(1.5px)'; g.drawImage(c, 0, 0); g.filter = 'none';
    return c.toDataURL('image/jpeg', 0.85);
  }, led);
  const file = `.impeccable/review/pump-${name}.jpg`;
  writeFileSync(file, Buffer.from(url.split(',')[1], 'base64'));
  await p.fill('#r-amount', ''); await p.fill('#r-price', '');
  const t0 = Date.now();
  await p.setInputFiles('#r-receipt-gal', file);
  await p.waitForFunction(() => document.querySelector('#r-amount').value || /No se han|no está/.test(document.querySelector('.reading .ocr')?.textContent ?? ''), null, { timeout: 60000 });
  console.log(name, 'importe', await p.inputValue('#r-amount'), 'precio', await p.inputValue('#r-price'), (Date.now() - t0) + 'ms', '|', await p.locator('.reading .ocr').first().textContent());
}
await p.screenshot({ path: '.impeccable/review/d-form-pump.png' });
await b.close();
