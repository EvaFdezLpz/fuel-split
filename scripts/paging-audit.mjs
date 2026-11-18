// Con ?demo&mucho (unos dos años de datos): listas y tablas largas sin paginar, y altura de cada pantalla.
import { chromium } from 'playwright-core';
const routes = ['#/', '#/viajes', '#/calendario', '#/reservas', '#/repostajes', '#/gastos', '#/estadisticas', '#/perfil'];
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&mucho&como=marta#/'); await p.waitForTimeout(1500);
const audit = async (label) => {
  const r = await p.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('main ul, main ol, main tbody, main .tiles, main .gm-list')) {
      const n = [...el.children].filter((c) => c.offsetParent !== null).length;
      if (n < 12) continue;
      const block = el.closest('section, .block, details') ;
      const title = block?.querySelector('h2, h3, summary')?.textContent?.trim().slice(0, 40) ?? el.className;
      const pager = !!block?.querySelector('.pager');
      out.push(`${title} [${el.tagName.toLowerCase()}.${el.className}] filas=${n} pager=${pager}`);
    }
    return { h: document.documentElement.scrollHeight, out };
  });
  console.log(`${label}  altura=${r.h}`);
  for (const x of r.out) console.log('   ', x);
};
for (const r of routes) {
  await p.evaluate((h) => (location.hash = h), r); await p.waitForTimeout(900);
  await audit(r);
}
// Gastos: pestañas
for (const t of ['Me deben', 'Registro']) {
  await p.evaluate(() => (location.hash = '#/gastos')); await p.waitForTimeout(500);
  await p.click(`.seg-control button:has-text("${t}")`).catch(() => {}); await p.waitForTimeout(600);
  await audit(`#/gastos (${t})`);
}
// Detalle de un repostaje (viajes de ese depósito abiertos)
await p.evaluate(() => (location.hash = '#/repostajes')); await p.waitForTimeout(600);
const href = await p.$eval('a[href^="#/repostajes/"]', (a) => a.getAttribute('href')).catch(() => null);
if (href) { await p.evaluate((h) => (location.hash = h), href); await p.waitForTimeout(700); await p.$$eval('details', (d) => d.forEach((x) => (x.open = true))); await audit(href); }
// Perfil: «Todo»
await p.evaluate(() => (location.hash = '#/perfil')); await p.waitForTimeout(600);
await p.click('button:has-text("Todo")').catch(() => {}); await p.waitForTimeout(600);
await audit('#/perfil (Todo)');
await p.evaluate(() => (location.hash = '#/estadisticas')); await p.waitForTimeout(600);
await p.click('button:has-text("Todo")').catch(() => {}); await p.waitForTimeout(600);
await audit('#/estadisticas (Todo)');
await b.close();
