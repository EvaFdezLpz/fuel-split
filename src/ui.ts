// Piezas de interfaz compartidas entre pantallas.
import { h } from './dom';
import { fmtEur, groupThousands, type EvidenceState, type Member, type RefuelView } from './domain';
import { icon, type IconName } from './icons';
import { jpegSrc } from './images';
import { segmentDisplay } from './segments';
import { memberOf, type AppState } from './state';

/** "5 nov" (con año solo si no es el actual). */
export function dayMonth(ms: number): string {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString('es-ES', sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' }).replace('.', '');
}

/**
 * Nombre legible de un tramo (los km que paga un depósito): cuándo se llenó, quién lo pagó
 * y qué fechas de viajes cubre. Sustituye a códigos como "R-003".
 */
export function tramoName(st: AppState, r: RefuelView): { title: string; period: string; payer: string } {
  const i = st.ledger.refuels.indexOf(r);
  const prev = i > 0 ? st.ledger.refuels[i - 1] : null;
  const trips = st.ledger.trips.filter((v) => v.refuelId === r.refuel.id);
  const start = prev ? prev.refuel.date : trips.length ? Math.min(...trips.map((v) => v.trip.date)) : null;
  const payer = memberOf(st, r.refuel.payer).name;
  return {
    title: `Depósito del ${dayMonth(r.refuel.date)}`,
    period: start != null ? `viajes del ${dayMonth(start)} al ${dayMonth(r.refuel.date)}` : `viajes hasta el ${dayMonth(r.refuel.date)}`,
    payer,
  };
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}

export function withColor<T extends HTMLElement>(el: T, m: Member): T {
  el.style.setProperty('--mc', `var(--${m.color})`);
  return el;
}

export function avatar(m: Member, small = false, href?: string) {
  const el = href
    ? h('a', { class: `avatar${small ? ' sm' : ''}`, href, title: m.name, 'aria-label': `Perfil de ${m.name}` }, initials(m.name))
    : h('span', { class: `avatar${small ? ' sm' : ''}`, 'aria-hidden': 'true' }, initials(m.name));
  return withColor(el, m);
}

export function who(st: AppState, email: string, opts: { you?: boolean } = {}) {
  const m = memberOf(st, email);
  const isMe = email === st.me.email;
  return h('span', { class: 'who' }, withColor(h('span', { class: 'dot', 'aria-hidden': 'true' }), m), isMe && opts.you !== false ? `${m.name} (tú)` : m.name);
}

const EVIDENCE: Record<EvidenceState, { cls: string; text: string; icon: IconName }> = {
  photo: { cls: 'ok', text: 'Foto', icon: 'camera' },
  corroborated: { cls: 'ok', text: 'Cuadra', icon: 'check' },
  manual: { cls: 'warn', text: 'Sin foto', icon: 'alert' },
  inferred: { cls: 'warn', text: 'Inferido', icon: 'swap' },
  open: { cls: 'neutral', text: 'En curso', icon: 'clock' },
};

const EVIDENCE_TITLE: Record<EvidenceState, string> = {
  photo: 'Lectura con foto',
  corroborated: 'Sin foto propia, pero coincide con otra lectura que sí la tiene',
  manual: 'Escrita a mano y sin foto: falta evidencia',
  inferred: 'No se registró: se toma del km inicial del siguiente viaje',
  open: 'Viaje todavía sin terminar',
};

export function evidencePill(state: EvidenceState, where: string, onOpen?: () => void) {
  const e = EVIDENCE[state];
  const label = where ? `${where}: ${e.text}` : e.text;
  const attrs = { class: `pill ${e.cls}`, title: EVIDENCE_TITLE[state] };
  if (onOpen) return h('button', { ...attrs, type: 'button', onclick: onOpen as EventListener, 'aria-label': `${label}. Ver foto` }, icon(e.icon), label);
  return h('span', attrs, icon(e.icon), label);
}

export function totemRow(label: string, sub: string | null, value: Node, unit: string, href?: string) {
  const inner = [h('div', { class: 'trow-label' }, label, sub ? h('small', null, sub) : null), h('div', { class: 'trow-value' }, value, h('span', { class: 'trow-unit' }, unit))];
  return href ? h('a', { class: 'trow', href }, inner) : h('div', { class: 'trow' }, inner);
}

export function euroSeg(cents: number, tone: 'led' | 'ok' | 'bad' | 'dim' = 'led') {
  const txt = (cents / 100).toFixed(2).replace('.', ',');
  return segmentDisplay(txt, { minDigits: 4, label: fmtEur(cents), tone });
}

export function kmSeg(km: number | null, minDigits = 6) {
  if (km == null) return segmentDisplay('------', { label: 'Sin datos', tone: 'dim' });
  return segmentDisplay(groupThousands(km), { minDigits, label: `${groupThousands(km)} kilómetros` });
}

export function priceSeg(milli: number | null) {
  if (milli == null) return segmentDisplay('-,---', { label: 'Sin datos', tone: 'dim' });
  return segmentDisplay((milli / 1000).toFixed(3).replace('.', ','), { label: `${(milli / 1000).toFixed(3)} euros por litro` });
}

export function fmtDate(ms: number, withTime = false): string {
  return new Date(ms).toLocaleString('es-ES', withTime ? { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function toast(text: string, kind: IconName = 'check') {
  document.querySelector('.toast')?.remove();
  const t = h('div', { class: 'toast', role: 'status' }, icon(kind), text);
  document.body.append(t);
  setTimeout(() => t.remove(), 3600);
}

export function dialog(title: string, body: (Node | null)[], foot: Node[] = []): HTMLDialogElement {
  const close = h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Cerrar' }, icon('close'));
  const d = h('dialog', { 'aria-label': title }, h('div', { class: 'dlg-head' }, h('h2', null, title), close), h('div', { class: 'dlg-body' }, body), foot.length ? h('div', { class: 'dlg-foot' }, foot) : null);
  close.addEventListener('click', () => d.close());
  d.addEventListener('close', () => d.remove());
  d.addEventListener('click', (e) => {
    if (e.target === d) d.close();
  });
  document.body.append(d);
  d.showModal();
  return d;
}

/** Abre la foto de evidencia en un diálogo. La imagen se valida antes de pintarla. */
export async function showEvidence(st: AppState, photoId: string, title: string) {
  const img = h('img', { class: 'evidence-img', alt: title });
  const status = h('p', { class: 'muted small' }, 'Cargando foto…');
  dialog(title, [img, status]);
  try {
    const ev = await st.backend.getEvidence(photoId);
    const src = ev ? jpegSrc(ev.data) : '';
    if (!ev || !src) {
      status.textContent = 'No se encuentra la foto o no es válida.';
      img.remove();
      return;
    }
    img.setAttribute('src', src);
    status.textContent = `Subida por ${memberOf(st, ev.owner).name}${ev.createdAt ? ` el ${fmtDate(ev.createdAt, true)}` : ''}.`;
  } catch {
    status.textContent = 'No se pudo cargar la foto. Comprueba la conexión.';
  }
}

export function errorText(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  if (code === 'permission-denied') return 'No tienes permiso para hacer esto o los datos no son válidos.';
  if (code === 'unavailable') return 'Sin conexión. Se enviará cuando vuelvas a tener red.';
  if (e instanceof Error && e.name === 'ImageError') return e.message;
  return 'Algo ha fallado. Inténtalo de nuevo.';
}

export function busy(btn: HTMLButtonElement, on: boolean, text?: string) {
  btn.disabled = on;
  btn.classList.toggle('busy', on);
  if (on) {
    btn.dataset.label = btn.textContent ?? '';
    btn.replaceChildren(h('span', { class: 'spinner', 'aria-hidden': 'true' }), text ?? 'Guardando…');
  } else if (btn.dataset.label != null) {
    btn.replaceChildren(btn.dataset.label);
  }
}

export function pageHead(title: string, sub: string | null, ...actions: Node[]) {
  return h('header', { class: 'pagehead' }, h('div', null, h('h1', null, title), sub ? h('p', null, sub) : null), actions.length ? h('div', { class: 'chips' }, actions) : null);
}

export function linkBtn(href: string, text: string, ic: IconName, cls = 'btn') {
  return h('a', { class: cls, href }, icon(ic), text);
}
