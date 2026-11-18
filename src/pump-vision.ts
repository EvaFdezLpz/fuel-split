// Lector de la pantalla del surtidor: busca en toda la foto líneas de cifras de 7 segmentos
// (importe, litros y precio) y elige la combinación que cumple importe ≈ litros × precio.
// Sirve para pantallas LCD (cifras oscuras sobre fondo claro) y LED (cifras claras sobre fondo oscuro).
// Funciones puras sobre ImageData, sin dependencias, para poder probarlas.

import { decodeDigit, resample, type Box, type Img } from './odometer-vision';
import { parsePump, type ReceiptGuess } from './receipt-parse';

export interface PumpVision {
  guess: ReceiptGuess | null;
  /** Líneas de cifras encontradas en la mejor variante (para depurar). */
  lines: string[];
}

/** Luminancia de la imagen reducida a `maxW` de ancho como mucho. */
function toLum(img: Img, maxW: number): { lum: Uint8Array; W: number; H: number } {
  const s = Math.min(1, maxW / img.width);
  const W = Math.max(1, Math.round(img.width * s));
  const H = Math.max(1, Math.round(img.height * s));
  const lum = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const sx = Math.min(img.width - 1, Math.floor(x / s));
      const sy = Math.min(img.height - 1, Math.floor(y / s));
      const i = (sy * img.width + sx) * 4;
      lum[y * W + x] = Math.round(0.3 * img.data[i] + 0.55 * img.data[i + 1] + 0.15 * img.data[i + 2]);
    }
  return { lum, W, H };
}

/** Umbral local: tinta = más oscura (o más clara, si `bright`) que la media de su entorno. */
function threshold(lum: Uint8Array, W: number, H: number, r: number, bright: boolean): Uint8Array {
  const integ = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += lum[y * W + x];
      integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row;
    }
  }
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - r),
        xb = Math.min(W, x + r + 1),
        ya = Math.max(0, y - r),
        yb = Math.min(H, y + r + 1);
      const mean = (integ[yb * (W + 1) + xb] - integ[ya * (W + 1) + xb] - integ[yb * (W + 1) + xa] + integ[ya * (W + 1) + xa]) / ((xb - xa) * (yb - ya));
      const v = lum[y * W + x];
      mask[y * W + x] = bright ? (v > mean * 1.12 && v > mean + 18 ? 1 : 0) : v < mean * 0.86 && v < mean - 14 ? 1 : 0;
    }
  return mask;
}

/** Dilatación separable (cuadrado de lado 2r+1): une los segmentos de una misma cifra. */
function dilate(mask: Uint8Array, W: number, H: number, r: number): Uint8Array {
  if (r <= 0) return mask;
  const tmp = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) {
    let last = -1e9;
    for (let x = 0; x < W; x++)
      if (mask[y * W + x]) last = x;
      else if (x - last <= r) tmp[y * W + x] = 1;
    last = 1e9;
    for (let x = W - 1; x >= 0; x--) {
      if (mask[y * W + x]) last = x;
      if (mask[y * W + x] || last - x <= r) tmp[y * W + x] = 1;
    }
  }
  const out = new Uint8Array(W * H);
  for (let x = 0; x < W; x++) {
    let last = -1e9;
    for (let y = 0; y < H; y++)
      if (tmp[y * W + x]) last = y;
      else if (y - last <= r) out[y * W + x] = 1;
    last = 1e9;
    for (let y = H - 1; y >= 0; y--) {
      if (tmp[y * W + x]) last = y;
      if (tmp[y * W + x] || last - y <= r) out[y * W + x] = 1;
    }
  }
  return out;
}

/** Cajas de los componentes conexos (8-vecindad). */
function components(mask: Uint8Array, W: number, H: number): (Box & { n: number })[] {
  const seen = new Uint8Array(W * H);
  const out: (Box & { n: number })[] = [];
  const st: number[] = [];
  for (let i = 0; i < W * H; i++) {
    if (!mask[i] || seen[i]) continue;
    let x0 = W,
      y0 = H,
      x1 = 0,
      y1 = 0,
      n = 0;
    seen[i] = 1;
    st.push(i);
    while (st.length) {
      const j = st.pop()!;
      const x = j % W,
        y = (j - x) / W;
      n++;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      if (y > y1) y1 = y;
      for (let dy = -1; dy <= 1; dy++)
        for (let dx = -1; dx <= 1; dx++) {
          const xx = x + dx,
            yy = y + dy;
          if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
          const k = yy * W + xx;
          if (mask[k] && !seen[k]) {
            seen[k] = 1;
            st.push(k);
          }
        }
    }
    out.push({ x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1, n });
  }
  return out;
}

/** Ajusta una caja (de la máscara dilatada) a la tinta real. */
function shrink(mask: Uint8Array, W: number, b: Box): Box | null {
  let x0 = b.x + b.w,
    y0 = b.y + b.h,
    x1 = -1,
    y1 = -1;
  for (let y = b.y; y < b.y + b.h; y++)
    for (let x = b.x; x < b.x + b.w; x++)
      if (mask[y * W + x]) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

function decode(mask: Uint8Array, W: number, b: Box): string | null {
  for (const slant of [0, 0.08, 0.15]) {
    const d = decodeDigit(mask, W, b, slant);
    if (d) return d;
  }
  return null;
}

/**
 * Pantallas con marco: muchos surtidores enmarcan cada importe con un rectángulo oscuro pegado a las
 * cifras, y marco + cifras salen como una sola mancha que no parece un número. Aquí se buscan las
 * ventanitas claras del LCD (anchas y bajas) y se deja solo la tinta de dentro, sin el marco.
 */
function insideWindows(ink: Uint8Array, lum: Uint8Array, W: number, H: number, r: number): Uint8Array | null {
  const light = threshold(lum, W, H, r, true);
  const out = new Uint8Array(W * H);
  let found = 0;
  for (const c of components(dilate(light, W, H, 1), W, H)) {
    if (c.h < H * 0.025 || c.h > H * 0.3 || c.w < c.h * 1.8 || c.w > W * 0.9) continue;
    const m = Math.max(1, Math.round(c.h * 0.04));
    const x0 = c.x + m,
      x1 = c.x + c.w - m,
      ya = c.y + m,
      yb = c.y + c.h - m;
    // Franja de las cifras: donde hay trazos verticales largos. Lo de encima o debajo (sombras, restos
    // del marco) son líneas horizontales y se descarta.
    let top = yb,
      bottom = ya;
    for (let x = x0; x < x1; x++) {
      let run = 0;
      for (let y = ya; y <= yb; y++) {
        if (y < yb && ink[y * W + x]) run++;
        else {
          if (run >= c.h * 0.3) {
            top = Math.min(top, y - run);
            bottom = Math.max(bottom, y - 1);
          }
          run = 0;
        }
      }
    }
    if (top > bottom) continue;
    for (let y = Math.max(ya, top - 1); y <= Math.min(yb - 1, bottom + 1); y++) for (let x = x0; x < x1; x++) out[y * W + x] = ink[y * W + x];
    found++;
  }
  return found ? out : null;
}

/** Busca líneas de cifras en una máscara binaria y las devuelve como texto («61,75»). */
function linesIn(raw: Uint8Array, W: number, H: number, join: number): string[] {
  // Los puntos decimales (manchas pequeñas y compactas) se apartan antes de unir segmentos:
  // si no, se pegan a la cifra de al lado y la estropean.
  const mask = raw.slice();
  const dots: Box[] = [];
  for (const c of components(raw, W, H)) {
    const small = c.w <= H * 0.03 && c.h <= H * 0.03 && c.w >= 2 && c.h >= 2;
    if (small && c.w < c.h * 2 && c.h < c.w * 2 && c.n >= c.w * c.h * 0.45) {
      dots.push(c);
      for (let y = c.y; y < c.y + c.h; y++) for (let x = c.x; x < c.x + c.w; x++) mask[y * W + x] = 0;
    }
  }
  const merged = dilate(mask, W, H, join);
  const boxes: Box[] = [];
  for (const c of components(merged, W, H)) {
    if (c.h < H * 0.025 || c.h > H * 0.45 || c.w > c.h * 1.6) continue;
    const b = shrink(mask, W, c);
    if (b && b.h >= H * 0.02) boxes.push(b);
  }
  boxes.sort((a, b) => a.x - b.x);
  // Agrupa en líneas: misma altura, centros alineados y cerca en horizontal.
  type Line = { boxes: Box[] };
  const lines: Line[] = [];
  for (const b of boxes) {
    if (b.w > b.h * 0.95) continue; // demasiado ancho para ser una cifra
    const cy = b.y + b.h / 2;
    const line = lines.find((l) => {
      const p = l.boxes[l.boxes.length - 1];
      const ref = Math.max(...l.boxes.map((x) => x.h));
      const thin = b.w < ref * 0.33; // un "1" puede quedar algo más corto
      return (
        Math.abs(p.y + p.h / 2 - cy) < ref * 0.22 &&
        (thin ? b.h > ref * 0.6 : b.h > ref * 0.75 && b.h < ref * 1.33) &&
        b.x - (p.x + p.w) < ref * 1.1 &&
        b.x >= p.x + p.w - ref * 0.1
      );
    });
    if (line) line.boxes.push(b);
    else lines.push({ boxes: [b] });
  }
  const out: { text: string; y: number }[] = [];
  for (const l of lines) {
    if (l.boxes.length < 3) continue;
    const refH = Math.max(...l.boxes.map((b) => b.h));
    const wide = l.boxes
      .filter((b) => b.w >= refH * 0.33)
      .map((b) => b.w)
      .sort((a, b) => a - b);
    const refW = wide[Math.floor(wide.length / 2)] ?? refH * 0.55;
    let text = '';
    let digits = 0;
    let prev: Box | null = null;
    for (const b of l.boxes) {
      if (b.h < refH * 0.6) continue;
      // Un "1" ocupa la parte derecha de su casilla: se decodifica con su ancho real.
      const box = b.w < refH * 0.33 ? b : { ...b, w: Math.max(b.w, Math.round(refW * 0.9)) };
      const d = decode(mask, W, box);
      if (d == null) {
        if (digits >= 3) break;
        text = '';
        digits = 0;
        prev = null;
        continue;
      }
      // Punto decimal: una mancha pequeña abajo, entre esta cifra y la anterior.
      if (prev && hasDot(dots, prev, b, refH)) text += ',';
      text += d;
      digits++;
      prev = b;
    }
    if (digits >= 3) out.push({ text, y: l.boxes[0].y });
  }
  return out.sort((a, b) => a.y - b.y).map((o) => o.text);
}

function hasDot(dots: Box[], a: Box, b: Box, refH: number): boolean {
  const bottom = Math.max(a.y + a.h, b.y + b.h);
  return dots.some((d) => {
    const cx = d.x + d.w / 2,
      cy = d.y + d.h / 2;
    return cx > a.x + a.w * 0.5 && cx < b.x + b.w * 0.3 && cy > bottom - refH * 0.25 && cy < bottom + refH * 0.15 && d.h < refH * 0.3;
  });
}

/**
 * Lee el surtidor: prueba polaridad (LCD/LED), giro y escala de unión entre segmentos,
 * y se queda con la primera variante en la que las tres cifras cuadran entre sí.
 */
/** Copia un trozo de la imagen (a su resolución original). */
function cropImg(img: Img, b: Box): Img {
  const x0 = Math.max(0, Math.round(b.x)),
    y0 = Math.max(0, Math.round(b.y));
  const w = Math.min(img.width - x0, Math.round(b.w)),
    h = Math.min(img.height - y0, Math.round(b.h));
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) {
    const from = ((y0 + y) * img.width + x0) * 4;
    for (let i = 0; i < w * 4; i++) data[y * w * 4 + i] = img.data[from + i];
  }
  return { width: w, height: h, data };
}

/**
 * Zonas donde puede estar la pantalla cuando el surtidor sale pequeño en la foto: ventanitas claras
 * con forma de visor, ampliadas para abarcar las otras líneas (importe, litros y precio van apiladas).
 */
function displayCandidates(img: Img): Box[] {
  const { lum, W, H } = toLum(img, 900);
  const k = img.width / W;
  const out: (Box & { score: number })[] = [];
  for (const r of [0.03, 0.06]) {
    const light = threshold(lum, W, H, Math.max(6, Math.round(H * r)), true);
    for (const c of components(dilate(light, W, H, 1), W, H)) {
      if (c.h < H * 0.012 || c.h > H * 0.2 || c.w < c.h * 1.8 || c.w > c.h * 9 || c.n < c.w * c.h * 0.3) continue;
      const box = {
        x: (c.x - c.w * 0.4) * k,
        y: (c.y - c.h * 4) * k,
        w: c.w * 1.9 * k,
        h: c.h * 9 * k,
      };
      if (out.some((o) => Math.abs(o.x - box.x) < o.w * 0.25 && Math.abs(o.y - box.y) < o.h * 0.25)) continue;
      out.push({ ...box, score: c.n });
    }
  }
  return out.sort((a, b) => b.score - a.score).slice(0, 8);
}

export function readPumpDisplay(img: Img, zoomed = false): PumpVision {
  let partial: PumpVision | null = null;
  const full = { x: 0, y: 0, w: img.width, h: img.height };
  const outH = Math.max(1, Math.round(img.height * Math.min(1, 900 / img.width)));
  const pass = (angles: number[]): PumpVision | null => {
    for (const angle of angles) {
      const { lum, W, H } = toLum(resample(img, full, angle, outH), 900);
      for (const bright of [false, true]) {
        for (const r of [0.04, 0.08]) {
          const rr = Math.max(6, Math.round(H * r));
          const mask = threshold(lum, W, H, rr, bright);
          // Cifras oscuras: también solo dentro de las ventanitas del LCD (sin marcos).
          const framed = bright ? null : insideWindows(mask, lum, W, H, rr);
          for (const m of framed ? [mask, framed] : [mask])
            for (const j of [0.006, 0.012, 0.02]) {
              const lines = linesIn(m, W, H, Math.max(1, Math.round(H * j)));
              if (lines.length < 2) continue;
              const guess = parsePump(lines.join('\n'));
              if (guess.confidence === 'alta') return { guess, lines };
              if (!partial && guess.amountCents != null) partial = { guess, lines };
            }
        }
      }
    }
    return null;
  };
  // 1) La foto tal cual; 2) si la pantalla sale pequeña, recortada a resolución completa; 3) la foto girada.
  const first = pass([0]);
  if (first || zoomed) return first ?? partial ?? { guess: null, lines: [] };
  if (img.width > 500)
    for (const box of displayCandidates(img)) {
      const v = readPumpDisplay(cropImg(img, box), true);
      if (v.guess?.confidence === 'alta') return v;
      if (!partial && v.guess?.amountCents != null) partial = v;
    }
  return pass([-3, 3, -6, 6]) ?? partial ?? { guess: null, lines: [] };
}
