// Registrar viaje: «Lo termino más tarde» / «Ya he llegado» (demo, Pablo, que no tiene viaje en curso).
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
p.on('pageerror', (e) => console.log('pageerror', e.message));
p.on('dialog', (d) => d.accept());
await p.goto('http://localhost:5173/?demo&como=pablo#/viajes/nuevo'); await p.waitForTimeout(900);
const vis = () => p.$eval('#end-km, [id^=end]', (e) => !!e.closest('[hidden]') === false && e.offsetParent !== null).catch(() => 'no existe');
console.log('más tarde · final visible:', await vis(), '· botón:', await p.$eval('form button[type=submit]', (e) => e.innerText));
await p.screenshot({ path: '.impeccable/review/trip-later.png', fullPage: true });
await p.click('button:has-text("Ya he llegado")'); await p.waitForTimeout(300);
console.log('ya he llegado · final visible:', await vis(), '· botón:', await p.$eval('form button[type=submit]', (e) => e.innerText));
await p.click('form button[type=submit]'); await p.waitForTimeout(400);
console.log('sin km final:', await p.$$eval('.error', (e) => e.map((x) => x.textContent).filter(Boolean)));
await p.screenshot({ path: '.impeccable/review/trip-now.png', fullPage: true });
await p.click('button:has-text("Lo termino más tarde")'); await p.waitForTimeout(200);
await p.click('form button[type=submit]'); await p.waitForTimeout(800);
console.log('guardado:', await p.$eval('.toast', (e) => e.innerText).catch(() => '-'), location);
await b.close();
