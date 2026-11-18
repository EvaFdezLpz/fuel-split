// Calendario: selector de fechas propio (sustituye al nativo) y sección de calendario mensual
// con los viajes y repostajes de cada día.
import { h } from '../dom';
import { fmtEur, fmtKm, groupThousands, type RefuelView, type Reservation, type TripView } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth, pageHead, withColor } from '../ui';
import { tripDetail } from './trips';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];

/** 'YYYY-MM-DD' en hora local. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function parseIso(s: string): Date | null {
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
function monthTitle(d: Date): string {
  const t = d.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return t[0].toUpperCase() + t.slice(1);
}
/** Días que se muestran en la rejilla de un mes: semanas completas de lunes a domingo. */
function gridDays(month: Date): Date[] {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first.getFullYear(), first.getMonth(), 1 - offset);
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0);
  const cells = Math.ceil((offset + last.getDate()) / 7) * 7;
  return Array.from({ length: cells }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}
function shortRange(from: string, to: string): string {
  const a = parseIso(from);
  const b = parseIso(to);
  if (a && b) return `${dayMonth(a.getTime())} – ${dayMonth(b.getTime())}`;
  if (a) return `Desde el ${dayMonth(a.getTime())}`;
  if (b) return `Hasta el ${dayMonth(b.getTime())}`;
  return 'Todas las fechas';
}

/** Texto de un rango futuro: «Sáb 21 nov» o «Sáb 21 – lun 23 nov». */
export function futureRange(from: string, to: string): string {
  const a = parseIso(from);
  const b = parseIso(to);
  if (!a) return 'Elige el día';
  const wd = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '');
  const one = (d: Date) => `${wd(d)} ${dayMonth(d.getTime())}`;
  if (!b || isoDay(a) === isoDay(b)) return cap(one(a));
  return cap(`${one(a)} – ${one(b)}`);
}
const cap = (t: string) => t[0].toUpperCase() + t.slice(1);
export { parseIso };

// ---------------------------------------------------------------------------
// Selector de rango de fechas
// ---------------------------------------------------------------------------

export function dateRangePicker(opts: { from: string; to: string; onChange: (from: string, to: string) => void; future?: boolean; id?: string }): HTMLElement {
  let from = opts.from;
  let to = opts.to;
  let month = parseIso(from) ?? new Date();
  const fmt = (f: string, t: string) => (opts.future ? futureRange(f, t) : shortRange(f, t));
  const label = h('span', { class: 'drp-label' }, fmt(from, to));
  const trigger = h('button', { class: 'drp-trigger input', type: 'button', id: opts.id ?? null, 'aria-haspopup': 'dialog', 'aria-expanded': 'false' }, icon('calendar', 16), label);
  const pop = h('div', { class: 'drp-pop', role: 'dialog', 'aria-label': 'Elegir fechas' });
  pop.hidden = true;
  const wrap = h('div', { class: 'drp' }, trigger, pop);

  const commit = (f: string, t: string) => {
    from = f;
    to = t;
    close();
    opts.onChange(f, t);
  };
  const today = new Date();
  const plus = (n: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + n);
  const toSat = (6 - today.getDay() + 7) % 7;
  const toMon = ((8 - today.getDay()) % 7) || 7;
  const presets: [string, () => [string, string]][] = opts.future
    ? [
        ['Hoy', () => [isoDay(today), isoDay(today)]],
        ['Mañana', () => [isoDay(plus(1)), isoDay(plus(1))]],
        ['Este fin de semana', () => (today.getDay() === 0 ? [isoDay(today), isoDay(today)] : [isoDay(plus(toSat)), isoDay(plus(toSat + 1))])],
        ['La semana que viene', () => [isoDay(plus(toMon)), isoDay(plus(toMon + 6))]],
      ]
    : [
    ['Este mes', () => [isoDay(new Date(today.getFullYear(), today.getMonth(), 1)), isoDay(today)]],
    ['Mes pasado', () => [isoDay(new Date(today.getFullYear(), today.getMonth() - 1, 1)), isoDay(new Date(today.getFullYear(), today.getMonth(), 0))]],
    ['Últimos 3 meses', () => [isoDay(new Date(today.getFullYear(), today.getMonth() - 2, 1)), isoDay(today)]],
    ['Este año', () => [isoDay(new Date(today.getFullYear(), 0, 1)), isoDay(today)]],
    ['Todo', () => ['', '']],
  ];
  const minT = opts.future ? new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime() : -Infinity;

  const render = () => {
    const days = gridDays(month);
    const a = parseIso(from)?.getTime() ?? null;
    const b = parseIso(to)?.getTime() ?? null;
    const prev = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior' }, icon('chevronLeft', 16));
    const next = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente' }, icon('chevron', 16));
    prev.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() - 1, 1);
      render();
    });
    next.addEventListener('click', () => {
      month = new Date(month.getFullYear(), month.getMonth() + 1, 1);
      render();
    });
    const grid = h(
      'div',
      { class: 'drp-grid', role: 'grid' },
      WEEKDAYS.map((w) => h('span', { class: 'drp-wd', 'aria-hidden': 'true' }, w)),
      days.map((d) => {
        const t = d.getTime();
        const iso = isoDay(d);
        const inMonth = d.getMonth() === month.getMonth();
        const isEdge = t === a || t === b;
        const inside = a != null && b != null && t > a && t < b;
        const cls = ['drp-day', inMonth ? '' : 'out', isEdge ? 'edge' : '', inside ? 'inside' : '', iso === isoDay(today) ? 'today' : ''].filter(Boolean).join(' ');
        const btn = h('button', { class: cls, type: 'button', disabled: t < minT || null, 'aria-label': d.toLocaleDateString('es-ES', { dateStyle: 'full' }), 'aria-pressed': String(isEdge) }, String(d.getDate()));
        btn.addEventListener('click', () => {
          // Primer clic: inicio. Segundo: fin (si es anterior al inicio, se intercambian).
          if (!from || (from && to)) {
            from = iso;
            to = '';
          } else if (iso < from) {
            to = from;
            from = iso;
          } else {
            to = iso;
          }
          render();
        });
        return btn;
      }),
    );
    const hint = h('p', { class: 'drp-hint' }, !from ? 'Pulsa el primer día' : !to ? (opts.future ? 'Pulsa el último día, o Aplicar si es solo uno' : 'Ahora pulsa el último día') : fmt(from, to));
    const apply = h('button', { class: 'btn primary sm', type: 'button', disabled: !from || null }, 'Aplicar');
    apply.addEventListener('click', () => commit(from, to || from));
    const clear = opts.future ? h('span') : h('button', { class: 'btn ghost sm', type: 'button' }, 'Quitar fechas');
    clear.addEventListener('click', () => commit('', ''));
    pop.replaceChildren(
      h(
        'div',
        { class: 'drp-presets' },
        presets.map(([name, fn]) => {
          const b2 = h('button', { class: 'chip', type: 'button' }, name);
          b2.addEventListener('click', () => commit(...fn()));
          return b2;
        }),
      ),
      h('div', { class: 'drp-cal' }, h('div', { class: 'drp-head' }, prev, h('b', null, monthTitle(month)), next), grid, hint, h('div', { class: 'drp-actions' }, clear, apply)),
    );
  };

  const onDoc = (e: Event) => {
    if (!wrap.contains(e.target as Node)) close();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      close();
      trigger.focus();
    }
  };
  function close() {
    pop.hidden = true;
    trigger.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', onDoc);
    document.removeEventListener('keydown', onKey);
    label.textContent = fmt(from, to);
  }
  trigger.addEventListener('click', () => {
    if (!pop.hidden) return close();
    month = parseIso(from) ?? new Date();
    render();
    pop.hidden = false;
    trigger.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', onDoc);
    document.addEventListener('keydown', onKey);
  });
  return wrap;
}

/** Filtro de persona en botones (no se corta como un desplegable). */
export function personPicker(st: AppState, value: string, onChange: (email: string) => void): HTMLElement {
  const btn = (email: string, text: string) => {
    const m = email ? memberOf(st, email) : null;
    const b = h('button', { class: 'chip', type: 'button', 'aria-pressed': String(value === email) }, m ? withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m) : null, text);
    b.addEventListener('click', () => onChange(email));
    return b;
  };
  return h('div', { class: 'chips person-pick', role: 'group', 'aria-label': 'Persona' }, btn('', 'Todas'), [...st.members.values()].map((m) => btn(m.email, m.email === st.me.email ? `${m.name} (tú)` : m.name)));
}

// ---------------------------------------------------------------------------
// Sección Calendario
// ---------------------------------------------------------------------------

const cal: { month: Date; day: string } = { month: new Date(), day: isoDay(new Date()) };

/** Abre el calendario en un día concreto (desde otras secciones). */
export function showDay(iso: string) {
  const d = parseIso(iso);
  if (!d) return;
  cal.day = iso;
  cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
  location.hash = '#/calendario';
}

/** Días ('YYYY-MM-DD') que ocupa una reserva, como mucho 62. */
export function reservationDays(r: Reservation): string[] {
  const out: string[] = [];
  const a = parseIso(r.day);
  if (!a) return out;
  for (let i = 0; i < 62; i++) {
    const k = isoDay(new Date(a.getFullYear(), a.getMonth(), a.getDate() + i));
    if (k > r.endDay) break;
    out.push(k);
  }
  return out;
}

interface DayEvents {
  trips: TripView[];
  refuels: RefuelView[];
  reservations: Reservation[];
}

export function calendarView(st: AppState, rerender: () => void): Node {
  const byDay = new Map<string, DayEvents>();
  const slot = (ms: number) => {
    const k = isoDay(new Date(ms));
    let e = byDay.get(k);
    if (!e) byDay.set(k, (e = { trips: [], refuels: [], reservations: [] }));
    return e;
  };
  for (const v of st.ledger.trips) slot(v.trip.date).trips.push(v);
  for (const r of st.ledger.refuels) slot(r.refuel.date).refuels.push(r);
  for (const r of st.snap.reservations) for (const k of reservationDays(r)) slot(parseIso(k)!.getTime()).reservations.push(r);

  const month = cal.month;
  const days = gridDays(month);
  const inMonth = (k: string) => k.slice(0, 7) === isoDay(month).slice(0, 7);
  let mTrips = 0;
  let mKm = 0;
  let mRefuels = 0;
  let mCents = 0;
  const mRes = st.snap.reservations.filter((r) => reservationDays(r).some(inMonth)).length;
  for (const [k, e] of byDay) {
    if (!inMonth(k)) continue;
    mTrips += e.trips.length;
    mKm += e.trips.reduce((a, v) => a + v.km, 0);
    mRefuels += e.refuels.length;
    mCents += e.refuels.reduce((a, r) => a + r.refuel.amountCents, 0);
  }

  const go = (delta: number) => {
    cal.month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    rerender();
  };
  const prev = h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Mes anterior' }, icon('chevronLeft', 16));
  const next = h('button', { class: 'btn sm', type: 'button', 'aria-label': 'Mes siguiente' }, icon('chevron', 16));
  const todayBtn = h('button', { class: 'btn ghost sm', type: 'button' }, 'Hoy');
  prev.addEventListener('click', () => go(-1));
  next.addEventListener('click', () => go(1));
  todayBtn.addEventListener('click', () => {
    cal.month = new Date();
    cal.day = isoDay(new Date());
    rerender();
  });

  const openRefuel = (r: RefuelView) => {
    location.hash = `#/repostajes/${r.refuel.id}`;
  };
  const tripChip = (v: TripView) => {
    const m = memberOf(st, v.trip.driver);
    const b = h(
      'button',
      { class: 'ev ev-trip', type: 'button', title: `Viaje de ${m.name}: ${v.endState === 'open' ? 'en curso' : fmtKm(v.km)}` },
      withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m),
      h('span', { class: 'ev-name' }, m.name),
      h('span', { class: 'ev-val num' }, v.endState === 'open' ? '…' : groupThousands(v.km)),
    );
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      tripDetail(st, v);
    });
    return b;
  };
  const refuelChip = (r: RefuelView) => {
    const b = h('button', { class: 'ev ev-fuel', type: 'button', title: `Repostaje: ${fmtEur(r.refuel.amountCents)}` }, icon('fuel', 13), h('span', { class: 'ev-val num' }, fmtEur(r.refuel.amountCents)));
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      openRefuel(r);
    });
    return b;
  };

  const resChip = (r: Reservation) => {
    const m = memberOf(st, r.member);
    const b = withColor(
      h('button', { class: 'ev ev-res', type: 'button', title: `Reserva de ${m.name}: ${r.note}` }, icon('calendarCheck', 13), h('span', { class: 'ev-name' }, m.name)),
      m,
    );
    b.addEventListener('click', (e) => {
      e.stopPropagation();
      location.hash = `#/reservas/${r.id}`;
    });
    return b;
  };

  const today = isoDay(new Date());
  const grid = h(
    'div',
    { class: 'cal-grid', role: 'grid', 'aria-label': monthTitle(month) },
    WEEKDAYS_LONG.map((w) => h('div', { class: 'cal-wd', role: 'columnheader' }, h('span', { class: 'hide-sm' }, w.slice(0, 3)), h('span', { class: 'only-mobile' }, w[0].toUpperCase()))),
    days.map((d) => {
      const k = isoDay(d);
      const e = byDay.get(k);
      const n = (e?.trips.length ?? 0) + (e?.refuels.length ?? 0) + (e?.reservations.length ?? 0);
      const cls = ['cal-day', inMonth(k) ? '' : 'out', k === today ? 'today' : '', k === cal.day ? 'sel' : '', n ? 'has' : ''].filter(Boolean).join(' ');
      const shown: Node[] = [];
      if (e) {
        for (const r of e.reservations) shown.push(resChip(r));
        for (const r of e.refuels) shown.push(refuelChip(r));
        for (const v of e.trips) shown.push(tripChip(v));
      }
      const max = 3;
      // En el móvil la celda solo muestra puntos de color; el detalle va en el panel del día.
      const dots = e
        ? h(
            'span',
            { class: 'cal-dots only-mobile', 'aria-hidden': 'true' },
            e.reservations.slice(0, 2).map((r) => withColor(h('span', { class: 'res-dot' }), memberOf(st, r.member))),
            e.refuels.length ? h('span', { class: 'fuel-dot' }) : null,
            e.trips.slice(0, 4).map((v) => withColor(h('span', { class: 'dot' }), memberOf(st, v.trip.driver))),
          )
        : null;
      const cell = h(
        'div',
        { class: cls, role: 'gridcell', tabindex: 0, 'aria-label': `${d.toLocaleDateString('es-ES', { dateStyle: 'full' })}${n ? `: ${n} registros` : ''}` },
        h('span', { class: 'cal-num num' }, String(d.getDate())),
        h('div', { class: 'cal-evs hide-sm' }, shown.slice(0, max), shown.length > max ? h('span', { class: 'ev-more' }, `+${shown.length - max} más`) : null),
        dots,
      );
      const pick = () => {
        cal.day = k;
        if (!inMonth(k)) cal.month = new Date(d.getFullYear(), d.getMonth(), 1);
        rerender();
      };
      cell.addEventListener('click', pick);
      cell.addEventListener('keydown', (ev) => (ev.key === 'Enter' || ev.key === ' ') && (ev.preventDefault(), pick()));
      return cell;
    }),
  );

  // Panel del día seleccionado: todo lo de ese día, cada línea lleva a su registro.
  const sel = parseIso(cal.day) ?? new Date();
  const ev = byDay.get(cal.day);
  const items: Node[] = [];
  for (const r of ev?.reservations ?? []) {
    const m = memberOf(st, r.member);
    const range = r.day === r.endDay ? 'Todo el día' : futureRange(r.day, r.endDay);
    const b = h(
      'a',
      { class: 'day-item', href: `#/reservas/${r.id}` },
      withColor(h('span', { class: 'day-ic res' }, icon('calendarCheck', 16)), m),
      h('span', { class: 'day-main' }, h('b', null, `Reserva de ${m.name === st.me.name && r.member === st.me.email ? `${m.name} (tú)` : m.name}`), h('span', { class: 'small muted' }, `${range} · ${r.note}`)),
      h('span'),
      icon('chevron', 16),
    );
    items.push(b);
  }
  for (const r of ev?.refuels ?? []) {
    const b = h(
      'button',
      { class: 'day-item', type: 'button' },
      h('span', { class: 'day-ic fuel' }, icon('fuel', 16)),
      h('span', { class: 'day-main' }, h('b', null, `Repostaje · llenó ${memberOf(st, r.refuel.payer).name}`), h('span', { class: 'small muted num' }, `${new Date(r.refuel.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${fmtKm(r.toKm)}`)),
      h('b', { class: 'num' }, fmtEur(r.refuel.amountCents)),
      icon('chevron', 16),
    );
    b.addEventListener('click', () => openRefuel(r));
    items.push(b);
  }
  for (const v of ev?.trips ?? []) {
    const m = memberOf(st, v.trip.driver);
    const b = h(
      'button',
      { class: 'day-item', type: 'button' },
      withColor(h('span', { class: 'day-ic trip' }, icon('route', 16)), m),
      h(
        'span',
        { class: 'day-main' },
        h('b', null, `Viaje de ${m.name}`),
        h('span', { class: 'small muted num' }, `${new Date(v.trip.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} · ${groupThousands(v.trip.start.km ?? 0)} → ${v.endKm != null ? groupThousands(v.endKm) : 'sin terminar'}`),
      ),
      h('b', { class: 'num' }, v.endState === 'open' ? 'En curso' : fmtKm(v.km)),
      icon('chevron', 16),
    );
    b.addEventListener('click', () => tripDetail(st, v));
    items.push(b);
  }
  const dayTitle = sel.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
  const dayPanel = h(
    'section',
    { class: 'block day-panel', 'aria-live': 'polite' },
    h(
      'div',
      { class: 'block-head' },
      h('h2', null, dayTitle[0].toUpperCase() + dayTitle.slice(1)),
      cal.day >= today ? h('a', { class: 'btn sm', href: `#/reservas/nueva/${cal.day}` }, icon('calendarCheck', 16), 'Reservar') : null,
    ),
    items.length ? h('div', { class: 'day-list' }, items) : h('div', { class: 'empty small' }, 'Nada registrado este día.'),
  );

  return h(
    'div',
    { class: 'stack' },
    pageHead('Calendario', 'Viajes, repostajes y reservas. Pulsa uno para abrir su registro.', h('a', { class: 'btn primary', href: '#/reservas/nueva' }, icon('calendarCheck'), 'Reservar el coche')),
    h(
      'div',
      { class: 'cal-layout' },
    h(
      'section',
      { class: 'block cal' },
      h(
        'div',
        { class: 'cal-head' },
        h('div', null, h('h2', null, monthTitle(month)), h('p', { class: 'muted small num' }, `${mTrips} viajes · ${fmtKm(mKm)} · ${mRefuels} ${mRefuels === 1 ? 'repostaje' : 'repostajes'}${mCents ? ` (${fmtEur(mCents)})` : ''}${mRes ? ` · ${mRes} ${mRes === 1 ? 'reserva' : 'reservas'}` : ''}`)),
        h('div', { class: 'chips' }, todayBtn, prev, next),
      ),
      grid,
      h(
        'div',
        { class: 'cal-key small muted' },
        h('span', null, h('span', { class: 'fuel-dot', 'aria-hidden': 'true' }), 'Repostaje'),
        h('span', null, h('span', { class: 'res-dot key', 'aria-hidden': 'true' }), 'Reserva'),
        [...st.members.values()].map((m) => h('span', null, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m), m.name)),
      ),
    ),
    dayPanel,
    ),
  );
}
