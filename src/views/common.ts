import { h } from '../dom';
import { fmtKm, type Issue, type Share } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { withColor } from '../ui';

/** Escala común para comparar tramos entre sí (el depósito del C3 da para unos 800 km). */
export const TRAMO_SCALE_KM = 800;

export function tramoBar(st: AppState, shares: Share[], totalKm: number, scaleKm = TRAMO_SCALE_KM) {
  const scale = Math.max(scaleKm, totalKm);
  const bar = h('div', { class: 'tramo-bar', role: 'img', 'aria-label': shares.map((s) => `${memberOf(st, s.email).name} ${fmtKm(s.km)}`).join(', ') || 'Sin km' });
  const assigned = shares.reduce((a, s) => a + s.km, 0);
  for (const s of shares) {
    if (s.km <= 0) continue;
    const seg = withColor(h('span', { title: `${memberOf(st, s.email).name}: ${fmtKm(s.km)}` }), memberOf(st, s.email));
    seg.style.setProperty('flex', `0 0 ${(s.km / scale) * 100}%`);
    bar.append(seg);
  }
  const gap = totalKm - assigned;
  if (gap > 0) {
    const g = h('span', { class: 'gap', title: `${fmtKm(gap)} sin asignar` });
    g.style.setProperty('flex', `0 0 ${(gap / scale) * 100}%`);
    bar.append(g);
  }
  return bar;
}

export function legend(st: AppState, shares: Share[]) {
  return h(
    'div',
    { class: 'legend' },
    shares.map((s) => {
      const m = memberOf(st, s.email);
      return h('span', { class: 'who' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m), m.name, h('span', { class: 'num' }, fmtKm(s.km)));
    }),
  );
}

export function issueList(st: AppState, issues: Issue[], limit = 6) {
  const visible = issues.slice(-limit).reverse();
  return h(
    'ul',
    { class: 'issues' },
    visible.map((i) =>
      h('li', { class: i.kind === 'overlap' ? 'bad' : '' }, icon(i.kind === 'gap' || i.kind === 'unassigned' ? 'route' : i.kind === 'inferred' ? 'swap' : 'alert'), h('span', null, i.message)),
    ),
    issues.length > limit ? h('li', null, h('a', { href: '#/viajes' }, `Ver las ${issues.length} incidencias`)) : null,
  );
}


/**
 * Paginación: «‹ anterior · 1 2 3 · siguiente ›» y un texto con la posición.
 * `state` es un objeto del módulo de la vista para que la página se recuerde al volver.
 */
export function paginate<T>(items: T[], perPage: number, state: { page: number; key: string }, key: string): { slice: T[]; pages: number } {
  if (state.key !== key) Object.assign(state, { key, page: 1 });
  const pages = Math.max(1, Math.ceil(items.length / perPage));
  state.page = Math.min(Math.max(1, state.page), pages);
  return { slice: items.slice((state.page - 1) * perPage, state.page * perPage), pages };
}

/** Números de página a mostrar: siempre la primera y la última, y dos alrededor de la actual. null = «…». */
export function pageWindow(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const out: (number | null)[] = [1];
  const a = Math.max(2, Math.min(page - 1, pages - 4));
  const b = Math.min(pages - 1, Math.max(page + 1, 5));
  if (a > 2) out.push(null);
  for (let n = a; n <= b; n++) out.push(n);
  if (b < pages - 1) out.push(null);
  out.push(pages);
  return out;
}

export function pager(opts: { page: number; pages: number; total: number; perPage: number; noun: [string, string]; prev: string; next: string; go: (n: number) => void; anchor?: string }): HTMLElement | null {
  const { page, pages, total, perPage, noun } = opts;
  if (pages <= 1) return null;
  const go = (n: number) => {
    opts.go(n);
    if (opts.anchor) document.querySelector(opts.anchor)?.scrollIntoView({ block: 'start' });
  };
  const a = (page - 1) * perPage + 1;
  const b = Math.min(page * perPage, total);
  return h(
    'nav',
    { class: 'pager', 'aria-label': 'Páginas' },
    h('button', { class: 'btn sm', type: 'button', disabled: page === 1 || null, onclick: (() => go(page - 1)) as EventListener }, icon('chevronLeft', 16), h('span', { class: 'hide-xs' }, opts.prev)),
    h(
      'div',
      { class: 'pager-pages' },
      pageWindow(page, pages).map((n) =>
        n == null
          ? h('span', { class: 'pager-gap', 'aria-hidden': 'true' }, '…')
          : h('button', { class: 'pager-n num', type: 'button', 'aria-current': n === page ? 'page' : null, 'aria-label': `Página ${n}`, onclick: (() => go(n)) as EventListener }, String(n)),
      ),
    ),
    h('span', { class: 'pager-compact num' }, `${page} de ${pages}`),
    h('button', { class: 'btn sm', type: 'button', disabled: page === pages || null, onclick: (() => go(page + 1)) as EventListener }, h('span', { class: 'hide-xs' }, opts.next), icon('chevron', 16)),
    h('p', { class: 'pager-info small muted' }, a === b ? `${noun[0]} ${a} de ${total}` : `${noun[1]} ${a}–${b} de ${total}`),
  );
}
