import { describe, expect, it } from 'vitest';
import { allocateGap, buildLedger, gapAnswerId, gapTrips, mysteryGaps, type GapAnswer, type Refuel, type Trip } from './domain';

// Ana termina en 1000 con foto; nadie apunta nada; Eva coge el coche y su foto marca 1100.
const t = (id: string, driver: string, a: number, b: number): Trip => ({ id, driver, date: a * 1000, start: { km: a, photoId: 'p' }, end: { km: b, photoId: 'p' }, note: '', createdAt: a });
const trips = [t('t1', 'ana', 900, 1000), t('t2', 'eva', 1100, 1200)];
const refuel: Refuel = { id: 'r1', payer: 'eva', date: 1_300_000, amountCents: 3000, priceMilli: 1500, odometerKm: 1200, odometerPhotoId: 'p', receiptPhotoId: 'p', note: '', createdAt: 1 };
const members = ['ana', 'luis', 'pablo', 'eva'];
const ans = (member: string, used: boolean, km = 0, day: string | null = used ? '2026-11-03' : null): GapAnswer => ({ id: gapAnswerId(1000, 1100, member), fromKm: 1000, toKm: 1100, member, used, km, day, createdAt: 0 });
const gapOf = (answers: GapAnswer[]) => mysteryGaps(buildLedger(trips, [refuel], []), answers, members)[0];
const kmOf = (answers: GapAnswer[]) => {
  const g = gapOf(answers);
  const l = buildLedger([...trips, ...(g.resolved ? gapTrips(g) : [])], [refuel], []);
  return Object.fromEntries(l.refuels[0].shares.map((s) => [s.email, s.km]));
};

describe('km misterio', () => {
  it('detecta el hueco entre dos fotos y pregunta a todos', () => {
    const g = gapOf([]);
    expect([g.fromKm, g.toKm, g.km]).toEqual([1000, 1100, 100]);
    expect(g.pending).toEqual(members);
    expect(g.resolved).toBe(false);
  });

  it('mientras falta gente por responder, no se reparte (salvo que lo dicho cuadre justo)', () => {
    expect(gapOf([ans('luis', true, 60)]).resolved).toBe(false);
    expect(gapOf([ans('luis', true, 60), ans('pablo', true, 40)]).resolved).toBe(true); // 60 + 40 = 100
  });

  it('cuadra: cada uno paga sus km', () => {
    const km = kmOf([ans('luis', true, 60), ans('pablo', true, 40)]);
    expect(km.luis).toBe(60);
    expect(km.pablo).toBe(40);
  });

  it('faltan km: la diferencia se reparte a partes iguales entre quienes dijeron que sí', () => {
    // Luis 50 + Pablo 30 = 80 de 100: faltan 20, 10 para cada uno.
    const km = kmOf([ans('luis', true, 50), ans('pablo', true, 30), ans('ana', false), ans('eva', false)]);
    expect(km.luis).toBe(60);
    expect(km.pablo).toBe(40);
    expect(km.ana).toBe(100); // solo su viaje con foto
  });

  it('sobran km: se quitan a partes iguales, sin bajar de 0', () => {
    expect(allocateGap(100, [{ km: 80 }, { km: 40 }]).map((x) => x.km)).toEqual([70, 30]);
    expect(allocateGap(100, [{ km: 150 }, { km: 5 }]).map((x) => x.km)).toEqual([100, 0]);
    expect(allocateGap(10, [{ km: 1 }, { km: 2 }, { km: 3 }]).map((x) => x.km)).toEqual([3, 3, 4]);
  });

  it('todos dicen que no: queda como siempre (se reparte entre todos según sus km)', () => {
    const g = gapOf(members.map((m) => ans(m, false)));
    expect(g.pending).toEqual([]);
    expect(g.resolved).toBe(false);
    const l = buildLedger(trips, [refuel], []);
    expect(l.refuels[0].shares.reduce((a, s) => a + s.cents, 0)).toBe(3000);
  });

  it('los km resueltos llenan el hueco sin dejar huecos ni solapes, y el dinero suma el depósito', () => {
    const g = gapOf([ans('luis', true, 50), ans('pablo', true, 30, '2026-11-02'), ans('ana', false), ans('eva', false)]);
    const ts = gapTrips(g);
    expect(ts[0].start.km).toBe(1000);
    expect(ts[ts.length - 1].end.km).toBe(1100);
    for (let i = 1; i < ts.length; i++) expect(ts[i].start.km).toBe(ts[i - 1].end.km);
    const l = buildLedger([...trips, ...ts], [refuel], []);
    expect(l.issues.some((i) => i.kind === 'gap')).toBe(false);
    expect(l.issues.some((i) => i.kind === 'manual')).toBe(false);
    expect(l.refuels[0].shares.reduce((a, s) => a + s.cents, 0)).toBe(3000);
  });

  it('respuestas de un hueco que ya no existe (o de alguien de fuera) no cuentan', () => {
    const g = gapOf([{ ...ans('luis', true, 60), toKm: 1090 }, ans('intruso', true, 100)]);
    expect(g.answers).toEqual([]);
  });
});
