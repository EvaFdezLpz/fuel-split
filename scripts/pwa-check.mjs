// Comprueba que el build se puede instalar como app (manifiesto, iconos, service worker) y sin errores de CSP.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
const errs = [];
p.on('console', (m) => m.type() === 'error' && errs.push(m.text()));
p.on('pageerror', (e) => errs.push(e.message));
await p.goto('http://localhost:4173/');
await p.waitForTimeout(2500);
const cdp = await ctx.newCDPSession(p);
const m = await cdp.send('Page.getAppManifest');
console.log('manifiesto:', m.url, 'errores:', JSON.stringify(m.errors));
console.log('instalable:', JSON.stringify((await cdp.send('Page.getInstallabilityErrors')).installabilityErrors));
console.log('service worker:', await p.evaluate(async () => !!(await navigator.serviceWorker.getRegistration())?.active));
console.log('errores consola:', errs.filter((e) => !/firebase|auth|api key|identitytoolkit/i.test(e)));
await b.close();
