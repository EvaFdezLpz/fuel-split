import { describe, expect, it } from 'vitest';
import { parsePump, parseReceipt } from './receipt-parse';

describe('parseReceipt', () => {
  it('ticket típico con litros, precio y total', () => {
    const t = `ESTACION DE SERVICIO
SURTIDOR 4  GASOLINA 95
14/11/2026 18:42
LITROS        38,19
PRECIO €/L    1,529
TOTAL         58,40 EUR
BASE IMP.     48,26
IVA 21%       10,14
TARJETA       58,40`;
    const g = parseReceipt(t);
    expect(g.amountCents).toBe(5840);
    expect(g.priceMilli).toBe(1529);
    expect(g.litersMilli).toBe(38190);
    expect(g.confidence).toBe('alta');
    expect(new Date(g.date!).getDate()).toBe(14);
  });

  it('no confunde el IVA ni la base imponible con el total', () => {
    const g = parseReceipt('BASE IMPONIBLE 41,32\nIVA 8,68\nIMPORTE 50,00');
    expect(g.amountCents).toBe(5000);
  });

  it('tolera errores del OCR (O por 0, espacios en la coma)', () => {
    const g = parseReceipt('Litros 32 , 68\nPrecio 1,53O\nTotal 5O,00');
    expect(g.amountCents).toBe(5000);
    expect(g.priceMilli).toBe(1530);
  });

  it('ticket sin precio por litro: solo importe', () => {
    const g = parseReceipt('PREPAGO SURTIDOR 2\nIMPORTE A PAGAR 40,00 EUR');
    expect(g.amountCents).toBe(4000);
    expect(g.priceMilli).toBeNull();
  });

  it('nada legible', () => {
    expect(parseReceipt('gracias por su visita').amountCents).toBeNull();
  });
});

describe('parsePump', () => {
  it('lee importe, litros y precio con comas', () => {
    expect(parsePump('IMPORTE 61,75\nLITROS 40,12\nPRECIO 1,539')).toMatchObject({ amountCents: 6175, litersMilli: 40120, priceMilli: 1539, confidence: 'alta' });
  });
  it('recoloca la coma perdida en el display de siete segmentos', () => {
    expect(parsePump('6175\n4012\n1539')).toMatchObject({ amountCents: 6175, litersMilli: 40120, priceMilli: 1539 });
  });
  it('ignora ruido y cifras sueltas', () => {
    expect(parsePump('SURTIDOR 3  GASOLEO A\n€ 55.20\nL 35.64\n€/L 1.549\n95')).toMatchObject({ amountCents: 5520, priceMilli: 1549 });
  });
});
