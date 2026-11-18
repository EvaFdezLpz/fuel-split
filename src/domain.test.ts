import { describe, expect, it } from 'vitest';
import { adjustPaymentId, balanceFor, buildLedger, paymentId, splitCents, type Payment, type Refuel, type Trip } from './domain';

let n = 0;
const trip = (driver: string, s: number, e: number | null, opts: Partial<{ sp: boolean; ep: boolean }> = {}): Trip => ({
  id: `t${++n}`,
  driver,
  date: 1_700_000_000_000 + n * 1000,
  start: { km: s, photoId: opts.sp === false ? null : `ps${n}` },
  end: { km: e, photoId: e == null || opts.ep === false ? null : `pe${n}` },
  note: '',
  createdAt: n,
});
const refuel = (id: string, payer: string, odo: number, cents: number): Refuel => ({
  id,
  payer,
  date: 1_700_000_000_000 + odo,
  amountCents: cents,
  priceMilli: 1500,
  odometerKm: odo,
  odometerPhotoId: 'po',
  receiptPhotoId: 'pr',
  note: '',
  createdAt: odo,
});

describe('splitCents', () => {
  it('reparte sin perder céntimos', () => {
    const m = splitCents(1000, [
      { key: 'a', w: 1 },
      { key: 'b', w: 1 },
      { key: 'c', w: 1 },
    ]);
    expect([...m.values()].reduce((a, b) => a + b, 0)).toBe(1000);
    expect(Math.max(...m.values()) - Math.min(...m.values())).toBeLessThanOrEqual(1);
  });
});

describe('buildLedger', () => {
  it('reparte el repostaje por km del tramo', () => {
    const trips = [trip('ana', 1000, 1100), trip('luis', 1100, 1400)];
    const l = buildLedger(trips, [refuel('r1', 'ana', 1400, 6000)], []);
    const r = l.refuels[0];
    expect(r.shares.find((s) => s.email === 'ana')!.cents).toBe(1500);
    expect(r.shares.find((s) => s.email === 'luis')!.cents).toBe(4500);
    expect(l.debts).toHaveLength(1);
    expect(l.debts[0]).toMatchObject({ debtor: 'luis', creditor: 'ana', cents: 4500, state: 'pending' });
  });

  it('corta los viajes que cruzan un repostaje', () => {
    const trips = [trip('ana', 1000, 1200), trip('luis', 1200, 1300)];
    const l = buildLedger(trips, [refuel('r1', 'luis', 1100, 1000), refuel('r2', 'luis', 1300, 2000)], []);
    expect(l.refuels[0].shares).toEqual([{ email: 'ana', km: 100, cents: 1000 }]);
    const r2 = l.refuels[1].shares;
    expect(r2.find((s) => s.email === 'ana')!.km).toBe(100);
    expect(r2.find((s) => s.email === 'luis')!.km).toBe(100);
  });

  it('infiere el km final que falta a partir del siguiente viaje', () => {
    const trips = [trip('ana', 1000, null), trip('luis', 1080, 1200)];
    const l = buildLedger(trips, [], []);
    expect(l.trips[0].endState).toBe('inferred');
    expect(l.trips[0].endKm).toBe(1080);
    expect(l.trips[0].km).toBe(80);
    expect(l.issues.some((i) => i.kind === 'inferred')).toBe(true);
  });

  it('marca como corroborada una lectura sin foto que coincide con otra con foto', () => {
    const trips = [trip('ana', 1000, 1050), trip('luis', 1050, 1100, { sp: false })];
    const l = buildLedger(trips, [], []);
    expect(l.trips[1].startState).toBe('corroborated');
  });

  it('detecta huecos y solapes', () => {
    const l = buildLedger([trip('ana', 1000, 1050), trip('luis', 1070, 1100), trip('eva', 1090, 1120)], [], []);
    expect(l.issues.find((i) => i.kind === 'gap')?.km).toBe(20);
    expect(l.issues.find((i) => i.kind === 'overlap')?.km).toBe(10);
  });

  it('el viaje en curso queda abierto', () => {
    const l = buildLedger([trip('ana', 1000, null)], [], []);
    expect(l.trips[0].endState).toBe('open');
    expect(l.trips[0].km).toBe(0);
  });

  it('aplica los pagos y calcula saldos', () => {
    const trips = [trip('ana', 1000, 1100), trip('luis', 1100, 1400)];
    const pay: Payment = {
      id: paymentId('r1', 'luis'),
      refuelId: 'r1',
      debtor: 'luis',
      creditor: 'ana',
      amountCents: 4500,
      status: 'sent',
      sentAt: 1,
      confirmedAt: null,
    };
    const l = buildLedger(trips, [refuel('r1', 'ana', 1400, 6000)], [pay]);
    expect(balanceFor(l, 'luis')).toEqual({ owes: 0, awaiting: 4500, owed: 0 });
    expect(balanceFor(l, 'ana')).toEqual({ owes: 0, awaiting: 0, owed: 4500 });
  });

  it('sin viajes en el tramo, el coste se lo queda quien paga', () => {
    const l = buildLedger([], [refuel('r1', 'ana', 1400, 6000)], []);
    expect(l.debts).toHaveLength(0);
  });
});

describe('compensación entre dos personas', () => {
  it('cancela lo que se deben mutuamente y deja solo la diferencia', () => {
    // Tramo 1: Luis conduce 100 km, Ana paga 30 €. Tramo 2: Ana conduce 100 km, Luis paga 20 €.
    const trips = [trip('luis', 1000, 1100), trip('ana', 1100, 1200)];
    const refuels = [refuel('r1', 'ana', 1100, 3000), refuel('r2', 'luis', 1200, 2000)];
    const l = buildLedger(trips, refuels, [], (e) => e);
    const luisDebe = l.debts.find((d) => d.debtor === 'luis')!;
    const anaDebe = l.debts.find((d) => d.debtor === 'ana')!;
    expect(luisDebe).toMatchObject({ cents: 3000, offsetCents: 2000, dueCents: 1000, state: 'pending' });
    expect(anaDebe).toMatchObject({ cents: 2000, offsetCents: 2000, dueCents: 0, state: 'offset' });
    expect(balanceFor(l, 'luis').owes).toBe(1000);
    expect(balanceFor(l, 'ana').owes).toBe(0);
    expect(balanceFor(l, 'ana').owed).toBe(1000);
  });

  it('no compensa una deuda ya pagada entera', () => {
    const trips = [trip('luis', 1000, 1100), trip('ana', 1100, 1200)];
    const refuels = [refuel('r1', 'ana', 1100, 3000), refuel('r2', 'luis', 1200, 2000)];
    const pay: Payment = { id: paymentId('r1', 'luis'), refuelId: 'r1', debtor: 'luis', creditor: 'ana', amountCents: 3000, status: 'confirmed', sentAt: 1, confirmedAt: 2 };
    const l = buildLedger(trips, refuels, [pay], (e) => e);
    expect(l.debts.find((d) => d.debtor === 'ana')).toMatchObject({ dueCents: 2000, state: 'pending' });
    expect(l.debts.find((d) => d.debtor === 'luis')).toMatchObject({ offsetCents: 0, driftCents: 0 });
  });

  it('mantiene el descuento después de pagar la diferencia', () => {
    const trips = [trip('luis', 1000, 1100), trip('ana', 1100, 1200)];
    const refuels = [refuel('r1', 'ana', 1100, 3000), refuel('r2', 'luis', 1200, 2000)];
    const pay: Payment = { id: paymentId('r1', 'luis'), refuelId: 'r1', debtor: 'luis', creditor: 'ana', amountCents: 1000, status: 'sent', sentAt: 1, confirmedAt: null };
    const l = buildLedger(trips, refuels, [pay], (e) => e);
    expect(l.debts.find((d) => d.debtor === 'luis')).toMatchObject({ offsetCents: 2000, dueCents: 1000, driftCents: 0, state: 'sent' });
    expect(l.debts.find((d) => d.debtor === 'ana')).toMatchObject({ state: 'offset' });
  });
});

describe('ajustes cuando un viaje se apunta tarde', () => {
  const trip = (id: string, driver: string, a: number, b: number): Trip => ({ id, driver, date: a, start: { km: a, photoId: 'p' }, end: { km: b, photoId: 'p' }, note: '', createdAt: a });
  const refuel: Refuel = { id: 'r1', payer: 'ana', date: 500, amountCents: 6000, priceMilli: 1500, odometerKm: 400, odometerPhotoId: 'p', receiptPhotoId: 'p', note: '', createdAt: 500 };
  // Ana 100 km, Luis 100 km, y 200 km sin apuntar (se reparten): Luis paga 3000.
  const base = [trip('t1', 'ana', 0, 100), trip('t2', 'luis', 100, 200)];
  const paid: Payment = { id: paymentId('r1', 'luis'), refuelId: 'r1', debtor: 'luis', creditor: 'ana', amountCents: 3000, status: 'confirmed', sentAt: 1, confirmedAt: 2 };

  it('si los km olvidados eran de Ana, Ana devuelve la diferencia a Luis', () => {
    const l = buildLedger([...base, trip('t3', 'ana', 200, 400)], [refuel], [paid]);
    // Ahora: Ana 300 km, Luis 100 km → Luis debía 1500 y pagó 3000.
    const adj = l.debts.filter((d) => d.kind === 'adjust');
    expect(adj).toHaveLength(1);
    expect(adj[0]).toMatchObject({ debtor: 'ana', creditor: 'luis', dueCents: 1500, state: 'pending', seq: 1 });
    expect(balanceFor(l, 'ana').owes).toBe(1500);
    expect(balanceFor(l, 'luis').owed).toBe(1500);
  });

  it('si eran de Luis, Luis completa la diferencia', () => {
    const l = buildLedger([...base, trip('t3', 'luis', 200, 400)], [refuel], [paid]);
    const adj = l.debts.filter((d) => d.kind === 'adjust');
    expect(adj[0]).toMatchObject({ debtor: 'luis', creditor: 'ana', dueCents: 1500 });
  });

  it('un ajuste ya pagado cuadra las cuentas', () => {
    const fix: Payment = { id: adjustPaymentId('r1', 'ana', 'luis', 1), refuelId: 'r1', debtor: 'ana', creditor: 'luis', amountCents: 1500, status: 'confirmed', sentAt: 3, confirmedAt: 4, kind: 'adjust', seq: 1 };
    const l = buildLedger([...base, trip('t3', 'ana', 200, 400)], [refuel], [paid, fix]);
    expect(l.debts.filter((d) => d.kind === 'adjust' && d.state === 'pending')).toHaveLength(0);
    expect(balanceFor(l, 'ana').owes).toBe(0);
  });

  it('quien pagó y ya no tiene km recupera todo', () => {
    const r2: Refuel = { ...refuel, odometerKm: 200, amountCents: 3000 };
    const p2: Payment = { ...paid, amountCents: 1500 };
    // Al corregir, el tramo solo tiene km de Ana.
    const l = buildLedger([trip('t1', 'ana', 0, 200)], [r2], [p2]);
    const adj = l.debts.find((d) => d.kind === 'adjust');
    expect(adj).toMatchObject({ debtor: 'ana', creditor: 'luis', dueCents: 1500 });
  });
});

describe('ajustes: nadie puede inflar lo que dice haber pagado', () => {
  const trip = (id: string, driver: string, a: number, b: number): Trip => ({ id, driver, date: a, start: { km: a, photoId: 'p' }, end: { km: b, photoId: 'p' }, note: '', createdAt: a });
  const refuel: Refuel = { id: 'r1', payer: 'ana', date: 500, amountCents: 6000, priceMilli: 1500, odometerKm: 400, odometerPhotoId: 'p', receiptPhotoId: 'p', note: '', createdAt: 500 };
  const trips = [trip('t1', 'ana', 0, 200), trip('t2', 'luis', 200, 400)]; // Luis debe 3000
  const share = (amount: number, status: Payment['status']): Payment => ({ id: paymentId('r1', 'luis'), refuelId: 'r1', debtor: 'luis', creditor: 'ana', amountCents: amount, status, sentAt: 1, confirmedAt: status === 'confirmed' ? 2 : null });
  const adj = (debtor: string, creditor: string, amount: number, status: Payment['status'], seq = 1): Payment => ({ id: adjustPaymentId('r1', debtor, creditor, seq), refuelId: 'r1', debtor, creditor, amountCents: amount, status, sentAt: 3, confirmedAt: status === 'confirmed' ? 4 : null, kind: 'adjust', seq });

  it('un Bizum sin confirmar por un importe inflado no crea deuda a su favor', () => {
    const l = buildLedger(trips, [refuel], [share(30000, 'sent')]);
    expect(l.debts.filter((d) => d.kind === 'adjust')).toHaveLength(0);
    expect(balanceFor(l, 'ana').owes).toBe(0);
  });

  it('un ajuste inventado sin confirmar no hace que le deban dinero', () => {
    const l = buildLedger(trips, [refuel], [share(3000, 'confirmed'), adj('luis', 'ana', 30000, 'sent')]);
    expect(l.debts.filter((d) => d.kind === 'adjust' && d.state === 'pending')).toHaveLength(0);
    expect(balanceFor(l, 'ana').owes).toBe(0);
  });

  it('un ajuste enviado correcto no se pide dos veces', () => {
    const l = buildLedger([...trips, trip('t3', 'luis', 400, 600)], [{ ...refuel, odometerKm: 600 }], [share(3000, 'confirmed'), adj('luis', 'ana', 1000, 'sent')]);
    // Ahora Luis: 400 de 600 km → 4000; pagó 3000 y ha enviado 1000 de ajuste: no queda nada pendiente.
    expect(l.debts.filter((d) => d.kind === 'adjust' && d.state === 'pending')).toHaveLength(0);
  });
});
