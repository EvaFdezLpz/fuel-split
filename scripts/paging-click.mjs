// Pulsa «siguiente página» en cada lista paginada y comprueba que cambia el contenido (demo grande).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, mob] of [[1280, false], [390, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 }, isMobile: mob, hasTouch: mob });
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&mucho&como=marta#/'); await p.waitForTimeout(1500);
  const go = async (hash, tab) => {
    await p.evaluate((h) => (location.hash = h), hash); await p.waitForTimeout(700);
    if (tab) { await p.click(`.seg-control button:has-text("${tab}")`); await p.waitForTimeout(500); }
  };
  const check = async (label) => {
    const pagers = await p.$$('main .pager');
    for (let i = 0; i < pagers.length; i++) {
      const pg = (await p.$$('main .pager'))[i];
      const info = await pg.innerText();
      const next = await pg.$(':scope > button:last-of-type:not([disabled])');
      const before = await p.evaluate(() => document.querySelector('main')?.innerText.length);
      const block = await pg.evaluate((e) => e.closest('section')?.querySelector('h2')?.textContent ?? '?');
      if (!next) { console.log(w, label, block, '| sin botón |', info.replace(/\s+/g, ' ')); continue; }
      if (!(await next.isVisible())) { console.log(w, label, block, '| PAGER OCULTO |', info.replace(/\s+/g, ' '), await pg.evaluate((e) => e.parentElement?.outerHTML.slice(0, 200))); continue; }
      await next.click(); await p.waitForTimeout(500);
      const pg2 = (await p.$$('main .pager'))[i];
      const after = pg2 ? (await pg2.innerText()).replace(/\s+/g, ' ') : 'pager desaparecido';
      const wide = await p.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      console.log(w, label, '·', block, '|', info.replace(/\s+/g, ' '), '→', after, wide ? '| DESBORDA' : '');
    }
    if (!pagers.length) console.log(w, label, '(sin paginación)');
  };
  await go('#/viajes'); await check('viajes');
  await go('#/repostajes'); await check('repostajes');
  await go('#/gastos', 'Registro'); await check('registro');
  await go('#/gastos', 'Me deben'); await check('me deben');
  await go('#/reservas'); await check('reservas');
  await go('#/perfil'); await check('perfil');
  await go('#/repostajes'); 
  const id = await p.$$eval('a[href^="#/repostajes/"]', (as) => as.map((a) => a.getAttribute('href')).find((h) => !h.endsWith('nuevo')));
  await go(id); await p.$$eval('details', (d) => d.forEach((x) => (x.open = true))); await p.waitForTimeout(300);
  console.log(w, 'detalle repostaje', id, 'filas de viajes:', await p.$$eval('main tbody tr, main .trip', (r) => r.length), 'altura', await p.evaluate(() => document.documentElement.scrollHeight));
  await p.close();
}
await b.close();
