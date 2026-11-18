// Km misterio: km entre dos fotos del cuentakilómetros que nadie apuntó. Se pregunta a todos si usaron
// el coche en esas fechas (sí/no) y, si fue que sí, qué día y cuántos km. Cuando han respondido todos
// (o lo dicho suma justo el hueco), cada uno paga sus km y la diferencia se reparte a partes iguales
// entre quienes dijeron que sí. Si nadie lo usó, se reparten entre todos según sus km, como siempre.
import { h } from '../dom';
import { fmtKm, groupThousands, type MysteryGap, type RefuelView } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, dayMonth, dialog, errorText, toast } from '../ui';
import { paginate, pager } from './common';
import { presetTrip } from './trip-form';

export type Gap = MysteryGap;

/** Km misterio sin resolver, del más reciente al más antiguo. */
export function findGaps(st: AppState): Gap[] {
  return st.gaps.filter((g) => !g.resolved).reverse();
}

/** Abre el formulario de viaje con los km del hueco ya puestos (para apuntarlo a nombre de otra persona). */
export function claimGap(g: Gap, other = false) {
  const a = g.after.trip.date;
  const b = g.before.trip.date;
  presetTrip({ startKm: g.fromKm, endKm: g.toKm, date: b > a ? Math.round(a + (b - a) / 2) : a + 3_600_000, other });
  location.hash = '#/viajes/nuevo';
}

const isoDay = (ms: number) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** «del 3 nov al 7 nov» (o «el 3 nov» si es el mismo día). */
export function gapRange(g: Gap): string {
  const a = dayMonth(g.after.trip.endDate ?? g.after.trip.date);
  const b = dayMonth(g.before.trip.date);
  return a === b ? `el ${a}` : `del ${a} al ${b}`;
}

const myAnswer = (st: AppState, g: Gap) => g.answers.find((a) => a.member === st.me.email) ?? null;

async function answerNo(st: AppState, g: Gap, btn: HTMLButtonElement) {
  busy(btn, true, '…');
  try {
    await st.backend.answerGap({ fromKm: g.fromKm, toKm: g.toKm, used: false, km: 0, day: null });
    toast('Respondido: no lo usaste');
  } catch (e) {
    busy(btn, false);
    toast(errorText(e), 'alert');
  }
}

/** «Sí, lo usé»: qué día y cuántos km. */
export function answerYesDialog(st: AppState, g: Gap) {
  const mine = myAnswer(st, g);
  const othersKm = g.answers.filter((a) => a.used && a.member !== st.me.email).reduce((x, a) => x + a.km, 0);
  const left = Math.max(0, g.km - othersKm);
  const from = g.after.trip.endDate ?? g.after.trip.date;
  const minDay = isoDay(from);
  const maxDay = isoDay(Math.max(g.before.trip.date, from));
  const day = h('input', { class: 'input', type: 'date', id: 'gap-day', min: minDay, max: maxDay, value: mine?.used && mine.day ? mine.day : maxDay === minDay ? minDay : '' });
  const km = h('input', { class: 'input big num', id: 'gap-km', inputmode: 'numeric', autocomplete: 'off', placeholder: left ? String(left) : '0', value: mine?.used ? String(mine.km) : '' });
  const err = h('div', { class: 'error', role: 'alert' });
  const ok = h('button', { class: 'btn primary', type: 'button' }, icon('check'), 'Guardar');
  const dlg = dialog(
    'Usé el coche',
    [
      h('p', null, `Entre ${fmtKm(g.fromKm)} y ${fmtKm(g.toKm)} (${gapRange(g)}) hay `, h('b', null, fmtKm(g.km)), ' que nadie apuntó.'),
      h('div', { class: 'field' }, h('label', { for: 'gap-day' }, '¿Qué día?'), day),
      h(
        'div',
        { class: 'field' },
        h('label', { for: 'gap-km' }, '¿Cuántos km hiciste?'),
        h('div', { class: 'input-unit' }, km, h('span', null, 'km')),
        h('div', { class: 'hint' }, othersKm ? `Los demás ya han dicho ${fmtKm(othersKm)}; quedan ${fmtKm(left)}.` : 'Si no lo sabes exacto, pon lo que calcules.'),
        err,
      ),
      h('p', { class: 'small muted' }, 'Cuando hayan respondido todos, cada uno paga sus km. Si lo que decís no suma los km del hueco, la diferencia se reparte a partes iguales entre quienes lo usasteis.'),
    ],
    [h('button', { class: 'btn ghost', type: 'button', onclick: (() => dlg.close()) as EventListener }, 'Cancelar'), ok],
  );
  setTimeout(() => km.focus(), 50);
  for (const x of [day, km]) x.addEventListener('input', () => (err.textContent = ''));
  ok.addEventListener('click', async () => {
    const n = Number(km.value.trim().replace(/\./g, ''));
    if (!/^\d{1,4}$/.test(km.value.trim().replace(/\./g, '')) || n < 1 || n > g.km) {
      err.textContent = `Escribe los km, entre 1 y ${groupThousands(g.km)}.`;
      km.focus();
      return;
    }
    if (!day.value || day.value < minDay || day.value > maxDay) {
      err.textContent = `Elige un día ${gapRange(g)}.`;
      day.focus();
      return;
    }
    busy(ok, true);
    try {
      await st.backend.answerGap({ fromKm: g.fromKm, toKm: g.toKm, used: true, km: n, day: day.value });
      dlg.close();
      toast('Respuesta guardada');
    } catch (e) {
      busy(ok, false);
      toast(errorText(e), 'alert');
    }
  });
}

/** Botones Sí / No, o lo que respondiste con «Cambiar». */
export function gapAnswerActions(st: AppState, g: Gap): HTMLElement[] {
  const mine = myAnswer(st, g);
  const no = h('button', { class: 'btn ghost sm', type: 'button' }, 'No');
  no.addEventListener('click', () => answerNo(st, g, no));
  const yes = h('button', { class: 'btn sm', type: 'button' }, 'Sí, lo usé');
  yes.addEventListener('click', () => answerYesDialog(st, g));
  if (!mine) return [no, yes];
  const edit = h('button', { class: 'btn ghost sm', type: 'button' }, 'Cambiar');
  edit.addEventListener('click', () => answerYesDialog(st, g));
  return mine.used ? [edit] : [yes];
}

/** Una ficha por persona: lo que ha dicho (km o «No») o pendiente. */
function answerChips(st: AppState, g: Gap): HTMLElement {
  const people = [st.me.email, ...[...st.members.keys()].filter((e) => e !== st.me.email)];
  return h(
    'ul',
    { class: 'gm-people', 'aria-label': 'Respuestas' },
    people.map((e) => {
      const a = g.answers.find((x) => x.member === e);
      const name = e === st.me.email ? 'Tú' : memberOf(st, e).name;
      const state = !a ? 'is-pending' : a.used ? 'is-yes' : 'is-no';
      const value = !a ? '—' : a.used ? fmtKm(a.km) : 'No';
      return h('li', { class: `gm-chip ${state}`, title: !a ? `${name}: sin responder` : null }, h('span', { class: 'gm-name' }, name), h('span', { class: 'gm-val num' }, value));
    }),
  );
}

/** Barra: cuántos km del hueco ya ha dicho alguien que hizo. */
function claimBar(g: Gap): HTMLElement {
  const pct = Math.min(100, Math.round((g.claimedKm / g.km) * 100));
  const over = g.claimedKm - g.km;
  const label =
    over > 0
      ? `Se han dicho ${fmtKm(g.claimedKm)}: sobran ${fmtKm(over)}`
      : g.claimedKm === g.km
        ? 'Cuadra: todos los km tienen dueño'
        : `${groupThousands(g.claimedKm)} de ${groupThousands(g.km)} km`;
  const fill = h('span', { class: 'gm-fill' });
  fill.style.width = `${pct}%`;
  return h('div', { class: 'gm-progress' }, h('div', { class: 'gm-bar', role: 'img', 'aria-label': label }, fill), h('span', { class: 'small muted num' }, label));
}

const paging = { page: 1, key: '' };

export function gapsBlock(st: AppState, rerender: () => void): HTMLElement | null {
  const gaps = findGaps(st);
  if (!gaps.length) return null;
  const total = gaps.reduce((a, g) => a + g.km, 0);
  const { slice, pages } = paginate(gaps, 5, paging, String(gaps.length));
  return h(
    'section',
    { class: 'block gaps', id: 'km-sin-apuntar' },
    h('div', { class: 'block-head' }, h('h2', null, 'Km misterio'), h('span', { class: 'muted small num' }, `${gaps.length} ${gaps.length === 1 ? 'hueco' : 'huecos'} · ${fmtKm(total)}`)),
    h('p', { class: 'gaps-intro small muted' }, 'Km sin foto. Cada uno dice si usó el coche; lo que no cuadre se reparte a partes iguales entre quienes lo usaron.'),
    h(
      'ul',
      { class: 'gm-list' },
      slice.map((g) => {
        const other = h('button', { class: 'gm-link', type: 'button' }, 'Lo hizo otra persona');
        other.addEventListener('click', () => claimGap(g, true));
        const allNo = !g.pending.length && !g.claimedKm;
        return h(
          'li',
          { class: 'gm-card' },
          h(
            'div',
            { class: 'gm-head' },
            h('b', { class: 'gm-km num' }, fmtKm(g.km)),
            h('span', { class: 'gm-meta small muted num' }, `${gapRange(g).replace(/^del /, '').replace(' al ', ' – ')} · ${groupThousands(g.fromKm)} → ${groupThousands(g.toKm)}`),
          ),
          claimBar(g),
          answerChips(st, g),
          allNo ? h('p', { class: 'small muted gm-note' }, 'Nadie lo usó: se reparten entre todos según sus km.') : null,
          h('div', { class: 'gm-foot' }, h('div', { class: 'gap-actions' }, ...gapAnswerActions(st, g)), other),
        );
      }),
    ),
    pager({ page: paging.page, pages, total: gaps.length, perPage: 5, noun: ['Hueco', 'Huecos'], prev: 'Más recientes', next: 'Más antiguos', go: (n) => ((paging.page = n), rerender()), anchor: '#km-sin-apuntar' }),
  );
}

/**
 * Repostajes que probablemente faltan: un tramo con muy pocos litros para sus km. Un C3 de 2005
 * gasta unos 6-7 l/100 km; por debajo de 4 l/100 km no cuadra, así que alguien llenó sin apuntarlo
 * (y esos km se están cobrando con un solo depósito).
 */
export function suspiciousRefuels(st: AppState): RefuelView[] {
  return st.ledger.refuels.filter((r) => {
    const km = r.toKm - r.fromKm;
    return km >= 300 && r.litersMilli > 0 && (r.litersMilli / 1000 / km) * 100 < 4;
  });
}
