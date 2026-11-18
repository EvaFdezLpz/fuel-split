import { h, type Child } from '../dom';
import { fmtEur, fmtKm, fmtKmShare, groupThousands, needsConfirmation, riders, type TripView } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, dayMonth, dialog, errorText, tramoName, evidencePill, fmtDate, linkBtn, pageHead, showEvidence, toast, who, withColor } from '../ui';
import { dateRangePicker } from './calendar';
import { selectMenu } from './select';
import { gapsBlock } from './gaps';
import { issueList, legend, paginate, pager, tramoBar } from './common';

export function tripRow(st: AppState, v: TripView) {
  const t = v.trip;
  const m = memberOf(st, t.driver);
  const mine = t.driver === st.me.email;
  const isOpen = v.endState === 'open';
  const d = new Date(t.date);
  const when = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const main = h(
    'button',
    { class: `trip${isOpen ? ' is-open' : ''}`, type: 'button', 'aria-label': `Ver el ${v.code}`, onclick: (() => tripDetail(st, v)) as EventListener },
    h(
      'span',
      { class: 'trip-date', 'aria-hidden': 'true' },
      h('b', { class: 'num' }, String(d.getDate())),
      h('span', null, d.toLocaleString('es-ES', { month: 'short' }).replace('.', '')),
    ),
    h(
      'span',
      { class: 'trip-main' },
      h(
        'span',
        { class: 'trip-who' },
        withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m),
        h('span', { class: 'strong' }, mine ? `${m.name} (tú)` : m.name),
        t.with?.length ? h('span', { class: 'small muted with-tag' }, icon('users', 13), `con ${t.with.map((e) => memberOf(st, e).name).join(', ')}`) : null,
        t.addedBy ? h('span', { class: 'pill neutral' }, `Apuntado por ${memberOf(st, t.addedBy).name}`) : null,
      ),
      h(
        'span',
        { class: 'trip-odo num' },
        `${when} · ${groupThousands(t.start.km ?? 0)} → ${v.endKm != null ? groupThousands(v.endKm) : 'sin terminar'}`,
        v.startState !== 'photo' ? evidencePill(v.startState, 'Inicio') : null,
        v.endState !== 'photo' && !isOpen ? evidencePill(v.endState, 'Final') : null,
      ),
    ),
    h(
      'span',
      { class: 'trip-km' },
      isOpen ? h('span', { class: 'pill warn' }, icon('clock'), 'En curso') : h('span', null, h('b', { class: 'num' }, groupThousands(v.km)), h('span', { class: 'unit' }, ' km')),
    ),
  );
  withColor(main, m);
  if (!isOpen) return main;
  // Viaje sin terminar: la acción para cerrarlo queda a la vista, no escondida en el detalle.
  const foot = mine
    ? h(
        'a',
        { class: 'trip-finish', href: `#/viajes/${t.id}/editar` },
        h('span', { class: 'btn primary sm' }, icon('route'), 'Terminar viaje'),
        h('span', { class: 'small muted' }, 'Al aparcar: foto del cuentakilómetros y listo.'),
      )
    : h('div', { class: 'trip-finish muted' }, icon('clock'), h('span', { class: 'small' }, `Lo terminará ${m.name} al aparcar. Si se olvida, se toma el km del siguiente viaje.`));
  return h('div', { class: 'trip-wrap' }, main, withColor(foot, m));
}

export function tripDetail(st: AppState, v: TripView) {
  const t = v.trip;
  const mine = t.driver === st.me.email;
  const photoBtn = (id: string | null, label: string) => (id ? () => showEvidence(st, id, `${label} · ${t.date ? dayMonth(t.date) : ''}`) : undefined);
  const body: (Node | null)[] = [
    h(
      'dl',
      { class: 'kv' },
      h('dt', null, 'Conductor'),
      h('dd', null, who(st, t.driver)),
      h('dt', null, 'Fecha'),
      h('dd', null, fmtDate(t.date, true)),
      h('dt', null, 'Km inicial'),
      h('dd', { class: 'num kv-ev' }, evidencePill(v.startState, '', photoBtn(t.start.photoId, 'km inicial')), fmtKm(t.start.km ?? 0)),
      h('dt', null, 'Km final'),
      h('dd', { class: 'num kv-ev' }, v.endState !== 'open' ? evidencePill(v.endState, '', photoBtn(t.end.photoId, 'km final')) : null, v.endKm != null ? fmtKm(v.endKm) : 'Sin terminar'),
      h('dt', null, 'Recorrido'),
      h('dd', { class: 'num strong' }, fmtKm(v.km)),
      t.with?.length ? h('dt', null, 'Iban') : null,
      t.with?.length
        ? h('dd', null, riders(t).map((e) => memberOf(st, e).name).join(', '), h('span', { class: 'muted' }, ` · ${fmtKmShare(v.km / riders(t).length)} cada uno`))
        : null,
      t.addedBy ? h('dt', null, 'Apuntado por') : null,
      t.addedBy ? h('dd', null, who(st, t.addedBy)) : null,
    ),
    (() => {
      const waiting = riders(t).filter((e) => needsConfirmation(t, e));
      return waiting.length ? h('p', { class: 'small muted' }, `Falta que lo confirme: ${waiting.map((e) => memberOf(st, e).name).join(', ')}.`) : null;
    })(),
    v.endState === 'inferred' ? h('p', { class: 'notice' }, icon('swap'), h('span', null, `No se registró el km final. Se toma el inicio del siguiente viaje: ${fmtKm(v.endKm ?? 0)}.`)) : null,
    t.note ? h('p', { class: 'muted' }, t.note) : null,
  ];
  const foot: Node[] = [];
  const close = () => d.close();
  foot.push(...confirmActions(st, v, close));
  const byOther = !!t.addedBy && t.addedBy !== st.me.email;
  if (!mine && t.addedBy === st.me.email && Date.now() - t.createdAt < 24 * 3600_000) {
    const undo = h('button', { class: 'btn ghost danger sm', type: 'button' }, icon('trash'), 'Borrar');
    undo.addEventListener('click', async () => {
      if (!confirm('¿Borrar el viaje que apuntaste? Solo se puede en las primeras 24 h.')) return;
      busy(undo, true, 'Borrando…');
      try {
        await st.backend.deleteTrip(t.id);
        close();
        toast('Viaje borrado');
      } catch (e) {
        busy(undo, false);
        toast(errorText(e), 'alert');
      }
    });
    foot.push(undo);
  }
  if (mine && !byOther) {
    const del = h('button', { class: 'btn ghost danger sm', type: 'button' }, icon('trash'), 'Borrar');
    del.addEventListener('click', async () => {
      if (!confirm(`¿Borrar el ${v.code}? Solo se puede en las 24 h siguientes a crearlo.`)) return;
      busy(del, true, 'Borrando…');
      try {
        await st.backend.deleteTrip(t.id);
        d.close();
        toast('Viaje borrado');
      } catch (e) {
        busy(del, false);
        toast(errorText(e), 'alert');
      }
    });
    const missingPhoto = !t.start.photoId || (t.end.km != null && !t.end.photoId);
    const old = t.end.km != null && Date.now() > t.createdAt + 7 * 86_400_000;
    if (!old) foot.push(del);
    foot.push(
      old
        ? missingPhoto
          ? linkBtn(`#/viajes/${t.id}/editar`, 'Añadir foto', 'camera', 'btn primary sm')
          : h('span', { class: 'small muted' }, 'Pasada una semana ya no se edita.')
        : linkBtn(`#/viajes/${t.id}/editar`, v.endState === 'open' ? 'Terminar viaje' : missingPhoto ? 'Editar o añadir foto' : 'Editar', v.endState === 'open' ? 'route' : 'edit', 'btn primary sm'),
    );
  }
  const d = dialog(`Viaje de ${memberOf(st, t.driver).name} · ${dayMonth(t.date)}`, body, foot);
  d.querySelectorAll('a').forEach((a) => a.addEventListener('click', () => d.close()));
}

interface TripFilter {
  who: string;
  from: string;
  to: string;
}
const filter: TripFilter = { who: '', from: '', to: '' };

/** Abre Viajes con los de una persona (desde otras secciones). */
export function showTripsOf(email: string) {
  Object.assign(filter, { who: email, from: '', to: '' });
  location.hash = '#/viajes';
}
// Paginación por depósitos: cada página muestra unos pocos recuadros completos.
const PER_PAGE = 3;
const paging = { page: 1, key: '' };
const issuePaging = { page: 1, key: '' };

/**
 * Tarjeta de una persona con una minitabla de sus viajes.
 * `order`: 'asc' = cronológico (el más antiguo arriba); 'desc' = el más reciente arriba.
 */
export function personTripsCard(st: AppState, email: string, trips: TripView[], opts: { order: 'asc' | 'desc'; limit?: number; foot?: Child[] | null }): HTMLElement {
  const m = memberOf(st, email);
  const total = trips.reduce((a, v) => a + v.km, 0);
  let rows = opts.order === 'asc' ? trips : [...trips].reverse();
  if (opts.limit) rows = opts.order === 'asc' ? rows.slice(-opts.limit) : rows.slice(0, opts.limit);
  const mine = email === st.me.email;
  return withColor(
    h(
      'article',
      { class: 'person-card' },
      h(
        'div',
        { class: 'person-head' },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h('b', null, mine ? `${m.name} (tú)` : m.name),
        h('span', { class: 'muted small num' }, `${trips.length} ${trips.length === 1 ? 'viaje' : 'viajes'} · ${fmtKm(total)}`),
      ),
      rows.length
        ? h(
            'table',
            { class: 'mini' },
            h('thead', null, h('tr', null, h('th', null, 'Fecha'), h('th', null, 'Cuentakilómetros'), h('th', { class: 'r' }, 'Km'))),
            h(
              'tbody',
              null,
              rows.map((v) => {
                const isOpen = v.endState === 'open';
                const doubt = v.startState !== 'photo' || (!isOpen && v.endState !== 'photo');
                const tr = h(
                  'tr',
                  { tabindex: 0, class: isOpen ? 'is-open' : null, 'aria-label': `Ver el ${v.code}` },
                  h('td', { class: 'num' }, dayMonth(v.trip.date)),
                  h(
                    'td',
                    { class: 'muted odo-cell' },
                    h('span', { class: 'num' }, `${groupThousands(v.trip.start.km ?? 0)} →`),
                    ' ',
                    h('span', { class: 'num' }, v.endKm != null ? groupThousands(v.endKm) : '…'),
                    doubt || v.trip.with?.length || v.trip.addedBy
                      ? h(
                          'span',
                          { class: 'row-marks' },
                          doubt ? h('span', { class: 'doubt', title: 'Falta alguna foto del cuentakilómetros' }, icon('alert', 13)) : null,
                          v.trip.with?.length
                            ? h('span', { class: 'doubt with-mark', title: `Con ${v.trip.with.map((e) => memberOf(st, e).name).join(', ')}: los km se reparten` }, icon('users', 13), `+${v.trip.with.length}`)
                            : null,
                          v.trip.addedBy ? h('span', { class: 'doubt with-mark', title: `Apuntado por ${memberOf(st, v.trip.addedBy).name}` }, icon('edit', 13)) : null,
                        )
                      : null,
                  ),
                  h(
                    'td',
                    { class: 'r num' },
                    isOpen
                      ? mine
                        ? h('a', { class: 'btn primary xs', href: `#/viajes/${v.trip.id}/editar`, onclick: ((e: Event) => e.stopPropagation()) as EventListener }, 'Terminar')
                        : h('span', { class: 'pill warn' }, 'En curso')
                      : h('b', null, groupThousands(v.km)),
                  ),
                );
                tr.addEventListener('click', () => tripDetail(st, v));
                tr.addEventListener('keydown', (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), tripDetail(st, v)));
                return tr;
              }),
            ),
          )
        : h('p', { class: 'muted small' }, 'Sin viajes todavía.'),
      opts.foot ? h('div', { class: 'person-foot' }, opts.foot) : null,
    ),
    m,
  );
}

export function tripsView(st: AppState, rerender: () => void): Node {
  const { ledger } = st;
  const fromMs = filter.from ? new Date(`${filter.from}T00:00`).getTime() : null;
  const toMs = filter.to ? new Date(`${filter.to}T23:59:59`).getTime() : null;
  const visible = (v: TripView) => (!filter.who || v.trip.driver === filter.who) && (fromMs == null || v.trip.date >= fromMs) && (toMs == null || v.trip.date <= toMs);

  const anyFilter = !!(filter.who || filter.from || filter.to);
  const filterBox = h(
    'div',
    { class: 'toolbar', role: 'group', 'aria-label': 'Filtrar viajes' },
    selectMenu({
      label: 'Persona',
      value: filter.who,
      icon: 'user',
      options: [{ value: '', label: 'Todos' }, ...[...st.members.values()].map((m) => ({ value: m.email, label: m.email === st.me.email ? `${m.name} (tú)` : m.name, member: m }))],
      onChange: (v) => ((filter.who = v), rerender()),
    }),
    dateRangePicker({ from: filter.from, to: filter.to, onChange: (f, t) => (Object.assign(filter, { from: f, to: t }), rerender()) }),
    anyFilter ? h('button', { class: 'link-btn small', type: 'button', onclick: (() => (Object.assign(filter, { who: '', from: '', to: '' }), rerender())) as EventListener }, 'Quitar filtros') : null,
  );

  // Agrupado por depósitos, del más reciente al más antiguo. Cada uno en su recuadro.
  interface Group {
    title: string;
    payer: string | null;
    period: string;
    km: number;
    cents: number | null;
    odo: string;
    shares: { email: string; km: number; cents: number }[];
    items: TripView[];
    current: boolean;
  }
  const groups: Group[] = [];
  const open = ledger.trips.filter((v) => v.refuelId == null);
  if (open.length) {
    const lastRefuel = ledger.refuels[ledger.refuels.length - 1];
    groups.push({
      title: 'Depósito actual',
      payer: null,
      period: lastRefuel ? `Desde el ${dayMonth(lastRefuel.refuel.date)}` : 'Desde el primer viaje',
      km: Math.max(0, ledger.openTramo.toKm - ledger.openTramo.fromKm),
      cents: null,
      odo: `${groupThousands(ledger.openTramo.fromKm)} → ${groupThousands(ledger.openTramo.toKm)}`,
      shares: ledger.openTramo.shares,
      items: open,
      current: true,
    });
  }
  for (const r of [...ledger.refuels].reverse()) {
    const n = tramoName(st, r);
    groups.push({
      title: n.title,
      payer: n.payer,
      period: n.period.replace(/^viajes /, ''),
      km: r.toKm - r.fromKm,
      cents: r.refuel.amountCents,
      odo: `${groupThousands(r.fromKm)} → ${groupThousands(r.toKm)}`,
      shares: r.shares,
      items: ledger.trips.filter((v) => v.refuelId === r.refuel.id),
      current: false,
    });
  }

  let shown = 0;
  const list = h('div', { class: 'deposits' });
  const withItems = groups.map((g) => ({ g, items: g.items.filter(visible).reverse() })).filter((x) => x.items.length);
  // Al cambiar los filtros se vuelve a la primera página.
  const key = `${filter.who}|${filter.from}|${filter.to}`;
  if (key !== paging.key) Object.assign(paging, { key, page: 1 });
  const pages = Math.max(1, Math.ceil(withItems.length / PER_PAGE));
  paging.page = Math.min(Math.max(1, paging.page), pages);
  const pageGroups = withItems.slice((paging.page - 1) * PER_PAGE, paging.page * PER_PAGE);
  for (const { g, items } of pageGroups) {
    shown += items.length;
    const fact = (label: string, value: string, strong = false) => h('div', { class: 'fact' }, h('span', null, label), h('b', { class: strong ? 'num strong' : 'num' }, value));
    list.append(
      h(
        'section',
        { class: `block deposit${g.current ? ' is-current' : ''}` },
        h(
          'header',
          { class: 'deposit-head' },
          h(
            'div',
            { class: 'deposit-title' },
            h('h2', null, g.title),
            g.current ? h('span', { class: 'pill neutral' }, 'Sin repostar') : h('span', { class: 'muted small' }, `Llenó ${g.payer}`),
          ),
          h(
            'div',
            { class: 'facts' },
            fact('Fechas', g.period),
            fact('Km totales', fmtKm(g.km), true),
            g.cents != null ? fact('Importe', fmtEur(g.cents), true) : fact('Importe', 'en el próximo repostaje'),
            h('div', { class: 'fact hide-sm' }, h('span', null, 'Cuentakilómetros'), h('b', { class: 'num' }, g.odo)),
          ),
          h('div', { class: 'tramo-scale' }, tramoBar(st, g.shares, g.km), legend(st, g.shares)),
        ),
        h(
          'div',
          { class: 'person-grid in-deposit' },
          (() => {
            const by = new Map<string, TripView[]>();
            for (const v of [...items].reverse()) {
              const k = v.trip.driver;
              if (!by.has(k)) by.set(k, []);
              by.get(k)!.push(v);
            }
            const order = [...by.entries()].sort((x, y) => y[1].reduce((a, v) => a + v.km, 0) - x[1].reduce((a, v) => a + v.km, 0));
            return order.map(([email, trips]) => personTripsCard(st, email, trips, { order: 'asc' }));
          })(),
        ),
      ),
    );
  }
  const pagerEl = pager({
    page: paging.page,
    pages,
    total: withItems.length,
    perPage: PER_PAGE,
    noun: ['Depósito', 'Depósitos'],
    prev: 'Más recientes',
    next: 'Más antiguos',
    go: (n) => ((paging.page = n), rerender()),
    anchor: '.deposits',
  });
  if (pagerEl) list.append(pagerEl);
  if (!shown) list.append(h('section', { class: 'block' }, h('div', { class: 'empty' }, ledger.trips.length ? 'Ningún viaje coincide con los filtros.' : 'Todavía no hay viajes. Registra el primero con la foto del cuentakilómetros.')));

  const issues = ledger.issues.length
    ? (() => {
        const all = [...ledger.issues].reverse();
        const { slice, pages: ip } = paginate(all, 10, issuePaging, String(all.length));
        return h(
          'section',
          { class: 'block', id: 'issues' },
          h('div', { class: 'block-head' }, h('h2', null, 'Incidencias de kilometraje'), h('span', { class: 'muted small' }, `${ledger.issues.length}`)),
          issueList(st, [...slice].reverse(), slice.length),
          pager({ page: issuePaging.page, pages: ip, total: all.length, perPage: 10, noun: ['Incidencia', 'Incidencias'], prev: 'Anteriores', next: 'Siguientes', go: (n) => ((issuePaging.page = n), rerender()), anchor: '#issues' }),
        );
      })()
    : null;

  const filteredKm = ledger.trips.filter(visible).reduce((a, v) => a + v.km, 0);
  const myOpen = ledger.trips.find((v) => v.trip.driver === st.me.email && v.endState === 'open');
  const live = myOpen
    ? h(
        'a',
        { class: 'live', href: `#/viajes/${myOpen.trip.id}/editar` },
        icon('route'),
        h('div', null, h('div', { class: 'strong' }, 'Tienes un viaje en curso'), h('div', { class: 'muted small' }, `Salió en ${fmtKm(myOpen.trip.start.km ?? 0)}. Al aparcar, pulsa aquí y haz la foto del km final.`)),
        h('span', { class: 'btn primary sm' }, 'Terminar'),
      )
    : null;
  return h(
    'div',
    { class: 'stack' },
    pageHead('Viajes', `${ledger.trips.filter(visible).length} ${ledger.trips.filter(visible).length === 1 ? "viaje" : "viajes"} · ${fmtKm(filteredKm)}${filter.who ? ` de ${memberOf(st, filter.who).name}` : ''}`, linkBtn('#/viajes/nuevo', 'Registrar viaje', 'plus', 'btn primary')),
    live,
    gapsBlock(st, rerender),
    filterBox,
    list,
    issues,
  );
}

/**
 * «Es correcto» / «No fui yo» / «No iba» para quien tiene que confirmar un viaje: el que lo apuntó
 * otra persona a su nombre, o en el que le han puesto como acompañante.
 */
export function confirmActions(st: AppState, v: TripView, done?: () => void): HTMLElement[] {
  const t = v.trip;
  const me = st.me.email;
  if (!needsConfirmation(t, me)) return [];
  const isDriver = t.driver === me;
  const ok = h('button', { class: 'btn primary sm', type: 'button' }, icon('check'), 'Es correcto');
  const no = h('button', { class: 'btn ghost danger sm', type: 'button' }, icon('close'), isDriver ? 'No fui yo' : 'No iba');
  ok.addEventListener('click', async () => {
    busy(ok, true);
    try {
      await st.backend.confirmTrip(t.id);
      done?.();
      toast('Confirmado');
    } catch (e) {
      busy(ok, false);
      toast(errorText(e), 'alert');
    }
  });
  no.addEventListener('click', async () => {
    const q = isDriver
      ? `¿Borrar este viaje de ${fmtKm(v.km)}? Esos km volverán a quedar sin apuntar.`
      : `¿Quitarte de este viaje? Sus ${fmtKm(v.km)} se repartirán entre los demás que iban.`;
    if (!confirm(q)) return;
    busy(no, true);
    try {
      if (isDriver) await st.backend.deleteTrip(t.id);
      else await st.backend.leaveTrip(t.id);
      done?.();
      toast(isDriver ? 'Viaje borrado' : 'Te has quitado del viaje');
    } catch (e) {
      busy(no, false);
      toast(errorText(e), 'alert');
    }
  });
  return [no, ok];
}
