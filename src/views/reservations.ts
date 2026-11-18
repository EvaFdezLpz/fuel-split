// Reservas del coche: quien lo necesita un día lo anota, y el resto lo ve aquí y en el calendario.
import { h } from '../dom';
import { fmtKm, type Reservation, riders } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, errorText, pageHead, toast, withColor } from '../ui';
import { dateRangePicker, futureRange, isoDay, parseIso, reservationDays, showDay } from './calendar';
import { paginate, pager } from './common';

const todayIso = () => isoDay(new Date());
const RES_PER_PAGE = 8;
const nextPaging = { page: 1, key: '' };
const pastPaging = { page: 1, key: '' };

/** «Hoy», «Mañana», «En 3 días», «Ahora» (si ya ha empezado). */
function whenLabel(r: Reservation): string {
  const t = todayIso();
  if (r.day <= t && r.endDay >= t) return r.day === r.endDay ? 'Hoy' : 'En curso';
  const a = parseIso(r.day)!;
  const now = parseIso(t)!;
  const n = Math.round((a.getTime() - now.getTime()) / 86_400_000);
  if (n < 0) {
    const ago = Math.round((now.getTime() - parseIso(r.endDay)!.getTime()) / 86_400_000);
    return ago <= 1 ? 'Ayer' : `Hace ${ago} días`;
  }
  return n === 1 ? 'Mañana' : `En ${n} días`;
}

/** Reservas de otras personas que coinciden en algún día con esta. */
export function clashes(st: AppState, day: string, endDay: string, member: string, exceptId?: string): Reservation[] {
  return st.snap.reservations.filter((x) => x.id !== exceptId && x.member !== member && x.day <= endDay && x.endDay >= day);
}

/** Quién usó el coche esos días, según los viajes registrados: persona y km. */
function usedBy(st: AppState, r: Reservation): { email: string; km: number }[] {
  const by = new Map<string, number>();
  for (const v of st.ledger.trips) {
    const k = isoDay(new Date(v.trip.date));
    if (k < r.day || k > r.endDay) continue;
    for (const p of riders(v.trip)) by.set(p, (by.get(p) ?? 0) + v.km / riders(v.trip).length);
  }
  return [...by.entries()].map(([email, km]) => ({ email, km })).sort((a, b) => b.km - a.km);
}

function upcoming(st: AppState): Reservation[] {
  const t = todayIso();
  return st.snap.reservations.filter((r) => r.endDay >= t).sort((a, b) => a.day.localeCompare(b.day) || a.createdAt - b.createdAt);
}

/** Tarjeta de una reserva. */
export function reservationTile(st: AppState, r: Reservation, compact = false): HTMLElement {
  const m = memberOf(st, r.member);
  const mine = r.member === st.me.email;
  const a = parseIso(r.day)!;
  const days = reservationDays(r).length;
  const label = whenLabel(r);
  const tile = withColor(
    h(
      'article',
      { class: `tile res-tile${compact ? ' compact' : ''}`, id: `res-${r.id}` },
      h(
        'a',
        { class: 'tile-link', href: `#/reservas/${r.id}` },
        h(
          'span',
          { class: 'res-top' },
          h(
            'span',
            { class: 'res-date' },
            h('b', { class: 'num' }, String(a.getDate())),
            h('span', null, a.toLocaleDateString('es-ES', { month: 'short' }).replace('.', '')),
          ),
          h('span', { class: `pill ${label === 'Hoy' || label === 'En curso' ? 'warn' : 'neutral'}` }, label),
        ),
        h('span', { class: 'tile-date' }, futureRange(r.day, r.endDay), days > 1 ? ` · ${days} días` : ''),
        h('span', { class: 'tile-row' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m), h('b', null, mine ? `${m.name} (tú)` : m.name)),
        h('span', { class: 'res-note' }, r.note),
      ),
      compact
        ? null
        : h(
            'div',
            { class: 'tile-foot' },
            h('button', { class: 'btn sm', type: 'button', onclick: (() => showDay(r.day)) as EventListener }, icon('calendar', 16), 'Calendario'),
            mine ? h('a', { class: 'btn sm', href: `#/reservas/${r.id}/editar` }, icon('edit', 16), 'Editar') : null,
          ),
    ),
    m,
  );
  return tile;
}

export function reservationsView(st: AppState, rerender: () => void, focusId?: string): Node {
  const next = upcoming(st);
  const t = todayIso();
  const past = st.snap.reservations.filter((r) => r.endDay < t).sort((a, b) => b.day.localeCompare(a.day));
  const mineCount = next.filter((r) => r.member === st.me.email).length;
  // Agenda ordenada por día: la fecha a la izquierda y, a la derecha, quién lo necesita y para qué.
  const usedLine = (r: Reservation) => {
    const used = usedBy(st, r);
    if (!used.length) return h('p', { class: 'res-used none' }, icon('route', 14), r.endDay < t ? 'No se registró ningún viaje' : 'Todavía sin viajes registrados');
    return h(
      'p',
      { class: 'res-used' },
      icon('route', 14),
      'Lo usó ',
      used.flatMap((u, i) => {
        const um = memberOf(st, u.email);
        return [i ? ', ' : '', h('b', null, um.name), ` (${fmtKm(u.km)})`];
      }),
      used.every((u) => u.email !== r.member) ? h('span', { class: 'res-other' }, ` · no lo usó ${memberOf(st, r.member).name}`) : null,
    );
  };
  const item = (r: Reservation) => {
    const m = memberOf(st, r.member);
    const mine = r.member === st.me.email;
    const days = reservationDays(r).length;
    const el = withColor(
      h(
        'div',
        { class: 'res-item', id: `res-${r.id}` },
        h('span', { class: 'dot', 'aria-hidden': 'true' }),
        h(
          'div',
          { class: 'res-body' },
          h('div', { class: 'res-line' }, h('b', null, mine ? `${m.name} (tú)` : m.name), days > 1 ? h('span', { class: 'muted small' }, `hasta el ${futureRange(r.endDay, r.endDay).toLowerCase()} · ${days} días`) : null),
          h('p', { class: 'res-text' }, r.note),
          r.day <= t ? usedLine(r) : null,
        ),
        h(
          'div',
          { class: 'res-actions' },
          h('button', { class: 'icon-btn', type: 'button', title: 'Ver en el calendario', 'aria-label': 'Ver en el calendario', onclick: (() => showDay(r.day)) as EventListener }, icon('calendar', 16)),
          mine ? h('a', { class: 'icon-btn', href: `#/reservas/${r.id}/editar`, title: 'Editar', 'aria-label': 'Editar la reserva' }, icon('edit', 16)) : null,
        ),
      ),
      m,
    );
    if (r.id === focusId) {
      el.classList.add('flash');
      requestAnimationFrame(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }));
    }
    return el;
  };
  const agenda = (list: Reservation[]) => {
    const byDay = new Map<string, Reservation[]>();
    for (const r of list) {
      if (!byDay.has(r.day)) byDay.set(r.day, []);
      byDay.get(r.day)!.push(r);
    }
    return h(
      'div',
      { class: 'res-agenda' },
      [...byDay.entries()].map(([day, rs]) => {
        const d = parseIso(day)!;
        return h(
          'section',
          { class: 'res-day' },
          h(
            'div',
            { class: 'res-when' },
            h('b', { class: 'num' }, String(d.getDate())),
            h('span', null, `${d.toLocaleDateString('es-ES', { weekday: 'short' })} · ${d.toLocaleDateString('es-ES', { month: 'short' })}`.replace(/\./g, '')),
            h('small', null, whenLabel(rs[0])),
          ),
          h('div', { class: 'res-list' }, rs.map(item)),
        );
      }),
    );
  };
  // Si se abre una reserva concreta, se salta a la página donde está.
  const focusPage = (list: Reservation[], state: { page: number }) => {
    const i = list.findIndex((r) => r.id === focusId);
    if (i >= 0) state.page = Math.floor(i / RES_PER_PAGE) + 1;
  };
  focusPage(next, nextPaging);
  focusPage(past, pastPaging);
  const nextP = paginate(next, RES_PER_PAGE, nextPaging, String(next.length));
  const pastP = paginate(past, RES_PER_PAGE, pastPaging, String(past.length));
  const grid = next.length
    ? h(
        'div',
        { class: 'stack-sm', id: 'res-next' },
        agenda(nextP.slice),
        pager({ page: nextPaging.page, pages: nextP.pages, total: next.length, perPage: RES_PER_PAGE, noun: ['Reserva', 'Reservas'], prev: 'Antes', next: 'Después', go: (n) => ((nextPaging.page = n), rerender()), anchor: '#res-next' }),
      )
    : h(
        'section',
        { class: 'block' },
        h('div', { class: 'empty' }, icon('calendarCheck', 22), 'Nadie ha reservado el coche. Si lo necesitas un día, resérvalo para que lo sepan los demás.'),
      );
  const pastFocus = past.find((r) => r.id === focusId);
  return h(
    'div',
    { class: 'stack' },
    pageHead(
      'Reservas',
      next.length ? `${next.length} ${next.length === 1 ? 'próxima reserva' : 'próximas reservas'}${mineCount ? ` · ${mineCount} tuyas` : ''}` : 'Avisa de los días que necesitas el coche.',
      h('a', { class: 'btn primary', href: '#/reservas/nueva' }, icon('plus'), 'Reservar el coche'),
    ),
    grid,
    past.length
      ? h(
          'details',
          { class: 'more', open: pastFocus ? true : null },
          h('summary', null, `Reservas pasadas (${past.length})`),
          h(
            'div',
            { class: 'more-body stack-sm', id: 'res-past' },
            agenda(pastP.slice),
            pager({ page: pastPaging.page, pages: pastP.pages, total: past.length, perPage: RES_PER_PAGE, noun: ['Reserva', 'Reservas'], prev: 'Más recientes', next: 'Más antiguas', go: (n) => ((pastPaging.page = n), rerender()), anchor: '#res-past' }),
          ),
        )
      : null,
  );
}

export function reservationFormView(st: AppState, id: string | null, presetDay?: string): Node | null {
  const editing = id ? st.snap.reservations.find((r) => r.id === id) ?? null : null;
  if (id && (!editing || editing.member !== st.me.email)) return null;
  const t = todayIso();
  let day = editing?.day ?? (presetDay && presetDay >= t ? presetDay : '');
  let endDay = editing?.endDay ?? day;
  const dayErr = h('div', { class: 'error', role: 'alert' });
  const noteErr = h('div', { class: 'error', role: 'alert' });
  const formErr = h('div', { class: 'error', role: 'alert' });
  const clashBox = h('div', { 'aria-live': 'polite' });
  const showClash = () => {
    clashBox.replaceChildren();
    if (!day) return;
    const c = clashes(st, day, endDay, st.me.email, editing?.id);
    if (c.length)
      clashBox.append(
        h(
          'p',
          { class: 'notice' },
          icon('alert'),
          h('span', null, 'Ya lo ha reservado ', c.flatMap((x, i) => [i ? ', ' : '', h('b', null, memberOf(st, x.member).name), ` (${futureRange(x.day, x.endDay)}: ${x.note})`]), '. Puedes guardarla igualmente y hablarlo.'),
        ),
      );
  };
  const picker = dateRangePicker({
    from: day,
    to: endDay,
    future: true,
    id: 'res-day',
    onChange: (f, to) => {
      day = f;
      endDay = to || f;
      dayErr.textContent = '';
      showClash();
    },
  });
  const note = h('textarea', { class: 'input', id: 'res-note', rows: 3, maxlength: 280, placeholder: 'Ej.: médico por la mañana, viaje al pueblo el fin de semana…' }) as HTMLTextAreaElement;
  note.value = editing?.note ?? '';
  const save = h('button', { class: 'btn primary', type: 'submit' }, icon('check'), editing ? 'Guardar cambios' : 'Reservar');
  const del = editing ? h('button', { class: 'btn ghost danger', type: 'button' }, icon('trash'), 'Borrar reserva') : null;
  del?.addEventListener('click', async () => {
    if (!confirm('¿Borrar esta reserva?')) return;
    busy(del, true, 'Borrando…');
    try {
      await st.backend.deleteReservation(editing!.id);
      toast('Reserva borrada');
      location.hash = '#/reservas';
    } catch (e) {
      busy(del, false);
      formErr.textContent = errorText(e);
    }
  });
  const form = h(
    'form',
    { class: 'form narrow', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'res-day' }, 'Día'), picker, h('div', { class: 'hint' }, 'Si es más de un día, pulsa el primero y el último.'), dayErr),
    clashBox,
    h('div', { class: 'field' }, h('label', { for: 'res-note' }, '¿Para qué lo necesitas?'), note, noteErr),
    formErr,
    h('div', { class: 'formbar' }, del, h('span', { class: 'spacer' }), h('a', { class: 'btn ghost', href: '#/reservas' }, 'Cancelar'), save),
  );
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    [dayErr, noteErr, formErr].forEach((e) => (e.textContent = ''));
    const text = note.value.trim().slice(0, 280);
    let ok = true;
    if (!day) (dayErr.textContent = 'Elige el día.'), (ok = false);
    else if (endDay < t && !editing) (dayErr.textContent = 'El día ya ha pasado.'), (ok = false);
    if (!text) (noteErr.textContent = 'Cuenta brevemente para qué lo necesitas.'), (ok = false);
    if (!ok) return;
    busy(save, true);
    try {
      const input = { day, endDay, note: text };
      if (editing) await st.backend.updateReservation(editing.id, input);
      else await st.backend.addReservation(input);
      toast(editing ? 'Reserva actualizada' : 'Coche reservado. Los demás lo verán en el calendario.');
      location.hash = '#/reservas';
    } catch (e) {
      busy(save, false);
      formErr.textContent = errorText(e);
    }
  });
  showClash();
  return h('div', { class: 'stack' }, pageHead(editing ? 'Editar reserva' : 'Reservar el coche', 'Elige el día y cuenta para qué lo necesitas. Saldrá en el calendario de todos.'), form);
}
