// Km sin apuntar: huecos entre un viaje y el siguiente. Quien usó el coche y se olvidó de apuntarlo
// pulsa «Fui yo» y añade el viaje con los km ya rellenos. Si nadie los reclama, se reparten según los km de cada uno.
import { h } from '../dom';
import { fmtKm, groupThousands, type TripView } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth } from '../ui';
import { paginate, pager } from './common';
import { presetTrip } from './trip-form';

export interface Gap {
  fromKm: number;
  toKm: number;
  after: TripView;
  before: TripView;
}

/** Huecos entre viajes consecutivos (por km), del más reciente al más antiguo. */
export function findGaps(st: AppState): Gap[] {
  const out: Gap[] = [];
  const ts = st.ledger.trips;
  for (let i = 0; i + 1 < ts.length; i++) {
    const v = ts[i];
    const next = ts[i + 1];
    if (v.endKm == null || v.endState === 'inferred' || v.endState === 'open' || next.trip.start.km == null) continue;
    if (next.trip.start.km > v.endKm) out.push({ fromKm: v.endKm, toKm: next.trip.start.km, after: v, before: next });
  }
  return out.reverse();
}

/** Abre el formulario de viaje con los km del hueco ya puestos. */
export function claimGap(g: Gap) {
  const a = g.after.trip.date;
  const b = g.before.trip.date;
  presetTrip({ startKm: g.fromKm, endKm: g.toKm, date: b > a ? Math.round(a + (b - a) / 2) : a + 3_600_000 });
  location.hash = '#/viajes/nuevo';
}

const paging = { page: 1, key: '' };

export function gapsBlock(st: AppState, rerender: () => void): HTMLElement | null {
  const gaps = findGaps(st);
  if (!gaps.length) return null;
  const total = gaps.reduce((a, g) => a + (g.toKm - g.fromKm), 0);
  const { slice, pages } = paginate(gaps, 5, paging, String(gaps.length));
  const person = (v: TripView) => memberOf(st, v.trip.driver).name;
  return h(
    'section',
    { class: 'block gaps', id: 'km-sin-apuntar' },
    h('div', { class: 'block-head' }, h('h2', null, 'Km sin apuntar'), h('span', { class: 'muted small num' }, `${gaps.length} · ${fmtKm(total)}`)),
    h(
      'p',
      { class: 'gaps-intro small muted' },
      'Alguien usó el coche y no lo apuntó. Si fuiste tú, pulsa ',
      h('b', null, 'Fui yo'),
      ' y guarda el viaje (con foto si la tienes). Si nadie los reclama, se reparten entre todos según sus km. Si el depósito ya estaba pagado, la app calcula el ajuste.',
    ),
    h(
      'ul',
      { class: 'gap-list' },
      slice.map((g) => {
        const b = h('button', { class: 'btn sm', type: 'button' }, icon('user', 14), 'Fui yo');
        b.addEventListener('click', () => claimGap(g));
        return h(
          'li',
          { class: 'gap-row' },
          h('b', { class: 'gap-km num' }, fmtKm(g.toKm - g.fromKm)),
          h(
            'div',
            { class: 'gap-info' },
            h('span', { class: 'num' }, `${groupThousands(g.fromKm)} → ${groupThousands(g.toKm)}`),
            h('span', { class: 'small muted' }, `Después del viaje de ${person(g.after)} (${dayMonth(g.after.trip.date)}) y antes del de ${person(g.before)} (${dayMonth(g.before.trip.date)})`),
          ),
          b,
        );
      }),
    ),
    pager({ page: paging.page, pages, total: gaps.length, perPage: 5, noun: ['Hueco', 'Huecos'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((paging.page = n), rerender()), anchor: '#km-sin-apuntar' }),
  );
}
