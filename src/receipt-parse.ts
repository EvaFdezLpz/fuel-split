// Interpreta el texto reconocido de un ticket de gasolinera español.
// Busca importe total, precio por litro, litros y fecha, y usa la coherencia
// importe ≈ litros × precio para elegir la combinación más fiable.

export interface ReceiptGuess {
  amountCents: number | null;
  priceMilli: number | null;
  litersMilli: number | null;
  date: number | null;
  /** alta = las tres cifras cuadran entre sí; media = importe junto a "TOTAL"/"IMPORTE"; baja = suposición. */
  confidence: 'alta' | 'media' | 'baja';
}

interface Num {
  value: number;
  decimals: number;
  line: number;
}

const AMOUNT_KW = /TOTAL|IMPORTE|A\s*PAGAR|PAGADO|TARJETA|EFECTIVO|VISA|TOTAL\s*EUR/i;
const AMOUNT_BAD = /IVA|I\.V\.A|BASE|IMPONIBLE|CAMBIO|ENTREGADO|DESCUENTO|AHORRO|PUNTOS|CUOTA|%/i;
const PRICE_KW = /PRECIO|P\.?\s*UNIT|PVP|€\s*\/\s*L|EUR\s*\/\s*L|\/\s*L(T|ITRO)?\b|E\/L/i;
const LITERS_KW = /LITROS|LTS|LTRS|LITRES|VOLUMEN|CANTIDAD|\bL\b|\bLT\b/i;

/** Corrige confusiones típicas del OCR dentro de cifras (O→0, espacios alrededor de la coma). */
export function normalize(text: string): string {
  return text
    .replace(/(?<=\d)[oO](?=\d)|(?<=[.,]\d{0,2})[oO]|(?<=\d)[oO](?=[.,]\d)/g, '0')
    .replace(/(\d)\s*([.,])\s*(\d)/g, '$1$2$3');
}

function numbersIn(line: string, idx: number): Num[] {
  const out: Num[] = [];
  for (const m of line.matchAll(/(?<![\d.,])(\d{1,4})[.,](\d{2,3})(?![\d.,]*\d)/g)) {
    out.push({ value: Number(`${m[1]}.${m[2]}`), decimals: m[2].length, line: idx });
  }
  return out;
}

function parseDate(text: string): number | null {
  const m = text.match(/\b(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})\b(?:[^\d]{1,6}(\d{1,2})[:.h](\d{2}))?/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]);
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 2005 || y > 2100) return null;
  const hh = m[4] ? Number(m[4]) : 12;
  const mm = m[5] ? Number(m[5]) : 0;
  if (hh > 23 || mm > 59) return null;
  const t = new Date(y, mo - 1, d, hh, mm).getTime();
  return t > Date.now() + 86_400_000 ? null : t;
}

export function parseReceipt(raw: string): ReceiptGuess {
  const lines = normalize(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const all: Num[] = lines.flatMap((l, i) => numbersIn(l, i));
  const kw = (n: Num, re: RegExp) => re.test(lines[n.line]) || (n.line > 0 && re.test(lines[n.line - 1]) && numbersIn(lines[n.line - 1], 0).length === 0);

  const prices = all
    .filter((n) => n.decimals === 3 && n.value >= 0.5 && n.value <= 4)
    .map((n) => ({ n, score: kw(n, PRICE_KW) ? 3 : 0 }));
  const liters = all
    .filter((n) => n.value >= 1 && n.value <= 80)
    .map((n) => ({ n, score: kw(n, LITERS_KW) ? 3 : 0 }));
  const amounts = all
    .filter((n) => n.decimals === 2 && n.value >= 1 && n.value <= 300)
    .map((n) => ({ n, score: (kw(n, AMOUNT_KW) ? 3 : 0) - (AMOUNT_BAD.test(lines[n.line]) ? 4 : 0) }));

  let best: { a: Num; p: Num | null; l: Num | null; score: number; consistent: boolean } | null = null;
  for (const a of amounts) {
    // Sin precio en el ticket: solo el importe.
    const cands: { p: Num | null; ps: number }[] = [{ p: null, ps: 0 }, ...prices.map((p) => ({ p: p.n, ps: p.score }))];
    for (const { p, ps } of cands) {
      let l: Num | null = null;
      let ls = 0;
      let consistent = false;
      if (p) {
        const expected = a.n.value / p.value;
        if (expected < 1 || expected > 80) continue;
        for (const c of liters) {
          if (c.n === a.n || c.n === p) continue;
          if (Math.abs(c.n.value - expected) <= 0.03 + expected * 0.002) {
            if (!l || c.score > ls) {
              l = c.n;
              ls = c.score;
              consistent = true;
            }
          }
        }
      }
      const score = a.score + ps + ls + (consistent ? 6 : 0) + (p ? 1 : 0) + a.n.value / 1000;
      if (!best || score > best.score) best = { a: a.n, p, l, score, consistent };
    }
  }

  const date = parseDate(lines.join('\n'));
  if (!best) {
    const p = prices.sort((x, y) => y.score - x.score)[0]?.n ?? null;
    return { amountCents: null, priceMilli: p ? Math.round(p.value * 1000) : null, litersMilli: null, date, confidence: 'baja' };
  }
  const amountKw = AMOUNT_KW.test(lines[best.a.line]) || (best.a.line > 0 && AMOUNT_KW.test(lines[best.a.line - 1]));
  return {
    amountCents: Math.round(best.a.value * 100),
    priceMilli: best.p ? Math.round(best.p.value * 1000) : null,
    litersMilli: best.l ? Math.round(best.l.value * 1000) : null,
    date,
    confidence: best.consistent ? 'alta' : amountKw ? 'media' : 'baja',
  };
}

/**
 * Pantalla del surtidor: tres cifras (importe €, litros, precio €/l) que cumplen
 * importe ≈ litros × precio. En los displays de siete segmentos el OCR suele perder
 * la coma, así que se prueban también los números sin decimales con la coma en su sitio
 * habitual (2 decimales en importe y litros, 3 en el precio).
 */
export function parsePump(raw: string): ReceiptGuess {
  const text = normalize(raw);
  const tokens: { variants: { v: number; d: number; guessed: boolean }[]; idx: number }[] = [];
  let idx = 0;
  for (const m of text.matchAll(/\d{1,4}(?:[.,]\d{1,3})?/g)) {
    const t = m[0];
    const v: { v: number; d: number; guessed: boolean }[] = [];
    if (/[.,]/.test(t)) v.push({ v: Number(t.replace(',', '.')), d: t.split(/[.,]/)[1].length, guessed: false });
    else if (t.length >= 3) for (const d of [2, 3]) v.push({ v: Number(t) / 10 ** d, d, guessed: true });
    if (v.length) tokens.push({ variants: v, idx: idx++ });
  }
  let best: { a: number; l: number; p: number; err: number } | null = null;
  for (const A of tokens)
    for (const L of tokens)
      for (const P of tokens) {
        if (A.idx === L.idx || A.idx === P.idx || L.idx === P.idx) continue;
        for (const va of A.variants) {
          const a = va.v;
          if (a < 1 || a > 300) continue;
          for (const vl of L.variants) {
            const l = vl.v;
            if (l < 1 || l > 80) continue;
            for (const vp of P.variants) {
              const p = vp.v;
              if (p < 0.5 || p > 4) continue;
              const err = Math.abs(l * p - a);
              if (err > 0.03 + a * 0.003) continue;
              // Comas recolocadas: se prefiere lo habitual (2 decimales en € y litros, 3 en €/l)
              // y el orden de la pantalla: importe, litros, precio.
              const odd = (x: { d: number; guessed: boolean }, want: number) => (x.guessed && x.d !== want ? 1 : 0);
              const score = err + odd(va, 2) + odd(vl, 2) + odd(vp, 3) + (A.idx < L.idx && L.idx < P.idx ? 0 : 0.001);
              if (!best || score < best.err) best = { a, l, p, err: score };
            }
          }
        }
      }
  if (best)
    return { amountCents: Math.round(best.a * 100), priceMilli: Math.round(best.p * 1000), litersMilli: Math.round(best.l * 100) * 10, date: null, confidence: 'alta' };
  const fallback = parseReceipt(raw);
  return { ...fallback, date: null };
}
