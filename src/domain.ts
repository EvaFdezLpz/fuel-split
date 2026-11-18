// Lógica pura de negocio: lecturas del cuentakilómetros, evidencias, tramos y repartos.
// Sin dependencias de Firebase ni del DOM, para poder probarla de forma aislada.

export type ColorKey = 'c1' | 'c2' | 'c3' | 'c4' | 'c5';

export interface Member {
  email: string;
  name: string;
  color: ColorKey;
  admin: boolean;
}

export interface Reading {
  km: number | null;
  photoId: string | null;
}

export interface Trip {
  id: string;
  driver: string;
  date: number;
  start: Reading;
  end: Reading;
  note: string;
  createdAt: number;
  /** Viaje compartido: los demás que iban. Los km se reparten a partes iguales entre todos. */
  with?: string[];
  /** Si lo apuntó otra persona (km que se quedaron sin apuntar): quién. */
  addedBy?: string | null;
  /** Quiénes de los que no lo apuntaron han confirmado que es correcto. */
  confirmed?: string[];
  /** Fecha y hora de llegada (si se apuntó al terminar). `date` es la de salida. */
  endDate?: number | null;
  /** 'survey': no es un viaje guardado, sale de las respuestas a unos km misterio. */
  source?: 'survey';
}

/** Quienes hicieron un viaje (conductor y acompañantes), sin repetir. */
export function riders(t: Trip): string[] {
  return [...new Set([t.driver, ...(t.with ?? [])])];
}

/** Personas que tienen que confirmar un viaje porque lo apuntó otro o las añadió como acompañantes. */
export function needsConfirmation(t: Trip, email: string): boolean {
  const ok = t.confirmed ?? [];
  if (ok.includes(email) || t.addedBy === email) return false;
  if ((t.with ?? []).includes(email)) return true;
  return t.driver === email && !!t.addedBy && t.addedBy !== email;
}

export interface Refuel {
  id: string;
  payer: string;
  date: number;
  amountCents: number;
  /** Precio por litro en milésimas de euro (1,539 €/l -> 1539). */
  priceMilli: number;
  odometerKm: number;
  odometerPhotoId: string | null;
  receiptPhotoId: string;
  note: string;
  createdAt: number;
}

export type PaymentStatus = 'sent' | 'confirmed';

export interface Payment {
  id: string;
  refuelId: string;
  debtor: string;
  creditor: string;
  amountCents: number;
  status: PaymentStatus;
  sentAt: number;
  confirmedAt: number | null;
  /**
   * 'adjust' = Bizum de ajuste: un reparto ya pagado cambió (alguien añadió tarde un viaje o un repostaje)
   * y hay que completar la diferencia o devolverla. `seq` numera los ajustes de un mismo repostaje.
   */
  kind?: 'adjust';
  seq?: number;
}

/** Reserva del coche: alguien avisa de que lo necesita esos días. Días en formato 'YYYY-MM-DD' (hora local). */
export interface Reservation {
  id: string;
  member: string;
  day: string;
  endDay: string;
  note: string;
  createdAt: number;
}

export const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Cómo de respaldada está una lectura concreta. */
export type EvidenceState =
  | 'photo' // tiene foto propia
  | 'corroborated' // sin foto, pero otra lectura con foto da el mismo km
  | 'manual' // escrita a mano, sin respaldo
  | 'inferred' // no existe: se deduce del siguiente registro
  | 'open'; // viaje en curso, aún sin final

export interface TripView {
  trip: Trip;
  code: string;
  startState: EvidenceState;
  endState: EvidenceState;
  endKm: number | null; // efectivo (real o inferido)
  km: number;
  refuelId: string | null; // tramo al que pertenece (repostaje que lo cierra), null = tramo en curso
}

export type IssueKind = 'gap' | 'overlap' | 'inferred' | 'manual' | 'unassigned';

export interface Issue {
  kind: IssueKind;
  message: string;
  tripIds: string[];
  km?: number;
  who?: string;
}

export interface Share {
  email: string;
  km: number;
  cents: number;
}

/** offset = no hace falta Bizum: lo compensa un depósito que llenó el deudor y en el que el acreedor debe su parte. */
export type DebtState = 'pending' | 'sent' | 'confirmed' | 'offset';

export interface Debt {
  /** 'share' = su parte del repostaje; 'adjust' = diferencia de un reparto ya pagado que ha cambiado. */
  kind: 'share' | 'adjust';
  /** Solo en ajustes: número de ajuste dentro del repostaje (forma parte del id del Bizum). */
  seq?: number;
  paymentId: string;
  refuelId: string;
  debtor: string;
  creditor: string;
  cents: number;
  state: DebtState;
  payment: Payment | null;
  /** Diferencia entre lo pagado y lo que corresponde ahora (si se corrigieron km). */
  driftCents: number;
  /** Parte de la deuda que se cancela con deudas en sentido contrario entre las mismas dos personas. */
  offsetCents: number;
  /** Lo que queda por pagar por Bizum: cents − offsetCents. */
  dueCents: number;
  /** Repostajes (en sentido contrario) que compensan esta deuda. */
  offsetWith: string[];
}

export interface RefuelView {
  refuel: Refuel;
  code: string;
  fromKm: number;
  toKm: number;
  litersMilli: number;
  shares: Share[];
  assignedKm: number;
  unassignedKm: number;
  debts: Debt[];
}

export interface Ledger {
  trips: TripView[];
  refuels: RefuelView[];
  issues: Issue[];
  debts: Debt[];
  currentKm: number | null;
  openTramo: { fromKm: number; toKm: number; shares: Share[]; estCentsPerKm: number | null };
}

export const MAX_KM = 2_000_000;
export const MAX_TRIP_KM = 3_000;

/**
 * Viaje en curso de una persona que un repostaje a `km` parte en dos: empezó antes de ese km
 * (y no tan lejos como para ser un error). Al repostar se termina ahí y empieza otro desde ese km.
 */
export function openTripAt(trips: Trip[], email: string, km: number): Trip | null {
  // Solo cuenta si de verdad sigue abierto: si hay un viaje posterior, su final ya se toma del inicio de ese.
  const later = (t: Trip) => trips.some((x) => x.id !== t.id && x.start.km != null && x.start.km > t.start.km!);
  const open = trips.filter((t) => t.driver === email && t.end.km == null && t.start.km != null && t.start.km < km && km - t.start.km <= MAX_TRIP_KM && !later(t));
  // Si hubiera más de uno (no debería), el más reciente por km.
  return open.sort((a, b) => b.start.km! - a.start.km!)[0] ?? null;
}

/** Los viajes tal como quedan al partir el viaje en curso en el km del repostaje (para la vista previa). */
export function splitTripsAt(trips: Trip[], open: Trip, km: number, date: number): Trip[] {
  return [
    ...trips.filter((t) => t.id !== open.id),
    { ...open, end: { km, photoId: null } },
    { ...open, id: `${open.id}__sigue`, date, start: { km, photoId: null }, end: { km: null, photoId: null }, confirmed: [] },
  ];
}
export const TANK_LITERS = 47; // Citroën C3 (2005)

export function paymentId(refuelId: string, debtor: string): string {
  return `${refuelId}__${debtor}`;
}

/** Id del Bizum de ajuste: repostaje, quién paga, a quién y número de ajuste. */
export function adjustPaymentId(refuelId: string, debtor: string, creditor: string, seq: number): string {
  return `${refuelId}__${debtor}__${creditor}__a${seq}`;
}

function shortDay(ms: number): string {
  return new Date(ms).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, '0');
}

/** Reparte `total` céntimos según pesos enteros con el método del mayor resto. */
export function splitCents(total: number, weights: { key: string; w: number }[]): Map<string, number> {
  const out = new Map<string, number>();
  const sum = weights.reduce((a, b) => a + b.w, 0);
  if (sum <= 0) return out;
  let assigned = 0;
  const rema: { key: string; r: number; w: number }[] = [];
  for (const { key, w } of weights) {
    const exact = (total * w) / sum;
    const base = Math.floor(exact);
    out.set(key, base);
    assigned += base;
    rema.push({ key, r: exact - base, w });
  }
  rema.sort((a, b) => b.r - a.r || b.w - a.w || a.key.localeCompare(b.key));
  for (let i = 0; i < total - assigned; i++) {
    const k = rema[i % rema.length].key;
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

function overlap(a1: number, a2: number, b1: number, b2: number): number {
  return Math.max(0, Math.min(a2, b2) - Math.max(a1, b1));
}

export function buildLedger(
  tripsIn: Trip[],
  refuelsIn: Refuel[],
  payments: Payment[],
  nameOf: (email: string) => string = (e) => e,
): Ledger {
  const trips = [...tripsIn].sort(
    (a, b) => (a.start.km ?? 0) - (b.start.km ?? 0) || a.date - b.date || a.createdAt - b.createdAt,
  );
  const refuels = [...refuelsIn].sort((a, b) => a.odometerKm - b.odometerKm || a.date - b.date);
  const issues: Issue[] = [];

  // Km respaldados por foto en cualquier parte (viajes y repostajes).
  const photoKm = new Set<number>();
  for (const t of trips) {
    if (t.start.photoId && t.start.km != null) photoKm.add(t.start.km);
    if (t.end.photoId && t.end.km != null) photoKm.add(t.end.km);
  }
  for (const r of refuels) if (r.odometerPhotoId) photoKm.add(r.odometerKm);

  // Solo hay un coche: un viaje sin km final termina donde empieza el viaje siguiente.
  const views: TripView[] = trips.map((trip, i) => {
    // Nombre legible: «viaje de Marta del 5 nov». Sustituye a los códigos V-0001.
    const code = `viaje de ${nameOf(trip.driver)} del ${shortDay(trip.date)}`;
    const next = trips[i + 1];
    const s = trip.start;
    const startState: EvidenceState = s.photoId ? 'photo' : s.km != null && photoKm.has(s.km) ? 'corroborated' : 'manual';
    let endState: EvidenceState;
    let endKm: number | null = trip.end.km;
    if (trip.end.km != null) {
      endState = trip.end.photoId ? 'photo' : photoKm.has(trip.end.km) ? 'corroborated' : 'manual';
    } else if (next && next.start.km != null && s.km != null && next.start.km >= s.km) {
      endState = 'inferred';
      endKm = next.start.km;
    } else {
      endState = 'open';
    }
    const km = endKm != null && s.km != null ? Math.max(0, endKm - s.km) : 0;
    return { trip, code, startState, endState, endKm, km, refuelId: null };
  });

  // Coherencia entre viajes consecutivos y evidencias que faltan.
  for (let i = 0; i < views.length; i++) {
    const v = views[i];
    const who = nameOf(v.trip.driver);
    if (v.endState === 'inferred') {
      issues.push({
        kind: 'inferred',
        message: `En el ${v.code} no se apuntó el km final. Se toma ${fmtKm(v.endKm!)}, donde empezó el ${views[i + 1].code}.`,
        tripIds: [v.trip.id, views[i + 1].trip.id],
        who: v.trip.driver,
      });
    }
    if (v.trip.source !== 'survey' && (v.startState === 'manual' || v.endState === 'manual')) {
      const which = v.startState === 'manual' && v.endState === 'manual' ? 'inicio y final' : v.startState === 'manual' ? 'inicio' : 'final';
      issues.push({
        kind: 'manual',
        message: `Falta la foto del km de ${which} en el ${v.code}.`,
        tripIds: [v.trip.id],
        who: v.trip.driver,
      });
    }
    const next = views[i + 1];
    if (next && v.endKm != null && next.trip.start.km != null && v.endState !== 'inferred') {
      const diff = next.trip.start.km - v.endKm;
      if (diff > 0) {
        issues.push({
          kind: 'gap',
          message: `${fmtKm(diff)} sin apuntar entre el ${v.code} (acabó en ${fmtKm(v.endKm)}) y el ${next.code} (empezó en ${fmtKm(next.trip.start.km)}).`,
          tripIds: [v.trip.id, next.trip.id],
          km: diff,
        });
      } else if (diff < 0) {
        issues.push({
          kind: 'overlap',
          message: `El ${next.code} empieza en ${fmtKm(next.trip.start.km)}, antes de que acabe el ${v.code} (${fmtKm(v.endKm)}). Revisad las lecturas.`,
          tripIds: [v.trip.id, next.trip.id],
          km: -diff,
        });
      }
    }
  }

  // Tramos: cada repostaje paga los km hechos desde el repostaje anterior.
  const firstKm = trips.length ? Math.min(...trips.map((t) => t.start.km ?? Infinity)) : null;
  const byRefuel = new Map<string, Payment>();
  const adjustsByRefuel = new Map<string, Payment[]>();
  for (const p of payments) {
    if (p.kind === 'adjust') {
      if (!adjustsByRefuel.has(p.refuelId)) adjustsByRefuel.set(p.refuelId, []);
      adjustsByRefuel.get(p.refuelId)!.push(p);
    } else byRefuel.set(p.id, p);
  }

  const refuelViews: RefuelView[] = [];
  const allDebts: Debt[] = [];
  let prevKm: number | null = null;
  refuels.forEach((refuel, i) => {
    const fromKm = prevKm ?? Math.min(firstKm ?? refuel.odometerKm, refuel.odometerKm);
    const toKm = refuel.odometerKm;
    const perDriver = new Map<string, number>();
    for (const v of views) {
      if (v.trip.start.km == null || v.endKm == null) continue;
      const o = overlap(v.trip.start.km, v.endKm, fromKm, toKm);
      if (o > 0) {
        // Viaje compartido: cada uno paga la misma parte de esos km.
        const people = riders(v.trip);
        for (const p of people) perDriver.set(p, (perDriver.get(p) ?? 0) + o / people.length);
      }
      if (v.refuelId == null && v.trip.start.km >= fromKm && v.trip.start.km < toKm) v.refuelId = refuel.id;
    }
    const assignedKm = [...perDriver.values()].reduce((a, b) => a + b, 0);
    const unassignedKm = Math.max(0, toKm - fromKm - assignedKm);
    const weights = [...perDriver.entries()].map(([key, w]) => ({ key, w }));
    let centsMap: Map<string, number>;
    if (assignedKm > 0) centsMap = splitCents(refuel.amountCents, weights);
    else centsMap = new Map([[refuel.payer, refuel.amountCents]]);
    const emails = new Set([...perDriver.keys(), ...centsMap.keys()]);
    const shares: Share[] = [...emails]
      .map((email) => ({ email, km: perDriver.get(email) ?? 0, cents: centsMap.get(email) ?? 0 }))
      .sort((a, b) => b.km - a.km || a.email.localeCompare(b.email));
    const code = `R-${pad(i + 1, 3)}`;
    if (unassignedKm > 0) {
      issues.push({
        kind: 'unassigned',
        message: `${code}: ${fmtKm(unassignedKm)} del tramo no tienen viaje asignado; se reparten entre los km registrados.`,
        tripIds: [],
        km: unassignedKm,
      });
    }
    const owing = shares.filter((s) => s.email !== refuel.payer && s.cents > 0).map((s) => ({ email: s.email, cents: s.cents }));
    for (const p of payments) {
      if (p.kind !== 'adjust' && p.refuelId === refuel.id && p.debtor !== refuel.payer && !owing.some((o) => o.email === p.debtor)) owing.push({ email: p.debtor, cents: 0 });
    }
    const debts: Debt[] = owing
      .map((s) => {
        const id = paymentId(refuel.id, s.email);
        const p = byRefuel.get(id) ?? null;
        const state: DebtState = p ? p.status : 'pending';
        return {
          kind: 'share' as const,
          paymentId: id,
          refuelId: refuel.id,
          debtor: s.email,
          creditor: refuel.payer,
          cents: s.cents,
          state,
          payment: p,
          driftCents: p ? s.cents - p.amountCents : 0,
          offsetCents: 0,
          dueCents: s.cents,
          offsetWith: [],
        };
      });
    allDebts.push(...debts);
    refuelViews.push({
      refuel,
      code,
      fromKm,
      toKm,
      litersMilli: refuel.priceMilli > 0 ? Math.round((refuel.amountCents * 10_000) / refuel.priceMilli) : 0,
      shares,
      assignedKm,
      unassignedKm,
      debts,
    });
    prevKm = toKm;
  });

  compensate(allDebts, refuels);
  allDebts.push(...adjustments(allDebts, refuels, adjustsByRefuel));

  // Tramo en curso: km desde el último repostaje.
  const lastRefuel = refuels[refuels.length - 1];
  const tramoFrom = lastRefuel ? lastRefuel.odometerKm : firstKm ?? 0;
  let currentKm: number | null = lastRefuel ? lastRefuel.odometerKm : null;
  const openPer = new Map<string, number>();
  for (const v of views) {
    const top = v.endKm ?? v.trip.start.km;
    if (top != null && (currentKm == null || top > currentKm)) currentKm = top;
    if (v.trip.start.km == null || v.endKm == null) continue;
    const o = overlap(v.trip.start.km, v.endKm, tramoFrom, Infinity);
    if (o > 0) {
      const people = riders(v.trip);
      for (const p of people) openPer.set(p, (openPer.get(p) ?? 0) + o / people.length);
    }
  }
  const lastView = refuelViews[refuelViews.length - 1];
  const estCentsPerKm =
    lastView && lastView.toKm > lastView.fromKm ? lastView.refuel.amountCents / (lastView.toKm - lastView.fromKm) : null;
  const openShares = [...openPer.entries()]
    .map(([email, km]) => ({ email, km, cents: estCentsPerKm ? Math.round(km * estCentsPerKm) : 0 }))
    .sort((a, b) => b.km - a.km);

  return {
    trips: views,
    refuels: refuelViews,
    issues,
    debts: allDebts,
    currentKm,
    openTramo: { fromKm: tramoFrom, toKm: currentKm ?? tramoFrom, shares: openShares, estCentsPerKm },
  };
}

/** Último km conocido con su origen, para sugerirlo al empezar un viaje. */
export function lastKnownReading(ledger: Ledger): { km: number; code: string; driver: string | null; withPhoto: boolean } | null {
  let best: { km: number; code: string; driver: string | null; withPhoto: boolean } | null = null;
  for (const v of ledger.trips) {
    const km = v.trip.end.km ?? v.trip.start.km;
    if (km == null) continue;
    const withPhoto = v.trip.end.km != null ? !!v.trip.end.photoId : !!v.trip.start.photoId;
    if (!best || km > best.km) best = { km, code: v.code, driver: v.trip.driver, withPhoto };
  }
  for (const r of ledger.refuels) {
    if (!best || r.toKm > best.km) best = { km: r.toKm, code: `depósito del ${shortDay(r.refuel.date)}`, driver: r.refuel.payer, withPhoto: !!r.refuel.odometerPhotoId };
  }
  return best;
}

export interface Balance {
  owes: number; // pendiente de pagar (sin Bizum)
  awaiting: number; // Bizum enviado, falta que lo confirmen
  owed: number; // le deben y no lo han confirmado
}

export function balanceFor(ledger: Ledger, email: string): Balance {
  let owes = 0;
  let awaiting = 0;
  let owed = 0;
  for (const d of ledger.debts) {
    if (d.debtor === email) {
      if (d.state === 'pending') owes += d.dueCents;
      else if (d.state === 'sent') awaiting += d.payment?.amountCents ?? d.dueCents;
    }
    if (d.creditor === email) {
      if (d.state === 'pending') owed += d.dueCents;
      else if (d.state === 'sent') owed += d.payment?.amountCents ?? d.dueCents;
    }
  }
  return { owes, awaiting, owed };
}

/**
 * Ajustes de repartos ya pagados. Si después de pagar un Bizum cambia la parte de alguien
 * (un viaje o un repostaje apuntado tarde, una lectura corregida), la diferencia no se pierde:
 *  - si ahora le toca más, debe la diferencia a quien llenó el depósito;
 *  - si ahora le toca menos, quien llenó el depósito le devuelve la diferencia.
 * Los ajustes ya enviados cuentan; el que queda pendiente es lo que falta para cuadrar.
 */
function adjustments(debts: Debt[], refuels: Refuel[], adjustsByRefuel: Map<string, Payment[]>): Debt[] {
  const out: Debt[] = [];
  const payerOf = new Map(refuels.map((r) => [r.id, r.payer]));
  for (const d of debts) {
    if (d.kind !== 'share' || !d.payment) continue;
    const payer = payerOf.get(d.refuelId)!;
    const mine = (adjustsByRefuel.get(d.refuelId) ?? []).filter(
      (p) => (p.debtor === d.debtor && p.creditor === payer) || (p.debtor === payer && p.creditor === d.debtor),
    );
    for (const p of mine)
      out.push({
        kind: 'adjust',
        seq: p.seq,
        paymentId: p.id,
        refuelId: d.refuelId,
        debtor: p.debtor,
        creditor: p.creditor,
        cents: p.amountCents,
        state: p.status,
        payment: p,
        driftCents: 0,
        offsetCents: 0,
        dueCents: p.amountCents,
        offsetWith: [],
      });
    // Seguridad: solo cuenta el dinero que quien lo recibe ha confirmado. Un Bizum marcado como enviado
    // pero sin confirmar no puede generar una deuda a favor de quien lo marcó (si no, cualquiera podría
    // apuntar «he pagado 300 €» y la app le pediría a quien llenó que le devolviera la diferencia).
    if (d.payment.status !== 'confirmed') continue;
    const signed = (p: Payment) => (p.debtor === d.debtor ? p.amountCents : -p.amountCents);
    let need = d.dueCents - d.payment.amountCents; // + = la persona debe más; − = hay que devolverle
    for (const p of mine) if (p.status === 'confirmed') need -= signed(p);
    // Los ajustes enviados (aún sin confirmar) en el sentido correcto cubren lo que falta, nunca más.
    for (const p of mine) {
      if (p.status !== 'sent' || Math.sign(signed(p)) !== Math.sign(need)) continue;
      const take = Math.sign(need) * Math.min(Math.abs(signed(p)), Math.abs(need));
      need -= take;
    }
    const remaining = need;
    if (Math.abs(remaining) < 1) continue;
    const all = adjustsByRefuel.get(d.refuelId) ?? [];
    const seq = Math.max(0, ...all.map((p) => p.seq ?? 0), ...out.filter((x) => x.refuelId === d.refuelId).map((x) => x.seq ?? 0)) + 1;
    const [debtor, creditor] = remaining > 0 ? [d.debtor, payer] : [payer, d.debtor];
    out.push({
      kind: 'adjust',
      seq,
      paymentId: adjustPaymentId(d.refuelId, debtor, creditor, seq),
      refuelId: d.refuelId,
      debtor,
      creditor,
      cents: Math.abs(remaining),
      state: 'pending',
      payment: null,
      driftCents: 0,
      offsetCents: 0,
      dueCents: Math.abs(remaining),
      offsetWith: [],
    });
  }
  return out;
}

/**
 * Compensación entre dos personas: si A debe a B por un depósito y B debe a A por otro,
 * se cancela lo que coincide y solo queda por Bizum la diferencia.
 *
 * Es estable una vez pagado: un Bizum ya enviado por un importe menor que su parte
 * conserva su descuento (cents − pagado); los descuentos nuevos se aplican a las deudas
 * aún sin pagar, de la más antigua a la más reciente.
 */
function compensate(debts: Debt[], refuels: Refuel[]) {
  const order = new Map(refuels.map((r, i) => [r.id, i]));
  const pairs = new Map<string, { ab: Debt[]; ba: Debt[] }>();
  for (const d of debts) {
    const [a, b] = [d.debtor, d.creditor].sort();
    const key = `${a}|${b}`;
    let p = pairs.get(key);
    if (!p) pairs.set(key, (p = { ab: [], ba: [] }));
    (d.debtor === a ? p.ab : p.ba).push(d);
  }
  const offsettable = (d: Debt) => (d.payment ? Math.max(0, d.cents - d.payment.amountCents) : d.cents);
  for (const { ab, ba } of pairs.values()) {
    const total = Math.min(
      ab.reduce((x, d) => x + offsettable(d), 0),
      ba.reduce((x, d) => x + offsettable(d), 0),
    );
    if (total <= 0) continue;
    for (const side of [ab, ba]) {
      // Primero las ya pagadas con descuento (su descuento está fijado), luego por antigüedad.
      side.sort((x, y) => Number(!x.payment) - Number(!y.payment) || (order.get(x.refuelId) ?? 0) - (order.get(y.refuelId) ?? 0));
      let left = total;
      for (const d of side) {
        const take = Math.min(left, offsettable(d));
        left -= take;
        d.offsetCents = take;
        d.dueCents = d.cents - take;
        if (d.payment) d.driftCents = d.dueCents - d.payment.amountCents;
        else if (d.dueCents === 0) d.state = 'offset';
      }
    }
    const ids = (side: Debt[]) => side.filter((d) => d.offsetCents > 0).map((d) => d.refuelId);
    const abIds = ids(ab);
    const baIds = ids(ba);
    for (const d of ab) if (d.offsetCents > 0) d.offsetWith = baIds;
    for (const d of ba) if (d.offsetCents > 0) d.offsetWith = abIds;
  }
}

export interface ProfileStats {
  km: number;
  trips: TripView[];
  costCents: number; // suma de su parte en los repostajes del periodo
  pumpCents: number; // pagado en el surtidor
  sentCents: number; // Bizum enviados
  receivedCents: number; // Bizum recibidos (enviados por el deudor, confirmados o no)
  tramos: { view: RefuelView; share: Share | null; debt: Debt | null }[];
  byMonth: { key: string; label: string; km: number }[];
}

export function profileStats(ledger: Ledger, email: string, from: number | null, to: number | null): ProfileStats {
  const inRange = (t: number) => (from == null || t >= from) && (to == null || t <= to);
  const trips = ledger.trips.filter((v) => riders(v.trip).includes(email) && inRange(v.trip.date));
  const km = trips.reduce((a, v) => a + v.km / riders(v.trip).length, 0);
  const tramos = ledger.refuels
    .filter((r) => inRange(r.refuel.date))
    .map((view) => ({
      view,
      share: view.shares.find((s) => s.email === email) ?? null,
      debt: view.debts.find((d) => d.debtor === email) ?? null,
    }))
    .filter((t) => t.share || t.view.refuel.payer === email);
  const costCents = tramos.reduce((a, t) => a + (t.share?.cents ?? 0), 0);
  const pumpCents = tramos.filter((t) => t.view.refuel.payer === email).reduce((a, t) => a + t.view.refuel.amountCents, 0);
  let sentCents = 0;
  let receivedCents = 0;
  for (const d of ledger.debts) {
    const p = d.payment;
    if (!p || !inRange(p.sentAt)) continue;
    if (d.debtor === email) sentCents += p.amountCents;
    if (d.creditor === email) receivedCents += p.amountCents;
  }
  const months = new Map<string, number>();
  for (const v of trips) {
    const d = new Date(v.trip.date);
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1, 2)}`;
    months.set(key, (months.get(key) ?? 0) + v.km / riders(v.trip).length);
  }
  const byMonth = [...months.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, k]) => {
      const [y, m] = key.split('-').map(Number);
      const label = new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
      return { key, label, km: k };
    });
  return { km, trips, costCents, pumpCents, sentCents, receivedCents, tramos, byMonth };
}

// ---------- Formato ----------
const eur = new Intl.NumberFormat('es-ES', { style: 'currency', currency: 'EUR' });
const int = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0, useGrouping: true });

export function fmtEur(cents: number): string {
  return eur.format(cents / 100);
}
export function fmtKm(km: number): string {
  // es-ES no agrupa números de 4 cifras por defecto; forzamos el punto para km.
  return `${groupThousands(km)} km`;
}
/** Km que pueden tener medio km (parte de un viaje compartido): 8,5 km. */
export function fmtKmShare(km: number): string {
  return Number.isInteger(km) ? fmtKm(km) : `${(Math.round(km * 10) / 10).toLocaleString('es-ES', { maximumFractionDigits: 1 })} km`;
}
export function groupThousands(n: number): string {
  const s = String(Math.abs(Math.round(n)));
  const g = s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return (n < 0 ? '-' : '') + g;
}
export function fmtPrice(milli: number): string {
  return `${(milli / 1000).toFixed(3).replace('.', ',')} €/l`;
}
export function fmtLiters(milli: number): string {
  return `${(milli / 1000).toFixed(2).replace('.', ',')} l`;
}
export function fmtInt(n: number): string {
  return int.format(n);
}

// ---------------------------------------------------------------------------------------------
// Km misterio: km entre dos fotos del cuentakilómetros que nadie apuntó. Se pregunta a todos si
// usaron el coche en esas fechas y cuántos km hicieron. Cuando han respondido todos (o lo que dicen
// suma justo los km del hueco), cada uno paga sus km y la diferencia se reparte a partes iguales
// entre quienes dijeron que sí.
// ---------------------------------------------------------------------------------------------

export interface GapAnswer {
  id: string;
  fromKm: number;
  toKm: number;
  member: string;
  used: boolean;
  /** Km que dice haber hecho (0 si no lo usó). */
  km: number;
  /** Día en que lo usó (AAAA-MM-DD), o null. */
  day: string | null;
  createdAt: number;
}

export const gapAnswerId = (fromKm: number, toKm: number, email: string) => `${fromKm}-${toKm}__${email}`;

export interface MysteryGap {
  fromKm: number;
  toKm: number;
  km: number;
  /** Viaje que acabó en `fromKm` y viaje que empezó en `toKm`. */
  after: TripView;
  before: TripView;
  answers: GapAnswer[];
  /** Quienes aún no han respondido. */
  pending: string[];
  /** Km que suman los que dicen que sí. */
  claimedKm: number;
  /** Ya se puede repartir: han respondido todos o lo dicho suma justo el hueco (y alguien dijo que sí). */
  resolved: boolean;
  /** Km finales de cada uno, con la diferencia ya repartida (solo si está resuelto). */
  allocation: { email: string; km: number; day: string | null }[];
}

/**
 * Reparte la diferencia entre los km del hueco y los que dice cada uno, a partes iguales y en km
 * enteros. Si dicen de más, se quita a partes iguales (sin bajar de 0).
 */
export function allocateGap<T extends { km: number }>(total: number, claims: T[]): T[] {
  const out = claims.map((c) => ({ ...c }));
  let rest = total - out.reduce((a, c) => a + c.km, 0);
  for (let guard = 0; rest !== 0 && guard < 100; guard++) {
    const act = rest > 0 ? out : out.filter((c) => c.km > 0);
    if (!act.length) break;
    const sign = Math.sign(rest);
    const abs = Math.abs(rest);
    const base = Math.floor(abs / act.length);
    const extra = abs % act.length;
    act.forEach((c, i) => {
      const want = base + (i < extra ? 1 : 0);
      const take = sign > 0 ? want : Math.min(want, c.km);
      c.km += sign * take;
      rest -= sign * take;
    });
  }
  return out;
}

/** Huecos entre viajes con sus respuestas, del más antiguo al más reciente. */
export function mysteryGaps(ledger: Ledger, answers: GapAnswer[], members: string[]): MysteryGap[] {
  const out: MysteryGap[] = [];
  const ts = ledger.trips;
  for (let i = 0; i + 1 < ts.length; i++) {
    const v = ts[i];
    const next = ts[i + 1];
    if (v.endKm == null || v.endState === 'inferred' || v.endState === 'open' || next.trip.start.km == null) continue;
    const fromKm = v.endKm;
    const toKm = next.trip.start.km;
    if (toKm <= fromKm) continue;
    const mine = answers.filter((a) => a.fromKm === fromKm && a.toKm === toKm && members.includes(a.member));
    const yes = mine
      .filter((a) => a.used && a.km > 0)
      .sort((a, b) => (a.day ?? '').localeCompare(b.day ?? '') || a.member.localeCompare(b.member));
    const claimedKm = yes.reduce((a, x) => a + x.km, 0);
    const km = toKm - fromKm;
    const pending = members.filter((e) => !mine.some((a) => a.member === e));
    const resolved = yes.length > 0 && (pending.length === 0 || claimedKm === km);
    out.push({
      fromKm,
      toKm,
      km,
      after: v,
      before: next,
      answers: mine,
      pending,
      claimedKm,
      resolved,
      allocation: resolved ? allocateGap(km, yes.map((a) => ({ email: a.member, km: a.km, day: a.day }))) : [],
    });
  }
  return out;
}

/** Los km de un hueco resuelto como viajes (uno por persona, seguidos), para repartir el depósito. */
export function gapTrips(g: MysteryGap): Trip[] {
  const out: Trip[] = [];
  let km = g.fromKm;
  const a = g.after.trip.endDate ?? g.after.trip.date;
  const b = Math.max(g.before.trip.date, a);
  for (const x of g.allocation) {
    if (x.km <= 0) continue;
    const day = x.day ? new Date(`${x.day}T12:00:00`).getTime() : NaN;
    const date = Number.isFinite(day) ? Math.min(Math.max(day, a), b) : Math.round((a + b) / 2);
    out.push({
      id: `misterio-${g.fromKm}-${g.toKm}-${x.email}`,
      driver: x.email,
      date,
      start: { km, photoId: null },
      end: { km: km + x.km, photoId: null },
      note: 'Km misterio: según lo que respondió',
      createdAt: date,
      with: [],
      addedBy: null,
      confirmed: [],
      source: 'survey',
    });
    km += x.km;
  }
  return out;
}
