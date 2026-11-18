import type { Backend, Snapshot } from './backend';
import { buildLedger, type Ledger, type Member } from './domain';

export interface AppState {
  backend: Backend;
  me: Member;
  snap: Snapshot;
  ledger: Ledger;
  members: Map<string, Member>;
}

export function makeState(backend: Backend, me: Member, snap: Snapshot): AppState {
  const members = new Map(snap.members.map((m) => [m.email, m]));
  if (!members.has(me.email)) members.set(me.email, me);
  const nameOf = (e: string) => members.get(e)?.name ?? e.split('@')[0];
  return { backend, me, snap, members, ledger: buildLedger(snap.trips, snap.refuels, snap.payments, nameOf) };
}

export function memberOf(st: AppState, email: string): Member {
  return st.members.get(email) ?? { email, name: email.split('@')[0], color: 'c1', admin: false };
}
