import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [w, hgt, mob] of [[390, 844, true], [360, 780, true]]) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, isMobile: mob, hasTouch: mob });
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:5173/?demo&como=marta#/viajes');
  await p.waitForTimeout(700);
  // un viaje apuntado por otro con acompañante y sin foto, como en la captura
  const rows = await p.$$('.gap-row');
  if (rows[0]) { await (await rows[0].$('button.ghost')).click(); await p.waitForTimeout(400);
    const c = await p.$$('.who-chips'); await (await c[0].$('button:has-text("Javier")')).click(); await p.waitForTimeout(150);
    const c2 = await p.$$('.who-chips'); await (await c2[1].$('button:has-text("Carmen")')).click();
    await p.click('form button[type=submit]'); await p.waitForTimeout(700); }
  const bad = await p.$$eval('.person-card', (cs) => cs.filter((c) => c.scrollWidth > c.clientWidth + 1 || c.getBoundingClientRect().right > (c.parentElement.getBoundingClientRect().right + 1)).length);
  console.log(w, 'tarjetas desbordadas:', bad, ' scroll horizontal página:', await p.evaluate(() => document.documentElement.scrollWidth > innerWidth));
  const card = await p.$('.person-card:has(.with-mark)');
  await card?.screenshot({ path: `.impeccable/review/card-${w}.png` });
  await p.close();
}
await b.close();
