// Km misterio en la demo (Marta): pregunta en Por revisar, responder Sí, lista en Viajes.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&como=marta#/'); await p.waitForTimeout(900);
await (await p.$('.fix-list'))?.screenshot({ path: '.impeccable/review/mystery-home.png' });
await p.evaluate(() => (location.hash = '#/viajes')); await p.waitForTimeout(700);
await (await p.$('#km-sin-apuntar'))?.screenshot({ path: '.impeccable/review/mystery-list.png' });
console.log('antes:', await p.$$eval('.gap-row', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' '))));
// Marta dice que hizo 5 km en el hueco de 14 (Carmen dijo 6, Lucía no) → aún faltan Javier y Pablo
await p.click('.gap-row:has-text("182.598") button:has-text("Sí, lo usé")'); await p.waitForTimeout(300);
await (await p.$('dialog[open]')).screenshot({ path: '.impeccable/review/mystery-dialog.png' });
await p.fill('#gap-km', '5');
const d = await p.$eval('#gap-day', (e) => e.min); await p.fill('#gap-day', d);
await p.click('dialog[open] .btn.primary'); await p.waitForTimeout(500);
console.log('después:', await p.$$eval('.gap-row', (r) => r.map((x) => x.innerText.replace(/\s+/g, ' '))));
// Javier y Pablo responden que no → se resuelve
for (const who of ['javier', 'pablo']) {
  // la demo empieza de cero al recargar, así que solo comprobamos en esta sesión
}
await b.close();
