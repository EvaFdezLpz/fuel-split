import type { AuthState, Backend, Snapshot } from './backend';
import { clear, h, s } from './dom';
import { icon, type IconName } from './icons';
import { makeState, type AppState } from './state';
import { avatar, toast } from './ui';
import { expensesView } from './views/expenses';
import { homeView } from './views/home';
import { profileView } from './views/profile';
import { refuelDetailView, refuelFormView, refuelsView } from './views/refuels';
import { tripFormView } from './views/trip-form';
import { tripsView } from './views/trips';
import { themeToggle } from './theme';
import { calendarView } from './views/calendar';
import { statsView } from './views/stats';
import { reservationFormView, reservationsView } from './views/reservations';

const NAV: { href: string; label: string; short: string; icon: IconName; match: RegExp; tab?: false }[] = [
  { href: '#/', label: 'Resumen', short: 'Resumen', icon: 'home', match: /^\/?$/ },
  { href: '#/viajes', label: 'Viajes', short: 'Viajes', icon: 'route', match: /^\/viajes/ },
  { href: '#/calendario', label: 'Calendario', short: 'Agenda', icon: 'calendar', match: /^\/calendario/ },
  { href: '#/reservas', label: 'Reservas', short: 'Reservas', icon: 'calendarCheck', match: /^\/reservas/ },
  { href: '#/repostajes', label: 'Repostajes', short: 'Repostar', icon: 'fuel', match: /^\/repostajes/ },
  { href: '#/gastos', label: 'Gastos y Bizum', short: 'Gastos', icon: 'wallet', match: /^\/gastos/ },
  { href: '#/estadisticas', label: 'Estadísticas', short: 'Datos', icon: 'chart', match: /^\/estadisticas/ },
  // En el móvil el perfil se abre desde el avatar de la barra superior.
  { href: '#/perfil', label: 'Perfil', short: 'Perfil', icon: 'user', match: /^\/perfil/, tab: false },
];

/** Marca: un tótem de precios mínimo con dos filas encendidas. */
function mark() {
  return s(
    'svg',
    { class: 'mark', viewBox: '0 0 26 30', 'aria-hidden': 'true' },
    s('rect', { x: 3, y: 0.5, width: 20, height: 25, rx: 3, fill: 'oklch(30% 0.014 258)' }),
    s('rect', { x: 6, y: 4.5, width: 14, height: 5, rx: 1, fill: 'oklch(83% 0.165 74)' }),
    s('rect', { x: 6, y: 12, width: 9, height: 5, rx: 1, fill: 'oklch(83% 0.165 74)' }),
    s('rect', { x: 16.5, y: 12, width: 3.5, height: 5, rx: 1, fill: 'oklch(42% 0.03 70)' }),
    s('rect', { x: 11, y: 25.5, width: 4, height: 4, fill: 'oklch(30% 0.014 258)' }),
  );
}

function brand(sub = true) {
  return h('a', { class: 'brand', href: '#/' }, mark(), h('span', null, 'Depósito común', sub ? h('span', { class: 'brand-sub' }, 'Gasolina compartida') : null));
}

/** Botón para ocultar el menú lateral (se queda solo con los iconos). Se recuerda en este navegador. */
const RAIL_KEY = 'deposito-menu';
export function applyRail() {
  let mini = false;
  try {
    mini = localStorage.getItem(RAIL_KEY) === 'mini';
  } catch {
    /* sin almacenamiento */
  }
  document.documentElement.toggleAttribute('data-rail-mini', mini);
}
function railToggle() {
  const b = h('button', { class: 'rail-toggle', type: 'button' });
  const paint = () => {
    const mini = document.documentElement.hasAttribute('data-rail-mini');
    b.replaceChildren(icon(mini ? 'panelOpen' : 'panelClose', 18));
    b.setAttribute('aria-label', mini ? 'Mostrar el menú' : 'Ocultar el menú');
    b.title = mini ? 'Mostrar el menú' : 'Ocultar el menú';
    b.setAttribute('aria-expanded', String(!mini));
  };
  b.addEventListener('click', () => {
    const mini = !document.documentElement.hasAttribute('data-rail-mini');
    document.documentElement.toggleAttribute('data-rail-mini', mini);
    try {
      localStorage.setItem(RAIL_KEY, mini ? 'mini' : 'full');
    } catch {
      /* solo dura esta visita */
    }
    paint();
  });
  paint();
  return b;
}

/** Rutas permitidas: todo lo demás vuelve al inicio. Los parámetros se validan con expresiones estrictas. */
function route(st: AppState, path: string, rerender: () => void): Node {
  let m: RegExpMatchArray | null;
  if (path === '/' || path === '') return homeView(st);
  if (path === '/viajes') return tripsView(st, rerender);
  if (path === '/viajes/nuevo') return tripFormView(st, null);
  if ((m = path.match(/^\/viajes\/([A-Za-z0-9]{1,40})\/editar$/))) return tripFormView(st, m[1]);
  if (path === '/repostajes') return refuelsView(st, rerender);
  if ((m = path.match(/^\/repostajes\/([A-Za-z0-9]{1,40})$/)) && m[1] !== 'nuevo') {
    const v = refuelDetailView(st, m[1]);
    if (v) return v;
  }
  if (path === '/calendario') return calendarView(st, rerender);
  if (path === '/estadisticas') return statsView(st, rerender);
  if (path === '/reservas') return reservationsView(st, rerender);
  if (path === '/reservas/nueva') return reservationFormView(st, null)!;
  if ((m = path.match(/^\/reservas\/nueva\/(\d{4}-\d{2}-\d{2})$/))) return reservationFormView(st, null, m[1])!;
  if ((m = path.match(/^\/reservas\/([A-Za-z0-9]{1,40})\/editar$/))) {
    const v = reservationFormView(st, m[1]);
    if (v) return v;
  }
  if ((m = path.match(/^\/reservas\/([A-Za-z0-9]{1,40})$/)) && st.snap.reservations.some((r) => r.id === m![1])) return reservationsView(st, rerender, m[1]);
  if (path === '/repostajes/nuevo') return refuelFormView(st);
  if (path === '/gastos') return expensesView(st, rerender);
  if (path === '/perfil') return profileView(st, st.me.email, rerender);
  if ((m = path.match(/^\/perfil\/([^/]{3,254})$/))) {
    let email = '';
    try {
      email = decodeURIComponent(m[1]).toLowerCase();
    } catch {
      /* URL mal formada */
    }
    if (st.members.has(email)) return profileView(st, email, rerender);
  }
  location.replace('#/');
  return homeView(st);
}

function currentPath(): string {
  const raw = location.hash.replace(/^#/, '') || '/';
  return raw.split('?')[0];
}

function shell(st: AppState, content: Node) {
  const path = currentPath();
  const navItem = (n: (typeof NAV)[number], cls: string, short: boolean) =>
    h('a', { class: cls, href: n.href, title: short ? null : n.label, 'aria-current': n.match.test(path) ? 'page' : null }, icon(n.icon, short ? 20 : 18), h('span', { class: 'nav-label' }, short ? n.short : n.label));
  const signOut = h('button', { class: 'btn ghost sm', type: 'button', 'aria-label': 'Cerrar sesión' }, icon('logout'));
  signOut.addEventListener('click', () => st.backend.signOut());
  const signOutRail = h('button', { class: 'btn dark sm rail-out', type: 'button', title: 'Cerrar sesión' }, icon('logout'), h('span', { class: 'nav-label' }, 'Cerrar sesión'));
  signOutRail.addEventListener('click', () => st.backend.signOut());
  signOut.classList.add('only-mobile');

  return h(
    'div',
    { class: 'shell' },
    h('header', { class: 'topbar' }, brand(false), h('span', { class: 'spacer' }), themeToggle(false, 'btn ghost sm only-mobile theme-btn'), avatar(st.me, false, '#/perfil'), signOut),
    h(
      'aside',
      { class: 'rail', 'aria-label': 'Navegación' },
      h('div', { class: 'rail-head' }, brand(), railToggle()),
      h('nav', null, NAV.map((n) => navItem(n, 'navlink', false))),
      h(
        'div',
        { class: 'bottom' },
        h('div', { class: 'rail-user' }, avatar(st.me, false, '#/perfil'), h('div', { class: 'rail-who' }, st.me.name, h('span', null, st.me.email))),
        h('div', { class: 'rail-actions' }, themeToggle(false, 'btn dark sm icon-only'), signOutRail),
      ),
    ),
    h('main', { class: 'main', id: 'main' }, content),
    h('nav', { class: 'tabbar', 'aria-label': 'Navegación' }, NAV.filter((n) => n.tab !== false).map((n) => navItem(n, 'tab', true))),
  );
}

function loginView(backend: Backend, error?: string, forbidden?: string) {
  const btn = h('button', { class: 'btn gbtn', type: 'button' }, googleLogo(), 'Entrar con Google');
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    try {
      await backend.signIn();
    } catch {
      toast('No se pudo iniciar sesión. Inténtalo de nuevo.', 'alert');
    } finally {
      btn.disabled = false;
    }
  });
  const dash = (n: number) => s('svg', { class: 'seg seg-dim', viewBox: `0 0 ${n * 14} 21`, width: `${(n * 14) / 21}em`, height: '1em', 'aria-hidden': 'true' }, Array.from({ length: n }, (_, i) => s('rect', { x: i * 14 + 1.5, y: 9, width: 9, height: 2.3, class: 'on' })));
  return h(
    'div',
    { class: 'login' },
    h(
      'main',
      { class: 'login-card' },
      brand(),
      h(
        'div',
        { class: 'totem' },
        h('div', { class: 'totem-head' }, h('span', null, 'Cuentas del coche familiar'), h('span', { class: 'plate' }, 'C3 · 2005')),
        h('div', { class: 'trow' }, h('div', { class: 'trow-label' }, 'Debes'), h('div', { class: 'trow-value' }, dash(4), h('span', { class: 'trow-unit' }, '€'))),
        h('div', { class: 'trow' }, h('div', { class: 'trow-label' }, 'Cuentakilómetros'), h('div', { class: 'trow-value' }, dash(6), h('span', { class: 'trow-unit' }, 'km'))),
      ),
      h('p', null, 'Cada viaje con la foto del cuentakilómetros, cada repostaje con la foto del surtidor. Así se reparte la gasolina por los km que hace cada uno.'),
      forbidden ? h('div', { class: 'notice bad', role: 'alert' }, icon('alert'), h('span', null, `${forbidden} no está en la lista de la familia. Pide a quien administra la app que te añada.`)) : null,
      error ? h('div', { class: 'notice bad', role: 'alert' }, icon('alert'), h('span', null, error)) : null,
      btn,
      h('p', { class: 'small' }, 'Solo pueden entrar los correos autorizados.'),
    ),
  );
}

function googleLogo() {
  return s(
    'svg',
    { viewBox: '0 0 48 48', width: 18, height: 18, 'aria-hidden': 'true' },
    s('path', { fill: '#EA4335', d: 'M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z' }),
    s('path', { fill: '#4285F4', d: 'M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z' }),
    s('path', { fill: '#FBBC05', d: 'M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z' }),
    s('path', { fill: '#34A853', d: 'M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z' }),
  );
}

export function startApp(root: HTMLElement, backend: Backend) {
  let unsub: (() => void) | null = null;
  let snap: Snapshot | null = null;
  let auth: AuthState = { status: 'loading' };
  let lastPath = '';

  const render = () => {
    if (auth.status !== 'ready') {
      clear(root);
      if (auth.status === 'loading') root.append(h('div', { class: 'login' }, h('span', { class: 'spinner', 'aria-label': 'Cargando' })));
      else root.append(loginView(backend, auth.status === 'signed-out' ? auth.error : undefined, auth.status === 'forbidden' ? auth.email : undefined));
      return;
    }
    if (!snap) {
      clear(root);
      root.append(h('div', { class: 'login' }, h('span', { class: 'spinner', 'aria-label': 'Cargando datos' })));
      return;
    }
    const path = currentPath();
    // No repintar formularios a medias cuando llegan datos nuevos de otra persona.
    const isForm = /\/(nuevo|editar)$/.test(path);
    if (isForm && path === lastPath && root.querySelector('form')) return;
    const scroll = path === lastPath ? window.scrollY : 0;
    const st = makeState(backend, auth.member, snap);
    clear(root);
    root.append(shell(st, route(st, path, render)));
    window.scrollTo(0, scroll);
    if (path !== lastPath) document.title = `${titleFor(path)} · Depósito común`;
    lastPath = path;
  };

  backend.onAuth((a) => {
    auth = a;
    if (a.status === 'ready' && !unsub) {
      unsub = backend.subscribe(
        (s2) => {
          snap = s2;
          render();
        },
        () => toast('Se perdió la conexión con los datos. Recarga la página.', 'alert'),
      );
    }
    if (a.status !== 'ready' && unsub) {
      unsub();
      unsub = null;
      snap = null;
    }
    render();
  });
  window.addEventListener('hashchange', () => {
    document.querySelectorAll('dialog[open]').forEach((d) => (d as HTMLDialogElement).close());
    render();
  });
}

function titleFor(path: string): string {
  const n = NAV.find((x) => x.match.test(path));
  if (path.endsWith('/nuevo')) return path.includes('viajes') ? 'Registrar viaje' : 'Registrar repostaje';
  return n?.label ?? 'Resumen';
}
