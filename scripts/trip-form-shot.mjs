import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 390, height: 1000 }, colorScheme: 'light' });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&como=marta#/viajes/nuevo');
await p.waitForTimeout(700);
console.log('botones foto:', await p.locator('.photo-menu-wrap > button').count(), 'labels galería visibles:', await p.locator('label[for$="-gal"]:visible').count());
await p.screenshot({ path: '.impeccable/review/m-trip-form.png' });
await b.close();
