// Service worker mínimo: hace que el móvil trate la web como app instalable.
// No guarda nada en caché (los datos viven en Firestore y deben estar siempre al día):
// si no hay conexión al abrir la app, muestra un aviso en vez de la página de error del navegador.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (e) => {
  if (e.request.mode !== 'navigate') return;
  e.respondWith(
    fetch(e.request).catch(
      () =>
        new Response(
          '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Depósito común</title>' +
            '<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#16191e;color:#e9ebee;font:16px system-ui,sans-serif;text-align:center;padding:24px">' +
            '<div><p style="font-weight:600;font-size:1.1rem">Sin conexión</p><p style="opacity:.75">Conéctate a internet y vuelve a abrir la app.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'" } },
        ),
    ),
  );
});
