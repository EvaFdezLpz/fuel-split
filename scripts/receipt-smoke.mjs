// Prueba de extremo a extremo de la lectura del ticket con una imagen sintética (modo demo, dev).
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
const mk = await ctx.newPage();
await mk.setViewportSize({ width: 420, height: 560 });
await mk.setContent(`<body style="margin:0;background:#f4f2ec;font:20px 'Courier New',monospace;color:#222;padding:24px;line-height:1.5">
<div style="text-align:center">ESTACION DE SERVICIO<br>AV. DE LA CONSTITUCION 12</div><br>
14/11/2026 18:42<br>SURTIDOR 4 &nbsp; SIN PLOMO 95<br><br>
LITROS &nbsp; &nbsp; &nbsp; &nbsp; 38,19<br>PRECIO EUR/L &nbsp; 1,529<br><br>
<b>TOTAL &nbsp; &nbsp; &nbsp; &nbsp; &nbsp;58,40 EUR</b><br><br>
BASE IMP. &nbsp; &nbsp; &nbsp;48,26<br>IVA 21% &nbsp; &nbsp; &nbsp; &nbsp;10,14<br>TARJETA &nbsp; &nbsp; &nbsp; &nbsp;58,40</body>`);
const png = await mk.screenshot();
const page = await ctx.newPage();
page.on('console', (m) => ['warning','error'].includes(m.type()) && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto('http://localhost:5173/?demo#/repostajes/nuevo');
await page.waitForTimeout(700);
await page.setInputFiles('#r-receipt', { name: 'ticket.png', mimeType: 'image/png', buffer: png });
await page.waitForFunction(() => /Leído del ticket|No se han podido|no está disponible/.test(document.querySelector('.reading .ocr')?.textContent || ''), null, { timeout: 120000 });
console.log('OCR ticket:', await page.evaluate(() => document.querySelector('.reading .ocr').textContent));
console.log('importe:', await page.inputValue('#r-amount'), '| precio:', await page.inputValue('#r-price'), '| fecha:', await page.inputValue('#r-date'));
await page.screenshot({ path: '.impeccable/review/d-ticket-ocr-light.png' });
await browser.close();
