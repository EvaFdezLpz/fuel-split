import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, w, hgt, scheme] of [['d-form', 1440, 1100, 'light'], ['m-form', 390, 1700, 'dark']]) {
  const p = await b.newPage({ viewport: { width: w, height: hgt }, colorScheme: scheme });
  p.on('pageerror', (e) => console.log(name, 'pageerror', e.message));
  await p.goto('http://localhost:5173/?demo&como=marta#/repostajes/nuevo');
  await p.waitForTimeout(700);
  await p.click('.photo-menu-wrap button');
  const opts = await p.locator('#r-receipt-menu .photo-opt').allTextContents();
  console.log(name, 'menu:', opts, 'visible', await p.locator('#r-receipt-menu').isVisible());
  await p.screenshot({ path: `.impeccable/review/${name}-menu.png` });
  await p.keyboard.press('Escape');
  console.log('closed', await p.locator('#r-receipt-menu').isHidden());
  await p.setInputFiles('#odo-photo-gal', 'tests/fixtures/c3-odometro-101566.png');
  await p.fill('#r-amount', '46,00');
  await p.fill('#r-price', '1,529');
  await p.fill('#odo-km', '182.840');
  await p.dispatchEvent('#odo-km', 'input');
  await p.waitForTimeout(2500);
  await p.fill('#odo-km', '182.840');
  await p.dispatchEvent('#odo-km', 'input');
  await p.waitForTimeout(300);
  await p.screenshot({ path: `.impeccable/review/${name}.png`, fullPage: true });
  await p.close();
}
await b.close();
