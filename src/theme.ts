// Tema claro / oscuro elegido por la persona. Se guarda solo en este navegador;
// si no hay elección (o el almacenamiento no está disponible) se sigue al sistema.
import { h } from './dom';
import { icon } from './icons';

type Theme = 'light' | 'dark';
const KEY = 'deposito-tema';

function stored(): Theme | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'light' || v === 'dark' ? v : null;
  } catch {
    return null;
  }
}

function effective(): Theme {
  return stored() ?? (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
}

export function applyTheme() {
  const t = stored();
  if (t) document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
}

/** Botón que alterna entre claro y oscuro. `withLabel` muestra el texto (menú lateral). */
export function themeToggle(withLabel: boolean, cls: string): HTMLButtonElement {
  const b = h('button', { class: cls, type: 'button' });
  const paint = () => {
    const dark = effective() === 'dark';
    const next = dark ? 'Modo claro' : 'Modo oscuro';
    b.replaceChildren(icon(dark ? 'sun' : 'moon'), withLabel ? next : '');
    b.setAttribute('aria-label', `Cambiar a ${next.toLowerCase()}`);
    b.title = `Cambiar a ${next.toLowerCase()}`;
  };
  b.addEventListener('click', () => {
    const next: Theme = effective() === 'dark' ? 'light' : 'dark';
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* sin almacenamiento: solo dura esta visita */
    }
    document.documentElement.setAttribute('data-theme', next);
    document.querySelectorAll<HTMLButtonElement>('[data-theme-toggle]').forEach((x) => x.dispatchEvent(new Event('repaint')));
  });
  b.setAttribute('data-theme-toggle', '');
  b.addEventListener('repaint', paint);
  paint();
  return b;
}
