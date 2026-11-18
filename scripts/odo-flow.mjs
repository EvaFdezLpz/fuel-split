// Sube la foto real del C3 al formulario de viaje y comprueba la cifra y la corrección manual.
import { chromium } from 'playwright-core';
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await browser.newContext({ viewport: { width: 390, height: 1400 }, colorScheme: 'dark', deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://localhost:5173/?demo#/viajes/nuevo');
await page.waitForSelector('#start-photo', { state: 'attached' });
const t0 = Date.now();
await page.setInputFiles('#start-photo', 'tests/fixtures/c3-odometro-101566.png');
await page.waitForFunction(() => /Lectura detectada|No se ha podido|no está disponible/.test(document.querySelector('#start-km')?.closest('.field')?.textContent ?? ''), null, { timeout: 60000 });
console.log('tiempo', Date.now() - t0, 'ms | km:', await page.inputValue('#start-km'));
await page.fill('#start-km', '101.567');
console.log('aviso:', (await page.locator('#start-km').locator('xpath=ancestor::div[contains(@class,"field")][1]').innerText()).replace(/\s+/g, ' '));
await page.locator('#start-km').scrollIntoViewIfNeeded();
await page.screenshot({ path: '.impeccable/review/m-odo-real.png' });
console.log('botones:', await page.locator('.photo-pick label').allInnerTexts(), '| capture:', await page.getAttribute('#start-photo', 'capture'));
await browser.close();
