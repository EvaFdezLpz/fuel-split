import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
for (const w of [1536, 1280, 1100, 900, 760, 390]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto('http://localhost:5173/?demo&como=marta#/');
  await p.waitForTimeout(700);
  const r = await p.evaluate(() => {
    const q = document.querySelector('.quicks').getBoundingClientRect();
    const par = document.querySelector('.quicks').parentElement.getBoundingClientRect();
    return { q: [q.left, q.right], parent: [par.left, par.right], sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, cards: [...document.querySelectorAll('.quick')].map((e) => Math.round(e.getBoundingClientRect().right)) };
  });
  console.log(w, JSON.stringify(r));
  if (w === 1536) await (await p.$('.quicks')).screenshot({ path: '.impeccable/review/r9-q.png' });
  await p.close();
}
await b.close();
