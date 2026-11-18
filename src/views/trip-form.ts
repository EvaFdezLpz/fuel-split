import { h } from '../dom';
import { MAX_TRIP_KM, fmtKm, lastKnownReading } from '../domain';
import { icon } from '../icons';
import { memberOf, type AppState } from '../state';
import { busy, errorText, pageHead, toast } from '../ui';
import { readingField } from './reading';

function localInputValue(ms: number): string {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
}

/** Viaje olvidado: km y fecha propuestos desde «Km sin apuntar». Se usa una sola vez. */
let preset: { startKm: number; endKm: number; date: number } | null = null;
export function presetTrip(p: { startKm: number; endKm: number; date: number }) {
  preset = p;
}

/** Pasada una semana, un viaje terminado ya no se corrige: solo se le puede añadir la foto que falte. */
const EDIT_WINDOW = 7 * 86_400_000;

export function tripFormView(st: AppState, tripId: string | null): Node {
  const existing = tripId ? st.ledger.trips.find((v) => v.trip.id === tripId) : null;
  if (tripId && (!existing || existing.trip.driver !== st.me.email)) {
    return h('div', { class: 'stack' }, pageHead('Viaje no disponible', 'Solo puedes modificar tus propios viajes.'), h('a', { class: 'btn', href: '#/viajes' }, 'Volver a viajes'));
  }
  const t = existing?.trip;
  const p = !t ? preset : null;
  preset = null;
  const photoOnly = !!t && t.end.km != null && Date.now() > t.createdAt + EDIT_WINDOW;
  const last = lastKnownReading(st.ledger);
  const isFinishing = existing?.endState === 'open';

  const lastHint = last
    ? h('span', null, 'Último km registrado: ', h('b', { class: 'num' }, fmtKm(last.km)), ` (${last.code}${last.withPhoto ? ', con foto' : ', sin foto'}).`)
    : 'Es el primer registro: haz la foto con el coche parado y la cifra bien visible.';

  const date = h('input', { class: 'input', type: 'datetime-local', id: 'trip-date', value: localInputValue(t?.date ?? p?.date ?? Date.now()), max: localInputValue(Date.now() + 3600_000) });
  const start = readingField(st, {
    id: 'start',
    title: 'Al empezar',
    hint: t ? null : p ? 'Viaje que se quedó sin apuntar: los km son los del hueco. Añade foto si la tienes; si no, quedará como «sin foto».' : lastHint,
    km: t?.start.km ?? p?.startKm ?? (last && !t ? last.km : null),
    photoId: t?.start.photoId ?? null,
    expected: () => last?.km ?? null,
  });
  const end = readingField(st, {
    id: 'end',
    title: 'Al terminar',
    hint: p || photoOnly ? null : 'Si aún no has llegado, guárdalo así y complétalo al aparcar. Si se te olvida, se tomará del siguiente viaje.',
    km: t?.end.km ?? p?.endKm ?? null,
    photoId: t?.end.photoId ?? null,
    expected: () => start.km() ?? last?.km ?? null,
    optional: true,
  });
  const note = h('textarea', { class: 'input', id: 'trip-note', maxlength: 280, placeholder: 'Opcional: destino, incidencias…' }, t?.note ?? (p ? 'Apuntado más tarde' : ''));
  // Viaje antiguo: todo bloqueado salvo las fotos que falten.
  if (photoOnly) {
    for (const el of [date, start.input, end.input, note]) el.disabled = true;
    for (const r of [start, end]) if (r.photo.existingId()) (r.el.querySelector('.photo-menu-wrap') as HTMLElement | null)?.setAttribute('hidden', '');
  }
  const summary = h('div', { class: 'calc', 'aria-live': 'polite' });
  const formErr = h('div', { class: 'error', role: 'alert' });

  const refresh = () => {
    const a = start.km();
    const b = end.km();
    const lines: Node[] = [];
    if (a != null && !Number.isNaN(a) && b != null && !Number.isNaN(b) && b >= a) lines.push(h('div', null, 'Recorrido: ', h('b', { class: 'num' }, fmtKm(b - a))));
    else lines.push(h('div', { class: 'muted' }, 'El recorrido se calcula con las dos lecturas.'));
    if (!t && !p && last && a != null && !Number.isNaN(a) && a !== last.km) {
      const diff = a - last.km;
      lines.push(h('div', { class: 'small' }, diff > 0 ? `Hay ${fmtKm(diff)} desde el último registro que nadie ha apuntado; quedará marcado como hueco.` : `Empiezas ${fmtKm(-diff)} por debajo del último registro. Revisa la cifra.`));
    }
    summary.replaceChildren(...lines);
  };
  start.input.addEventListener('input', refresh);
  end.input.addEventListener('input', refresh);
  refresh();

  const save = h('button', { class: 'btn primary', type: 'submit' }, icon('check'), isFinishing ? 'Terminar viaje' : photoOnly ? 'Guardar foto' : t ? 'Guardar cambios' : 'Guardar viaje');
  const form = h(
    'form',
    { class: 'form', novalidate: true },
    h('div', { class: 'field' }, h('label', { for: 'trip-date' }, 'Fecha y hora de salida'), date),
    start.el,
    end.el,
    summary,
    h('div', { class: 'field' }, h('label', { for: 'trip-note' }, 'Nota'), note),
    formErr,
    h('div', { class: 'formbar' }, h('a', { class: 'btn ghost', href: '#/viajes' }, 'Cancelar'), save),
  );

  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    formErr.textContent = '';
    start.setError(null);
    end.setError(null);
    const a = start.km();
    const b = end.km();
    const when = new Date(date.value).getTime();
    let ok = true;
    if (a == null || Number.isNaN(a)) {
      start.setError('Escribe el km inicial (solo números).');
      ok = false;
    }
    if (b != null && Number.isNaN(b)) {
      end.setError('El km final solo puede tener números.');
      ok = false;
    }
    if (ok && b != null && a != null && b < a) {
      end.setError('El km final no puede ser menor que el inicial.');
      ok = false;
    }
    if (ok && b != null && a != null && b - a > MAX_TRIP_KM) {
      end.setError(`Más de ${fmtKm(MAX_TRIP_KM)} en un viaje: revisa las cifras.`);
      ok = false;
    }
    if (!Number.isFinite(when) || when > Date.now() + 3600_000) {
      formErr.textContent = 'La fecha no es válida.';
      ok = false;
    }
    // Corregir una lectura ya guardada exige foto: es la prueba de la cifra buena.
    if (t) {
      for (const [r, saved] of [[start, t.start.km], [end, t.end.km]] as const) {
        if (saved != null && r.changed() && r.km() != null && !r.hasPhoto()) {
          r.setError('Para corregir los km hace falta la foto del cuentakilómetros.');
          ok = false;
        }
      }
    }
    if (!ok) return;
    if (photoOnly && !start.photo.pending() && !end.photo.pending()) {
      formErr.textContent = 'Añade al menos una foto: es lo único que se puede cambiar en un viaje de hace más de una semana.';
      return;
    }
    if (!p && !photoOnly && !start.photo.pending() && !start.photo.existingId() && !confirm('No has añadido foto del km inicial. Quedará marcado como "sin foto". ¿Guardar igualmente?')) return;
    busy(save, true);
    try {
      const sp = start.photo.pending();
      const ep = end.photo.pending();
      const startPhotoId = sp ? await st.backend.addEvidence('odometer', sp) : start.photo.existingId();
      const endPhotoId = b == null ? null : ep ? await st.backend.addEvidence('odometer', ep) : end.photo.existingId();
      const input = { date: when, startKm: a!, startPhotoId, endKm: b, endPhotoId, note: note.value.trim().slice(0, 280) };
      if (t) await st.backend.updateTrip(t.id, input);
      else await st.backend.addTrip(input);
      toast(b == null ? 'Viaje empezado. Complétalo al aparcar.' : 'Viaje guardado');
      location.hash = '#/viajes';
    } catch (e) {
      busy(save, false);
      formErr.textContent = errorText(e);
    }
  });

  return h(
    'div',
    { class: 'stack' },
    pageHead(
      isFinishing ? 'Terminar el viaje' : photoOnly ? 'Añadir la foto que falta' : t ? 'Editar el viaje' : p ? 'Apuntar un viaje olvidado' : 'Registrar viaje',
      isFinishing
        ? 'Haz la foto del cuentakilómetros al aparcar.'
        : photoOnly
          ? 'Pasada una semana, los km ya no se cambian. Solo puedes añadir la foto que faltaba.'
          : p
            ? `Km ${fmtKm(p.startKm)} → ${fmtKm(p.endKm)}: ${fmtKm(p.endKm - p.startKm)} que nadie apuntó.`
            : 'Foto del cuentakilómetros al salir y al llegar.',
    ),
    form,
  );
}
