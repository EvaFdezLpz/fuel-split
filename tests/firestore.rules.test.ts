// Pruebas de las reglas de seguridad contra el emulador: control de acceso (IDOR), suplantación,
// lógica de negocio, ficheros maliciosos y asignación masiva de campos.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc } from 'firebase/firestore';
import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

let env: RulesTestEnvironment;
const ANA = 'ana@gmail.com';
const LUIS = 'luis@gmail.com';
const EVIL = 'intruso@gmail.com';
const JPEG = '/9j/' + 'A'.repeat(2000);
const id20 = (n: number) => `ev${String(n).padStart(18, '0')}`;

const as = (email: string, extra: Record<string, unknown> = {}) =>
  env.authenticatedContext(email.split('@')[0], { email, email_verified: true, firebase: { sign_in_provider: 'google.com' }, ...extra }).firestore();

const trip = (driver: string, over: Record<string, unknown> = {}) => ({
  driver,
  date: Timestamp.fromMillis(Date.now() - 60_000),
  start: { km: 1000, photoId: null },
  end: { km: 1050, photoId: null },
  note: '',
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  ...over,
});

const refuel = (payer: string, receipt: string | null, over: Record<string, unknown> = {}) => ({
  payer,
  date: Timestamp.fromMillis(Date.now() - 60_000),
  amountCents: 6000,
  priceMilli: 1539,
  odometerKm: 1400,
  odometerPhotoId: null,
  receiptPhotoId: receipt,
  note: '',
  createdAt: serverTimestamp(),
  ...over,
});

beforeAll(async () => {
  env = await initializeTestEnvironment({ projectId: 'demo-deposito', firestore: { host: '127.0.0.1', port: 8080, rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => env?.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'members', ANA), { name: 'Ana', color: 'c1' });
    await setDoc(doc(db, 'members', LUIS), { name: 'Luis', color: 'c2' });
    await setDoc(doc(db, 'evidence', id20(1)), { owner: ANA, kind: 'receipt', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'evidence', id20(2)), { owner: LUIS, kind: 'odometer', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() });
    await setDoc(doc(db, 'refuels', id20(9)), { ...refuel(ANA, id20(1)), createdAt: Timestamp.now() });
  });
});

describe('autenticación y lista blanca', () => {
  it('sin sesión no se lee nada', async () => {
    await assertFails(getDocs(collection(env.unauthenticatedContext().firestore(), 'trips')));
  });
  it('un correo fuera de la lista no lee nada', async () => {
    await assertFails(getDocs(collection(as(EVIL), 'trips')));
    await assertFails(getDoc(doc(as(EVIL), 'members', ANA)));
  });
  it('correo sin verificar o proveedor distinto de Google: denegado', async () => {
    await assertFails(getDocs(collection(as(ANA, { email_verified: false }), 'trips')));
    await assertFails(getDocs(collection(as(ANA, { firebase: { sign_in_provider: 'password' } }), 'trips')));
  });
  it('un miembro lee', async () => {
    await assertSucceeds(getDocs(collection(as(ANA), 'trips')));
  });
  it('nadie se añade a la lista blanca desde la app', async () => {
    await assertFails(setDoc(doc(as(EVIL), 'members', EVIL), { name: 'x', color: 'c1' }));
    await assertFails(updateDoc(doc(as(LUIS), 'members', LUIS), { admin: true }));
  });
  it('rutas desconocidas denegadas', async () => {
    await assertFails(setDoc(doc(as(ANA), 'otros', 'x'), { a: 1 }));
  });
});

describe('viajes', () => {
  it('crear un viaje propio', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA)));
  });
  it('no se puede crear un viaje a nombre de otro (suplantación)', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS)));
  });
  it('km incoherentes o fuera de rango', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { end: { km: 900, photoId: null } })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { end: { km: 9000, photoId: null } })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { start: { km: -5, photoId: null } })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { start: { km: '1000', photoId: null } })));
  });
  it('campos extra rechazados (asignación masiva)', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), { ...trip(ANA), admin: true }));
  });
  it('fecha en el futuro o createdAt manipulado', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { date: Timestamp.fromMillis(Date.now() + 864e5 * 3) })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { createdAt: Timestamp.fromMillis(0) })));
  });
  it('no se puede usar la foto de otra persona como evidencia', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { start: { km: 1000, photoId: id20(2) } })));
    await assertSucceeds(setDoc(doc(as(LUIS), 'trips', 't2'), trip(LUIS, { start: { km: 1000, photoId: id20(2) } })));
  });
  it('solo el conductor edita o borra su viaje (IDOR)', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { end: { km: null, photoId: null } })));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 't1'), { end: { km: 1100, photoId: null }, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(LUIS), 'trips', 't1')));
    await assertSucceeds(updateDoc(doc(as(ANA), 'trips', 't1'), { end: { km: 1100, photoId: null }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ANA), 'trips', 't1'), { driver: LUIS, updatedAt: serverTimestamp() }));
  });
});

describe('evidencias', () => {
  const ev = (over: Record<string, unknown> = {}) => ({ owner: ANA, kind: 'odometer', mime: 'image/jpeg', data: JPEG, createdAt: serverTimestamp(), ...over });
  it('subir una foto JPEG propia', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'evidence', id20(5)), ev()));
  });
  it('rechaza contenido que no es JPEG (HTML, SVG, script)', async () => {
    await assertFails(setDoc(doc(as(ANA), 'evidence', id20(5)), ev({ data: '<svg onload=alert(1)>' + 'A'.repeat(2000) })));
    await assertFails(setDoc(doc(as(ANA), 'evidence', id20(5)), ev({ data: 'PHNjcmlwdD4=' + 'A'.repeat(2000) })));
    await assertFails(setDoc(doc(as(ANA), 'evidence', id20(5)), ev({ mime: 'image/svg+xml' })));
  });
  it('rechaza ficheros demasiado grandes', async () => {
    await assertFails(setDoc(doc(as(ANA), 'evidence', id20(5)), ev({ data: '/9j/' + 'A'.repeat(900_001) })));
  });
  it('no se sube a nombre de otro y no se edita ni borra', async () => {
    await assertFails(setDoc(doc(as(ANA), 'evidence', id20(5)), ev({ owner: LUIS })));
    await assertFails(updateDoc(doc(as(ANA), 'evidence', id20(1)), { data: JPEG + 'B' }));
    await assertFails(deleteDoc(doc(as(ANA), 'evidence', id20(1))));
  });
});

describe('repostajes', () => {
  it('crear con ticket propio', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, id20(1))));
  });
  it('sin ticket, con ticket ajeno o haciéndose pasar por otro pagador: denegado', async () => {
    await assertFails(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, null)));
    await assertFails(setDoc(doc(as(LUIS), 'refuels', 'r1'), refuel(LUIS, id20(1))));
    await assertFails(setDoc(doc(as(LUIS), 'refuels', 'r1'), refuel(ANA, id20(1))));
  });
  it('importes absurdos rechazados', async () => {
    await assertFails(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, id20(1), { amountCents: -100 })));
    await assertFails(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, id20(1), { amountCents: 999999 })));
    await assertFails(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, id20(1), { priceMilli: 10 })));
    await assertFails(setDoc(doc(as(ANA), 'refuels', 'r1'), refuel(ANA, id20(1), { amountCents: 60.5 })));
  });
  it('inmutable y solo borrable por quien pagó', async () => {
    await assertFails(updateDoc(doc(as(ANA), 'refuels', id20(9)), { amountCents: 100 }));
    await assertFails(deleteDoc(doc(as(LUIS), 'refuels', id20(9))));
    await assertSucceeds(deleteDoc(doc(as(ANA), 'refuels', id20(9))));
  });
});

describe('pagos', () => {
  const pid = `${id20(9)}__${LUIS}`;
  const pay = (over: Record<string, unknown> = {}) => ({ refuelId: id20(9), debtor: LUIS, creditor: ANA, amountCents: 2500, status: 'sent', sentAt: serverTimestamp(), confirmedAt: null, ...over });
  it('el deudor marca el Bizum como enviado', async () => {
    await assertSucceeds(setDoc(doc(as(LUIS), 'payments', pid), pay()));
  });
  it('no puede marcarlo como confirmado él mismo ni cambiar el acreedor', async () => {
    await assertFails(setDoc(doc(as(LUIS), 'payments', pid), pay({ status: 'confirmed' })));
    await assertFails(setDoc(doc(as(LUIS), 'payments', pid), pay({ creditor: LUIS })));
  });
  it('no puede crear el pago de otro (ID manipulado)', async () => {
    await assertFails(setDoc(doc(as(ANA), 'payments', pid), pay({ debtor: ANA })));
    await assertFails(setDoc(doc(as(LUIS), 'payments', `${id20(9)}__${ANA}`), pay()));
  });
  it('solo el acreedor confirma, y solo el estado', async () => {
    await setDoc(doc(as(LUIS), 'payments', pid), pay());
    await assertFails(updateDoc(doc(as(LUIS), 'payments', pid), { status: 'confirmed', confirmedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ANA), 'payments', pid), { status: 'confirmed', confirmedAt: serverTimestamp(), amountCents: 1 }));
    await assertSucceeds(updateDoc(doc(as(ANA), 'payments', pid), { status: 'confirmed', confirmedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(LUIS), 'payments', pid)));
  });
});

describe('ajustes de pagos', () => {
  const EVA = 'eva@gmail.com';
  const adj = (debtor: string, creditor: string, seq: number, over: Record<string, unknown> = {}) => ({
    refuelId: id20(9), debtor, creditor, amountCents: 1200, status: 'sent', sentAt: serverTimestamp(), confirmedAt: null, kind: 'adjust', seq, ...over,
  });
  const aid = (debtor: string, creditor: string, seq: number) => `${id20(9)}__${debtor}__${creditor}__a${seq}`;
  it('la persona completa la diferencia a quien llenó', async () => {
    await assertSucceeds(setDoc(doc(as(LUIS), 'payments', aid(LUIS, ANA, 1)), adj(LUIS, ANA, 1)));
  });
  it('quien llenó devuelve la diferencia a otro miembro', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'payments', aid(ANA, LUIS, 1)), adj(ANA, LUIS, 1)));
  });
  it('no entre dos personas que no llenaron ese depósito, ni a alguien de fuera', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'members', EVA), { name: 'Eva', color: 'c3' }));
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(LUIS, EVA, 1)), adj(LUIS, EVA, 1)));
    await assertFails(setDoc(doc(as(ANA), 'payments', aid(ANA, EVIL, 1)), adj(ANA, EVIL, 1)));
  });
  it('id, estado y campos manipulados: denegado', async () => {
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(LUIS, ANA, 2)), adj(LUIS, ANA, 1)));
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(ANA, LUIS, 1)), adj(ANA, LUIS, 1)));
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(LUIS, ANA, 1)), adj(LUIS, ANA, 1, { status: 'confirmed' })));
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(LUIS, ANA, 1)), adj(LUIS, ANA, 1, { kind: 'otro' })));
    await assertFails(setDoc(doc(as(LUIS), 'payments', aid(LUIS, ANA, 1)), { ...adj(LUIS, ANA, 1), extra: true }));
  });
  it('lo confirma quien lo recibe', async () => {
    await setDoc(doc(as(ANA), 'payments', aid(ANA, LUIS, 1)), adj(ANA, LUIS, 1));
    await assertFails(updateDoc(doc(as(ANA), 'payments', aid(ANA, LUIS, 1)), { status: 'confirmed', confirmedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(LUIS), 'payments', aid(ANA, LUIS, 1)), { status: 'confirmed', confirmedAt: serverTimestamp() }));
  });
});

describe('fotos añadidas más tarde', () => {
  const old = (over: Record<string, unknown> = {}) => ({ ...trip(LUIS), createdAt: Timestamp.fromMillis(Date.now() - 864e5 * 30), updatedAt: Timestamp.fromMillis(Date.now() - 864e5 * 30), ...over });
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'trips', 'viejo'), old()));
  });
  it('el conductor añade la foto que faltaba a un viaje de hace un mes', async () => {
    await assertSucceeds(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(2) }, updatedAt: serverTimestamp() }));
  });
  it('pero no puede cambiar los km ni la fecha pasada la semana', async () => {
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { start: { km: 990, photoId: id20(2) }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { date: Timestamp.fromMillis(Date.now() - 1000), updatedAt: serverTimestamp() }));
  });
  it('ni usar la foto de otro, ni tocar el viaje de otro', async () => {
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(1) }, updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ANA), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(1) }, updatedAt: serverTimestamp() }));
  });
  it('ni cambiar una foto que ya existía', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'evidence', id20(3)), { owner: LUIS, kind: 'odometer', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() }));
    await env.withSecurityRulesDisabled(async (ctx) => updateDoc(doc(ctx.firestore(), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(2) } }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(3) }, updatedAt: serverTimestamp() }));
  });
});

describe('reservas', () => {
  const res = (member: string, over: Record<string, unknown> = {}) => ({ member, day: '2026-12-01', endDay: '2026-12-02', note: 'Viaje al pueblo', createdAt: serverTimestamp(), ...over });
  it('cada uno crea las suyas y todos las ven', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'reservations', 'r1'), res(ANA)));
    await assertSucceeds(getDoc(doc(as(LUIS), 'reservations', 'r1')));
    await assertFails(getDoc(doc(as(EVIL), 'reservations', 'r1')));
  });
  it('no se reserva a nombre de otro ni con datos inválidos', async () => {
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r2'), res(LUIS)));
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r3'), res(ANA, { endDay: '2026-11-30' })));
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r4'), res(ANA, { day: 'mañana' })));
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r5'), res(ANA, { note: '' })));
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r6'), res(ANA, { note: 'x'.repeat(281) })));
    await assertFails(setDoc(doc(as(ANA), 'reservations', 'r7'), res(ANA, { extra: true })));
  });
  it('solo quien reservó la cambia o la borra, y sin tocar el dueño', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'reservations', 'r8'), { ...res(ANA), createdAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(as(LUIS), 'reservations', 'r8'), { note: 'mío' }));
    await assertFails(deleteDoc(doc(as(LUIS), 'reservations', 'r8')));
    await assertFails(updateDoc(doc(as(ANA), 'reservations', 'r8'), { member: LUIS }));
    await assertSucceeds(updateDoc(doc(as(ANA), 'reservations', 'r8'), { note: 'Otra cosa', endDay: '2026-12-03' }));
    await assertSucceeds(deleteDoc(doc(as(ANA), 'reservations', 'r8')));
  });
});
