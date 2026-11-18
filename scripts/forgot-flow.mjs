// Prueba del flujo de olvidos en la demo: km sin apuntar → «Fui yo» → ajustes; y foto añadida tarde.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'light', isMobile: true, hasTouch: true });
p.on('pageerror', (e) => console.log('pageerror', e.message));
p.on('dialog', (d) => d.accept());
const nav = async (h) => {
  await p.evaluate((x) => (location.hash = x), h);
  await p.waitForTimeout(500);
};
const shotOf = async (sel, name) => {
  const el = await p.$(sel);
  if (!el) return console.log('no existe', sel);
  const box = await el.evaluateHandle((e) => e.closest('section') ?? e);
  await box.asElement().screenshot({ path: `.impeccable/review/fg-${name}.png` });
};

await p.goto('http://localhost:5173/?demo&como=marta#/');
await p.waitForTimeout(700);
console.log('Resumen antes:', await p.$eval('.fix-list', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '-'));
await nav('#/viajes');
const rows = await p.$$('.gap-row');
for (const r of rows) if ((await r.innerText()).includes('17 km')) await (await r.$('button')).click();
await p.waitForTimeout(500);
await p.screenshot({ path: '.impeccable/review/fg-form.png', fullPage: true });
await p.click('form button[type=submit]');
await p.waitForTimeout(700);
console.log('Huecos después:', await p.$$eval('.gap-row .gap-km', (r) => r.map((e) => e.textContent)));
await nav('#/');
await shotOf('.pays', 'home-pays');
await nav('#/gastos');
await p.screenshot({ path: '.impeccable/review/fg-gastos.png', fullPage: true });

// Javier (llenó ese depósito) ve que tiene que devolver diferencias
await p.goto('http://localhost:5173/?demo&como=javier#/');
await p.waitForTimeout(700);

// Pablo: viaje de hace 20 días sin foto de inicio → «Añadir foto»
await p.goto('http://localhost:5173/?demo&como=pablo#/');
await p.waitForTimeout(700);
console.log('Resumen Pablo:', await p.$eval('.fix-list', (e) => e.innerText.replace(/\s+/g, ' ')).catch(() => '-'));
const add = await p.$('.fix-row a[href*="editar"]');
if (add) {
  await add.click();
  await p.waitForTimeout(600);
  await p.screenshot({ path: '.impeccable/review/fg-photo-only.png', fullPage: true });
  console.log('campos bloqueados:', await p.$$eval('#trip-date, #start-km, #end-km, #trip-note', (els) => els.map((e) => e.disabled)));
}
await b.close();
