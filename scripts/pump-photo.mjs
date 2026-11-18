// Sube una foto del surtidor al formulario de repostaje de la demo y muestra lo que lee: node scripts/pump-photo.mjs foto.jpg [otra.jpg]
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, file] of [['entera', process.argv[2]], ['recorte', process.argv[3] ?? process.argv[2]]]) {
  const p = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/repostajes/nuevo');
  await p.waitForTimeout(800);
  const t = Date.now();
  await p.setInputFiles('#r-receipt-gal', file);
  await p.waitForFunction(() => !document.querySelector('.ocr .spinner, [aria-live] .spinner') && /Rellenado|No se han|no está/.test(document.body.innerText), null, { timeout: 60000 });
  const msg = await p.evaluate(() => [...document.querySelectorAll('[aria-live]')].map((e) => e.textContent).find((t) => /Rellenado|No se han|no está/.test(t)));
  console.log(name, Date.now() - t, 'ms |', msg, '| importe', await p.inputValue('#r-amount'), '| precio', await p.inputValue('#r-price'));
  await p.close();
}
await b.close();
