// Display de siete segmentos en SVG, como los tótems de precios de las gasolineras.
// Los segmentos apagados se dibujan tenues: así se lee como un panel real y las cifras no bailan.
import { s } from './dom';

const T = 2.3;
const G = 0.4;
const W = 12;

function hseg(yc: number): string {
  const x1 = 1.15 + G;
  const x2 = W - 1.15 - G;
  const t = T / 2;
  return `${x1},${yc} ${x1 + t},${yc - t} ${x2 - t},${yc - t} ${x2},${yc} ${x2 - t},${yc + t} ${x1 + t},${yc + t}`;
}
function vseg(xc: number, y1: number, y2: number): string {
  const t = T / 2;
  return `${xc},${y1} ${xc + t},${y1 + t} ${xc + t},${y2 - t} ${xc},${y2} ${xc - t},${y2 - t} ${xc - t},${y1 + t}`;
}

const SEG: Record<string, string> = {
  a: hseg(1.15),
  g: hseg(10),
  d: hseg(18.85),
  f: vseg(1.15, 1.15 + G, 10 - G),
  b: vseg(W - 1.15, 1.15 + G, 10 - G),
  e: vseg(1.15, 10 + G, 18.85 - G),
  c: vseg(W - 1.15, 10 + G, 18.85 - G),
};

const DIGITS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abged',
  '3': 'abgcd',
  '4': 'fgbc',
  '5': 'afgcd',
  '6': 'afgedc',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
  ' ': '',
};

export interface SegOptions {
  /** Rellena por la izquierda con dígitos apagados hasta este número de cifras. */
  minDigits?: number;
  label: string;
  tone?: 'led' | 'ok' | 'bad' | 'dim';
}

export function segmentDisplay(text: string, opts: SegOptions): SVGElement {
  const digitsIn = text.replace(/[^0-9]/g, '').length;
  const pad = Math.max(0, (opts.minDigits ?? 0) - digitsIn);
  const chars = '\u0000'.repeat(pad) + text;
  const parts: SVGElement[] = [];
  let x = 0;
  for (const ch of chars) {
    if (ch === '.' || ch === ',') {
      const r = s('rect', { x: x - 1.2, y: 17.3, width: 2.4, height: 2.4, rx: 0.4, class: 'on' });
      parts.push(r);
      x += 2.6;
      continue;
    }
    const lit = ch === '\u0000' ? '' : DIGITS[ch] ?? '';
    const g = s('g', { transform: `translate(${x} 0) skewX(-5)` });
    for (const [name, pts] of Object.entries(SEG)) {
      g.append(s('polygon', { points: pts, class: lit.includes(name) ? 'on' : 'off' }));
    }
    parts.push(g);
    x += W + 2.4;
  }
  const width = Math.max(1, x - 1.4);
  return s(
    'svg',
    {
      class: `seg seg-${opts.tone ?? 'led'}`,
      viewBox: `-0.5 -0.5 ${width + 1.5} 21`,
      role: 'img',
      'aria-label': opts.label,
      focusable: 'false',
      width: `${((width + 1.5) / 21).toFixed(3)}em`,
      height: '1em',
    },
    parts,
  );
}
