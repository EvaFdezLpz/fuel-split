import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
await p.goto('http://localhost:5173/?demo&mucho&como=marta#/perfil'); await p.waitForTimeout(1500);
console.log(await p.$$eval('main .pager', (ps) => ps.map((x) => ({ vis: x.offsetParent !== null, sec: x.closest('section,details')?.querySelector('h2,summary')?.textContent, inDetails: !!x.closest('details:not([open])'), txt: x.innerText.replace(/\s+/g, ' ') }))));
await b.close();
