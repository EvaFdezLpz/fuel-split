// Registro de todos los movimientos de dinero: Bizum (confirmados o no), lo pagado en la gasolinera
// y las compensaciones (deudas que se anulan entre dos personas sin Bizum). Sirve para revisar las
// cuentas si alguien cree que hay un error: «Ana → Marta · 20,00 €», ordenado por fecha.
import { h } from '../dom';
import { fmtEur, fmtLiters } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { dayMonth } from '../ui';
import { paginate, pager } from './common';
import { selectMenu } from './select';

type Kind = 'bizum' | 'pump' | 'offset';
interface Entry {
  date: number;
  kind: Kind;
  from: string;
  /** Destinatario; vacío para la gasolinera. */
  to: string;
  cents: number;
  concept: string;
  /** Solo Bizum: confirmado por quien lo recibió o todavía no. */
  pending: boolean;
  /** Nota corta (quién lo anotó, si fue quien lo recibió). */
  note: string;
}

const filter = { who: '', kind: '' as '' | Kind };
const paging = { page: 1, key: '' };
const PER_PAGE = 25;

export function logEntries(st: AppState): Entry[] {
  const name = (e: string) => memberOf(st, e).name;
  const refuelOf = (id: string) => st.snap.refuels.find((r) => r.id === id);
  const out: Entry[] = [];
  for (const p of st.snap.payments) {
    const r = refuelOf(p.refuelId);
    const dep = r ? `depósito del ${dayMonth(r.date)}` : 'depósito borrado';
    out.push({
      date: p.confirmedAt ?? p.sentAt,
      kind: 'bizum',
      from: p.debtor,
      to: p.creditor,
      cents: p.amountCents,
      concept: p.kind === 'adjust' ? `Ajuste del ${dep}` : `Parte del ${dep}`,
      pending: p.status !== 'confirmed',
      note: p.status === 'confirmed' && p.confirmedAt != null && p.confirmedAt === p.sentAt ? `Anotado por ${name(p.creditor)}` : '',
    });
  }
  for (const r of st.snap.refuels)
    out.push({ date: r.date, kind: 'pump', from: r.payer, to: '', cents: r.amountCents, concept: `Repostaje · ${fmtLiters(Math.round((r.amountCents * 10_000) / r.priceMilli))}`, pending: false, note: '' });
  // Compensaciones: una línea por pareja, con lo que se anula entre las dos sin Bizum.
  const pairs = new Map<string, { a: string; b: string; cents: number; date: number; deps: Set<string> }>();
  for (const d of st.ledger.debts) {
    if (d.offsetCents <= 0) continue;
    const [a, b] = [d.debtor, d.creditor].sort();
    const k = `${a}|${b}`;
    const g = pairs.get(k) ?? { a, b, cents: 0, date: 0, deps: new Set<string>() };
    if (d.debtor === a) g.cents += d.offsetCents; // se cuenta un solo lado (los dos suman lo mismo)
    const r = refuelOf(d.refuelId);
    if (r) (g.date = Math.max(g.date, r.date)), g.deps.add(dayMonth(r.date));
    pairs.set(k, g);
  }
  for (const g of pairs.values())
    if (g.cents > 0)
      out.push({ date: g.date, kind: 'offset', from: g.a, to: g.b, cents: g.cents, concept: `Compensado sin Bizum · depósitos del ${[...g.deps].join(', ')}`, pending: false, note: '' });
  return out.sort((x, y) => y.date - x.date);
}

const monthLabel = (ms: number) => {
  const s = new Date(ms).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  return s.charAt(0).toUpperCase() + s.slice(1);
};

function csv(st: AppState, rows: Entry[]): string {
  const name = (e: string) => (e ? memberOf(st, e).name : 'Gasolinera');
  const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const kind = { bizum: 'Bizum', pump: 'Gasolinera', offset: 'Compensación' };
  const lines = rows.map((r) =>
    [
      new Date(r.date).toLocaleString('es-ES'),
      kind[r.kind],
      name(r.from),
      r.kind === 'pump' ? 'Gasolinera' : name(r.to),
      (r.cents / 100).toFixed(2).replace('.', ','),
      r.kind === 'bizum' ? (r.pending ? 'Sin confirmar' : 'Confirmado') : '',
      r.concept + (r.note ? ` (${r.note})` : ''),
    ]
      .map(q)
      .join(';'),
  );
  return '﻿' + ['Fecha;Tipo;De;A;Importe (€);Estado;Concepto', ...lines].join('\r\n');
}

export function ledgerLog(st: AppState, rerender: () => void): HTMLElement {
  const all = logEntries(st);
  const rows = all.filter((e) => (!filter.who || e.from === filter.who || e.to === filter.who) && (!filter.kind || e.kind === filter.kind));
  const { slice, pages } = paginate(rows, PER_PAGE, paging, `${filter.who}|${filter.kind}|${rows.length}`);
  const name = (e: string) => (e === st.me.email ? `${memberOf(st, e).name} (tú)` : memberOf(st, e).name);

  // Totales del filtro.
  const sum = (f: (e: Entry) => boolean) => rows.filter(f).reduce((a, e) => a + e.cents, 0);
  const who = filter.who;
  const totals = who
    ? [
        ['Bizum enviados', sum((e) => e.kind === 'bizum' && !e.pending && e.from === who)],
        ['Bizum recibidos', sum((e) => e.kind === 'bizum' && !e.pending && e.to === who)],
        ['En gasolinera', sum((e) => e.kind === 'pump' && e.from === who)],
      ]
    : [
        ['En Bizum', sum((e) => e.kind === 'bizum' && !e.pending)],
        ['En gasolinera', sum((e) => e.kind === 'pump')],
        ['Compensado', sum((e) => e.kind === 'offset')],
      ];
  const unconfirmed = rows.filter((e) => e.kind === 'bizum' && e.pending);

  const kinds: [string, '' | Kind][] = [['Todo', ''], ['Bizum', 'bizum'], ['Gasolinera', 'pump'], ['Compensado', 'offset']];
  const seg = h(
    'div',
    { class: 'seg-control', role: 'group', 'aria-label': 'Tipo de movimiento' },
    kinds.map(([label, k]) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(filter.kind === k) }, label);
      b.addEventListener('click', () => ((filter.kind = k), rerender()));
      return b;
    }),
  );
  const download = h('button', { class: 'btn ghost sm', type: 'button' }, icon('arrowDownLeft', 14), 'Descargar');
  download.addEventListener('click', () => {
    const url = URL.createObjectURL(new Blob([csv(st, rows)], { type: 'text/csv;charset=utf-8' }));
    const a = h('a', { href: url, download: `movimientos-deposito-comun-${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.append(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  // Filas agrupadas por mes.
  const body: Node[] = [];
  let month = '';
  for (const e of slice) {
    const m = monthLabel(e.date);
    if (m !== month) {
      month = m;
      body.push(h('li', { class: 'log-month', role: 'presentation' }, m));
    }
    const target = e.kind === 'pump' ? h('span', { class: 'log-pump' }, 'Gasolinera') : h('span', null, name(e.to));
    body.push(
      h(
        'li',
        { class: `log-row${e.pending ? ' is-pending' : ''}` },
        h('span', { class: 'log-date num' }, dayMonth(e.date)),
        h(
          'span',
          { class: 'log-main' },
          h('span', { class: 'log-who' }, h('span', null, name(e.from)), h('span', { class: 'log-arrow', 'aria-label': e.kind === 'offset' ? 'y' : 'a' }, e.kind === 'offset' ? '⇄' : '→'), target),
          h('span', { class: 'log-concept' }, e.concept, e.note ? ` · ${e.note}` : ''),
        ),
        h('span', { class: 'log-amount' }, h('span', { class: `num${e.kind === 'offset' ? ' muted' : ''}` }, fmtEur(e.cents)), e.pending ? h('span', { class: 'log-state' }, 'Sin confirmar') : null),
      ),
    );
  }

  return h(
    'section',
    { class: 'log', id: 'registro' },
    h(
      'div',
      { class: 'log-filters' },
      selectMenu({
        label: 'Persona',
        value: filter.who,
        icon: 'user',
        options: [{ value: '', label: 'Todos' }, ...[...st.members.values()].map((m) => ({ value: m.email, label: m.email === st.me.email ? `${m.name} (tú)` : m.name, member: m }))],
        onChange: (v) => ((filter.who = v), rerender()),
      }),
      seg,
      download,
    ),
    h(
      'dl',
      { class: 'log-totals' },
      totals.map(([label, cents]) => h('div', null, h('dt', null, label as string), h('dd', { class: 'num' }, fmtEur(cents as number)))),
    ),
    unconfirmed.length
      ? h('p', { class: 'small muted log-hint' }, unconfirmed.length === 1
          ? '1 Bizum marcado como enviado está sin confirmar: no cuenta en los totales hasta que quien lo recibe lo confirma.'
          : `${unconfirmed.length} Bizum marcados como enviados están sin confirmar: no cuentan en los totales hasta que quien los recibe los confirma.`)
      : null,
    slice.length ? h('ul', { class: 'log-list' }, body) : h('div', { class: 'empty' }, icon('ok', 22), 'No hay movimientos con este filtro.'),
    pager({ page: paging.page, pages, total: rows.length, perPage: PER_PAGE, noun: ['Movimiento', 'Movimientos'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((paging.page = n), rerender()), anchor: '#registro' }),
    h('p', { class: 'small muted log-hint' }, '¿Falta un Bizum que sí se hizo? Búscalo en Debo o Me deben y pulsa «Ya lo había pagado» o «Ya me lo pagó». Si uno marcado no llegó, quien lo iba a recibir pulsa «No me ha llegado».'),
  );
}
