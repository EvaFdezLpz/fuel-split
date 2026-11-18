import { h } from '../dom';
import { balanceFor, fmtEur, fmtKm, groupThousands, type Debt, type TripView } from '../domain';
import { icon, type IconName } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth, euroSeg, fmtDate, kmSeg, priceSeg, totemRow, who, withColor } from '../ui';
import { isoDay } from './calendar';
import { issueList, legend, tramoBar } from './common';
import { adjustReason, debtActions } from './expenses';
import { reservationTile } from './reservations';
import { personTripsCard, showTripsOf } from './trips';
import { findGaps } from './gaps';

/** Acción rápida: icono, título y una línea que dice qué hace. */
function quick(href: string, ic: IconName, title: string, sub: string, primary = false) {
  return h('a', { class: `quick${primary ? ' primary' : ''}`, href }, h('span', { class: 'quick-ic' }, icon(ic, 20)), h('span', { class: 'quick-txt' }, h('b', null, title), h('span', null, sub)));
}

/**
 * Una deuda en el resumen, en dos líneas alineadas:
 *   [icono]  Pagar a Carmen        10,51 €
 *            Depósito del 7 nov    [Confirmar Bizum] / estado
 */
function payRow(st: AppState, d: Debt) {
  const iOwe = d.debtor === st.me.email;
  const other = memberOf(st, iOwe ? d.creditor : d.debtor);
  const r = st.ledger.refuels.find((x) => x.refuel.id === d.refuelId)!;
  const actions = debtActions(st, d);
  const status = d.state === 'sent' ? (iOwe ? 'Enviado, sin confirmar' : 'Dice que te lo envió') : !iOwe ? 'Sin pagar' : '';
  return h(
    'li',
    { class: `pay-row ${iOwe ? 'out' : 'in'}` },
    h('span', { class: 'pay-ic', 'aria-hidden': 'true' }, icon(iOwe ? 'arrowUpRight' : 'arrowDownLeft', 16)),
    h('span', { class: 'pay-title' }, iOwe ? ['Pagar a ', h('b', null, other.name)] : [h('b', null, other.name), ' te debe']),
    h('b', { class: 'num pay-amt' }, fmtEur(d.payment?.amountCents ?? d.dueCents)),
    h('a', { class: 'pay-dep', href: `#/repostajes/${r.refuel.id}`, title: d.kind === 'adjust' ? adjustReason(st, d) : null }, `${d.kind === 'adjust' ? 'Ajuste del depósito' : 'Depósito'} del ${dayMonth(r.refuel.date)}`),
    h('span', { class: 'pay-act' }, actions.length ? actions : status ? h('span', { class: `pay-status${d.state === 'sent' ? ' warn' : ''}` }, status) : null),
  );
}

export function homeView(st: AppState): Node {
  const { ledger, me } = st;
  const bal = balanceFor(ledger, me.email);
  const last = ledger.refuels[ledger.refuels.length - 1];
  const open = ledger.trips.find((v) => v.trip.driver === me.email && v.endState === 'open');
  const myIssues = ledger.issues.filter((i) => i.who === me.email);

  const totem = h(
    'section',
    { class: 'totem', 'aria-label': 'Resumen de cuentas' },
    h('div', { class: 'totem-head' }, h('span', null, `Hola, ${me.name}`), h('span', { class: 'plate' }, 'C3 · 2005')),
    h(
      'div',
      { class: 'totem-rows' },
      totemRow('Debes', bal.awaiting ? `${fmtEur(bal.awaiting)} pendientes de confirmar` : 'Bizum pendientes', euroSeg(bal.owes, bal.owes > 0 ? 'bad' : 'dim'), '€', '#/gastos'),
      totemRow('Te deben', 'De repostajes que pagaste', euroSeg(bal.owed, bal.owed > 0 ? 'ok' : 'dim'), '€', '#/gastos'),
      totemRow('Cuentakilómetros', 'Última lectura', kmSeg(ledger.currentKm), 'km', '#/viajes'),
      totemRow('Último precio', last ? `Depósito del ${dayMonth(last.refuel.date)}` : 'Sin repostajes', priceSeg(last?.refuel.priceMilli ?? null), '€/l', '#/repostajes'),
    ),
  );

  const actions = h(
    'nav',
    { class: 'quicks', 'aria-label': 'Acciones rápidas' },
    open
      ? quick(`#/viajes/${open.trip.id}/editar`, 'route', 'Terminar viaje', 'Foto del km al aparcar', true)
      : quick('#/viajes/nuevo', 'route', 'Registrar viaje', 'Foto del km al salir', true),
    quick('#/repostajes/nuevo', 'fuel', 'Repostar', 'Foto del surtidor'),
    quick('#/reservas/nueva', 'calendarCheck', 'Reservar', 'Avisa de que lo usas'),
  );

  const liveBox = open
    ? h(
        'a',
        { class: 'live', href: `#/viajes/${open.trip.id}/editar` },
        h('span', { class: 'pulse', 'aria-hidden': 'true' }),
        h('div', null, h('div', { class: 'strong' }, 'Tienes un viaje en curso'), h('div', { class: 'muted small' }, `Empezó en ${fmtKm(open.trip.start.km ?? 0)} el ${fmtDate(open.trip.date, true)}. Añade el km final al aparcar.`)),
        icon('chevron'),
      )
    : null;

  // Depósito actual: lo justo. Km hechos, gasto estimado y tu parte.
  const t = ledger.openTramo;
  const tramoKm = Math.max(0, t.toKm - t.fromKm);
  const myOpen = t.shares.find((s) => s.email === me.email);
  const estTotal = t.estCentsPerKm ? Math.round(tramoKm * t.estCentsPerKm) : null;
  const fact = (label: string, value: string) => h('div', { class: 'fact' }, h('span', null, label), h('b', { class: 'num' }, value));
  const tramo = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, 'Depósito actual'), last ? h('a', { class: 'small muted', href: `#/repostajes/${last.refuel.id}` }, `desde el ${dayMonth(last.refuel.date)}`) : null),
    h(
      'div',
      { class: 'block-body' },
      h('div', { class: 'facts three' }, fact('Km hechos', fmtKm(tramoKm)), estTotal != null ? fact('Gasto aprox.', `≈ ${fmtEur(estTotal)}`) : null, fact('Tu parte', myOpen && t.estCentsPerKm ? `≈ ${fmtEur(myOpen.cents)}` : '0 km')),
      tramoBar(st, t.shares, tramoKm),
      t.shares.length ? legend(st, t.shares) : h('p', { class: 'muted small' }, 'Aún no hay viajes en este depósito.'),
      h('p', { class: 'hint' }, 'Se reparte de verdad en el próximo repostaje.'),
    ),
  );

  // Pagos: separados en lo que tienes que pagar y lo que te deben, cada uno con su botón.
  const active = (d: Debt) => d.state === 'pending' || d.state === 'sent';
  const iOwe = ledger.debts.filter((d) => d.debtor === me.email && active(d));
  const owedMe = ledger.debts.filter((d) => d.creditor === me.email && active(d));
  const sum = (ds: Debt[]) => ds.reduce((a, d) => a + (d.payment?.amountCents ?? d.dueCents), 0);
  // Primero lo que tienes que pagar (con su botón), luego lo que te deben. Como mucho 5; el resto, en Gastos.
  const all = [...iOwe, ...owedMe];
  const shown = all.slice(0, 5);
  const pays = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, 'Pagos'), h('a', { class: 'small muted', href: '#/gastos' }, 'Historial')),
    all.length
      ? h(
          'div',
          { class: 'block-body pays' },
          h(
            'div',
            { class: 'pay-sum' },
            h('a', { class: `pay-sum-item${iOwe.length ? ' out' : ''}`, href: '#/gastos' }, h('span', null, 'Tienes que pagar'), h('b', { class: 'num' }, fmtEur(sum(iOwe)))),
            h('a', { class: `pay-sum-item${owedMe.length ? ' in' : ''}`, href: '#/gastos' }, h('span', null, 'Te deben'), h('b', { class: 'num' }, fmtEur(sum(owedMe)))),
          ),
          h('ul', { class: 'pay-list' }, shown.map((d) => payRow(st, d))),
          all.length > shown.length ? h('a', { class: 'link-btn small pay-more', href: '#/gastos' }, `Ver los ${all.length} pagos`) : null,
        )
      : h('div', { class: 'empty' }, icon('ok', 22), 'Estás al día: no debes nada y nadie te debe.'),
  );

  // Próximas reservas del coche.
  const today = isoDay(new Date());
  const soon = st.snap.reservations.filter((r) => r.endDay >= today).sort((a, b) => a.day.localeCompare(b.day)).slice(0, 3);
  const reservations = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, 'Próximas reservas'), h('a', { class: 'small muted', href: '#/reservas' }, 'Ver todas')),
    soon.length
      ? h('div', { class: 'block-body res-mini' }, soon.map((r) => reservationTile(st, r, true)))
      : h('div', { class: 'empty small' }, icon('calendarCheck', 20), 'Nadie ha reservado el coche.'),
  );

  // Viajes por persona: una tarjeta con su minitabla.
  const byPerson = new Map<string, TripView[]>();
  for (const m of st.members.values()) byPerson.set(m.email, []);
  for (const v of ledger.trips) byPerson.get(v.trip.driver)?.push(v);
  const order = [...byPerson.entries()].sort((a, b) => (b[1].at(-1)?.trip.date ?? 0) - (a[1].at(-1)?.trip.date ?? 0));
  const tripsBlock = h(
    'section',
    { class: 'stack-sm' },
    h('div', { class: 'section-head' }, h('h2', null, 'Viajes de cada uno'), h('a', { class: 'small muted', href: '#/viajes' }, 'Ver todos los viajes')),
    h('div', { class: 'person-grid' }, order.map(([email, trips]) => {
        const openKm = t.shares.find((x) => x.email === email)?.km ?? 0;
        return personTripsCard(st, email, trips, {
          order: 'desc',
          limit: 4,
          foot: [
            h('span', { class: 'muted small num' }, openKm ? `${fmtKm(openKm)} en el depósito actual` : 'Nada en el depósito actual'),
            trips.length ? h('button', { class: 'link-btn small', type: 'button', onclick: (() => showTripsOf(email)) as EventListener }, 'Ver todos') : null,
          ],
        });
      })),
  );

  // Por revisar: primero lo que puede arreglar cada uno (km sin apuntar, fotos que faltan en sus viajes).
  const gaps = findGaps(st);
  const gapKm = gaps.reduce((x, g) => x + (g.toKm - g.fromKm), 0);
  const missing = ledger.trips.filter((v) => v.trip.driver === me.email && v.endState !== 'open' && (!v.trip.start.photoId || (v.trip.end.km != null && !v.trip.end.photoId)));
  const fixRows: Node[] = [];
  if (gaps.length)
    fixRows.push(
      h(
        'li',
        { class: 'fix-row' },
        h('span', { class: 'fix-ic warn', 'aria-hidden': 'true' }, icon('route', 16)),
        h('span', null, h('b', null, `${fmtKm(gapKm)} sin apuntar`), h('span', { class: 'small muted' }, ` en ${gaps.length} ${gaps.length === 1 ? 'hueco' : 'huecos'}. ¿Fuiste tú?`)),
        h('a', { class: 'btn sm', href: '#/viajes' }, 'Revisar'),
      ),
    );
  for (const v of missing.slice(-3).reverse())
    fixRows.push(
      h(
        'li',
        { class: 'fix-row' },
        h('span', { class: 'fix-ic', 'aria-hidden': 'true' }, icon('camera', 16)),
        h('span', null, h('b', null, `Tu viaje del ${dayMonth(v.trip.date)}`), h('span', { class: 'small muted' }, ` sin foto ${!v.trip.start.photoId && v.trip.end.km != null && !v.trip.end.photoId ? 'de inicio ni final' : !v.trip.start.photoId ? 'de inicio' : 'del final'}`)),
        h('a', { class: 'btn sm', href: `#/viajes/${v.trip.id}/editar` }, 'Añadir foto'),
      ),
    );
  const others = ledger.issues.filter((i) => i.kind !== 'gap' && i.kind !== 'unassigned' && !(i.kind === 'manual' && i.who === me.email));
  const issues =
    fixRows.length || others.length
      ? h(
          'section',
          { class: 'block' },
          h('div', { class: 'block-head' }, h('h2', null, 'Por revisar'), missing.length > 3 ? h('a', { class: 'small muted', href: '#/viajes' }, `${missing.length} viajes sin foto`) : null),
          fixRows.length ? h('ul', { class: 'fix-list' }, fixRows) : null,
          !fixRows.length ? issueList(st, others, 2) : null,
        )
      : null;

  return h('div', { class: 'stack' }, totem, actions, liveBox, h('div', { class: 'grid-2' }, h('div', { class: 'col' }, tramo, reservations), h('div', { class: 'col' }, pays, issues)), tripsBlock);
}
