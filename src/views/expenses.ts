import { h } from '../dom';
import { balanceFor, fmtEur, type Debt } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, dayMonth, dialog, errorText, tramoName, euroSeg, fmtDate, pageHead, toast, totemRow, who } from '../ui';
import { paginate, pager } from './common';
import { debtPill } from './refuels';

let tab: 'debo' | 'medeben' | 'historial' = 'debo';

/** Por qué hay un ajuste: el reparto de un depósito ya pagado cambió después. */
export function adjustReason(st: AppState, d: Debt): string {
  const r = st.ledger.refuels.find((x) => x.refuel.id === d.refuelId)!;
  const payerIsDebtor = d.debtor === r.refuel.payer;
  const other = payerIsDebtor ? d.creditor : d.debtor;
  const you = other === st.me.email;
  const name = memberOf(st, other).name;
  return payerIsDebtor
    ? `Después del Bizum se apuntaron km que cambian el reparto: ${you ? 'te tocaba menos y se te devuelve' : `a ${name} le tocaba menos y se le devuelve`} la diferencia.`
    : `Después del Bizum se apuntaron km que cambian el reparto: ${you ? 'te tocaba más y falta' : `a ${name} le tocaba más y falta`} la diferencia.`;
}

/** Botones de una deuda según quién mira: Confirmar Bizum, Deshacer o Confirmar recibido. */
export function debtActions(st: AppState, d: Debt): HTMLElement[] {
  const r = st.ledger.refuels.find((x) => x.refuel.id === d.refuelId)!;
  const iOwe = d.debtor === st.me.email;
  const actions: HTMLElement[] = [];

  if (iOwe && d.state === 'pending') {
    const b = h('button', { class: 'btn primary sm', type: 'button' }, icon('send'), 'Confirmar', h('span', { class: 'hide-xs' }, ' Bizum'));
    b.addEventListener('click', () => {
      const ok = h('button', { class: 'btn primary', type: 'button' }, icon('check'), 'Sí, ya está enviado');
      const dlg = dialog(d.kind === 'adjust' ? 'Bizum de ajuste enviado' : 'Marcar Bizum como enviado', [
        h('p', null, 'Confirma que has enviado ', h('b', { class: 'num' }, fmtEur(d.dueCents)), ` a ${memberOf(st, d.creditor).name} por el depósito del ${dayMonth(r.refuel.date)}.`),
        d.kind === 'adjust' ? h('p', { class: 'small' }, adjustReason(st, d)) : null,
        h('p', { class: 'muted small' }, `${memberOf(st, d.creditor).name} tendrá que confirmar que lo ha recibido.`),
      ], [h('button', { class: 'btn ghost', type: 'button', onclick: (() => dlg.close()) as EventListener }, 'Cancelar'), ok]);
      ok.addEventListener('click', async () => {
        busy(ok, true, 'Enviando…');
        try {
          if (d.kind === 'adjust') await st.backend.sendAdjustment(d.refuelId, d.creditor, d.dueCents, d.seq ?? 1);
          else await st.backend.markSent(d.refuelId, d.creditor, d.dueCents);
          dlg.close();
          toast('Marcado como enviado');
        } catch (e) {
          busy(ok, false);
          toast(errorText(e), 'alert');
        }
      });
    });
    actions.push(b);
  }
  if (iOwe && d.state === 'sent') {
    const b = h('button', { class: 'btn ghost sm', type: 'button' }, 'Deshacer');
    b.addEventListener('click', async () => {
      busy(b, true, '…');
      try {
        await st.backend.undoSent(d.paymentId);
      } catch (e) {
        busy(b, false);
        toast(errorText(e), 'alert');
      }
    });
    actions.push(b);
  }
  if (!iOwe && d.state === 'sent') {
    const b = h('button', { class: 'btn primary sm', type: 'button' }, icon('check'), 'Confirmar recibido');
    b.addEventListener('click', async () => {
      busy(b, true, 'Confirmando…');
      try {
        await st.backend.confirmPayment(d.paymentId);
        toast('Pago confirmado');
      } catch (e) {
        busy(b, false);
        toast(errorText(e), 'alert');
      }
    });
    actions.push(b);
  }

  return actions;
}

/** Estado con un icono: ✓ pagado (o compensado), ○ pendiente de confirmar, ✕ sin pagar. */
function statusMark(d: Debt): HTMLElement {
  const [cls, ic, text] =
    d.state === 'confirmed' || d.state === 'offset'
      ? (['ok', 'check', d.state === 'offset' ? 'Compensado: no hace falta Bizum' : 'Pagado'] as const)
      : d.state === 'sent'
        ? (['warn', 'dashed', 'Pendiente: falta que lo confirme quien lo recibe'] as const)
        : (['bad', 'close', 'Sin pagar'] as const);
  return h('span', { class: `status-mark ${cls}`, title: text, role: 'img', 'aria-label': text }, icon(ic, 15));
}

/** Tarjeta de una deuda: depósito, persona, importe, estado y acciones. */
export function debtCard(st: AppState, d: Debt): HTMLElement {
  const r = st.ledger.refuels.find((x) => x.refuel.id === d.refuelId)!;
  const iOwe = d.debtor === st.me.email;
  const other = iOwe ? d.creditor : d.debtor;
  const actions = debtActions(st, d);
  const drift =
    d.kind === 'adjust'
      ? h('p', { class: 'small muted', role: 'note' }, adjustReason(st, d))
      : d.payment && d.state === 'sent' && d.driftCents !== 0 && d.creditor === st.me.email
        ? h('p', { class: 'small', role: 'note' }, h('span', { class: 'pill warn' }, icon('alert'), 'No cuadra'), ` Ha marcado ${fmtEur(d.payment.amountCents)} y le toca ${fmtEur(d.dueCents)}. Confirma solo lo que te haya llegado por Bizum.`)
      : d.payment && d.driftCents !== 0 && d.state === 'confirmed'
        ? h('p', { class: 'small muted', role: 'note' }, icon('swap', 13), ' El reparto cambió después del pago: la diferencia va en un ajuste aparte.')
        : null;
  // Compensación: explica de dónde sale el descuento y enlaza al depósito que lo compensa.
  const offsetNote =
    d.offsetCents > 0
      ? h(
          'p',
          { class: 'small muted' },
          d.dueCents === 0 ? 'No hace falta Bizum: ' : `Su parte era ${fmtEur(d.cents)}; `,
          `${fmtEur(d.offsetCents)} compensados con `,
          d.offsetWith.flatMap((rid, i) => {
            const o = st.ledger.refuels.find((x) => x.refuel.id === rid);
            return o ? [i ? ', ' : '', h('a', { href: `#/repostajes/${rid}` }, `el depósito del ${dayMonth(o.refuel.date)}`)] : [];
          }),
          '.',
        )
      : null;
  const amount = d.state === 'offset' ? 0 : d.payment?.amountCents ?? d.dueCents;
  const when = d.payment ? (d.state === 'confirmed' && d.payment.confirmedAt ? `Confirmado el ${fmtDate(d.payment.confirmedAt)}` : `Enviado el ${fmtDate(d.payment.sentAt)}`) : null;
  return h(
    'article',
    { class: 'tile debt-tile' },
    h(
      'div',
      { class: 'tile-body' },
      h('div', { class: 'debt-top' }, h('a', { class: 'debt-title', href: `#/repostajes/${r.refuel.id}` }, d.kind === 'adjust' ? 'Ajuste · ' : 'Depósito · ', h('span', { class: 'num' }, dayMonth(r.refuel.date))), statusMark(d)),
      h('div', { class: 'tile-amount num' }, fmtEur(amount)),
      h('div', { class: 'debt-who' }, h('span', { class: 'muted small' }, iOwe ? 'Le debes a' : 'Te debe'), h('a', { class: 'who-link', href: `#/perfil/${encodeURIComponent(other)}` }, who(st, other))),
      when ? h('p', { class: 'small muted' }, when) : null,
      drift,
      offsetNote,
    ),
    actions.length ? h('div', { class: 'tile-foot' }, actions) : null,
  );
}

const PER_PAGE = 9;
const paging = { page: 1, key: '' };

export function expensesView(st: AppState, rerender: () => void): Node {
  const me = st.me.email;
  const bal = balanceFor(st.ledger, me);
  const mine = st.ledger.debts.filter((d) => d.debtor === me || d.creditor === me).reverse();
  const lists = {
    debo: mine.filter((d) => d.debtor === me && (d.state === 'pending' || d.state === 'sent')),
    medeben: mine.filter((d) => d.creditor === me && (d.state === 'pending' || d.state === 'sent')),
    historial: mine.filter((d) => d.state === 'confirmed' || d.state === 'offset'),
  };
  const labels = { debo: `Debo (${lists.debo.length})`, medeben: `Me deben (${lists.medeben.length})`, historial: 'Historial' };
  const control = h(
    'div',
    { class: 'seg-control', role: 'group', 'aria-label': 'Filtrar pagos' },
    (Object.keys(labels) as (keyof typeof labels)[]).map((k) => {
      const b = h('button', { type: 'button', 'aria-pressed': String(tab === k) }, labels[k]);
      b.addEventListener('click', () => {
        tab = k;
        rerender();
      });
      return b;
    }),
  );
  const all = lists[tab];
  const { slice: rows, pages } = paginate(all, PER_PAGE, paging, `${tab}|${all.length}`);
  const empty = { debo: 'No debes nada. Cuando alguien reposte y hayas conducido, aparecerá aquí.', medeben: 'Nadie te debe nada ahora mismo.', historial: 'Aún no hay pagos confirmados.' }[tab];

  return h(
    'div',
    { class: 'stack' },
    pageHead('Gastos', 'Bizum entre la familia por cada repostaje.'),
    h(
      'section',
      { class: 'totem', 'aria-label': 'Saldo' },
      h('div', { class: 'totem-rows cols-3' }, totemRow('Debes', 'Sin Bizum todavía', euroSeg(bal.owes, bal.owes ? 'bad' : 'dim'), '€'), totemRow('Enviado', 'Esperando confirmación', euroSeg(bal.awaiting, bal.awaiting ? 'led' : 'dim'), '€'), totemRow('Te deben', 'Por cobrar o confirmar', euroSeg(bal.owed, bal.owed ? 'ok' : 'dim'), '€')),
    ),
    control,
    rows.length
      ? h('div', { class: 'tiles', id: 'debts' }, rows.map((d) => debtCard(st, d)))
      : h('section', { class: 'block' }, h('div', { class: 'empty' }, icon('ok', 22), empty)),
    pager({ page: paging.page, pages, total: all.length, perPage: PER_PAGE, noun: ['Pago', 'Pagos'], prev: 'Anteriores', next: 'Siguientes', go: (n) => ((paging.page = n), rerender()), anchor: '#debts' }),
  );
}
