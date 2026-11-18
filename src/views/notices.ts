// Avisos: todo lo que cada uno tiene que revisar, en un solo sitio. Viajes que otra persona le ha
// apuntado (o en los que le ha puesto de acompañante), km misterio por responder, repostajes que pueden
// faltar y fotos del cuentakilómetros que faltan en sus viajes. La campana de arriba cuenta lo que pide
// respuesta; las fotos que faltan se listan, pero no suman al número (no caducan y harían ruido).
import { h } from '../dom';
import { fmtKm, needsConfirmation, riders } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth, pageHead } from '../ui';
import { issueList, paginate, pager } from './common';
import { findGaps, gapAnswerActions, gapRange, suspiciousRefuels } from './gaps';
import { confirmActions } from './trips';

/** Lo que pide respuesta de esta persona (para el número de la campana). */
export function noticeCount(st: AppState): number {
  const me = st.me.email;
  const confirm = st.ledger.trips.filter((x) => needsConfirmation(x.trip, me)).length;
  const ask = findGaps(st).filter((g) => g.pending.includes(me)).length;
  return confirm + ask + suspiciousRefuels(st).length;
}

const row = (ic: Parameters<typeof icon>[0], warn: boolean, title: Node | string, sub: Node | string | null, actions: Node[]) =>
  h(
    'li',
    { class: 'fix-row' },
    h('span', { class: `fix-ic${warn ? ' warn' : ''}`, 'aria-hidden': 'true' }, icon(ic, 16)),
    h('span', { class: 'fix-text' }, h('b', null, title), sub ? h('span', { class: 'small muted fix-sub num' }, sub) : null),
    actions.length ? h('span', { class: 'fix-actions' }, ...actions) : null,
  );

const group = (title: string, count: number, rows: Node[], foot: Node | null = null) =>
  rows.length
    ? h(
        'section',
        { class: 'block notice-group' },
        h('div', { class: 'block-head' }, h('h2', null, title), h('span', { class: 'muted small num' }, String(count))),
        h('ul', { class: 'fix-list' }, rows),
        foot,
      )
    : null;

const photoPaging = { page: 1, key: '' };

export function noticesView(st: AppState, rerender: () => void): Node {
  const me = st.me.email;
  const { ledger } = st;

  // Viajes que otra persona me ha apuntado o en los que me ha puesto de acompañante.
  const toConfirm = ledger.trips.filter((x) => needsConfirmation(x.trip, me)).reverse();
  const confirmRows = toConfirm.map((v) => {
    const t = v.trip;
    const by = memberOf(st, t.addedBy && t.driver === me ? t.addedBy : t.driver).name;
    const n = riders(t).length;
    return row('users', true, t.driver === me ? `${by} te ha apuntado un viaje` : `${by} te ha puesto en su viaje`, `${dayMonth(t.date)} · ${fmtKm(v.km)}${n > 1 ? ` entre ${n}` : ''}`, confirmActions(st, v));
  });

  // Km misterio: primero los que me tocan responder; luego los que esperan a los demás.
  const gaps = findGaps(st);
  const askMe = gaps.filter((g) => g.pending.includes(me));
  const waiting = gaps.filter((g) => !g.pending.includes(me));
  const gapRows = [
    ...askMe.map((g) => row('route', true, `¿Usaste el coche ${gapRange(g)}?`, `${fmtKm(g.km)} sin foto · ${fmtKm(g.fromKm)} → ${fmtKm(g.toKm)}`, gapAnswerActions(st, g))),
    ...waiting.map((g) =>
      row('route', false, `${fmtKm(g.km)} ${gapRange(g)}`, `Ya has respondido · faltan ${g.pending.length} ${g.pending.length === 1 ? 'persona' : 'personas'}`, gapAnswerActions(st, g)),
    ),
  ];

  // Repostajes que pueden faltar (muy pocos litros para tantos km).
  const fuelRows = suspiciousRefuels(st)
    .reverse()
    .map((r) =>
      row('fuel', true, `Puede faltar un repostaje antes del ${dayMonth(r.refuel.date)}`, `${fmtKm(r.toKm - r.fromKm)} con un solo depósito de ${Math.round(r.litersMilli / 1000)} l. ¿Llenaste tú y no lo apuntaste?`, [
        h('a', { class: 'btn sm', href: '#/repostajes/nuevo' }, 'Apuntar'),
      ]),
    );

  // Fotos que faltan en mis viajes (paginado: con el tiempo pueden ser muchas).
  const missing = ledger.trips
    .filter((v) => v.trip.driver === me && v.trip.source !== 'survey' && v.endState !== 'open' && (!v.trip.start.photoId || (v.trip.end.km != null && !v.trip.end.photoId)))
    .reverse();
  const mp = paginate(missing, 8, photoPaging, String(missing.length));
  const photoRows = mp.slice.map((v) =>
    row(
      'camera',
      false,
      `Tu viaje del ${dayMonth(v.trip.date)}`,
      `Sin foto ${!v.trip.start.photoId && v.trip.end.km != null && !v.trip.end.photoId ? 'de inicio ni final' : !v.trip.start.photoId ? 'de inicio' : 'del final'}`,
      [h('a', { class: 'btn sm', href: `#/viajes/${v.trip.id}/editar` }, 'Añadir foto')],
    ),
  );

  // Otras incidencias de los registros (de todos): solapes, km finales deducidos…
  const others = ledger.issues.filter((i) => i.kind !== 'gap' && i.kind !== 'unassigned' && !(i.kind === 'manual' && i.who === me));

  const total = confirmRows.length + gapRows.length + fuelRows.length + missing.length;
  return h(
    'div',
    { class: 'stack notices-page' },
    pageHead('Avisos', total || others.length ? 'Lo que tienes que revisar o responder.' : 'No tienes nada pendiente.'),
    !total && !others.length ? h('div', { class: 'empty' }, icon('ok', 22), 'Todo al día.') : null,
    group('Para confirmar', confirmRows.length, confirmRows),
    group('Km misterio', gaps.length, gapRows),
    group('Repostajes que pueden faltar', fuelRows.length, fuelRows),
    group(
      'Fotos que faltan',
      missing.length,
      photoRows,
      pager({ page: photoPaging.page, pages: mp.pages, total: missing.length, perPage: 8, noun: ['Viaje', 'Viajes'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((photoPaging.page = n), rerender()) }),
    ),
    others.length
      ? h('section', { class: 'block notice-group' }, h('div', { class: 'block-head' }, h('h2', null, 'Otras incidencias'), h('span', { class: 'muted small num' }, String(others.length))), issueList(st, others, 10))
      : null,
  );
}
