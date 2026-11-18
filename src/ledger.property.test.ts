// Prueba de «las cuentas siempre cuadran»: miles de situaciones aleatorias (huecos, viajes sin km final,
// viajes que cruzan un repostaje, deudas cruzadas, viajes y repostajes apuntados tarde con depósitos ya
// pagados). En cada una se paga todo lo que pide la app, como haría la familia, y al final a nadie le
// puede faltar ni sobrar un céntimo:
//   lo que pagó en la gasolinera − su parte de los km = lo que recibió por Bizum − lo que envió.
import { describe, expect, it } from 'vitest';
import { adjustPaymentId, balanceFor, buildLedger, paymentId, type Payment, type Refuel, type Trip } from './domain';

const PEOPLE = ['ana', 'luis', 'eva', 'mar', 'pablo'];

function rng(seed: number) {
  let s = seed % 2147483647 || 1;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

interface World {
  trips: Trip[];
  refuels: Refuel[];
  payments: Payment[];
}

function makeWorld(seed: number): { world: World; late: { trips: Trip[]; refuels: Refuel[] } } {
  const r = rng(seed);
  const pick = <T>(a: T[]) => a[Math.floor(r() * a.length)];
  const trips: Trip[] = [];
  const refuels: Refuel[] = [];
  const lateTrips: Trip[] = [];
  const lateRefuels: Refuel[] = [];
  let km = 100_000;
  let t = 1_000_000;
  let nextFill = km + 200 + Math.floor(r() * 400);
  const n = 8 + Math.floor(r() * 30);
  for (let i = 0; i < n; i++) {
    const len = 3 + Math.floor(r() * 180);
    const a = km;
    const b = km + len;
    t += 3_600_000 * (1 + Math.floor(r() * 30));
    const roll = r();
    const trip: Trip = {
      id: `t${i}`,
      driver: pick(PEOPLE),
      date: t,
      start: { km: a, photoId: null },
      end: { km: roll < 0.1 ? null : b, photoId: null }, // a veces sin km final (se infiere)
      note: '',
      createdAt: t,
      // A veces van varios juntos y se reparten los km.
      with: r() < 0.2 ? PEOPLE.filter(() => r() < 0.4) : [],
    };
    trip.with = trip.with!.filter((e) => e !== trip.driver);
    if (roll > 0.9) lateTrips.push({ ...trip, id: `late${i}` }); // viaje olvidado: se apunta después
    else trips.push(trip);
    km = b + (r() < 0.15 ? Math.floor(r() * 60) : 0); // a veces huecos sin apuntar
    // Repostajes en mitad de un viaje o entre viajes.
    while (nextFill <= km) {
      const f: Refuel = {
        id: `r${refuels.length + lateRefuels.length}`,
        payer: pick(PEOPLE),
        date: t + 1000,
        amountCents: 1500 + Math.floor(r() * 6000),
        priceMilli: 1400 + Math.floor(r() * 400),
        odometerKm: nextFill,
        odometerPhotoId: null,
        receiptPhotoId: 'p',
        note: '',
        createdAt: t + 1000,
      };
      if (r() < 0.15) lateRefuels.push(f); // repostaje olvidado
      else refuels.push(f);
      nextFill += 150 + Math.floor(r() * 500);
    }
  }
  return { world: { trips, refuels, payments: [] }, late: { trips: lateTrips, refuels: lateRefuels } };
}

/** Todos pagan lo que la app les pide (Bizum enviado y confirmado), hasta que no queda nada pendiente. */
function settle(w: World): number {
  for (let round = 0; round < 12; round++) {
    const l = buildLedger(w.trips, w.refuels, w.payments);
    const pending = l.debts.filter((d) => d.state === 'pending' && d.dueCents > 0);
    if (!pending.length) return round;
    for (const d of pending) {
      const base = { refuelId: d.refuelId, debtor: d.debtor, creditor: d.creditor, amountCents: d.dueCents, status: 'confirmed' as const, sentAt: 1, confirmedAt: 2 };
      w.payments.push(
        d.kind === 'adjust'
          ? { ...base, id: adjustPaymentId(d.refuelId, d.debtor, d.creditor, d.seq!), kind: 'adjust', seq: d.seq }
          : { ...base, id: paymentId(d.refuelId, d.debtor) },
      );
    }
  }
  throw new Error('No se llega a cuadrar después de 12 rondas de pagos');
}

function checkBalanced(w: World) {
  const l = buildLedger(w.trips, w.refuels, w.payments);
  for (const rv of l.refuels) {
    // Cada repostaje se reparte entero, ni un céntimo más ni menos.
    expect(rv.shares.reduce((a, s) => a + s.cents, 0)).toBe(rv.refuel.amountCents);
    for (const s of rv.shares) expect(Number.isInteger(s.cents) && s.cents >= 0).toBe(true);
  }
  for (const p of PEOPLE) {
    const pump = w.refuels.filter((f) => f.payer === p).reduce((a, f) => a + f.amountCents, 0);
    const share = l.refuels.reduce((a, rv) => a + (rv.shares.find((s) => s.email === p)?.cents ?? 0), 0);
    const got = w.payments.filter((x) => x.creditor === p && x.status === 'confirmed').reduce((a, x) => a + x.amountCents, 0);
    const sent = w.payments.filter((x) => x.debtor === p && x.status === 'confirmed').reduce((a, x) => a + x.amountCents, 0);
    expect(pump - share, `cuentas de ${p}`).toBe(got - sent);
    const bal = balanceFor(l, p);
    expect(bal.owes + bal.owed + bal.awaiting, `pendiente de ${p}`).toBe(0);
  }
}

describe('las cuentas siempre cuadran', { timeout: 120_000 }, () => {
  it('pagando todo lo que pide la app, a nadie le falta ni le sobra un céntimo', () => {
    for (let seed = 1; seed <= 1500; seed++) {
      const { world } = makeWorld(seed);
      settle(world);
      checkBalanced(world);
    }
  });

  it('también cuando se apuntan tarde viajes y repostajes de depósitos ya pagados', () => {
    let withLate = 0;
    for (let seed = 1; seed <= 1500; seed++) {
      const { world, late } = makeWorld(seed);
      settle(world);
      if (!late.trips.length && !late.refuels.length) continue;
      withLate++;
      world.trips.push(...late.trips);
      world.refuels.push(...late.refuels);
      settle(world);
      checkBalanced(world);
    }
    expect(withLate).toBeGreaterThan(500);
  });

  it('pagando a medias (unos sí, otros todavía no) y apuntando tarde, al terminar de pagar también cuadra', () => {
    for (let seed = 1; seed <= 800; seed++) {
      const { world, late } = makeWorld(seed);
      // Solo la mitad de los Bizum se pagan antes de que lleguen los olvidos.
      const l = buildLedger(world.trips, world.refuels, world.payments);
      const r = rng(seed * 7);
      for (const d of l.debts)
        if (d.state === 'pending' && d.dueCents > 0 && d.kind === 'share' && r() < 0.5)
          world.payments.push({ id: paymentId(d.refuelId, d.debtor), refuelId: d.refuelId, debtor: d.debtor, creditor: d.creditor, amountCents: d.dueCents, status: 'confirmed', sentAt: 1, confirmedAt: 2 });
      world.trips.push(...late.trips);
      world.refuels.push(...late.refuels);
      settle(world);
      checkBalanced(world);
    }
  });
});
