// Lectura del cuentakilómetros en el propio dispositivo (la foto no sale a ningún servicio externo).
// Tesseract se sirve desde nuestro dominio (/ocr) y se carga solo cuando hace falta.
import type { Worker } from 'tesseract.js';
import { readSevenSegment } from './odometer-vision';
import { parsePump, type ReceiptGuess } from './receipt-parse';
import { readPumpDisplay } from './pump-vision';

let workerPromise: Promise<Worker> | null = null;
// Un solo worker compartido: las lecturas se encadenan para que no se pisen los parámetros.
let queue: Promise<unknown> = Promise.resolve();
function exclusive<T>(fn: () => Promise<T>): Promise<T> {
  const run = queue.then(fn, fn);
  queue = run.catch(() => undefined);
  return run;
}

async function getWorker(): Promise<Worker> {
  if (!workerPromise) {
    workerPromise = (async () => {
      const { createWorker } = await import('tesseract.js');
      const w = await createWorker('eng', 1, {
        workerPath: '/ocr/worker.min.js',
        corePath: '/ocr/',
        langPath: '/ocr',
        workerBlobURL: false,
        gzip: true,
      });
      return w;
    })().catch((e) => {
      workerPromise = null;
      throw e;
    });
  }
  return workerPromise;
}

/** Escala de grises y contraste fuerte; invierte si el display es claro sobre oscuro. */
function prepare(src: HTMLCanvasElement): HTMLCanvasElement {
  const scale = Math.min(1, 1400 / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  let sum = 0;
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
    d[i] = g;
    sum += g;
  }
  const mean = sum / (d.length / 4);
  const invert = mean < 110;
  for (let i = 0; i < d.length; i += 4) {
    let g = d[i];
    if (invert) g = 255 - g;
    const v = g > (invert ? 255 - mean : mean) ? 255 : 0;
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/**
 * Devuelve candidatos de km ordenados por verosimilitud.
 * `expected` es el último km conocido: la lectura buena suele estar justo por encima.
 */
export function readOdometer(canvas: HTMLCanvasElement, expected: number | null): Promise<number[]> {
  return exclusive(() => odometer(canvas, expected));
}

async function odometer(canvas: HTMLCanvasElement, expected: number | null): Promise<number[]> {
  // 1) Lector propio de pantallas LCD de 7 segmentos (el del C3): rápido y sin descargar nada.
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const v = readSevenSegment(ctx.getImageData(0, 0, canvas.width, canvas.height), { expected });
      if (v.km != null) {
        // Alternativas solo si tienen las mismas cifras (p. ej. un 6 leído como 8), no fragmentos.
        const alt = v.candidates.filter((n) => n !== v.km && String(n).length === String(v.km).length);
        return [v.km, ...alt].slice(0, 3);
      }
    }
  } catch {
    /* se intenta con el OCR genérico */
  }
  // 2) OCR genérico para otros tipos de cuentakilómetros.
  const worker = await getWorker();
  // Cuentakilómetros: solo cifras, texto disperso (PSM 11).
  await worker.setParameters({ tessedit_char_whitelist: '0123456789', tessedit_pageseg_mode: '11' as never });
  const { data } = await worker.recognize(prepare(canvas));
  const nums = new Set<number>();
  for (const m of data.text.matchAll(/\d{3,7}/g)) nums.add(Number(m[0]));
  const list = [...nums];
  if (expected != null) {
    const score = (n: number) => {
      const diff = n - expected;
      if (diff >= -2 && diff <= 3000) return diff;
      return 1e9 + Math.abs(diff);
    };
    list.sort((a, b) => score(a) - score(b));
  } else {
    list.sort((a, b) => String(b).length - String(a).length || b - a);
  }
  return list.slice(0, 4);
}

/** Ticket: escala de grises con contraste estirado (sin binarizar, el papel térmico se borra). */
function prepareReceipt(src: HTMLCanvasElement): HTMLCanvasElement {
  const scale = Math.min(2, 2000 / Math.max(src.width, src.height));
  const c = document.createElement('canvas');
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  const ctx = c.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, c.width, c.height);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  const hist = new Uint32Array(256);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.round(0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]);
    d[i] = g;
    hist[g]++;
  }
  // Percentiles 2 % y 98 % como negro y blanco.
  const total = d.length / 4;
  let lo = 0;
  let hi = 255;
  for (let acc = 0; lo < 255 && (acc += hist[lo]) < total * 0.02; lo++);
  for (let acc = 0; hi > 0 && (acc += hist[hi]) < total * 0.02; hi--);
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = v;
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

/** Lee la pantalla del surtidor en el dispositivo y extrae importe, litros y €/l. */
export function readPump(canvas: HTMLCanvasElement): Promise<ReceiptGuess> {
  return exclusive(() => receipt(canvas));
}

async function receipt(canvas: HTMLCanvasElement): Promise<ReceiptGuess> {
  // 1) Lector propio de pantallas de 7 segmentos: rápido, sin descargas y sin depender de la coma.
  let partial: ReceiptGuess | null = null;
  try {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (ctx) {
      const v = readPumpDisplay(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (v.guess?.confidence === 'alta') return v.guess;
      partial = v.guess;
    }
  } catch {
    /* se intenta con el OCR de texto */
  }
  // 2) OCR de texto (pantallas con cifras normales o fotos del ticket).
  const worker = await getWorker();
  await worker.setParameters({
    tessedit_char_whitelist: '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyzÁÉÍÓÚÑáéíóúñ€.,:/%-()= ',
    tessedit_pageseg_mode: '6' as never, // bloque de texto uniforme: respeta las líneas del ticket
    preserve_interword_spaces: '1',
  });
  const { data } = await worker.recognize(prepareReceipt(canvas));
  const g = parsePump(data.text);
  if (g.confidence === 'alta' || !partial) return g;
  return g.amountCents != null ? g : partial;
}
