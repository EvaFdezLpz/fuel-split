import { h } from '../dom';
import { balanceFor, fmtEur, type Debt } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, dayMonth, dialog, errorText, tramoName, euroSeg, fmtDate, pageHead, toast, totemRow, who } from '../ui';
import { paginate, pager } from './common';
import { debtPill, parseMoney } from './refuels';
import { ledgerLog } from './ledger-log';

let tab: 'debo' | 'medeben' | 'registro' = 'debo';

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
  // Bizum hecho pero sin marcar, y que la app ha compensado con otra deuda: se marca la parte entera.
  if (iOwe && d.offsetCents > 0 && (d.state === 'pending' || d.state === 'offset')) actions.push(forgotButton(st, d, 'debtor'));
  // Quien lo recibe puede anotar un Bizum que le llegó y nadie marcó.
  if (!iOwe && d.creditor === st.me.email && (d.state === 'pending' || d.state === 'offset')) actions.push(forgotButton(st, d, 'creditor'));
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
    const no = h('button', { class: 'btn ghost danger sm', type: 'button', 'aria-label': 'No me ha llegado' }, h('span', { class: 'long' }, 'No me ha llegado'), h('span', { class: 'short' }, 'No llegó'));
    no.addEventListener('click', async () => {
      if (!confirm(`¿No te ha llegado el Bizum de ${fmtEur(d.payment!.amountCents)} de ${memberOf(st, d.debtor).name}? Se quitará la marca de enviado y volverá a salirle como pendiente.`)) return;
      busy(no, true, '…');
      try {
        await st.backend.rejectPayment(d.paymentId);
        toast('Marcado como no recibido');
      } catch (e) {
        busy(no, false);
        toast(errorText(e), 'alert');
      }
    });
    actions.push(no);
    const b = h('button', { class: 'btn primary sm', type: 'button' }, icon('check'), 'Confirmar', h('span', { class: 'long' }, ' recibido'));
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

/**
 * Bizum que se hizo pero no se marcó en la app. Si mientras tanto se compensó con otra deuda, la app
 * cree que no hacía falta: al anotarlo se quita la compensación y la otra persona vuelve a deber lo suyo
 * (si ya lo había pagado con descuento, le sale un ajuste por la diferencia).
 */
function forgotButton(st: AppState, d: Debt, side: 'debtor' | 'creditor'): HTMLElement {
  const other = memberOf(st, side === 'debtor' ? d.creditor : d.debtor).name;
  const r = st.ledger.refuels.find((x) => x.refuel.id === d.refuelId)!;
  const b = h('button', { class: 'btn ghost sm', type: 'button' }, icon('receipt', 14), side === 'debtor' ? 'Ya lo había pagado' : 'Ya me lo pagó');
  b.addEventListener('click', () => {
    const amount = h('input', { class: 'input big num', id: 'forgot-amount', inputmode: 'decimal', autocomplete: 'off', placeholder: '0,00' });
    const err = h('div', { class: 'error', role: 'alert' });
    const ok = h('button', { class: 'btn primary', type: 'button' }, icon('check'), side === 'debtor' ? 'Marcar como enviado' : 'Anotar como recibido');
    const dlg = dialog(
      side === 'debtor' ? 'Bizum que no marcaste' : 'Bizum que te llegó',
      [
        h('p', null, side === 'debtor' ? `Bizum a ${other} por el depósito del ${dayMonth(r.refuel.date)}.` : `Bizum de ${other} por el depósito del ${dayMonth(r.refuel.date)}.`),
        h(
          'div',
          { class: 'field' },
          h('label', { for: 'forgot-amount' }, side === 'debtor' ? '¿Cuánto enviaste?' : '¿Cuánto te llegó?'),
          h('div', { class: 'input-unit' }, amount, h('span', null, '€')),
          h('div', { class: 'hint' }, `Mira el importe en tu banco. Su parte de este depósito es ${fmtEur(d.cents)}.`),
          err,
        ),
        h('p', { class: 'muted small' }, side === 'debtor' ? `Al guardarlo, la app recalcula las cuentas con ese pago. ${other} tendrá que confirmarlo.` : 'Al guardarlo, la app recalcula las cuentas con ese pago. Queda como recibido directamente.'),
      ],
      [h('button', { class: 'btn ghost', type: 'button', onclick: (() => dlg.close()) as EventListener }, 'Cancelar'), ok],
    );
    setTimeout(() => amount.focus(), 50);
    amount.addEventListener('input', () => (err.textContent = ''));
    ok.addEventListener('click', async () => {
      const pick = parseMoney(amount.value, 2);
      if (pick == null || Number.isNaN(pick) || pick < 1 || pick > 30_000) {
        err.textContent = 'Escribe el importe, entre 0,01 y 300 €.';
        amount.focus();
        return;
      }
      busy(ok, true);
      try {
        if (side === 'debtor') {
          if (d.kind === 'adjust') await st.backend.sendAdjustment(d.refuelId, d.creditor, pick, d.seq ?? 1);
          else await st.backend.markSent(d.refuelId, d.creditor, pick);
        } else await st.backend.recordReceived(d.refuelId, d.debtor, pick, d.kind === 'adjust' ? (d.seq ?? 1) : undefined);
        dlg.close();
        toast(side === 'debtor' ? 'Marcado como enviado' : 'Anotado como recibido');
      } catch (e) {
        busy(ok, false);
        toast(errorText(e), 'alert');
      }
    });
  });
  return b;
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
    registro: [] as Debt[],
  };
  const labels = { debo: `Debo (${lists.debo.length})`, medeben: `Me deben (${lists.medeben.length})`, registro: 'Registro' };
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
  const empty = { debo: 'No debes nada. Cuando alguien reposte y hayas conducido, aparecerá aquí.', medeben: 'Nadie te debe nada ahora mismo.', registro: '' }[tab];

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
    tab === 'registro'
      ? ledgerLog(st, rerender)
      : rows.length
      ? h('div', { class: 'tiles', id: 'debts' }, rows.map((d) => debtCard(st, d)))
      : h('section', { class: 'block' }, h('div', { class: 'empty' }, icon('ok', 22), empty)),
    tab === 'registro' ? null : pager({ page: paging.page, pages, total: all.length, perPage: PER_PAGE, noun: ['Pago', 'Pagos'], prev: 'Anteriores', next: 'Siguientes', go: (n) => ((paging.page = n), rerender()), anchor: '#debts' }),
  );
}
