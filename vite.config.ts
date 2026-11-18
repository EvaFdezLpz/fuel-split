import { defineConfig } from 'vite';
import { COMMON_HEADERS, DOCUMENT_HEADERS } from './security-headers.mjs';

export default defineConfig({
  build: {
    sourcemap: false, // no publicar el código fuente
    target: 'es2022',
    chunkSizeWarningLimit: 700, // el SDK de Firebase (auth + firestore con caché offline) va en su propio chunk
  },
  // vite preview sirve el build con las mismas cabeceras que Firebase Hosting, para probar la CSP en local.
  preview: {
    headers: { ...COMMON_HEADERS, ...DOCUMENT_HEADERS },
  },
  server: {
    headers: { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' },
  },
});
