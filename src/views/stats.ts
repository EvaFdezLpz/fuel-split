// Estadísticas: totales y gráficos de viajes, repostajes, km y gasto por persona en un rango de fechas.
import { h } from '../dom';
import { fmtEur, fmtKm, groupThousands, type Member, riders } from '../domain';
import { icon } from '../icons';
import type { AppState } from '../state';
import { pageHead, withColor } from '../ui';
import { dateRangePicker, isoDay, parseIso } from './calendar';

type Gran = 'week' | 'month' | 'year';
const state: { from: string; to: string; gran: Gran } = (() => {
  const t = new Date();
  return { from: isoDay(new Date(t.getFullYear(), t.getMonth() - 2, 1)), to: isoDay(t), gran: 'week' };
})();

function bucketStart(ms: number, gran: Gran): Date {
  const d = new Date(ms);
  if (gran === 'year') return new Date(d.getFullYear(), 0, 1);
  if (gran === 'month') return new Date(d.getFullYear(), d.getMonth(), 1);
  const off = (d.getDay() + 6) % 7; // lunes
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - off);
}
function nextBucket(d: Date, gran: Gran): Date {
  if (gran === 'year') return new Date(d.getFullYear() + 1, 0, 1);
  if (gran === 'month') return new Date(d.getFullYear(), d.getMonth() + 1, 1);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 7);
}
const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sept', 'oct', 'nov', 'dic'];
function shortLabel(d: Date, gran: Gran): string {
  if (gran === 'year') return String(d.getFullYear());
  if (gran === 'month') return `${MONTHS[d.getMonth()]}${d.getMonth() === 0 ? ` ${String(d.getFullYear()).slice(2)}` : ''}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`;
}
function longLabel(d: Date, gran: Gran): string {
  if (gran === 'year') return `Año ${d.getFullYear()}`;
  if (gran === 'month') {
    const t = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
    return t[0].toUpperCase() + t.slice(1);
  }
  return `Semana del ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** Tamaño en % puesto con CSSOM (la CSP no permite atributos style). */
function sized<T extends HTMLElement>(el: T, prop: 'width' | 'height', pct: number): T {
  el.style[prop] = `${pct}%`;
  return el;
}

interface Bucket {
  start: Date;
  label: string;
  long: string;
  value: number;
  tip: string;
}

/** Gráfico de columnas de una sola serie, con el valor al pasar el ratón o con el teclado. */
function columns(buckets: Bucket[], fmt: (v: number) => string, tone: 'a' | 'b', title: string): HTMLElement {
  const max = Math.max(1, ...buckets.map((b) => b.value));
  const tip = h('div', { class: 'chart-tip', role: 'status', hidden: true });
  const every = Math.max(1, Math.ceil(buckets.length / 8)); // como mucho unas 8 etiquetas en el eje
  const plot = h(
    'div',
    { class: `chart-plot tone-${tone}` },
    h('div', { class: 'chart-grid', 'aria-hidden': 'true' }, h('span', { class: 'num' }, fmt(max)), h('span', { class: 'num' }, fmt(max / 2))),
    buckets.map((b) => {
      const bar = h(
        'button',
        { class: `chart-col${b.value ? '' : ' zero'}`, type: 'button', 'aria-label': `${b.long}: ${b.tip}` },
        sized(h('span', { class: 'chart-bar' }), 'height', b.value ? Math.max(2, (b.value / max) * 100) : 0),
      );
      const show = () => {
        tip.replaceChildren(h('b', null, b.long), h('span', null, b.tip));
        tip.hidden = false;
        const r = bar.getBoundingClientRect();
        const p = plot.getBoundingClientRect();
        tip.style.left = `${Math.min(Math.max(r.left - p.left + r.width / 2, 70), p.width - 70)}px`;
      };
      bar.addEventListener('pointerenter', show);
      bar.addEventListener('focus', show);
      bar.addEventListener('pointerleave', () => (tip.hidden = true));
      bar.addEventListener('blur', () => (tip.hidden = true));
      return bar;
    }),
    tip,
  );
  const chart = h(
    'div',
    { class: 'chart', role: 'group', 'aria-label': title },
    plot,
    h('div', { class: 'chart-x', 'aria-hidden': 'true' }, buckets.map((b, i) => h('span', null, i % every === 0 ? b.label : ''))),
  );
  chart.style.setProperty('--cols', String(buckets.length));
  return chart;
}

/** Tabla por persona con una barra de proporción: cada dato en su columna. */
function personBars(rows: { m: Member; value: number; cells: string[] }[], heads: string[], empty: string): HTMLElement {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (!rows.some((r) => r.value)) return h('p', { class: 'empty small' }, empty);
  return h(
    'table',
    { class: 'hbars' },
    h('thead', null, h('tr', null, h('th', null, 'Persona'), h('th', { class: 'hbar-col' }, h('span', { class: 'sr-only' }, 'Proporción')), heads.map((t) => h('th', { class: 'r' }, t)))),
    h(
      'tbody',
      null,
      rows.map((r) =>
        withColor(
          h(
            'tr',
            null,
            h('td', { class: 'hbar-name' }, r.m.name),
            h('td', { class: 'hbar-col', 'aria-hidden': 'true' }, h('span', { class: 'hbar-track' }, sized(h('span', { class: 'hbar' }), 'width', (r.value / max) * 100))),
            r.cells.map((c, i) => h('td', { class: `r num${i === 0 ? ' strong' : ' muted'}` }, c)),
          ),
          r.m,
        ),
      ),
    ),
  );
}

export function statsView(st: AppState, rerender: () => void): Node {
  const { ledger } = st;
  // Rango: sin fecha de inicio, desde el primer registro; sin fin, hasta hoy.
  const firstMs = Math.min(...ledger.trips.map((v) => v.trip.date), ...ledger.refuels.map((r) => r.refuel.date), Date.now());
  const fromMs = parseIso(state.from)?.getTime() ?? bucketStart(firstMs, 'month').getTime();
  const toD = parseIso(state.to) ?? new Date();
  const toMs = new Date(toD.getFullYear(), toD.getMonth(), toD.getDate(), 23, 59, 59).getTime();
  const inRange = (ms: number) => ms >= fromMs && ms <= toMs;

  const trips = ledger.trips.filter((v) => inRange(v.trip.date));
  const refuels = ledger.refuels.filter((r) => inRange(r.refuel.date));
  const totalCents = refuels.reduce((a, r) => a + r.refuel.amountCents, 0);
  const totalKm = trips.reduce((a, v) => a + v.km, 0);
  const totalLiters = refuels.reduce((a, r) => a + r.litersMilli, 0);

  // Cubos de tiempo (semana, mes o año) que cubren el rango.
  const buckets: { start: Date; trips: number; km: number; refuels: number; cents: number }[] = [];
  for (let d = bucketStart(fromMs, state.gran); d.getTime() <= toMs && buckets.length < 400; d = nextBucket(d, state.gran)) buckets.push({ start: d, trips: 0, km: 0, refuels: 0, cents: 0 });
  const find = (ms: number) => {
    const k = bucketStart(ms, state.gran).getTime();
    return buckets.find((b) => b.start.getTime() === k);
  };
  for (const v of trips) {
    const b = find(v.trip.date);
    if (b) (b.trips++, (b.km += v.km));
  }
  for (const r of refuels) {
    const b = find(r.refuel.date);
    if (b) (b.refuels++, (b.cents += r.refuel.amountCents));
  }
  const unit = { week: 'semana', month: 'mes', year: 'año' }[state.gran];
  const tripBuckets: Bucket[] = buckets.map((b) => ({ start: b.start, label: shortLabel(b.start, state.gran), long: longLabel(b.start, state.gran), value: b.trips, tip: `${b.trips} ${b.trips === 1 ? 'viaje' : 'viajes'} · ${fmtKm(b.km)}` }));
  const refuelBuckets: Bucket[] = buckets.map((b) => ({ start: b.start, label: shortLabel(b.start, state.gran), long: longLabel(b.start, state.gran), value: b.cents, tip: `${b.refuels} ${b.refuels === 1 ? 'repostaje' : 'repostajes'} · ${fmtEur(b.cents)}` }));

  // Por persona: km conducidos (viajes del rango) y gasto (su parte de los repostajes del rango).
  const members = [...st.members.values()];
  const kmBy = new Map(members.map((m) => [m.email, 0]));
  const tripsBy = new Map(members.map((m) => [m.email, 0]));
  for (const v of trips) {
    const people = riders(v.trip);
    for (const p of people) {
      kmBy.set(p, (kmBy.get(p) ?? 0) + v.km / people.length);
      tripsBy.set(p, (tripsBy.get(p) ?? 0) + 1);
    }
  }
  const centsBy = new Map(members.map((m) => [m.email, 0]));
  for (const r of refuels) for (const s of r.shares) centsBy.set(s.email, (centsBy.get(s.email) ?? 0) + s.cents);
  const byKm = members.map((m) => ({ m, value: kmBy.get(m.email) ?? 0 })).sort((a, b) => b.value - a.value);
  const byCents = members.map((m) => ({ m, value: centsBy.get(m.email) ?? 0 })).sort((a, b) => b.value - a.value);

  // Controles: rango de fechas y agrupación.
  const gran = h(
    'div',
    { class: 'seg-control', role: 'group', 'aria-label': 'Agrupar por' },
    (['week', 'month', 'year'] as Gran[]).map((g) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(state.gran === g) }, { week: 'Semana', month: 'Mes', year: 'Año' }[g]);
      b.addEventListener('click', () => ((state.gran = g), rerender()));
      return b;
    }),
  );
  const range = dateRangePicker({ from: state.from, to: state.to, onChange: (f, t) => (Object.assign(state, { from: f, to: t }), rerender()) });

  const kpi = (label: string, value: string, sub: string) => h('div', { class: 'kpi' }, h('span', { class: 'kpi-label' }, label), h('b', { class: 'kpi-value num' }, value), h('span', { class: 'kpi-sub' }, sub));
  const card = (title: string, sub: string, body: Node) => h('section', { class: 'block chart-card' }, h('div', { class: 'block-head' }, h('h2', null, title), h('span', { class: 'muted small' }, sub)), h('div', { class: 'block-body' }, body));

  return h(
    'div',
    { class: 'stack' },
    pageHead('Estadísticas', 'Cuánto se usa el coche y cuánto cuesta.'),
    h('div', { class: 'toolbar' }, range, gran),
    h(
      'section',
      { class: 'kpis', 'aria-label': 'Totales del periodo' },
      kpi('Gasto total', fmtEur(totalCents), totalKm ? `${(totalCents / totalKm).toFixed(1).replace('.', ',')} cént. por km` : 'Sin km en el periodo'),
      kpi('Km recorridos', groupThousands(totalKm), `entre ${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'}`),
      kpi('Repostajes', String(refuels.length), totalLiters ? `${groupThousands(Math.round(totalLiters / 1000))} litros` : '—'),
      kpi('Media por viaje', trips.length ? fmtKm(Math.round(totalKm / trips.length)) : '—', `por ${unit}: ${(trips.length / Math.max(1, buckets.length)).toFixed(1).replace('.', ',')} viajes`),
    ),
    h(
      'div',
      { class: 'grid-2 charts' },
      card(`Viajes por ${unit}`, `${trips.length} en total`, columns(tripBuckets, (v) => String(Math.round(v)), 'a', `Viajes por ${unit}`)),
      card(`Gasto en repostajes por ${unit}`, fmtEur(totalCents), columns(refuelBuckets, (v) => `${Math.round(v / 100)} €`, 'b', `Gasto por ${unit}`)),
      card('Km por persona', fmtKm(totalKm), personBars(byKm.map((r) => ({ m: r.m, value: r.value, cells: [fmtKm(r.value), String(tripsBy.get(r.m.email) ?? 0)] })), ['Km', 'Viajes'], 'Nadie ha conducido en este periodo.')),
      card(
        'Gasto por persona',
        'según sus km',
        personBars(
          byCents.map((r) => ({ m: r.m, value: r.value, cells: [fmtEur(r.value), totalCents ? `${Math.round((r.value / totalCents) * 100)} %` : '—'] })),
          ['Gasto', '% del total'],
          'No hay repostajes en este periodo.',
        ),
      ),
    ),
    h('p', { class: 'hint' }, icon('route', 14), ' El gasto por persona es su parte de cada repostaje, repartida por los km que hizo. Los km del depósito actual cuentan cuando se reposte.'),
  );
}
