import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
const page = await ctx.newPage();
// 1) Imagen de prueba de un cuentakilómetros: cifras claras sobre fondo oscuro.
await page.setContent('<body style="margin:0;background:#111"><div style="font:bold 90px monospace;color:#f2c14e;padding:40px 30px;letter-spacing:6px">182745</div></body>');
await page.setViewportSize({ width: 520, height: 200 });
const png = await page.screenshot();
// 2) Seguridad en preview (CSP + Trusted Types)
const p2 = await ctx.newPage();
const resp = await p2.goto('http://localhost:4173/?demo#/');
const h = resp.headers();
console.log('CSP:', (h['content-security-policy'] || 'MISSING').slice(0, 60) + '…', '| XFO:', h['x-frame-options'], '| nosniff:', h['x-content-type-options']);
await p2.waitForTimeout(800);
const tt = await p2.evaluate(() => {
  const d = document.createElement('div');
  d.innerHTML = '<img src=x onerror="window.__pwned=1"><b>ok</b>';
  let evalBlocked = false;
  try { eval('1'); } catch { evalBlocked = true; }
  return { sanitized: d.innerHTML, evalBlocked };
});
console.log('Trusted Types default policy:', JSON.stringify(tt));
// 3) OCR en dev
const p3 = await ctx.newPage();
p3.on('console', (m) => m.type() === 'error' && console.log('console error:', m.text()));
await p3.goto('http://localhost:5173/?demo#/viajes/nuevo');
await p3.waitForTimeout(800);
await p3.setInputFiles('#end-photo', { name: 'odo.png', mimeType: 'image/png', buffer: png });
await p3.waitForFunction(() => document.querySelectorAll('.ocr button').length > 0 || /No se ha podido|no está disponible/.test(document.querySelectorAll('.ocr')[1]?.textContent || ''), null, { timeout: 90000 });
console.log('OCR:', await p3.evaluate(() => document.querySelectorAll('.ocr')[1].textContent), '| input:', await p3.inputValue('#end-km'));
// 4) Fichero falso (HTML disfrazado de .jpg)
await p3.setInputFiles('#start-photo', { name: 'x.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('<script>alert(1)</script>') });
await p3.waitForTimeout(500);
console.log('Fichero falso:', await p3.evaluate(() => document.querySelector('.reading .error, .reading .hint.error, .photo-pick .error')?.textContent));
await browser.close();
