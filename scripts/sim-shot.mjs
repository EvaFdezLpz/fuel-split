import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1440, height: 950 } });
p.on('pageerror', (e) => console.log('pageerror', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console', m.text()));
await p.goto('http://localhost:5173/simulador.html');
await p.waitForTimeout(2500);
await p.screenshot({ path: '.impeccable/review/sim-one.png' });
await p.click('#mode button[data-v="three"]');
await p.click('#theme button[data-v="dark"]');
await p.waitForTimeout(2500);
await p.click('#routes button:nth-child(5)');
await p.waitForTimeout(800);
await p.screenshot({ path: '.impeccable/review/sim-three.png' });
// restaurar
await p.click('#mode button[data-v="one"]');
await p.click('#theme button[data-v="light"]');
await b.close();
