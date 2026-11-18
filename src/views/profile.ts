import { h } from '../dom';
import { balanceFor, fmtEur, fmtKm, groupThousands, profileStats } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth, euroSeg, evidencePill, fmtDate, kmSeg, pageHead, totemRow, tramoName, withColor } from '../ui';
import { debtPill } from './refuels';
import { segmentDisplay } from '../segments';
import { dateRangePicker } from './calendar';
import { tripDetail } from './trips';
import { paginate, pager } from './common';

type Range = 'mes' | '3m' | 'año' | 'todo' | 'custom';
const range: { kind: Range; from: string; to: string } = { kind: 'todo', from: '', to: '' };
/** Mes que se ve en «Por viajes» ('YYYY-MM'); vacío = el más reciente con viajes. */
const tripMonth = { key: '', person: '' };
const tramoPaging = { page: 1, key: '' };
const monthKey = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const monthName = (key: string) => {
  const [y, mo] = key.split('-').map(Number);
  const t = new Date(y, mo - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return t[0].toUpperCase() + t.slice(1);
};

function bounds(): [number | null, number | null] {
  const now = new Date();
  switch (range.kind) {
    case 'mes':
      return [new Date(now.getFullYear(), now.getMonth(), 1).getTime(), null];
    case '3m':
      return [new Date(now.getFullYear(), now.getMonth() - 2, 1).getTime(), null];
    case 'año':
      return [new Date(now.getFullYear(), 0, 1).getTime(), null];
    case 'custom':
      return [range.from ? new Date(`${range.from}T00:00`).getTime() : null, range.to ? new Date(`${range.to}T23:59:59`).getTime() : null];
    default:
      return [null, null];
  }
}

export function profileView(st: AppState, email: string, rerender: () => void): Node {
  const m = memberOf(st, email);
  const isMe = email === st.me.email;
  const [from, to] = bounds();
  const stats = profileStats(st.ledger, email, from, to);
  const bal = balanceFor(st.ledger, email);

  const people = h(
    'nav',
    { class: 'chips', 'aria-label': 'Perfiles' },
    [...st.members.values()].map((p) =>
      h('a', { class: 'chip', href: `#/perfil/${encodeURIComponent(p.email)}`, 'aria-current': p.email === email ? 'page' : null }, withColor(h('span', { class: 'avatar sm', 'aria-hidden': 'true' }, p.name[0]?.toUpperCase() ?? '?'), p), p.email === st.me.email ? `${p.name} (tú)` : p.name),
    ),
  );

  const presets: [Range, string][] = [
    ['mes', 'Mes'],
    ['3m', '3 meses'],
    ['año', 'Año'],
    ['todo', 'Todo'],
    ['custom', 'Fechas…'],
  ];
  const control = h(
    'div',
    { class: 'seg-control', role: 'group', 'aria-label': 'Periodo' },
    presets.map(([k, label]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(range.kind === k) }, label);
      b.addEventListener('click', () => {
        range.kind = k;
        rerender();
      });
      return b;
    }),
  );
  const dateField = (key: 'from' | 'to', label: string) => {
    const i = h('input', { class: 'input', type: 'date', id: `p-${key}`, value: range[key] });
    i.addEventListener('change', () => {
      range[key] = i.value;
      rerender();
    });
    return h('div', { class: 'field' }, h('label', { for: `p-${key}` }, label), i);
  };
  const filters = h(
    'div',
    { class: 'filters' },
    control,
    range.kind === 'custom' ? dateRangePicker({ from: range.from, to: range.to, onChange: (f, t) => (Object.assign(range, { from: f, to: t }), rerender()) }) : null,
  );
  void dateField;

  const fills = stats.tramos.filter((t) => t.view.refuel.payer === email).length;
  const tramoKm = stats.tramos.reduce((a, t) => a + (t.share?.km ?? 0), 0);
  const totem = h(
    'section',
    { class: 'totem', 'aria-label': `Totales de ${m.name}` },
    h('div', { class: 'totem-head' }, h('span', null, `${m.name} · ${stats.trips.length} viajes`), h('span', { class: 'plate' }, range.kind === 'todo' ? 'Histórico' : 'Periodo')),
    h(
      'div',
      { class: 'totem-rows cols-3' },
      totemRow('Km recorridos', isMe ? 'Todos tus viajes' : 'Todos sus viajes', kmSeg(stats.km, 4), 'km'),
      totemRow('Gastado en gasolina', isMe ? 'Lo que te han costado tus km' : 'Lo que le han costado sus km', euroSeg(stats.costCents, stats.costCents ? 'led' : 'dim'), '€'),
      totemRow(isMe ? 'Veces que has repostado' : 'Veces que ha repostado', isMe ? 'Depósitos que pagaste en la gasolinera' : 'Depósitos que pagó en la gasolinera', segmentDisplay(String(fills), { minDigits: 2, label: `${fills} repostajes`, tone: fills ? 'led' : 'dim' }), fills === 1 ? 'vez' : 'veces'),
    ),
  );

  const net = stats.pumpCents + stats.sentCents - stats.receivedCents;
  const diff = net - stats.costCents;
  const t = (mine: string, other: string) => (isMe ? mine : other);
  // La cuenta, como un ticket: de dónde sale lo pagado y cómo queda frente a lo gastado.
  const line = (label: string, value: string, cls = '') => h('div', { class: `calc-line ${cls}` }, h('span', null, label), h('b', { class: 'num' }, value));
  const pendingNow: Node[] = [];
  for (const d of st.ledger.debts) {
    if (d.state !== 'pending' && d.state !== 'sent') continue;
    const amt = d.payment?.amountCents ?? d.dueCents;
    const owes = d.debtor === email;
    if (!owes && d.creditor !== email) continue;
    const other = memberOf(st, owes ? d.creditor : d.debtor);
    pendingNow.push(
      h(
        'li',
        { class: owes ? 'owes' : 'owed' },
        h('span', { class: 'pl-dir' }, owes ? t('Debes a', 'Debe a') : t('Te debe', 'Le debe')),
        h('span', { class: 'flow-who' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), other), other.name),
        h('b', { class: 'num pl-amt' }, fmtEur(amt)),
        h('a', { class: 'pl-link', href: `#/repostajes/${d.refuelId}` }, 'ver depósito'),
      ),
    );
  }
  const summary = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, t('¿Estás al día?', `¿${m.name} está al día?`))),
    h(
      'div',
      { class: 'block-body money' },
      h(
        'div',
        { class: 'calc-ticket' },
        line(t('Pagaste en la gasolinera', 'Pagó en la gasolinera'), fmtEur(stats.pumpCents)),
        line(t('+ Bizum que enviaste', '+ Bizum que envió'), fmtEur(stats.sentCents)),
        line(t('− Bizum que recibiste', '− Bizum que recibió'), fmtEur(stats.receivedCents)),
        line(t('Has pagado en total', 'Ha pagado en total'), fmtEur(net), 'total'),
        line(t(`Te tocaba pagar (tus ${fmtKm(tramoKm)})`, `Le tocaba pagar (sus ${fmtKm(tramoKm)})`), fmtEur(stats.costCents), 'sub'),
      ),
      Math.abs(diff) < 1
        ? h('div', { class: 'notice ok' }, h('span', null, t('Estás al día: has pagado justo lo que has gastado.', 'Está al día: ha pagado justo lo que ha gastado.')))
        : diff > 0
          ? h('div', { class: 'notice' }, h('span', null, t('Has pagado ', 'Ha pagado '), h('b', { class: 'num' }, fmtEur(diff)), t(' de más: los demás te lo devuelven por Bizum.', ' de más: los demás se lo devuelven por Bizum.')))
          : h('div', { class: 'notice bad' }, h('span', null, t('Has pagado ', 'Ha pagado '), h('b', { class: 'num' }, fmtEur(-diff)), t(' de menos: te queda por devolver.', ' de menos: le queda por devolver.'))),
      pendingNow.length ? h('ul', { class: 'pending-list small' }, pendingNow) : null,
    ),
  );
  // Cuentas de cada persona en el periodo: lo que le toca (sus km) frente a lo que ha pagado.
  // Los Bizum cuentan en cuanto se envían, para que las cuentas de todos sumen cero.
  const everyone = [...st.members.values()].map((p) => {
    const s2 = profileStats(st.ledger, p.email, from, to);
    const km2 = s2.tramos.reduce((a, t) => a + (t.share?.km ?? 0), 0);
    const paid = s2.pumpCents + s2.sentCents - s2.receivedCents;
    return { p, km: km2, cost: s2.costCents, paid, diff: paid - s2.costCents };
  });
  const totalCost = everyone.reduce((a, x) => a + x.cost, 0);
  const totalKm = everyone.reduce((a, x) => a + x.km, 0);
  // Quién le debe a quién: Bizum aún sin enviar de los depósitos del periodo, neteados por pareja.
  const refuelDate = new Map(st.ledger.refuels.map((r) => [r.refuel.id, r.refuel.date]));
  const pair = new Map<string, number>(); // "a|b" con a<b: positivo = a le debe a b
  for (const d of st.ledger.debts) {
    const when = refuelDate.get(d.refuelId) ?? 0;
    if (d.state !== 'pending' || !d.dueCents || (from != null && when < from) || (to != null && when > to)) continue;
    const [a, b] = d.debtor < d.creditor ? [d.debtor, d.creditor] : [d.creditor, d.debtor];
    const k = `${a}|${b}`;
    pair.set(k, (pair.get(k) ?? 0) + (d.debtor === a ? d.dueCents : -d.dueCents));
  }
  const flows = [...pair.entries()]
    .filter(([, c]) => Math.abs(c) >= 1)
    .map(([k, c]) => {
      const [a, b] = k.split('|');
      return c > 0 ? { from: a, to: b, cents: c } : { from: b, to: a, cents: -c };
    });
  const person = (e: string) => {
    const m = memberOf(st, e);
    return h('span', { class: 'flow-who' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m), m.name);
  };
  // Resultado: un número con signo, sin pastillas. El detalle (quién → a quién) va en una sola lista debajo.
  const resultCell = (diff: number) =>
    Math.abs(diff) < 1
      ? h('span', { class: 'res-zero' }, icon('check', 14), 'Al día')
      : h('span', { class: `num res-amt ${diff > 0 ? 'pos' : 'neg'}`, title: diff > 0 ? 'Ha pagado de más: se lo deben' : 'Ha pagado de menos: debe' }, `${diff > 0 ? '+' : '−'}${fmtEur(Math.abs(diff))}`);
  // Bizum pendientes: tabla aparte, sobria, un pago por fila.
  const flowList = flows.length
    ? h(
        'section',
        { class: 'block' },
        h('div', { class: 'block-head' }, h('h2', null, 'Bizum pendientes'), h('span', { class: 'muted small' }, `${flows.length} ${flows.length === 1 ? 'pago' : 'pagos'} · ${fmtEur(flows.reduce((a, f) => a + f.cents, 0))}`)),
        h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'flow-table' },
            h('thead', null, h('tr', null, h('th', null, 'Envía'), h('th', null, 'Recibe'), h('th', { class: 'r' }, 'Importe'))),
            h(
              'tbody',
              null,
              [...flows]
                .sort((x, y) => y.cents - x.cents)
                .map((f) => h('tr', null, h('td', null, memberOf(st, f.from).name), h('td', null, memberOf(st, f.to).name), h('td', { class: 'r num strong' }, fmtEur(f.cents)))),
            ),
          ),
        ),
      )
    : null;
  const family = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, 'Cuentas de cada uno'), h('span', { class: 'muted small' }, 'Quién ha pagado de más y quién de menos')),
    h(
      'div',
      { class: 'table-wrap' },
      h(
        'table',
        { class: 'family' },
        h(
          'thead',
          null,
          h('tr', null, h('th', null, 'Persona'), h('th', { class: 'r hide-sm' }, 'Km'), h('th', { class: 'r' }, h('span', { class: 'hide-sm' }, 'Le toca pagar'), h('span', { class: 'only-mobile' }, 'Le toca')), h('th', { class: 'r' }, h('span', { class: 'hide-sm' }, 'Ha pagado'), h('span', { class: 'only-mobile' }, 'Pagado')), h('th', { class: 'r' }, 'Resultado')),
        ),
        h(
          'tbody',
          null,
          everyone.map((x) =>
            h(
              'tr',
              { class: x.p.email === email ? 'is-current' : null },
              h('td', null, h('a', { href: `#/perfil/${encodeURIComponent(x.p.email)}`, class: 'who-link' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), x.p), x.p.name)),
              h('td', { class: 'r num hide-sm' }, fmtKm(x.km)),
              h('td', { class: 'r num strong' }, fmtEur(x.cost)),
              h('td', { class: 'r num' }, fmtEur(x.paid)),
              h('td', { class: 'r' }, resultCell(x.diff)),
            ),
          ),
        ),
        h('tfoot', null, h('tr', null, h('td', null, 'Total'), h('td', { class: 'r num hide-sm' }, fmtKm(totalKm)), h('td', { class: 'r num' }, fmtEur(totalCost)), h('td', { class: 'r num' }, fmtEur(totalCost)), h('td'))),
      ),
    ),
    h(
      'details',
      { class: 'block-foot legend-fold small muted' },
      h('summary', null, icon('info', 14), '¿Cómo se calcula?'),
      h('p', null, h('b', null, 'Le toca pagar'), ': la gasolina que ha gastado con sus km.'),
      h('p', null, h('b', null, 'Ha pagado'), ': lo que pagó en la gasolinera + los Bizum que envió − los Bizum que le devolvieron.'),
      h('p', null, h('b', null, 'Resultado'), ': lo pagado menos lo que le toca. En positivo, se lo deben; en negativo, debe.'),
      h('p', null, h('b', null, 'Bizum pendientes'), ': quién tiene que enviar a quién y cuánto. Si dos personas se deben en sentidos contrarios, se compensa.'),
      st.ledger.openTramo.shares.length
        ? h('p', null, `Solo cuentan los depósitos ya repostados: los ${fmtKm(st.ledger.openTramo.shares.reduce((a, y) => a + y.km, 0))} del depósito actual se reparten en el próximo repostaje.`)
        : null,
    ),
  );

  // Km por mes: una sola serie, sin leyenda; el título la nombra. Tabla de viajes debajo como vista accesible.
  // Solo los últimos 12 meses: el histórico completo está en Estadísticas.
  const byMonth = stats.byMonth.slice(-12);
  const max = Math.max(1, ...byMonth.map((x) => x.km));
  const chart = h(
    'section',
    { class: 'block' },
    h('div', { class: 'block-head' }, h('h2', null, t('Tus km cada mes', 'Sus km cada mes'))),
    h(
      'div',
      { class: 'block-body' },
      byMonth.length
        ? [
            h(
              'div',
              { class: 'bars', role: 'list' },
              byMonth.map((x) => {
                const bar = withColor(h('span', null), m);
                bar.style.setProperty('height', `${(x.km / max) * 100}%`);
                const label = h('b', null, groupThousands(x.km));
                label.style.setProperty('bottom', `calc(${(x.km / max) * 100}% + 4px)`);
                return h('div', { class: 'bar', role: 'listitem', tabindex: 0, title: `${x.label}: ${fmtKm(x.km)}`, 'aria-label': `${x.label}: ${fmtKm(x.km)}` }, bar, label);
              }),
            ),
            h('div', { class: 'bar-labels', 'aria-hidden': 'true' }, byMonth.map((x) => h('span', { title: x.label }, x.label.split(' ')[0]))),
          ]
        : h('p', { class: 'muted small' }, 'Sin viajes en este periodo.'),
    ),
  );

  const tramoList = [...stats.tramos].reverse();
  const tramoPage = paginate(tramoList, 6, tramoPaging, `${email}|${tramoList.length}`);
  const tramos = h(
    'section',
    { class: 'block', id: 'por-depositos' },
    h('div', { class: 'block-head' }, h('h2', null, t('Tu parte de cada depósito', 'Su parte de cada depósito')), h('span', { class: 'muted small' }, `${tramoList.length}`)),
    stats.tramos.length
      ? h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            null,
            h('thead', null, h('tr', null, h('th', null, 'Fechas'), h('th', null, 'Llenó'), h('th', null, 'Pago'), h('th', { class: 'r' }, t('Tus km', 'Sus km')), h('th', { class: 'r' }, t('Te toca', 'Le toca')))),
            h(
              'tbody',
              null,
              tramoPage.slice.map((t) =>
                h(
                  'tr',
                  null,
                  h('td', { class: 'nowrap' }, h('a', { class: 'strong num', href: `#/repostajes/${t.view.refuel.id}`, title: tramoName(st, t.view).title }, tramoName(st, t.view).range)),
                  h('td', { class: 'nowrap' }, t.view.refuel.payer === st.me.email ? 'Tú' : tramoName(st, t.view).payer),
                  h('td', null, debtPill(t.debt ?? undefined, t.view.refuel.payer === email)),
                  h('td', { class: 'r num' }, groupThousands(t.share?.km ?? 0)),
                  h('td', { class: 'r num strong' }, fmtEur(t.share?.cents ?? 0)),
                ),
              ),
            ),
          ),
        )
      : h('div', { class: 'empty' }, 'Sin tramos en este periodo.'),
    pager({ page: tramoPaging.page, pages: tramoPage.pages, total: tramoList.length, perPage: 6, noun: ['Depósito', 'Depósitos'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((tramoPaging.page = n), rerender()), anchor: '#por-depositos' }),
  );

  // Por viajes, paginado por meses (del más reciente al más antiguo).
  const months = [...new Set([...stats.trips].reverse().map((v) => monthKey(v.trip.date)))];
  if (tripMonth.person !== email || !months.includes(tripMonth.key)) Object.assign(tripMonth, { person: email, key: months[0] ?? '' });
  const mi = months.indexOf(tripMonth.key);
  const monthTrips = [...stats.trips].reverse().filter((v) => monthKey(v.trip.date) === tripMonth.key);
  const goMonth = (k: string) => {
    tripMonth.key = k;
    rerender();
    document.getElementById('por-viajes')?.scrollIntoView({ block: 'nearest' });
  };
  const monthNav = months.length
    ? h(
        'div',
        { class: 'month-nav' },
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes anterior', disabled: mi >= months.length - 1 || null, onclick: (() => goMonth(months[mi + 1])) as EventListener }, icon('chevronLeft', 16)),
        h('span', { class: 'month-name' }, monthName(tripMonth.key)),
        h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Mes siguiente', disabled: mi <= 0 || null, onclick: (() => goMonth(months[mi - 1])) as EventListener }, icon('chevron', 16)),
      )
    : null;
  const evid = (state: Parameters<typeof evidencePill>[0], label: string) => h('span', { class: 'evid-cell' }, evidencePill(state, label));
  const trips = h(
    'section',
    { class: 'block', id: 'por-viajes' },
    h('div', { class: 'block-head' }, h('h2', null, t('Tus viajes del mes', 'Sus viajes del mes')), monthNav),
    monthTrips.length
      ? h(
          'div',
          { class: 'table-wrap' },
          h(
            'table',
            { class: 'cards trips-month' },
            h('thead', null, h('tr', null, h('th', null, 'Fecha'), h('th', { class: 'r' }, 'Km'), h('th', null, 'Foto salida'), h('th', null, 'Foto llegada'))),
            h(
              'tbody',
              null,
              monthTrips.map((v) => {
                const tr = h(
                  'tr',
                  { class: 'clickable', tabindex: 0 },
                  h('td', null, h('span', { class: 'strong' }, dayMonth(v.trip.date)), h('div', { class: 'small muted num' }, `${groupThousands(v.trip.start.km ?? 0)} → ${v.endKm != null ? groupThousands(v.endKm) : '…'}`)),
                  h('td', { class: 'r num strong' }, v.endState === 'open' ? 'En curso' : fmtKm(v.km)),
                  h('td', { 'data-label': 'Foto salida' }, evid(v.startState, '')),
                  h('td', { 'data-label': 'Foto llegada' }, evid(v.endState, '')),
                );
                const open = () => tripDetail(st, v);
                tr.addEventListener('click', open);
                tr.addEventListener('keydown', (e) => e.key === 'Enter' && open());
                return tr;
              }),
            ),
            h('tfoot', null, h('tr', null, h('td', null, `${monthTrips.length} ${monthTrips.length === 1 ? 'viaje' : 'viajes'}`), h('td', { class: 'r num' }, fmtKm(monthTrips.reduce((a, v) => a + v.km, 0))), h('td'), h('td'))),
          ),
        )
      : h('div', { class: 'empty' }, 'Sin viajes en este periodo.'),
  );

  return h(
    'div',
    { class: 'stack' },
    pageHead(isMe ? 'Tu perfil' : `Perfil de ${m.name}`, email),
    people,
    filters,
    totem,
    family,
    flowList,
    h('div', { class: 'grid-2' }, h('div', { class: 'col' }, chart, tramos), h('div', { class: 'col' }, summary, trips)),
  );
}
