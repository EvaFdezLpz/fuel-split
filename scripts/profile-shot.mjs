import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto('http://localhost:5173/?demo&como=marta#/perfil'); await p.waitForTimeout(900);
await p.screenshot({ path: '.impeccable/review/profile-1400.png', fullPage: true });
await b.close();
