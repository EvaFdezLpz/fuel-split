// Backend en memoria SOLO para desarrollo y capturas (?demo). Los datos son sintéticos.
// Vite lo elimina del build de producción porque solo se importa tras comprobar import.meta.env.DEV.
import type { AuthState, Backend, Evidence, Snapshot } from './backend';
import type { Member, Payment, Refuel, Reservation, Trip } from './domain';
import { adjustPaymentId, buildLedger, paymentId } from './domain';

const DAY = 86_400_000;

export function createDemoBackend(): Backend {
  const members: Member[] = [
    { email: 'marta@demo.test', name: 'Marta', color: 'c1', admin: true },
    { email: 'javier@demo.test', name: 'Javier', color: 'c2', admin: false },
    { email: 'lucia@demo.test', name: 'Lucía', color: 'c3', admin: false },
    { email: 'pablo@demo.test', name: 'Pablo', color: 'c4', admin: false },
    { email: 'carmen@demo.test', name: 'Carmen', color: 'c5', admin: false },
  ];
  const [m, j, l, p, c] = members.map((x) => x.email);
  const now = Date.now();
  let seq = 0;
  const id = () => `demo${String(++seq).padStart(16, '0')}`;
  const trips: Trip[] = [];
  const add = (driver: string, daysAgo: number, s: number, e: number | null, photos: [boolean, boolean] = [true, true]) =>
    trips.push({
      id: id(),
      driver,
      date: now - daysAgo * DAY,
      start: { km: s, photoId: photos[0] ? 'photo' : null },
      end: { km: e, photoId: e != null && photos[1] ? 'photo' : null },
      note: '',
      createdAt: now - daysAgo * DAY,
    });
  const many = new URLSearchParams(location.search).has('mucho');
  // ?demo&mucho: unos dos años de historial antes de los datos de ejemplo, para probar paginaciones y gráficos.
  const histRefuels: { payer: string; daysAgo: number; odo: number; cents: number; price: number }[] = [];
  if (many) {
    let r = 7;
    const rnd = () => ((r = (r * 16807) % 2147483647) / 2147483647);
    const drivers = [m, j, l, p, c];
    const plan: { d: string; day: number; km: number }[] = [];
    for (let day = 760; day > 64; day -= 1 + Math.floor(rnd() * 3)) plan.push({ d: drivers[Math.floor(rnd() * 5)], day, km: 15 + Math.floor(rnd() * 150) });
    let odo = 181_204 - plan.reduce((a, x) => a + x.km, 0);
    let sinceFuel = 0;
    for (const x of plan) {
      add(x.d, x.day, odo, odo + x.km, [rnd() > 0.05, rnd() > 0.08]);
      odo += x.km;
      sinceFuel += x.km;
      if (sinceFuel > 380 + rnd() * 120) {
        const price = 1450 + Math.floor(rnd() * 250);
        histRefuels.push({ payer: drivers[Math.floor(rnd() * 5)], daysAgo: x.day - 0.2, odo, cents: Math.round((sinceFuel / 100) * 6.2 * price / 10), price });
        sinceFuel = 0;
      }
    }
  }
  add(m, 62, 181_204, 181_262);
  add(j, 60, 181_262, 181_418);
  add(l, 57, 181_418, 181_430); // hueco de 17 km sin apuntar (lo hizo Marta y se le olvidó)
  add(m, 55, 181_447, 181_530);
  add(c, 51, 181_530, 181_702);
  add(p, 48, 181_702, 181_744, [true, false]);
  add(j, 44, 181_744, 181_906);
  add(m, 40, 181_906, 181_951);
  add(l, 36, 181_951, 182_013);
  add(j, 31, 182_013, 182_187);
  add(c, 27, 182_187, 182_240);
  add(m, 22, 182_240, null);
  add(p, 20, 182_311, 182_356, [false, true]);
  add(l, 15, 182_356, 182_430);
  trips[trips.length - 1].with = [m, p]; // viaje juntos: los 74 km se reparten entre los tres
  add(j, 11, 182_430, 182_598);
  add(m, 7, 182_612, 182_665);
  add(c, 4, 182_665, 182_731);
  add(j, 1, 182_731, null);

  const refuels: Refuel[] = [];
  const fuel = (payer: string, daysAgo: number, odo: number, cents: number, price: number) =>
    refuels.push({
      id: id(),
      payer,
      date: now - daysAgo * DAY,
      amountCents: cents,
      priceMilli: price,
      odometerKm: odo,
      odometerPhotoId: 'photo',
      receiptPhotoId: 'photo',
      note: '',
      createdAt: now - daysAgo * DAY,
    });
  for (const f of histRefuels) fuel(f.payer, f.daysAgo, f.odo, f.cents, f.price);
  fuel(j, 44, 181_744, 6050, 1589);
  fuel(m, 31, 182_013, 5520, 1549);
  fuel(c, 11, 182_430, 6175, 1539);

  const payments: Payment[] = [];
  const pay = (refuel: Refuel, debtor: string, cents: number, status: Payment['status']) =>
    payments.push({
      id: paymentId(refuel.id, debtor),
      refuelId: refuel.id,
      debtor,
      creditor: refuel.payer,
      amountCents: cents,
      status,
      sentAt: refuel.date + 2 * DAY,
      confirmedAt: status === 'confirmed' ? refuel.date + 3 * DAY : null,
    });
  // Algunos pagos ya hechos para que haya de todo.
  // Importes según el reparto del momento: si luego alguien apunta un viaje olvidado, aparecen los ajustes.
  const nHist = histRefuels.length;
  const before = buildLedger(trips, refuels, []);
  const cents = (r: Refuel, who: string) => before.debts.find((d) => d.refuelId === r.id && d.debtor === who)?.cents ?? 0;
  for (const [ri, who, status] of [[0, m, 'confirmed'], [0, l, 'confirmed'], [0, c, 'confirmed'], [0, p, 'sent'], [1, j, 'confirmed']] as const) {
    const r = refuels[nHist + ri];
    pay(r, who, cents(r, who), status);
  }

  // En el historial largo, las deudas antiguas ya están pagadas y confirmadas.
  if (many) {
    const old = new Set(refuels.slice(0, histRefuels.length).map((x) => x.id));
    const ledger = buildLedger(trips, refuels, []);
    for (const d of ledger.debts) {
      const rf = refuels.find((x) => x.id === d.refuelId)!;
      if (old.has(d.refuelId) && d.cents > 0) pay(rf, d.debtor, d.cents, 'confirmed');
    }
  }

  // Reservas de ejemplo: unos días por delante (y una pasada).
  const iso = (daysAhead: number) => {
    const d = new Date(now + daysAhead * DAY);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const reservations: Reservation[] = [
    ...(many
      ? Array.from({ length: 40 }, (_, i) => {
          const who = [m, j, l, p, c][i % 5];
          const ago = -(14 + i * 9);
          return { id: id(), member: who, day: iso(ago), endDay: iso(ago + (i % 4 === 0 ? 2 : 0)), note: ['Médico', 'Compra grande', 'Visita a la familia', 'Excursión', 'Llevar cosas al trastero'][i % 5], createdAt: now + ago * DAY - DAY };
        })
      : []),
    ...(many
      ? Array.from({ length: 12 }, (_, i) => ({ id: id(), member: [j, l, p, c, m][i % 5], day: iso(11 + i * 3), endDay: iso(11 + i * 3), note: 'Reserva de prueba', createdAt: now - DAY }))
      : []),
    { id: id(), member: l, day: iso(2), endDay: iso(2), note: 'Médico en el hospital comarcal por la mañana', createdAt: now - 2 * DAY },
    { id: id(), member: j, day: iso(5), endDay: iso(7), note: 'Fin de semana en el pueblo', createdAt: now - DAY },
    { id: id(), member: m, day: iso(9), endDay: iso(9), note: 'Llevar muebles al trastero', createdAt: now - 3 * DAY },
    { id: id(), member: c, day: iso(-4), endDay: iso(-4), note: 'Compra grande', createdAt: now - 9 * DAY },
    { id: id(), member: l, day: iso(-11), endDay: iso(-11), note: 'Llevar a la abuela al centro de salud', createdAt: now - 14 * DAY },
  ];

  const params = new URLSearchParams(location.search);
  const who = members.find((x) => x.name.toLowerCase() === (params.get('como') ?? '').toLowerCase()) ?? members[0];
  let authCb: (s: AuthState) => void = () => {};
  const listeners = new Set<(s: Snapshot) => void>();
  const emit = () => listeners.forEach((cb) => cb({ members, trips: [...trips], refuels: [...refuels], payments: [...payments], reservations: [...reservations] }));
  const evidence = new Map<string, Evidence>();

  return {
    onAuth(cb) {
      authCb = cb;
      if (params.has('salir')) cb({ status: 'signed-out' });
      else cb({ status: 'ready', user: { email: who.email, displayName: who.name }, member: who });
    },
    async signIn() {
      authCb({ status: 'ready', user: { email: who.email, displayName: who.name }, member: who });
    },
    async signOut() {
      authCb({ status: 'signed-out' });
    },
    subscribe(cb) {
      listeners.add(cb);
      queueMicrotask(emit);
      return () => listeners.delete(cb);
    },
    async addTrip(i) {
      trips.push({ id: id(), driver: who.email, date: i.date, start: { km: i.startKm, photoId: i.startPhotoId }, end: { km: i.endKm, photoId: i.endPhotoId }, note: i.note, createdAt: Date.now(), with: i.with ?? [], addedBy: null, confirmed: [] });
      emit();
    },
    async addTripFor(driver, i) {
      trips.push({ id: id(), driver, date: i.date, start: { km: i.startKm, photoId: null }, end: { km: i.endKm, photoId: null }, note: i.note, createdAt: Date.now(), with: i.with ?? [], addedBy: who.email, confirmed: [] });
      emit();
    },
    async confirmTrip(tid) {
      const t = trips.find((x) => x.id === tid);
      if (t) t.confirmed = [...new Set([...(t.confirmed ?? []), who.email])];
      emit();
    },
    async leaveTrip(tid) {
      const t = trips.find((x) => x.id === tid);
      if (t) t.with = (t.with ?? []).filter((e) => e !== who.email);
      emit();
    },
    async updateTrip(tid, i) {
      const t = trips.find((x) => x.id === tid);
      if (t) Object.assign(t, { date: i.date, start: { km: i.startKm, photoId: i.startPhotoId }, end: { km: i.endKm, photoId: i.endPhotoId }, note: i.note, ...(i.with ? { with: i.with } : {}) });
      emit();
    },
    async deleteTrip(tid) {
      trips.splice(trips.findIndex((x) => x.id === tid), 1);
      emit();
    },
    async addRefuel(i) {
      refuels.push({ id: id(), payer: who.email, createdAt: Date.now(), ...i });
      emit();
    },
    async deleteRefuel(rid) {
      refuels.splice(refuels.findIndex((x) => x.id === rid), 1);
      emit();
    },
    async markSent(refuelId, creditor, amountCents) {
      payments.push({ id: paymentId(refuelId, who.email), refuelId, debtor: who.email, creditor, amountCents, status: 'sent', sentAt: Date.now(), confirmedAt: null });
      emit();
    },
    async sendAdjustment(refuelId, creditor, amountCents, seq) {
      payments.push({ id: adjustPaymentId(refuelId, who.email, creditor, seq), refuelId, debtor: who.email, creditor, amountCents, status: 'sent', sentAt: Date.now(), confirmedAt: null, kind: 'adjust', seq });
      emit();
    },
    async undoSent(pid) {
      payments.splice(payments.findIndex((x) => x.id === pid), 1);
      emit();
    },
    async confirmPayment(pid) {
      const x = payments.find((y) => y.id === pid);
      if (x) Object.assign(x, { status: 'confirmed', confirmedAt: Date.now() });
      emit();
    },
    async addReservation(i) {
      reservations.push({ id: id(), member: who.email, createdAt: Date.now(), ...i });
      emit();
    },
    async updateReservation(rid, i) {
      const r = reservations.find((x) => x.id === rid && x.member === who.email);
      if (r) Object.assign(r, i);
      emit();
    },
    async deleteReservation(rid) {
      const k = reservations.findIndex((x) => x.id === rid && x.member === who.email);
      if (k >= 0) reservations.splice(k, 1);
      emit();
    },
    async addEvidence(kind, data) {
      const eid = id();
      evidence.set(eid, { id: eid, owner: who.email, kind, data, createdAt: Date.now() });
      return eid;
    },
    async getEvidence(eid) {
      return evidence.get(eid) ?? null;
    },
  };
}
