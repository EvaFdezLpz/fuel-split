import { describe, expect, it } from 'vitest';
import { readPumpDisplay } from './pump-vision';

// Dibuja una pantalla de surtidor sintética: tres líneas de cifras de 7 segmentos.
const SEGS: Record<string, string> = { '0': 'abcdef', '1': 'bc', '2': 'abdeg', '3': 'abcdg', '4': 'bcfg', '5': 'acdfg', '6': 'acdefg', '7': 'abc', '8': 'abcdefg', '9': 'abcdfg' };

function render(opts: { lines: { text: string; h: number }[]; led?: boolean; slant?: number; noise?: number; angle?: number; seed?: number; ghost?: boolean; blur?: number; big?: boolean; frame?: boolean }) {
  const W = opts.big ? 1600 : 800, H = opts.big ? 1200 : 600;
  const ox = opts.big ? 500 : 0, oy = opts.big ? 380 : 0;
  const lcd = [178, 190, 168];
  // Con marco: carcasa oscura y cada importe en su ventanita clara, muy pegada a las cifras.
  const bg = opts.led ? [18, 18, 20] : opts.frame ? [58, 64, 64] : lcd;
  const ink = opts.led ? [255, 70, 40] : [30, 34, 30];
  const px = new Float32Array(W * H * 3);
  for (let i = 0; i < W * H; i++) px.set(bg, i * 3);
  let seed = opts.seed ?? 1;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const ang = ((opts.angle ?? 0) * Math.PI) / 180;
  const put = (x: number, y: number, c: number[]) => {
    // giro alrededor del centro
    const dx = x - W / 2, dy = y - H / 2;
    const rx = Math.round(W / 2 + dx * Math.cos(ang) - dy * Math.sin(ang));
    const ry = Math.round(H / 2 + dx * Math.sin(ang) + dy * Math.cos(ang));
    if (rx < 0 || ry < 0 || rx >= W || ry >= H) return;
    px.set(c, (ry * W + rx) * 3);
  };
  const rect = (x0: number, y0: number, w: number, h: number, slant: number, base: number, c: number[]) => {
    for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) put(x + slant * (base - y), y, c);
  };
  // Etiquetas y marco: ruido que no son cifras.
  rect(ox + 40, oy + 20, 720, 6, 0, 0, ink);
  rect(ox + 60, oy + 60, 140, 18, 0, 0, ink);
  if (opts.big) {
    // Resto del surtidor: botones, manguera, texto.
    for (let k = 0; k < 14; k++) rect(Math.round(rnd() * 1500), Math.round(rnd() * 300 + (k % 2 ? 0 : 880)), Math.round(20 + rnd() * 120), Math.round(10 + rnd() * 80), 0, 0, ink);
  }
  const ghost = opts.led ? [70, 22, 18] : [150, 160, 142];
  let y = oy + 110;
  for (const line of opts.lines) {
    const h = line.h, w = Math.round(h * 0.55), t = Math.max(3, Math.round(h * 0.12)), g = Math.max(1, Math.round(h * 0.03));
    let x = ox + 260;
    const sl = opts.slant ?? 0;
    if (opts.frame) {
      const width = [...line.text].filter((c) => c !== ',').length * (w + Math.round(h * 0.25));
      rect(x - 5, y - 4, width + 6, h + 9, 0, 0, lcd);
      rect(x - 3, y + h + 2, width + 2, 2, 0, 0, [70, 76, 72]); // sombra pegada debajo de las cifras
    }
    for (const ch of line.text) {
      if (ch === ',') {
        rect(x - Math.round(w * 0.25), y + h - t, t, t, sl, y + h, ink);
        continue;
      }
      const s = SEGS[ch];
      const lit = opts.ghost ? 'abcdefg' : '';
      const half = Math.round(h / 2);
      const seg: Record<string, [number, number, number, number]> = {
        a: [x + g + t / 2, y, w - 2 * g - t, t],
        g: [x + g + t / 2, y + half - t / 2, w - 2 * g - t, t],
        d: [x + g + t / 2, y + h - t, w - 2 * g - t, t],
        f: [x, y + g + t / 2, t, half - 2 * g - t / 2],
        b: [x + w - t, y + g + t / 2, t, half - 2 * g - t / 2],
        e: [x, y + half + g, t, half - 2 * g - t / 2],
        c: [x + w - t, y + half + g, t, half - 2 * g - t / 2],
      };
      for (const k of lit) {
        const [a, b, c, d] = seg[k];
        rect(Math.round(a), Math.round(b), Math.round(c), Math.round(d), sl, y + h, ghost);
      }
      for (const k of s) {
        const [a, b, c, d] = seg[k];
        rect(Math.round(a), Math.round(b), Math.round(c), Math.round(d), sl, y + h, ink);
      }
      x += w + Math.round(h * 0.25);
    }
    y += line.h + 60;
  }
  for (let pass = 0; pass < (opts.blur ?? 0); pass++) {
    const src = px.slice();
    for (let yy = 1; yy < H - 1; yy++)
      for (let xx = 1; xx < W - 1; xx++)
        for (let k = 0; k < 3; k++) {
          let sum = 0;
          for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) sum += src[((yy + dy) * W + xx + dx) * 3 + k];
          px[(yy * W + xx) * 3 + k] = sum / 9;
        }
  }
  const data = new Uint8ClampedArray(W * H * 4);
  const n = opts.noise ?? 0;
  for (let i = 0; i < W * H; i++)
    for (let k = 0; k < 3; k++) data[i * 4 + k] = px[i * 3 + k] + (rnd() - 0.5) * n + (i % W) * 0.05; // ruido y luz desigual
  for (let i = 0; i < W * H; i++) data[i * 4 + 3] = 255;
  return { width: W, height: H, data };
}

const pump = [
  { text: '61,75', h: 110 },
  { text: '40,12', h: 110 },
  { text: '1,539', h: 70 },
];

describe('readPumpDisplay', { timeout: 30_000 }, () => {
  it('lee una pantalla LCD (cifras oscuras)', () => {
    expect(readPumpDisplay(render({ lines: pump, noise: 20 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539, litersMilli: 40120 });
  });
  it('lee una pantalla LED (cifras claras sobre negro)', () => {
    expect(readPumpDisplay(render({ lines: pump, led: true, noise: 20 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539 });
  });
  it('aguanta cifras inclinadas y la foto algo torcida', () => {
    expect(readPumpDisplay(render({ lines: pump, slant: 0.12, angle: 3, noise: 25 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539 });
  });
  it('sin coma visible también cuadra', () => {
    const r = readPumpDisplay(render({ lines: [{ text: '5520', h: 100 }, { text: '3564', h: 100 }, { text: '1549', h: 70 }], noise: 15 }));
    expect(r.guess).toMatchObject({ amountCents: 5520, priceMilli: 1549 });
  });
  it('no inventa cifras en una imagen sin pantalla', () => {
    expect(readPumpDisplay(render({ lines: [], noise: 30 })).guess).toBeNull();
  });
  it('ignora los segmentos apagados que se ven tenues (LCD)', () => {
    expect(readPumpDisplay(render({ lines: pump, ghost: true, noise: 15, blur: 1 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539 });
  });
  it('ignora los segmentos apagados que se ven tenues (LED)', () => {
    expect(readPumpDisplay(render({ lines: pump, ghost: true, led: true, noise: 15, blur: 1 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539 });
  });
  it('encuentra la pantalla en una foto grande con más cosas', () => {
    expect(readPumpDisplay(render({ lines: pump, big: true, noise: 20, blur: 2, slant: 0.1 })).guess).toMatchObject({ amountCents: 6175, priceMilli: 1539 });
  });
  it('lee pantallas con marco pegado a las cifras y ceros a la izquierda', () => {
    const lines = [{ text: '0030,00', h: 60 }, { text: '0016,59', h: 60 }, { text: '01,809', h: 60 }];
    expect(readPumpDisplay(render({ lines, frame: true, noise: 15, blur: 1 })).guess).toMatchObject({ amountCents: 3000, litersMilli: 16590, priceMilli: 1809 });
  });
  it('encuentra una pantalla con marco pequeña dentro de una foto grande', () => {
    const lines = [{ text: '0030,00', h: 34 }, { text: '0016,59', h: 34 }, { text: '01,809', h: 34 }];
    expect(readPumpDisplay(render({ lines, frame: true, big: true, noise: 15, blur: 1 })).guess).toMatchObject({ amountCents: 3000, priceMilli: 1809 });
  });
  it('lee otra combinación de cifras', () => {
    const r = readPumpDisplay(render({ lines: [{ text: '20,00', h: 100 }, { text: '13,08', h: 100 }, { text: '1,529', h: 70 }], noise: 20, blur: 1 }));
    expect(r.guess).toMatchObject({ amountCents: 2000, priceMilli: 1529 });
  });
});
