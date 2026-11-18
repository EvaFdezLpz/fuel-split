// Lector específico de cuentakilómetros LCD de 7 segmentos (como el del Citroën C3 de 2005:
// cifras oscuras sobre pantalla naranja retroiluminada). Funciones puras sobre ImageData,
// sin dependencias, para poder probarlas con fotos reales.

export interface Img {
  width: number;
  height: number;
  data: Uint8ClampedArray | number[];
}

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface VisionResult {
  km: number | null;
  digits: string;
  lcd: Box | null;
  debug?: string;
}

/** Píxel de pantalla retroiluminada: naranja/ámbar saturado y luminoso. */
function isBacklight(r: number, g: number, b: number): boolean {
  return r > 150 && r - b > 70 && r >= g && g > 40 && r - g < 190;
}

/** Busca la pantalla: el mayor bloque conexo de píxeles retroiluminados (en una rejilla gruesa). */
export function findLcd(img: Img): Box | null {
  const cell = Math.max(2, Math.round(Math.max(img.width, img.height) / 300));
  const gw = Math.ceil(img.width / cell);
  const gh = Math.ceil(img.height / cell);
  const grid = new Uint8Array(gw * gh);
  for (let gy = 0; gy < gh; gy++) {
    for (let gx = 0; gx < gw; gx++) {
      let hit = 0;
      let n = 0;
      for (let y = gy * cell; y < Math.min(img.height, (gy + 1) * cell); y += 2) {
        for (let x = gx * cell; x < Math.min(img.width, (gx + 1) * cell); x += 2) {
          const i = (y * img.width + x) * 4;
          n++;
          if (isBacklight(img.data[i], img.data[i + 1], img.data[i + 2])) hit++;
        }
      }
      grid[gy * gw + gx] = n && hit / n > 0.4 ? 1 : 0;
    }
  }
  // Las cifras oscuras abren agujeros en la pantalla: cerramos huecos pequeños dilatando una celda.
  const dil = new Uint8Array(gw * gh);
  for (let y = 0; y < gh; y++)
    for (let x = 0; x < gw; x++) {
      let v = 0;
      for (let dy = -1; dy <= 1 && !v; dy++) for (let dx = -1; dx <= 1 && !v; dx++) v = grid[(y + dy) * gw + (x + dx)] ?? 0;
      dil[y * gw + x] = v;
    }
  const seen = new Uint8Array(gw * gh);
  let best: { box: Box; area: number } | null = null;
  const stack: number[] = [];
  for (let start = 0; start < dil.length; start++) {
    if (!dil[start] || seen[start]) continue;
    let minX = gw, minY = gh, maxX = 0, maxY = 0, area = 0;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const p = stack.pop()!;
      const x = p % gw;
      const y = (p - x) / gw;
      area++;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
      for (const q of [p - 1, p + 1, p - gw, p + gw]) {
        if (q < 0 || q >= dil.length || seen[q] || !dil[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === gw - 1)) continue;
        seen[q] = 1;
        stack.push(q);
      }
    }
    const w = maxX - minX + 1;
    const h = maxY - minY + 1;
    // Una pantalla es un rectángulo bastante relleno y más ancho que alto.
    const fill = area / (w * h);
    if (w < 6 || h < 4 || fill < 0.55 || w < h * 0.9) continue;
    if (!best || area > best.area) best = { box: { x: minX * cell, y: minY * cell, w: w * cell, h: h * cell }, area };
  }
  return best ? tighten(img, best.box) : null;
}

/** Recorta el marco: se queda con las filas y columnas donde domina la retroiluminación. */
function tighten(img: Img, b: Box): Box {
  const frac = (x0: number, y0: number, x1: number, y1: number) => {
    let hit = 0, n = 0;
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++) {
        const i = (y * img.width + x) * 4;
        n++;
        if (isBacklight(img.data[i], img.data[i + 1], img.data[i + 2])) hit++;
      }
    return n ? hit / n : 0;
  };
  const x1 = Math.min(img.width, b.x + b.w), y1 = Math.min(img.height, b.y + b.h);
  let top = b.y, bottom = y1, left = b.x, right = x1;
  while (top < bottom && frac(b.x, top, x1, top + 1) < 0.5) top++;
  while (bottom > top && frac(b.x, bottom - 1, x1, bottom) < 0.5) bottom--;
  while (left < right && frac(left, top, left + 1, bottom) < 0.5) left++;
  while (right > left && frac(right - 1, top, right, bottom) < 0.5) right--;
  return { x: left, y: top, w: right - left, h: bottom - top };
}

/** Umbral de Otsu sobre un histograma de 256 niveles. */
function otsu(hist: number[], total: number): number {
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t];
    if (!wB) continue;
    const wF = total - wB;
    if (!wF) break;
    sumB += t * hist[t];
    const mB = sumB / wB;
    const mF = (sum - sumB) / wF;
    const between = wB * wF * (mB - mF) ** 2;
    if (between > best) {
      best = between;
      thr = t;
    }
  }
  return thr;
}

const SEG_DIGITS: Record<string, string> = {
  abcdef: '0', bc: '1', abdeg: '2', abcdg: '3', bcfg: '4', acdfg: '5', acdefg: '6', abc: '7', abcdefg: '8', abcdfg: '9',
  // Variantes habituales: 7 con segmento f, 6 y 9 sin cola.
  abcf: '7', cdefg: '6', abcfg: '9',
};

/** Decodifica un dígito de 7 segmentos a partir de su máscara (1 = tinta). */
export function decodeDigit(mask: Uint8Array, mw: number, b: Box, slant: number): string | null {
  if (b.w < b.h * 0.33) return '1';
  const ink = (fx: number, fy: number, rw: number, rh: number) => {
    // fx, fy en fracciones de la caja; compensa la inclinación de las cifras.
    const cx = b.x + fx * b.w + slant * (0.5 - fy) * b.h;
    const cy = b.y + fy * b.h;
    const hw = Math.max(1, (rw * b.w) / 2);
    const hh = Math.max(1, (rh * b.h) / 2);
    let on = 0, n = 0;
    for (let y = Math.round(cy - hh); y <= Math.round(cy + hh); y++)
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x++) {
        n++;
        if (mask[y * mw + x]) on++;
      }
    return n ? on / n : 0;
  };
  const probes: Record<string, number> = {
    a: ink(0.5, 0.06, 0.4, 0.1),
    g: ink(0.5, 0.5, 0.4, 0.1),
    d: ink(0.5, 0.94, 0.4, 0.1),
    f: ink(0.1, 0.27, 0.18, 0.26),
    b: ink(0.9, 0.27, 0.18, 0.26),
    e: ink(0.1, 0.73, 0.18, 0.26),
    c: ink(0.9, 0.73, 0.18, 0.26),
  };
  const lit = Object.entries(probes)
    .filter(([, v]) => v > 0.3)
    .map(([k]) => k)
    .sort()
    .join('');
  return SEG_DIGITS[lit] ?? null;
}

/** Lee la cifra del cuentakilómetros. Devuelve null si no encuentra una pantalla o una línea de cifras clara. */
let lastMask: { mask: Uint8Array; w: number; h: number; dbg: string[] } | null = null;
export function debugLast() {
  return lastMask;
}
function decodeCrop(img: Img, k = 0.86): string {
  const X0 = 0, Y0 = 0, W = img.width, H = img.height;
  // Tinta = píxeles oscuros respecto al fondo naranja (canal rojo, el que más contrasta).
  const hist = new Array(256).fill(0);
  const lum = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = ((Y0 + y) * img.width + X0 + x) * 4;
      const v = Math.round(0.6 * img.data[i] + 0.4 * img.data[i + 1]);
      lum[y * W + x] = v;
      hist[v]++;
    }
  const thr = otsu(hist, W * H);
  // Umbral local (media en una ventana del tamaño de una cifra): la retroiluminación no es uniforme
  // y un umbral único borra los "1" finos en la zona más clara.
  const integ = new Float64Array((W + 1) * (H + 1));
  for (let y = 0; y < H; y++) {
    let row = 0;
    for (let x = 0; x < W; x++) {
      row += lum[y * W + x];
      integ[(y + 1) * (W + 1) + x + 1] = integ[y * (W + 1) + x + 1] + row;
    }
  }
  const r = Math.max(4, Math.round(H * 0.12));
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const xa = Math.max(0, x - r), xb = Math.min(W, x + r + 1), ya = Math.max(0, y - r), yb = Math.min(H, y + r + 1);
      const sum = integ[yb * (W + 1) + xb] - integ[ya * (W + 1) + xb] - integ[yb * (W + 1) + xa] + integ[ya * (W + 1) + xa];
      const mean = sum / ((xb - xa) * (yb - ya));
      const v = lum[y * W + x];
      mask[y * W + x] = v < mean * k && v < mean - 8 && v < thr + 40 ? 1 : 0;
    }

  // Lo que toca el borde del recorte es marco o sombra, nunca una cifra: se borra.
  const st: number[] = [];
  const push = (i: number) => {
    if (mask[i]) {
      mask[i] = 0;
      st.push(i);
    }
  };
  for (let x = 0; x < W; x++) {
    push(x);
    push((H - 1) * W + x);
  }
  for (let y = 0; y < H; y++) {
    push(y * W);
    push(y * W + W - 1);
  }
  while (st.length) {
    const i = st.pop()!;
    const x = i % W;
    if (x > 0) push(i - 1);
    if (x < W - 1) push(i + 1);
    if (i >= W) push(i - W);
    if (i < W * (H - 1)) push(i + W);
  }

  // Bandas horizontales con tinta.
  const rows = new Array(H).fill(0);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) rows[y] += mask[y * W + x];
  const bands: { y0: number; y1: number }[] = [];
  let inBand = -1;
  const rowMin = Math.max(2, W * 0.01);
  // Se toleran filas vacías cortas: los huecos entre segmentos de una misma cifra.
  const maxRowGap = Math.max(2, Math.round(H * 0.045));
  let lastOn = -1;
  for (let y = 0; y <= H; y++) {
    const on = y < H && rows[y] >= rowMin;
    if (on) {
      if (inBand < 0) inBand = y;
      lastOn = y;
    } else if (inBand >= 0 && (y - lastOn > maxRowGap || y === H)) {
      if (lastOn + 1 - inBand >= H * 0.08) bands.push({ y0: inBand, y1: lastOn + 1 });
      inBand = -1;
    }
  }
  let bestDigits = '';
  const dbg: string[] = [];
  // De abajo arriba: en el C3 la línea del total va abajo.
  for (const band of bands.reverse()) {
    const bh = band.y1 - band.y0;
    const cols = new Array(W).fill(0);
    for (let y = band.y0; y < band.y1; y++) for (let x = 0; x < W; x++) cols[x] += mask[y * W + x];
    // Segmentos de columnas con tinta; se unen huecos pequeños (separaciones entre segmentos).
    const spans: { x0: number; x1: number }[] = [];
    let s = -1, gap = 0;
    const maxGap = Math.max(1, Math.round(bh * 0.08));
    for (let x = 0; x <= W; x++) {
      const on = x < W && cols[x] > 0;
      if (on) {
        if (s < 0) s = x;
        gap = 0;
      } else if (s >= 0) {
        gap++;
        if (gap > maxGap || x === W) {
          spans.push({ x0: s, x1: x - gap + 1 });
          s = -1;
          gap = 0;
        }
      }
    }
    // Cajas ajustadas en vertical; solo las de altura de cifra.
    const boxes: Box[] = [];
    const dbgSpans: string[] = [];
    for (const sp of spans) {
      let y0 = band.y1, y1 = band.y0;
      for (let y = band.y0; y < band.y1; y++)
        for (let x = sp.x0; x < sp.x1; x++)
          if (mask[y * W + x]) {
            if (y < y0) y0 = y;
            if (y > y1) y1 = y;
          }
      const h = y1 - y0 + 1;
      dbgSpans.push(`${sp.x0}-${sp.x1}:h${h}`);
      if (h >= bh * 0.5) boxes.push({ x: sp.x0, y: y0, w: sp.x1 - sp.x0, h });
    }
    dbg.push(`spans ${dbgSpans.join(' ')}`);
    dbg.push(`banda ${band.y0}-${band.y1}: ${boxes.map((b) => `${b.x},${b.y} ${b.w}x${b.h}`).join(' | ')}`);
    // Altura de referencia: la mayor frecuente (las cifras completas). Los "1" son algo más bajos
    // porque sus dos segmentos no llegan a los extremos; "km" y otros textos son mucho más bajos.
    const refH = Math.max(...boxes.map((b) => b.h));
    const tall = boxes.filter((b) => b.h >= refH * 0.9);
    const tops = tall.map((b) => b.y).sort((a, b) => a - b);
    const bots = tall.map((b) => b.y + b.h).sort((a, b) => a - b);
    const topM = tops[Math.floor(tops.length / 2)];
    const botM = bots[Math.floor(bots.length / 2)];
    // Misma línea de cifras: arriba y abajo alineados (los "1" pueden quedarse algo cortos).
    const mid = (topM + botM) / 2;
    const kept = boxes.filter((b) => {
      if (b.y < topM - refH * 0.15 || b.y + b.h > botM + refH * 0.15) return false;
      // Un "1" es estrecho y a veces más corto (sus extremos se pierden con mucha luz): basta con que esté centrado.
      if (b.w < refH * 0.33) return b.h >= refH * 0.6 && Math.abs(b.y + b.h / 2 - mid) <= refH * 0.15;
      return b.h >= refH * 0.75 && b.y - topM <= refH * 0.2 && botM - (b.y + b.h) <= refH * 0.2;
    });
    boxes.length = 0;
    boxes.push(...kept);
    if (boxes.length < 4) continue;
    const ws = boxes.filter((b) => b.w > refH * 0.33).map((b) => b.w).sort((a, b) => a - b);
    const refW = ws[Math.floor(ws.length / 2)] ?? refH * 0.55;
    let digits = '';
    for (const b of boxes) {
      const box = b.w < refH * 0.33 ? b : { ...b, w: Math.max(b.w, Math.round(refW * 0.9)) };
      let d: string | null = null;
      for (const slant of [0, 0.08, 0.15]) {
        d = decodeDigit(mask, W, box, slant);
        if (d) break;
      }
      if (d == null) {
        if (digits.length >= 4) break; // empieza "km" u otro texto
        digits = '';
        continue;
      }
      digits += d;
    }
    if (digits.length > bestDigits.length) bestDigits = digits;
    if (digits.length >= 4) break;
  }
  lastMask = { mask, w: W, h: H, dbg };
  return bestDigits;
}

/** Remuestrea la pantalla a una altura fija, girándola `angle` grados (bilineal). */
export function resample(img: Img, b: Box, angle: number, outH: number): Img {
  const scale = outH / b.h;
  const outW = Math.round(b.w * scale);
  const data = new Uint8ClampedArray(outW * outH * 4);
  const cos = Math.cos((angle * Math.PI) / 180);
  const sin = Math.sin((angle * Math.PI) / 180);
  const cx = b.x + b.w / 2;
  const cy = b.y + b.h / 2;
  for (let y = 0; y < outH; y++)
    for (let x = 0; x < outW; x++) {
      const dx = (x - outW / 2) / scale;
      const dy = (y - outH / 2) / scale;
      const sx = cx + dx * cos - dy * sin;
      const sy = cy + dx * sin + dy * cos;
      const x0 = Math.floor(sx), y0 = Math.floor(sy);
      const fx = sx - x0, fy = sy - y0;
      const o = (y * outW + x) * 4;
      if (x0 < 0 || y0 < 0 || x0 + 1 >= img.width || y0 + 1 >= img.height) {
        data[o] = 255; data[o + 1] = 120; data[o + 2] = 60; data[o + 3] = 255; // fondo naranja
        continue;
      }
      for (let k = 0; k < 3; k++) {
        const i00 = (y0 * img.width + x0) * 4 + k;
        const i10 = i00 + 4;
        const i01 = i00 + img.width * 4;
        const i11 = i01 + 4;
        data[o + k] = (img.data[i00] * (1 - fx) + img.data[i10] * fx) * (1 - fy) + (img.data[i01] * (1 - fx) + img.data[i11] * fx) * fy;
      }
      data[o + 3] = 255;
    }
  return { width: outW, height: outH, data };
}

export interface VisionOptions {
  /** Último km conocido: desempata a favor de la lectura más verosímil. */
  expected?: number | null;
  debugAngle?: number;
  debugH?: number;
}
let dbgOut: unknown = null;
export function debugOut() {
  return dbgOut;
}

/**
 * Lee la cifra del cuentakilómetros: localiza la pantalla, la amplía, prueba varias
 * correcciones de giro y vota la lectura que más se repite.
 */
export function readSevenSegment(img: Img, opts: VisionOptions = {}): VisionResult & { candidates: number[] } {
  const lcd = findLcd(img);
  if (!lcd) return { km: null, digits: '', lcd: null, candidates: [], debug: 'sin pantalla' };
  const pad = Math.round(Math.min(lcd.w, lcd.h) * 0.02);
  const box = { x: lcd.x + pad, y: lcd.y + pad, w: lcd.w - 2 * pad, h: lcd.h - 2 * pad };
  const votes = new Map<string, number>();
  for (const angle of [0, -1.5, 1.5, -3, 3, -4.5, 4.5, -6, 6]) {
    for (const [outH, k] of [[180, 0.86], [240, 0.86], [180, 0.92], [240, 0.8]] as const) {
      const d = decodeCrop(resample(img, box, angle, outH), k);
      if (opts.debugAngle === angle && opts.debugH === outH) dbgOut = lastMask;
      if (d.length >= 4 && d.length <= 7) votes.set(d, (votes.get(d) ?? 0) + (angle === 0 ? 1.5 : 1));
    }
  }
  const exp = opts.expected ?? null;
  const ranked = [...votes.entries()].sort((a, b) => {
    const score = ([d, v]: [string, number]) => {
      let sc = v + (d.length === 6 ? 0.5 : 0);
      if (exp != null) {
        const diff = Number(d) - exp;
        if (diff >= -2 && diff <= 3000) sc += 3;
      }
      return sc;
    };
    return score(b) - score(a);
  });
  const digits = ranked[0]?.[0] ?? '';
  return {
    km: digits ? Number(digits) : null,
    digits,
    lcd,
    candidates: ranked.map(([d]) => Number(d)).slice(0, 4),
    debug: ranked.map(([d, v]) => `${d}:${v}`).join(' '),
  };
}
