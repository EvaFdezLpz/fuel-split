import { installTrustedTypes } from './trusted-types';
import './styles.css';
import type { Backend } from './backend';
import { applyRail, startApp } from './app';
import { applyTheme } from './theme';

installTrustedTypes();
applyTheme();
applyRail();

// Service worker: necesario para que Android ofrezca «Instalar app» y la abra sin barras del navegador.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  addEventListener('load', () => navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {}));
}

async function pickBackend(): Promise<Backend> {
  // El modo demo solo existe en desarrollo (o en un build de demostración explícito): nunca en producción.
  if ((import.meta.env.DEV || import.meta.env.VITE_DEMO === '1') && new URLSearchParams(location.search).has('demo')) {
    const { createDemoBackend } = await import('./demo-backend');
    return createDemoBackend();
  }
  const { createFirebaseBackend } = await import('./firebase-backend');
  return createFirebaseBackend();
}

// Excepción SOLO en desarrollo: el simulador móvil (simulador.html, mismo origen) muestra la app en iframes.
// En producción import.meta.env.DEV es false y esta comprobación desaparece del build.
function inDevSimulator(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return window.top!.location.origin === location.origin && window.top!.location.pathname === '/simulador.html';
  } catch {
    return false; // marco de otro origen: no se puede leer, así que no es el simulador
  }
}

// Si la app acabara dentro de un iframe ajeno (clickjacking), no se pinta nada.
if (window.top !== window.self && !inDevSimulator()) {
  document.body.textContent = '';
} else {
  pickBackend().then((b) => startApp(document.getElementById('app')!, b));
}
