// Campo de lectura del cuentakilómetros: foto (con OCR local) o número escrito a mano.
import { h } from '../dom';
import { MAX_KM, groupThousands } from '../domain';
import { icon } from '../icons';
import { ImageError, jpegSrc, processImage } from '../images';
import type { AppState } from '../state';
import { showEvidence } from '../ui';

export interface PhotoPicker {
  el: HTMLElement;
  /** Foto nueva lista para subir (base64), o null. */
  pending(): string | null;
  existingId(): string | null;
  onCanvas?: (c: HTMLCanvasElement) => void;
}

export function photoPicker(st: AppState, opts: { id: string; label: string; existingId: string | null; required?: boolean; onCanvas?: (c: HTMLCanvasElement) => void }): PhotoPicker {
  let base64: string | null = null;
  // Un solo botón que abre dos opciones: la cámara trasera directamente (móvil) o una foto de la galería.
  const input = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', capture: 'environment', id: opts.id, class: 'sr-only', tabindex: '-1' });
  const gallery = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', id: `${opts.id}-gal`, class: 'sr-only', tabindex: '-1' });
  const thumb = h('img', { class: 'thumb', alt: '' });
  const status = h('div', { class: 'hint' }, opts.existingId ? 'Foto guardada.' : '');
  const btnLabel = h('span', null, opts.existingId ? 'Cambiar foto' : opts.label);
  const btn = h('button', { class: 'btn sm', type: 'button', 'aria-haspopup': 'menu', 'aria-expanded': 'false', 'aria-controls': `${opts.id}-menu` }, icon('camera'), btnLabel, icon('chevronDown', 14));
  const menu = h(
    'div',
    { class: 'photo-menu', role: 'menu', id: `${opts.id}-menu`, hidden: true },
    h('label', { class: 'photo-opt', role: 'menuitem', for: opts.id, tabindex: '0' }, icon('camera'), h('span', null, h('b', null, 'Hacer foto'), h('small', null, 'Abre la cámara'))),
    h('label', { class: 'photo-opt', role: 'menuitem', for: `${opts.id}-gal`, tabindex: '0' }, icon('image'), h('span', null, h('b', null, 'Elegir de la galería'), h('small', null, 'Una foto que ya tengas'))),
  );
  const close = () => {
    menu.hidden = true;
    btn.setAttribute('aria-expanded', 'false');
    document.removeEventListener('pointerdown', outside, true);
  };
  const outside = (e: Event) => {
    if (!wrap.contains(e.target as Node)) close();
  };
  btn.addEventListener('click', () => {
    if (!menu.hidden) return close();
    menu.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    document.addEventListener('pointerdown', outside, true);
    (menu.querySelector('.photo-opt') as HTMLElement | null)?.focus();
  });
  menu.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      btn.focus();
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      (e.target as HTMLLabelElement).click();
    } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const items = [...menu.querySelectorAll<HTMLElement>('.photo-opt')];
      const i = items.indexOf(document.activeElement as HTMLElement);
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length]?.focus();
    }
  });
  menu.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).closest('.photo-opt')) setTimeout(close);
  });
  const wrap = h('div', { class: 'photo-menu-wrap' }, btn, menu);
  const view = opts.existingId
    ? h('button', { class: 'btn ghost sm', type: 'button', onclick: (() => showEvidence(st, opts.existingId!, opts.label)) as EventListener }, icon('image'), 'Ver')
    : null;
  thumb.hidden = true;

  const onPick = async (input: HTMLInputElement) => {
    const f = input.files?.[0];
    if (!f) return;
    status.textContent = 'Procesando foto…';
    status.className = 'hint';
    try {
      const out = await processImage(f);
      base64 = out.base64;
      thumb.setAttribute('src', jpegSrc(out.base64));
      thumb.hidden = false;
      thumb.alt = `Vista previa: ${opts.label}`;
      status.textContent = '';
      btnLabel.textContent = 'Cambiar foto';
      opts.onCanvas?.(out.canvas);
    } catch (e) {
      base64 = null;
      thumb.hidden = true;
      status.textContent = e instanceof ImageError ? e.message : 'No se pudo usar esa imagen.';
      status.className = 'error';
    } finally {
      input.value = '';
    }
  };
  input.addEventListener('change', () => void onPick(input));
  gallery.addEventListener('change', () => void onPick(gallery));

  const el = h('div', { class: 'photo-pick' }, thumb, h('div', { class: 'field' }, h('div', { class: 'chips' }, wrap, view), status), input, gallery);
  return { el, pending: () => base64, existingId: () => opts.existingId };
}

export interface ReadingField {
  el: HTMLElement;
  /** Fila de km (se le puede añadir la fecha para que vaya al lado). */
  row: HTMLElement;
  input: HTMLInputElement;
  photo: PhotoPicker;
  km(): number | null;
  /** Hay foto (nueva o ya guardada). */
  hasPhoto(): boolean;
  /** La cifra es distinta de la que había guardada al abrir el formulario. */
  changed(): boolean;
  setError(msg: string | null): void;
}

export function parseKm(raw: string): number | null {
  const clean = raw.replace(/[.\s]/g, '');
  if (!clean) return null;
  if (!/^\d{1,7}$/.test(clean)) return NaN;
  const n = Number(clean);
  return n > MAX_KM ? NaN : n;
}

export function readingField(
  st: AppState,
  opts: { id: string; title: string; hint: Node | string | null; km: number | null; photoId: string | null; expected: () => number | null; optional?: boolean },
): ReadingField {
  const input = h('input', {
    class: 'input big num',
    id: `${opts.id}-km`,
    inputmode: 'numeric',
    autocomplete: 'off',
    placeholder: opts.optional ? 'Pendiente' : '182.450',
    value: opts.km != null ? groupThousands(opts.km) : '',
    'aria-describedby': `${opts.id}-err`,
  });
  const err = h('div', { class: 'error', id: `${opts.id}-err`, role: 'alert' });
  const ocr = h('div', { class: 'ocr', 'aria-live': 'polite' });
  const correction = h('div', { class: 'hint', 'aria-live': 'polite' });
  let ocrKm: number | null = null;
  const checkCorrection = () => {
    const v = parseKm(input.value);
    correction.replaceChildren();
    if (ocrKm == null || v == null || Number.isNaN(v) || v === ocrKm) return;
    correction.append(
      h('span', { class: 'pill warn', title: `La foto se leyó como ${groupThousands(ocrKm)}. Se guarda tu cifra junto con la foto.` }, icon('alert'), `Corregido a mano (la foto decía ${groupThousands(ocrKm)})`),
    );
  };

  const photo = photoPicker(st, {
    id: `${opts.id}-photo`,
    label: 'Foto del cuentakilómetros',
    existingId: opts.photoId,
    onCanvas: async (canvas) => {
      ocr.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), 'Leyendo la cifra…');
      try {
        const { readOdometer } = await import('../ocr');
        const found = await readOdometer(canvas, opts.expected());
        if (!found.length) {
          ocr.replaceChildren('No se ha podido leer. Escribe la cifra.');
          return;
        }
        ocrKm = found[0];
        ocr.replaceChildren(h('span', null, 'Leído de la foto:'));
        for (const n of found) {
          const b = h('button', { type: 'button', class: 'num' }, groupThousands(n));
          b.addEventListener('click', () => {
            input.value = groupThousands(n);
            input.dispatchEvent(new Event('input'));
          });
          ocr.append(b);
        }
        // Se sustituye la cifra sugerida, pero nunca lo que la persona haya escrito a mano.
        if (!input.value || !userEdited) {
          input.value = groupThousands(found[0]);
          input.dispatchEvent(new Event('input'));
        }
        checkCorrection();
      } catch {
        ocr.replaceChildren('El lector automático no está disponible. Escribe la cifra.');
      }
    },
  });

  let userEdited = false;
  input.addEventListener('input', (e) => {
    if (e.isTrusted) userEdited = true;
    checkCorrection();
  });
  input.addEventListener('blur', () => {
    const v = parseKm(input.value);
    if (v != null && !Number.isNaN(v)) input.value = groupThousands(v);
  });

  const row = h(
    'div',
    { class: 'reading-row' },
    h('div', { class: 'field reading-km' }, h('label', { for: `${opts.id}-km` }, 'Kilómetros'), h('div', { class: 'input-unit' }, input, h('span', null, 'km'))),
  );
  const el = h(
    'fieldset',
    { class: 'reading' },
    h('div', { class: 'reading-head' }, h('legend', { class: 'label' }, opts.title), opts.optional ? h('span', { class: 'pill neutral' }, 'Opcional') : null),
    opts.hint ? h('div', { class: 'hint' }, opts.hint) : null,
    row,
    photo.el,
    ocr,
    correction,
    err,
  );
  return {
    el,
    /** Fila de km: se le pueden añadir otros campos (la fecha) para que vayan en la misma línea. */
    row,
    input,
    photo,
    km: () => parseKm(input.value),
    hasPhoto: () => !!(photo.pending() || photo.existingId()),
    changed: () => parseKm(input.value) !== opts.km,
    setError(msg) {
      err.textContent = msg ?? '';
      input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    },
  };
}
