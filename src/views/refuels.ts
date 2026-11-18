import { h } from '../dom';
import { MAX_KM, TANK_LITERS, buildLedger, fmtEur, fmtKm, fmtLiters, fmtPrice, groupThousands, type Debt, type RefuelView, type Share } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, dayMonth, errorText, tramoName, euroSeg, fmtDate, linkBtn, pageHead, priceSeg, showEvidence, toast, who, withColor } from '../ui';
import { segmentDisplay } from '../segments';
import { legend, paginate, pager, tramoBar } from './common';
import { tripRow } from './trips';
import { photoPicker, readingField } from './reading';

export function debtPill(d: Debt | undefined, isPayer: boolean) {
  if (isPayer) return h('span', { class: 'pill neutral' }, icon('fuel'), 'Pagó');
  if (!d) return h('span', { class: 'muted small' }, '—');
  if (d.state === 'confirmed') return h('span', { class: 'pill ok' }, icon('ok'), 'Pagado');
  if (d.state === 'sent') return h('span', { class: 'pill warn' }, icon('clock'), 'Por confirmar');
  if (d.state === 'offset') return h('span', { class: 'pill ok', title: 'No hace falta Bizum: se compensa con otro depósito' }, icon('swap'), 'Compensado');
  return h('span', { class: 'pill bad' }, icon('dashed'), 'Pendiente');
}

function shareTable(st: AppState, r: RefuelView) {
  const total = r.shares.reduce((a, s) => a + s.km, 0);
  return h(
    'div',
    { class: 'table-wrap' },
    h(
      'table',
      { class: 'shares' },
      h('thead', null, h('tr', null, h('th', null, 'Persona'), h('th', { class: 'r' }, 'Km'), h('th', { class: 'r hide-sm' }, '%'), h('th', { class: 'r' }, 'Le toca'), h('th', null, 'Estado'))),
      h(
        'tbody',
        null,
        r.shares.map((s) =>
          h(
            'tr',
            null,
            h('td', null, h('a', { class: 'who-link', href: `#/perfil/${encodeURIComponent(s.email)}` }, who(st, s.email))),
            h('td', { class: 'r num' }, groupThousands(s.km)),
            h('td', { class: 'r num hide-sm' }, total ? `${((s.km / total) * 100).toFixed(1).replace('.', ',')} %` : '—'),
            h('td', { class: 'r num strong' }, fmtEur(s.cents)),
            h('td', null, debtPill(r.debts.find((d) => d.debtor === s.email), s.email === r.refuel.payer)),
          ),
        ),
      ),
      h('tfoot', null, h('tr', { class: 'total-row' }, h('td', null, 'Total'), h('td', { class: 'r num' }, groupThousands(total)), h('td', { class: 'hide-sm' }), h('td', { class: 'r num' }, fmtEur(r.refuel.amountCents)), h('td', null))),
    ),
  );
}

function refuelBlock(st: AppState, r: RefuelView) {
  const f = r.refuel;
  const mine = f.payer === st.me.email;
  const canDelete = mine && Date.now() - f.createdAt < 24 * 3600_000;
  const del = canDelete ? h('button', { class: 'btn ghost danger sm', type: 'button' }, icon('trash'), 'Borrar') : null;
  del?.addEventListener('click', async () => {
    if (!confirm(`¿Borrar ${r.code}? Solo se puede durante las primeras 24 h.`)) return;
    busy(del, true, 'Borrando…');
    try {
      await st.backend.deleteRefuel(f.id);
      toast('Repostaje borrado');
    } catch (e) {
      busy(del, false);
      toast(errorText(e), 'alert');
    }
  });
  return h(
    'article',
    { class: 'block' },
    h(
      'div',
      { class: 'block-head' },
      h('div', null, h('h2', null, `${tramoName(st, r).title} · ${fmtEur(f.amountCents)}`), h('div', { class: 'muted small num' }, `Llenó ${tramoName(st, r).payer} · ${fmtDate(f.date, true)} · ${fmtPrice(f.priceMilli)} · ${fmtLiters(r.litersMilli)} · ${r.code}`)),
      h('a', { class: 'who-link', href: `#/perfil/${encodeURIComponent(f.payer)}` }, who(st, f.payer)),
    ),
    h(
      'div',
      { class: 'block-body' },
      h(
        'p',
        { class: 'small muted num' },
        `Paga los km ${groupThousands(r.fromKm)} → ${fmtKm(r.toKm)} (${fmtKm(r.toKm - r.fromKm)})`,
        r.toKm > r.fromKm ? ` · ${(f.amountCents / (r.toKm - r.fromKm)).toFixed(1).replace('.', ',')} cént./km · ${((r.litersMilli / 1000 / (r.toKm - r.fromKm)) * 100).toFixed(1).replace('.', ',')} l/100 km aprox.` : '',
      ),
      h('div', { class: 'tramo-scale' }, tramoBar(st, r.shares, r.toKm - r.fromKm)),
      r.unassignedKm > 0 ? h('p', { class: 'notice' }, icon('route'), h('span', null, `${fmtKm(r.unassignedKm)} de este tramo no tienen viaje. Se reparte solo lo registrado.`)) : null,
    ),
    shareTable(st, r),
    tripsOf(st, r),
    h(
      'div',
      { class: 'dlg-foot' },
      h('button', { class: 'btn sm', type: 'button', onclick: (() => showEvidence(st, f.receiptPhotoId, `${r.code} · surtidor`)) as EventListener }, icon('receipt'), 'Surtidor'),
      f.odometerPhotoId ? h('button', { class: 'btn sm', type: 'button', onclick: (() => showEvidence(st, f.odometerPhotoId!, `${r.code} · cuentakilómetros`)) as EventListener }, icon('gauge'), 'Cuentakilómetros') : h('span', { class: 'pill warn' }, icon('alert'), 'Km sin foto'),
      del,
    ),
  );
}

/** Viajes que paga este depósito; cada uno abre su ficha. */
function tripsOf(st: AppState, r: RefuelView): Node | null {
  const trips = st.ledger.trips.filter((v) => v.refuelId === r.refuel.id).reverse();
  if (!trips.length) return null;
  return h(
    'details',
    { class: 'deposit-trips' },
    h('summary', null, icon('route', 16), `Viajes de este depósito (${trips.length})`),
    h('ul', { class: 'rows' }, trips.map((v) => h('li', null, tripRow(st, v)))),
  );
}

/** Tarjeta resumen de un repostaje: quién llenó, km del depósito, importe y fotos. */
function refuelTile(st: AppState, r: RefuelView): HTMLElement {
  const f = r.refuel;
  const n = tramoName(st, r);
  const payer = memberOf(st, f.payer);
  const pending = r.debts.filter((d) => d.state === 'pending' || d.state === 'sent').length;
  const status =
    r.debts.length === 0
      ? h('span', { class: 'pill neutral' }, 'Sin reparto')
      : pending
        ? h('span', { class: 'pill warn' }, icon('clock'), `${pending} por pagar`)
        : h('span', { class: 'pill ok' }, icon('ok'), 'Todo pagado');
  const tile = h(
    'article',
    { class: 'tile', id: `r-${f.id}` },
    h(
      'a',
      { class: 'tile-link', href: `#/repostajes/${f.id}`, 'aria-label': `Ver el ${n.title.toLowerCase()}` },
      h('span', { class: 'tile-date' }, n.title),
      h('span', { class: 'tile-amount num' }, fmtEur(f.amountCents)),
      h('span', { class: 'tile-row' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), payer), `Llenó ${payer.email === st.me.email ? `${payer.name} (tú)` : payer.name}`),
      h('span', { class: 'tile-row muted num' }, icon('route', 14), `${fmtKm(r.toKm - r.fromKm)} desde el anterior`),
      h('span', { class: 'tile-row muted num' }, icon('fuel', 14), `${fmtLiters(r.litersMilli)} · ${fmtPrice(f.priceMilli)}`),
      status,
    ),
    h(
      'div',
      { class: 'tile-foot' },
      h('button', { class: 'btn sm', type: 'button', onclick: (() => showEvidence(st, f.receiptPhotoId, `${n.title} · surtidor`)) as EventListener }, icon('receipt', 16), 'Surtidor'),
      f.odometerPhotoId
        ? h('button', { class: 'btn sm', type: 'button', onclick: (() => showEvidence(st, f.odometerPhotoId!, `${n.title} · cuentakilómetros`)) as EventListener }, icon('gauge', 16), 'Km')
        : h('span', { class: 'pill warn' }, icon('alert'), 'Km sin foto'),
    ),
  );
  return tile;
}

const PER_PAGE = 9;
const paging = { page: 1, key: '' };

export function refuelsView(st: AppState, rerender: () => void): Node {
  const list = [...st.ledger.refuels].reverse();
  const total = list.reduce((a, r) => a + r.refuel.amountCents, 0);
  const liters = list.reduce((a, r) => a + r.litersMilli, 0);
  const { slice, pages } = paginate(list, PER_PAGE, paging, String(list.length));
  return h(
    'div',
    { class: 'stack' },
    pageHead('Repostajes', list.length ? `${list.length} repostajes · ${fmtEur(total)} · ${fmtLiters(liters)}` : 'Quien llena el depósito paga; el resto le devuelve su parte por km.', linkBtn('#/repostajes/nuevo', 'Registrar repostaje', 'plus', 'btn primary')),
    list.length
      ? h('div', { class: 'tiles', id: 'tiles' }, slice.map((r) => refuelTile(st, r)))
      : h('section', { class: 'block' }, h('div', { class: 'empty' }, icon('fuel', 22), 'Aún no hay repostajes.')),
    pager({ page: paging.page, pages, total: list.length, perPage: PER_PAGE, noun: ['Repostaje', 'Repostajes'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((paging.page = n), rerender()), anchor: '#tiles' }),
  );
}

/** Página de un repostaje: todo el reparto, sus viajes y las fotos. */
export function refuelDetailView(st: AppState, id: string): Node | null {
  const r = st.ledger.refuels.find((x) => x.refuel.id === id);
  if (!r) return null;
  const i = st.ledger.refuels.indexOf(r);
  const newer = st.ledger.refuels[i + 1];
  const older = st.ledger.refuels[i - 1];
  const nav = h(
    'div',
    { class: 'detail-nav' },
    h('a', { class: 'btn ghost sm', href: '#/repostajes' }, icon('chevronLeft', 16), 'Todos los repostajes'),
    h(
      'div',
      { class: 'chips' },
      older ? h('a', { class: 'btn sm', href: `#/repostajes/${older.refuel.id}` }, icon('chevronLeft', 16), 'Anterior') : null,
      newer ? h('a', { class: 'btn sm', href: `#/repostajes/${newer.refuel.id}` }, 'Siguiente', icon('chevron', 16)) : null,
    ),
  );
  return h('div', { class: 'stack' }, nav, refuelBlock(st, r));
}

function parseMoney(raw: string, decimals: number): number | null {
  const s = raw.trim().replace(/\s|€/g, '').replace(',', '.');
  if (!s) return null;
  if (!new RegExp(`^\\d{1,4}(\\.\\d{1,${decimals}})?$`).test(s)) return NaN;
  return Math.round(Number(s) * 10 ** decimals);
}

export function refuelFormView(st: AppState): Node {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  const date = h('input', { class: 'input', type: 'datetime-local', id: 'r-date', value: now.toISOString().slice(0, 16) });
  const amount = h('input', { class: 'input big num', id: 'r-amount', inputmode: 'decimal', placeholder: '0,00', autocomplete: 'off' });
  const price = h('input', { class: 'input big num', id: 'r-price', inputmode: 'decimal', placeholder: '1,539', autocomplete: 'off' });
  const litersOut = h('div', { class: 'hint num', 'aria-live': 'polite' });
  const amountErr = h('div', { class: 'error', role: 'alert' });
  const priceErr = h('div', { class: 'error', role: 'alert' });
  const receiptErr = h('div', { class: 'error', role: 'alert' });
  const formErr = h('div', { class: 'error', role: 'alert' });
  const last = st.ledger.currentKm;
  const odo = readingField(st, {
    id: 'odo',
    title: 'Cuentakilómetros',
    hint: null,
    km: last,
    photoId: null,
    expected: () => last,
  });
  // Lectura automática del surtidor: rellena importe y €/l si el campo está vacío
  // o si lo había rellenado la lectura anterior (nunca pisa lo que ha escrito la persona).
  const pumpOcr = h('div', { class: 'ocr', 'aria-live': 'polite' });
  const autoFilled = new Map<HTMLInputElement, string>();
  const autofill = (input: HTMLInputElement, value: string) => {
    const prev = autoFilled.get(input);
    if (input.value.trim() && input.value !== prev) return false;
    input.value = value;
    autoFilled.set(input, value);
    input.dispatchEvent(new Event('input'));
    return true;
  };
  const money = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
  const priceTxt = (milli: number) => (milli / 1000).toFixed(3).replace('.', ',');
  const receipt = photoPicker(st, {
    id: 'r-receipt',
    label: 'Foto del surtidor',
    existingId: null,
    required: true,
    onCanvas: async (canvas) => {
      pumpOcr.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Leyendo el surtidor…');
      try {
        const { readPump } = await import('../ocr');
        const g = await readPump(canvas);
        if (g.amountCents == null && g.priceMilli == null) {
          pumpOcr.replaceChildren('No se han podido leer las cifras. Escríbelas tú.');
          return;
        }
        if (g.amountCents != null) autofill(amount, money(g.amountCents));
        if (g.priceMilli != null) autofill(price, priceTxt(g.priceMilli));
        pumpOcr.replaceChildren(icon('ok', 16), g.confidence === 'alta' ? 'Rellenado desde la foto. Compruébalo.' : 'Rellenado en parte desde la foto. Revisa las cifras.');
      } catch (e) {
        console.warn('OCR surtidor', e);
        pumpOcr.replaceChildren('El lector automático no está disponible. Escribe las cifras.');
      }
    },
  });
  const note = h('input', { class: 'input', id: 'r-note', maxlength: 280, placeholder: 'Gasolinera, tipo de combustible…' });
  const preview = h('section', { class: 'block', 'aria-live': 'polite' });

  // Resumen breve del tramo que cierra este repostaje.
  const prevRefuel = st.ledger.refuels[st.ledger.refuels.length - 1] ?? null;
  const firstKm = st.ledger.trips.length ? Math.min(...st.ledger.trips.map((v) => v.trip.start.km ?? Infinity)) : null;
  const tramoFrom = prevRefuel ? prevRefuel.toKm : firstKm;
  const tramoBox = h('div', { class: 'tramo-line', 'aria-live': 'polite' });
  odo.el.append(tramoBox);
  odo.el.querySelector('legend')?.prepend(h('span', { class: 'step-n', 'aria-hidden': 'true' }, '2'));
  const renderTramo = (km: number | null, cents: number | null, priceMilli: number | null) => {
    tramoBox.replaceChildren();
    if (tramoFrom == null || !Number.isFinite(tramoFrom)) {
      tramoBox.append(h('p', { class: 'hint' }, 'Primer repostaje: el reparto empezará a contar desde aquí.'));
      return;
    }
    const since = prevRefuel ? `el depósito del ${dayMonth(prevRefuel.refuel.date)}` : 'el primer viaje';
    if (km == null || Number.isNaN(km) || km <= tramoFrom) {
      tramoBox.append(h('p', { class: 'hint num' }, `El anterior se llenó a ${fmtKm(tramoFrom)}.`));
      return;
    }
    const total = km - tramoFrom;
    let registered = 0;
    for (const v of st.ledger.trips) {
      const a = v.trip.start.km;
      if (a == null || v.endState === 'open' || v.endKm == null) continue;
      registered += Math.max(0, Math.min(v.endKm, km) - Math.max(a, tramoFrom));
    }
    const missing = Math.max(0, total - registered);
    tramoBox.append(
      h(
        'p',
        { class: 'tramo-sum num' },
        `Desde ${since}: `,
        h('b', null, fmtKm(total)),
        cents && !Number.isNaN(cents) ? [' · ', h('b', null, fmtEur(cents)), ` · ${(cents / total).toFixed(1).replace('.', ',')} cént./km`] : null,
      ),
    );
    if (missing > 0)
      tramoBox.append(h('p', { class: 'hint warn-line' }, icon('alert', 14), `${fmtKm(missing)} sin apuntar en viajes: no se cobran a nadie. `, h('a', { href: '#/viajes' }, 'Ver viajes')));
    if (cents && priceMilli && !Number.isNaN(priceMilli)) {
      const liters = (cents * 10) / priceMilli;
      if (liters > TANK_LITERS + 2)
        tramoBox.append(h('p', { class: 'error' }, `Salen ${liters.toFixed(1).replace('.', ',')} l y el depósito es de unos ${TANK_LITERS} l. Revisa importe o precio.`));
    }
  };

  const refresh = () => {
    const c = parseMoney(amount.value, 2);
    const p = parseMoney(price.value, 3);
    const okC = c != null && !Number.isNaN(c) && c > 0;
    const okP = p != null && !Number.isNaN(p) && p > 0;
    litersOut.textContent = okC && okP ? `${fmtLiters(Math.round((c! * 10_000) / p!))} repostados` : '';
    const km = odo.km();
    renderTramo(km, okC ? c : null, okP ? p : null);
    preview.replaceChildren();
    if (!c || Number.isNaN(c) || km == null || Number.isNaN(km)) {
      preview.append(h('div', { class: 'block-head' }, h('h2', null, 'Reparto')), h('div', { class: 'block-body muted small' }, 'Pon el importe y los km para ver cuánto paga cada uno.'));
      return;
    }
    // Simulación con los mismos datos y la misma función que usará la app tras guardar.
    const fake = { id: '__preview', payer: st.me.email, date: Date.now(), amountCents: c, priceMilli: p && !Number.isNaN(p) ? p : 1, odometerKm: km, odometerPhotoId: null, receiptPhotoId: '', note: '', createdAt: Date.now() };
    const sim = buildLedger(st.snap.trips, [...st.snap.refuels, fake], []);
    const r = sim.refuels.find((x) => x.refuel.id === '__preview');
    if (!r) return;
    const shares: Share[] = r.shares;
    preview.append(
      h('div', { class: 'block-head' }, h('h2', null, 'Reparto'), h('span', { class: 'muted small num' }, fmtKm(r.toKm - r.fromKm))),
      h(
        'div',
        { class: 'block-body' },
        tramoBar(st, shares, r.toKm - r.fromKm),
        h(
          'ul',
          { class: 'split-list' },
          shares.map((s) =>
            h(
              'li',
              null,
              who(st, s.email),
              h('span', { class: 'muted small num' }, fmtKm(s.km)),
              s.email === st.me.email ? h('span', { class: 'muted small' }, 'tu parte') : h('b', { class: 'num' }, fmtEur(s.cents)),
            ),
          ),
        ),
        h('p', { class: 'hint' }, 'Cada uno te devolverá su parte por Bizum.'),
      ),
    );
  };
  [amount, price, odo.input].forEach((i) => i.addEventListener('input', refresh));
  refresh();

  const save = h('button', { class: 'btn primary', type: 'submit' }, icon('check'), 'Guardar repostaje');
  const step = (n: string, title: string) => h('div', { class: 'reading-head' }, h('legend', { class: 'label' }, h('span', { class: 'step-n', 'aria-hidden': 'true' }, n), title));
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h(
      'fieldset',
      { class: 'reading' },
      step('1', 'Surtidor'),
      h('div', { class: 'hint' }, 'Haz la foto a la pantalla del surtidor, donde se vean el importe y el precio por litro.'),
      receipt.el,
      pumpOcr,
      receiptErr,
      h(
        'div',
        { class: 'row-2' },
        h('div', { class: 'field' }, h('label', { for: 'r-amount' }, 'Importe'), h('div', { class: 'input-unit' }, amount, h('span', null, '€')), amountErr),
        h('div', { class: 'field' }, h('label', { for: 'r-price' }, 'Precio del litro'), h('div', { class: 'input-unit' }, price, h('span', null, '€/l')), priceErr),
      ),
      litersOut,
    ),
    odo.el,
    h(
      'details',
      { class: 'more' },
      h('summary', null, 'Fecha y nota'),
      h('div', { class: 'more-body' }, h('div', { class: 'field' }, h('label', { for: 'r-date' }, 'Fecha y hora'), date), h('div', { class: 'field' }, h('label', { for: 'r-note' }, 'Nota (opcional)'), note)),
    ),
    formErr,
    h('div', { class: 'formbar' }, h('a', { class: 'btn ghost', href: '#/repostajes' }, 'Cancelar'), save),
  );
  // En el móvil el reparto va antes del botón de guardar; en el ordenador, al lado.
  const aside = h('aside', { class: 'form-aside' });
  const wide = matchMedia('(min-width: 960px)');
  const place = () => (wide.matches ? aside.append(preview) : form.insertBefore(preview, formErr));
  wide.addEventListener('change', place);
  place();

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    [amountErr, priceErr, receiptErr, formErr].forEach((e) => (e.textContent = ''));
    odo.setError(null);
    const c = parseMoney(amount.value, 2);
    const p = parseMoney(price.value, 3);
    const km = odo.km();
    const when = new Date(date.value).getTime();
    let ok = true;
    if (c == null || Number.isNaN(c) || c < 100 || c > 30_000) (amountErr.textContent = 'Importe entre 1 y 300 €.'), (ok = false);
    if (p == null || Number.isNaN(p) || p < 500 || p > 4000) (priceErr.textContent = 'Precio entre 0,500 y 4,000 €/l.'), (ok = false);
    if (km == null || Number.isNaN(km) || km > MAX_KM) odo.setError('Escribe el km del cuentakilómetros.'), (ok = false);
    if (!receipt.pending()) (receiptErr.textContent = 'Falta la foto del surtidor: es la prueba del pago.'), (ok = false);
    if (!Number.isFinite(when) || when > Date.now() + 3600_000) (formErr.textContent = 'La fecha no es válida.'), (ok = false);
    const lastRefuel = st.ledger.refuels[st.ledger.refuels.length - 1];
    if (ok && lastRefuel && km! <= lastRefuel.toKm) odo.setError(`Debe ser mayor que el del último repostaje (${fmtKm(lastRefuel.toKm)}).`), (ok = false);
    if (!ok) return;
    busy(save, true);
    try {
      const receiptPhotoId = await st.backend.addEvidence('receipt', receipt.pending()!);
      const op = odo.photo.pending();
      const odometerPhotoId = op ? await st.backend.addEvidence('odometer', op) : null;
      await st.backend.addRefuel({ date: when, amountCents: c!, priceMilli: p!, odometerKm: km!, odometerPhotoId, receiptPhotoId, note: note.value.trim().slice(0, 280) });
      toast('Repostaje guardado. Ya se ve lo que debe cada uno.');
      location.hash = '#/repostajes';
    } catch (e) {
      busy(save, false);
      formErr.textContent = errorText(e);
    }
  });

  return h('div', { class: 'stack' }, pageHead('Registrar repostaje', 'Pagas tú; los demás te devuelven su parte por km.'), h('div', { class: 'form-split' }, form, aside));
}
