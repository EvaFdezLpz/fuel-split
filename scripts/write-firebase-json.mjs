// Genera firebase.json con las cabeceras de security-headers.mjs para que no se desincronicen.
import { writeFileSync } from 'node:fs';
import { COMMON_HEADERS, DOCUMENT_HEADERS, WORKER_CSP } from '../security-headers.mjs';

const toList = (o) => Object.entries(o).map(([key, value]) => ({ key, value }));
const config = {
  hosting: {
    public: 'dist',
    ignore: ['firebase.json', '**/.*', '**/*.map'],
    cleanUrls: true,
    headers: [
      { source: '**', headers: toList(COMMON_HEADERS) },
      { source: '/', headers: toList(DOCUMENT_HEADERS) },
      { source: '/index.html', headers: toList(DOCUMENT_HEADERS) },
      { source: '/assets/**', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      {
        source: '/ocr/**',
        headers: [
          { key: 'Content-Security-Policy', value: WORKER_CSP },
          { key: 'Cache-Control', value: 'public, max-age=604800' },
        ],
      },
    ],
  },
  firestore: { rules: 'firestore.rules', indexes: 'firestore.indexes.json' },
  emulators: { firestore: { host: '127.0.0.1', port: 8080 }, auth: { port: 9099 }, ui: { enabled: false }, singleProjectMode: true },
};
writeFileSync('firebase.json', JSON.stringify(config, null, 2) + '\n');
console.log('firebase.json actualizado');
