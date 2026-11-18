import { initializeApp } from 'firebase/app';
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  getAuth,
  getRedirectResult,
  onAuthStateChanged,
  setPersistence,
  signInWithPopup,
  signInWithRedirect,
  signOut as fbSignOut,
} from 'firebase/auth';
import {
  Timestamp,
  collection,
  deleteDoc,
  doc,
  getDoc,
  initializeFirestore,
  terminate,
  clearIndexedDbPersistence,
  onSnapshot,
  persistentLocalCache,
  persistentMultipleTabManager,
  serverTimestamp,
  setDoc,
  updateDoc,
  type DocumentData,
} from 'firebase/firestore';
import type { AuthState, Backend, Evidence, RefuelInput, Snapshot, TripInput } from './backend';
import { DAY_RE, type ColorKey, type Member, type Payment, type Refuel, type Reservation, type Trip } from './domain';
import { adjustPaymentId, paymentId } from './domain';

const config = {
  apiKey: import.meta.env.VITE_FB_API_KEY,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FB_PROJECT_ID,
  appId: import.meta.env.VITE_FB_APP_ID,
};

// ---------- Validación de lo que llega de la base de datos ----------
// Nunca se confía en la forma de los documentos: si algo no encaja, se descarta.
const isStr = (v: unknown, max = 320): v is string => typeof v === 'string' && v.length <= max;
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isSafeInteger(v);
const optStr = (v: unknown) => (v == null ? null : isStr(v, 64) ? v : undefined);
const optInt = (v: unknown) => (v == null ? null : isInt(v) ? v : undefined);
const ms = (v: unknown): number | undefined => (v instanceof Timestamp ? v.toMillis() : undefined);
const COLORS: ColorKey[] = ['c1', 'c2', 'c3', 'c4', 'c5'];

function parseMember(id: string, d: DocumentData): Member | null {
  if (!isStr(d.name, 60)) return null;
  const color = COLORS.includes(d.color) ? (d.color as ColorKey) : 'c1';
  return { email: id, name: d.name, color, admin: d.admin === true };
}

function parseReading(r: unknown) {
  if (typeof r !== 'object' || r === null) return null;
  const o = r as Record<string, unknown>;
  const km = optInt(o.km);
  const photoId = optStr(o.photoId);
  if (km === undefined || photoId === undefined) return null;
  return { km, photoId };
}

function parseTrip(id: string, d: DocumentData): Trip | null {
  const start = parseReading(d.start);
  const end = parseReading(d.end);
  const date = ms(d.date);
  const createdAt = ms(d.createdAt) ?? Date.now(); // pendiente de escritura local
  if (!start || !end || date === undefined || !isStr(d.driver) || start.km == null) return null;
  return { id, driver: d.driver, date, start, end, note: isStr(d.note, 280) ? d.note : '', createdAt };
}

function parseRefuel(id: string, d: DocumentData): Refuel | null {
  const date = ms(d.date);
  const odoPhoto = optStr(d.odometerPhotoId);
  if (
    date === undefined ||
    !isStr(d.payer) ||
    !isInt(d.amountCents) ||
    !isInt(d.priceMilli) ||
    !isInt(d.odometerKm) ||
    !isStr(d.receiptPhotoId, 64) ||
    odoPhoto === undefined
  )
    return null;
  return {
    id,
    payer: d.payer,
    date,
    amountCents: d.amountCents,
    priceMilli: d.priceMilli,
    odometerKm: d.odometerKm,
    odometerPhotoId: odoPhoto,
    receiptPhotoId: d.receiptPhotoId,
    note: isStr(d.note, 280) ? d.note : '',
    createdAt: ms(d.createdAt) ?? Date.now(),
  };
}

function parseReservation(id: string, d: DocumentData): Reservation | null {
  if (!isStr(d.member) || !isStr(d.day, 10) || !isStr(d.endDay, 10) || !isStr(d.note, 280)) return null;
  if (!DAY_RE.test(d.day) || !DAY_RE.test(d.endDay) || d.endDay < d.day) return null;
  return { id, member: d.member, day: d.day, endDay: d.endDay, note: d.note, createdAt: ms(d.createdAt) ?? Date.now() };
}

function parsePayment(id: string, d: DocumentData): Payment | null {
  if (!isStr(d.refuelId, 64) || !isStr(d.debtor) || !isStr(d.creditor) || !isInt(d.amountCents)) return null;
  if (d.status !== 'sent' && d.status !== 'confirmed') return null;
  return {
    id,
    refuelId: d.refuelId,
    debtor: d.debtor,
    creditor: d.creditor,
    amountCents: d.amountCents,
    status: d.status,
    sentAt: ms(d.sentAt) ?? Date.now(),
    confirmedAt: ms(d.confirmedAt) ?? null,
    ...(d.kind === 'adjust' && isInt(d.seq) ? { kind: 'adjust' as const, seq: d.seq } : {}),
  };
}

/** Las escrituras sin conexión se encolan: no bloqueamos la interfaz más de unos segundos. */
async function settle(p: Promise<unknown>): Promise<void> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<void>((res) => (timer = setTimeout(res, 6000)));
  try {
    await Promise.race([p, timeout]);
  } finally {
    clearTimeout(timer);
  }
}

export function createFirebaseBackend(): Backend {
  const app = initializeApp(config);
  const auth = getAuth(app);
  auth.languageCode = 'es';
  const db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
  });
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });

  let me = '';
  const tripRef = (id?: string) => (id ? doc(db, 'trips', id) : doc(collection(db, 'trips')));

  const tripData = (input: TripInput) => ({
    date: Timestamp.fromMillis(input.date),
    start: { km: input.startKm, photoId: input.startPhotoId },
    end: { km: input.endKm, photoId: input.endPhotoId },
    note: input.note,
    updatedAt: serverTimestamp(),
  });

  return {
    onAuth(cb) {
      cb({ status: 'loading' });
      getRedirectResult(auth).catch(() => cb({ status: 'signed-out', error: 'No se pudo completar el inicio de sesión.' }));
      onAuthStateChanged(auth, async (u) => {
        if (!u || !u.email) {
          me = '';
          cb({ status: 'signed-out' });
          return;
        }
        const email = u.email.toLowerCase();
        if (!u.emailVerified) {
          await fbSignOut(auth);
          cb({ status: 'signed-out', error: 'La cuenta de Google no tiene el correo verificado.' });
          return;
        }
        try {
          const snap = await getDoc(doc(db, 'members', email));
          const member = snap.exists() ? parseMember(email, snap.data()) : null;
          if (!member) throw new Error('forbidden');
          me = email;
          cb({ status: 'ready', user: { email, displayName: u.displayName ?? member.name }, member });
        } catch {
          // Las reglas deniegan la lectura a quien no está en la lista blanca.
          await fbSignOut(auth);
          cb({ status: 'forbidden', email });
        }
      });
    },

    async signIn() {
      await setPersistence(auth, browserLocalPersistence);
      try {
        await signInWithPopup(auth, provider);
      } catch (e) {
        const code = (e as { code?: string }).code ?? '';
        if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
          await signInWithRedirect(auth, provider);
          return;
        }
        if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') return;
        throw e;
      }
    },

    async signOut() {
      await fbSignOut(auth);
      // Borra la copia local (viajes, pagos, fotos) para que no quede nada en un dispositivo prestado.
      try {
        await terminate(db);
        await clearIndexedDbPersistence(db);
      } catch {
        /* si otra pestaña la tiene abierta, se borrará al cerrarla; la sesión ya está cerrada */
      }
      location.reload();
    },

    subscribe(cb, onError) {
      const snap: Snapshot = { members: [], trips: [], refuels: [], payments: [], reservations: [] };
      const ready = new Set<string>();
      const emit = (key: string) => {
        ready.add(key);
        if (ready.size === 5) cb({ ...snap });
      };
      const keep = <T>(arr: (T | null)[]) => arr.filter((x): x is T => x !== null);
      const unsubs = [
        onSnapshot(collection(db, 'members'), (s) => {
          snap.members = keep(s.docs.map((d) => parseMember(d.id, d.data())));
          emit('members');
        }, onError),
        onSnapshot(collection(db, 'trips'), (s) => {
          snap.trips = keep(s.docs.map((d) => parseTrip(d.id, d.data({ serverTimestamps: 'estimate' }))));
          emit('trips');
        }, onError),
        onSnapshot(collection(db, 'refuels'), (s) => {
          snap.refuels = keep(s.docs.map((d) => parseRefuel(d.id, d.data({ serverTimestamps: 'estimate' }))));
          emit('refuels');
        }, onError),
        onSnapshot(collection(db, 'payments'), (s) => {
          snap.payments = keep(s.docs.map((d) => parsePayment(d.id, d.data({ serverTimestamps: 'estimate' }))));
          emit('payments');
        }, onError),
        onSnapshot(collection(db, 'reservations'), (s) => {
          snap.reservations = keep(s.docs.map((d) => parseReservation(d.id, d.data({ serverTimestamps: 'estimate' }))));
          emit('reservations');
        }, onError),
      ];
      return () => unsubs.forEach((u) => u());
    },

    async addTrip(input) {
      await settle(setDoc(tripRef(), { ...tripData(input), driver: me, createdAt: serverTimestamp() }));
    },

    async updateTrip(id, input) {
      await settle(updateDoc(tripRef(id), tripData(input)));
    },

    async deleteTrip(id) {
      await settle(deleteDoc(tripRef(id)));
    },

    async addRefuel(input: RefuelInput) {
      await settle(
        setDoc(doc(collection(db, 'refuels')), {
          payer: me,
          date: Timestamp.fromMillis(input.date),
          amountCents: input.amountCents,
          priceMilli: input.priceMilli,
          odometerKm: input.odometerKm,
          odometerPhotoId: input.odometerPhotoId,
          receiptPhotoId: input.receiptPhotoId,
          note: input.note,
          createdAt: serverTimestamp(),
        }),
      );
    },

    async deleteRefuel(id) {
      await settle(deleteDoc(doc(db, 'refuels', id)));
    },

    async markSent(refuelId, creditor, amountCents) {
      await settle(
        setDoc(doc(db, 'payments', paymentId(refuelId, me)), {
          refuelId,
          debtor: me,
          creditor,
          amountCents,
          status: 'sent',
          sentAt: serverTimestamp(),
          confirmedAt: null,
        }),
      );
    },

    async sendAdjustment(refuelId, creditor, amountCents, seq) {
      await settle(
        setDoc(doc(db, 'payments', adjustPaymentId(refuelId, me, creditor, seq)), {
          refuelId,
          debtor: me,
          creditor,
          amountCents,
          status: 'sent',
          sentAt: serverTimestamp(),
          confirmedAt: null,
          kind: 'adjust',
          seq,
        }),
      );
    },

    async undoSent(id) {
      await settle(deleteDoc(doc(db, 'payments', id)));
    },

    async confirmPayment(id) {
      await settle(updateDoc(doc(db, 'payments', id), { status: 'confirmed', confirmedAt: serverTimestamp() }));
    },

    async addReservation(input) {
      await settle(setDoc(doc(collection(db, 'reservations')), { member: me, day: input.day, endDay: input.endDay, note: input.note, createdAt: serverTimestamp() }));
    },

    async updateReservation(id, input) {
      await settle(updateDoc(doc(db, 'reservations', id), { day: input.day, endDay: input.endDay, note: input.note }));
    },

    async deleteReservation(id) {
      await settle(deleteDoc(doc(db, 'reservations', id)));
    },

    async addEvidence(kind, base64Jpeg) {
      const ref = doc(collection(db, 'evidence'));
      // Las escrituras se envían en orden, así que la evidencia llega antes que el viaje que la referencia.
      await settle(setDoc(ref, { owner: me, kind, mime: 'image/jpeg', data: base64Jpeg, createdAt: serverTimestamp() }));
      return ref.id;
    },

    async getEvidence(id): Promise<Evidence | null> {
      if (!/^[A-Za-z0-9]{20}$/.test(id)) return null;
      const s = await getDoc(doc(db, 'evidence', id));
      if (!s.exists()) return null;
      const d = s.data();
      if (!isStr(d.data, 1_000_000) || !/^\/9j\/[A-Za-z0-9+/=]+$/.test(d.data)) return null;
      if (d.kind !== 'odometer' && d.kind !== 'receipt') return null;
      return { id, owner: String(d.owner), kind: d.kind, data: d.data, createdAt: ms(d.createdAt) ?? 0 };
    },
  };
}
