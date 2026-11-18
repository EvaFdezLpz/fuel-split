// Copia los ficheros de Tesseract a /public/ocr para servirlos desde el mismo origen
// (sin CDNs de terceros: CSP estricta y sin riesgo de supply chain en tiempo de ejecución).
import { copyFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

const out = resolve('public/ocr');
mkdirSync(out, { recursive: true });
copyFileSync('node_modules/tesseract.js/dist/worker.min.js', resolve(out, 'worker.min.js'));
for (const f of ['tesseract-core-relaxedsimd-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js', 'tesseract-core-lstm.wasm.js']) {
  copyFileSync(resolve('node_modules/tesseract.js-core', f), resolve(out, f));
}

const lang = resolve(out, 'eng.traineddata.gz');
if (!existsSync(lang)) {
  const url = 'https://cdn.jsdelivr.net/npm/@tesseract.js-data/eng@1.0.0/4.0.0_best_int/eng.traineddata.gz';
  const res = await fetch(url);
  if (!res.ok) throw new Error(`No se pudo descargar ${url}: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  // Integridad: si el fichero remoto cambia, el build falla en vez de servir algo no revisado.
  const EXPECTED = '45b4cb346724ac1774f1c36f42f182b887bcdb28ebe63e6fff90ac41f3fcff91';
  const got = createHash('sha256').update(buf).digest('hex');
  if (got !== EXPECTED) throw new Error(`Hash inesperado para eng.traineddata.gz: ${got}`);
  writeFileSync(lang, buf);
}
console.log('OCR listo en public/ocr');
