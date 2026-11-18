import type { Backend, Snapshot } from './backend';
import { buildLedger, gapTrips, mysteryGaps, type Ledger, type Member, type MysteryGap } from './domain';

export interface AppState {
  backend: Backend;
  me: Member;
  snap: Snapshot;
  ledger: Ledger;
  members: Map<string, Member>;
  /** Km misterio (huecos entre viajes) con las respuestas de cada uno. */
  gaps: MysteryGap[];
}

export function makeState(backend: Backend, me: Member, snap: Snapshot): AppState {
  const members = new Map(snap.members.map((m) => [m.email, m]));
  if (!members.has(me.email)) members.set(me.email, me);
  const nameOf = (e: string) => members.get(e)?.name ?? e.split('@')[0];
  const base = buildLedger(snap.trips, snap.refuels, snap.payments, nameOf);
  const gaps = mysteryGaps(base, snap.gapAnswers ?? [], [...members.keys()]);
  // Los huecos ya resueltos cuentan como viajes de quien dijo haberlo usado.
  const extra = gaps.filter((g) => g.resolved).flatMap(gapTrips);
  const ledger = extra.length ? buildLedger([...snap.trips, ...extra], snap.refuels, snap.payments, nameOf) : base;
  return { backend, me, snap, members, ledger, gaps };
}

export function memberOf(st: AppState, email: string): Member {
  return st.members.get(email) ?? { email, name: email.split('@')[0], color: 'c1', admin: false };
}
