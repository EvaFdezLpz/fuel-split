// Capturas de revisión de diseño (modo demo). Uso: node scripts/shots.mjs [light|dark] [url-base]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';

const scheme = process.argv[2] ?? 'light';
const base = process.argv[3] ?? 'http://localhost:5173/?demo';
const out = '.impeccable/review';
mkdirSync(out, { recursive: true });
const shots = [
  ['desktop', 1440, 1000, '#/'],
  ['mobile', 390, 844, '#/'],
  ['d-viajes', 1440, 1000, '#/viajes'],
  ['m-viajes', 390, 844, '#/viajes'],
  ['d-repostajes', 1440, 1000, '#/repostajes'],
  ['m-repostajes', 390, 844, '#/repostajes'],
  ['m-nuevo-viaje', 390, 844, '#/viajes/nuevo'],
  ['d-nuevo-repostaje', 1440, 1000, '#/repostajes/nuevo'],
  ['m-gastos', 390, 844, '#/gastos'],
  ['d-gastos', 1440, 900, '#/gastos'],
  ['d-perfil', 1440, 1000, '#/perfil'],
  ['m-perfil', 390, 844, '#/perfil'],
  ['m-login', 390, 844, '&salir#/', true],
];
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const [name, w, hgt, hash] of shots) {
  const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: 1, colorScheme: scheme, isMobile: w < 500, hasTouch: w < 500, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  const url = hash.startsWith('&') ? base + hash : base + hash;
  await page.goto(url);
  await page.waitForTimeout(700);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  await page.screenshot({ path: `${out}/${name}-${scheme}.png`, fullPage: true });
  console.log(name, overflow > 0 ? `OVERFLOW ${overflow}px` : 'ok', errors.length ? errors.join(' | ') : '');
  await ctx.close();
}
await browser.close();
