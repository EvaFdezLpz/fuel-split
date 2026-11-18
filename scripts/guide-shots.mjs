// Capturas del móvil (demo) para la guía de usuario. Uso: node scripts/guide-shots.mjs <carpeta>
import { chromium } from 'playwright-core';
const OUT = process.argv[2];
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: 'light', isMobile: true, hasTouch: true });
p.on('dialog', (d) => d.accept());
p.on('pageerror', (e) => console.log('pageerror', e.message));
const hideToast = () => p.addStyleTag({ content: '.toast{display:none!important} *{scrollbar-width:none} ::-webkit-scrollbar{display:none}' });
const go = async (hash) => { await p.evaluate((x) => (location.hash = x), hash); await p.waitForTimeout(700); await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(150); };
// Lleva un elemento a la parte de arriba (por debajo de la barra superior) y captura la pantalla.
const at = async (sel, offset = 70) => {
  const ok = await p.evaluate(([s, o]) => { const e = document.querySelector(s); if (!e) return false; scrollTo(0, e.getBoundingClientRect().top + scrollY - o); return true; }, [sel, offset]);
  if (!ok) console.log('no existe', sel);
  await p.waitForTimeout(250);
};
const shot = async (name) => { await p.screenshot({ path: `${OUT}/${name}.png` }); console.log('ok', name); };

await p.goto('http://localhost:5173/?demo&como=marta#/');
await p.waitForTimeout(900);
await hideToast();
await shot('inicio');
await at('.fix-list', 120); await shot('porrevisar');
await go('#/viajes/nuevo'); await shot('viaje');
await at('.who-chips', 120); await shot('acompanantes');
await go('#/viajes'); await at('#km-sin-apuntar', 64); await shot('huecos');
await (await p.$('.gap-row button.ghost')).click(); await p.waitForTimeout(600);
let c = await p.$$('.who-chips'); await (await c[0].$('button:has-text("Javier")')).click(); await p.waitForTimeout(150);
c = await p.$$('.who-chips'); await (await c[1].$('button:has-text("Carmen")')).click(); await p.waitForTimeout(150);
await p.evaluate(() => scrollTo(0, 0)); await p.waitForTimeout(200); await shot('fueotro');
await go('#/viajes'); await at('.person-grid.in-deposit', 64); await shot('viajes');
const shared = await p.$('tr:has(.with-mark)'); await shared?.click(); await p.waitForTimeout(500); await shot('detalle');
await p.keyboard.press('Escape'); await p.waitForTimeout(300);
await go('#/repostajes/nuevo'); await shot('repostar');
await go('#/repostajes'); await shot('repostajes');
await go('#/gastos'); await shot('gastos');
await go('#/reservas'); await shot('reservas');
await go('#/calendario'); await shot('calendario');
await go('#/estadisticas'); await shot('datos');
await go('#/perfil'); await shot('perfil');
await at('.calc, details', 120);
await b.close();
