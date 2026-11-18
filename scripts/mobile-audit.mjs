// Recorre todas las pantallas en tamaños de móvil y detecta desbordes horizontales y elementos cortados.
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe' });
const routes = ['#/',  '#/viajes', '#/viajes/nuevo', '#/calendario', '#/reservas', '#/reservas/nueva', '#/repostajes', '#/repostajes/nuevo', '#/gastos', '#/estadisticas', '#/perfil'];
// iPhone 11 / XR (414×896), 11 Pro / 12-13 mini (375×812), 12-14 (390×844), 15-16 (393×852), 16 Pro (402×874),
// 14 Plus (428×926), 15-16 Pro Max (430×932), 16 Pro Max (440×956) y Samsung Galaxy A55 (384×832).
const sizes = [[375, 812], [384, 832], [390, 844], [393, 852], [402, 874], [414, 896], [428, 926], [430, 932], [440, 956]];
const data = process.argv[2] ?? 'mucho';
for (const [w, hgt] of sizes) {
  for (const scheme of ['light']) {
    const p = await b.newPage({ viewport: { width: w, height: hgt }, colorScheme: scheme, hasTouch: true, isMobile: true, deviceScaleFactor: 1 });
    p.on('pageerror', (e) => console.log('PAGEERROR', w, e.message));
    for (const r of routes) {
      await p.goto(`http://localhost:5173/?demo&como=marta${data === 'mucho' ? '&mucho' : ''}${r}`);
      await p.waitForTimeout(500);
      const res = await p.evaluate(() => {
        const vw = document.documentElement.clientWidth;
        const out = [];
        if (document.documentElement.scrollWidth > vw + 1) out.push(`page scrollWidth ${document.documentElement.scrollWidth} > ${vw}`);
        for (const e of document.querySelectorAll('main *, .tabbar *, .topbar *')) {
          const r = e.getBoundingClientRect();
          if (!r.width || !r.height) continue;
          // dentro de contenedores con scroll horizontal es intencionado
          let sc = e.parentElement, scroll = false;
          while (sc && sc !== document.body) { const o = getComputedStyle(sc).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden') { scroll = true; break; } sc = sc.parentElement; }
          if (!scroll && (r.right > vw + 1 || r.left < -1)) out.push(`${e.tagName.toLowerCase()}.${[...e.classList].join('.')} [${Math.round(r.left)},${Math.round(r.right)}] "${(e.textContent || '').trim().slice(0, 30)}"`);
          const cs = getComputedStyle(e);
          if (e.children.length === 0 && cs.textOverflow === 'ellipsis' && e.scrollWidth > e.clientWidth + 1) out.push(`ellipsis: "${e.textContent.trim().slice(0, 40)}"`);
        }
        // objetivos táctiles pequeños
        const small = [...document.querySelectorAll('main a, main button, .tabbar a')].filter((e) => { const r = e.getBoundingClientRect(); return r.width && r.height && (r.height < 24 || r.width < 24); }).map((e) => `${e.tagName.toLowerCase()} "${(e.textContent || e.getAttribute('aria-label') || '').trim().slice(0, 20)}" ${Math.round(e.getBoundingClientRect().width)}x${Math.round(e.getBoundingClientRect().height)}`);
        for (const f of document.querySelectorAll('input:not([type=file]):not([type=checkbox]):not([type=radio]), select, textarea')) {
          const fs = parseFloat(getComputedStyle(f).fontSize);
          if (f.getBoundingClientRect().width && fs < 16) out.push(`ZOOM iOS: ${f.tagName.toLowerCase()}#${f.id} ${fs}px`);
        }
        return { out: [...new Set(out)].slice(0, 12), small: [] };
      });
      if (res.out.length || res.small.length) console.log(`\n${w} ${scheme} ${r}\n  ` + [...res.out, ...res.small.map((s) => 'SMALL ' + s)].join('\n  '));
      if (w === 375) await p.screenshot({ path: `.impeccable/review/mob-${r.replace(/[#/]+/g, '_') || 'home'}.png`, fullPage: true });
    }
    await p.close();
  }
}
await b.close();
console.log('\nfin');
