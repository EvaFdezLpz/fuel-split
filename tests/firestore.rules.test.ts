// Pruebas de las reglas de seguridad contra el emulador: control de acceso (IDOR), suplantación,
// lógica de negocio, ficheros maliciosos y asignación masiva de campos.
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, serverTimestamp, setDoc, Timestamp, updateDoc, writeBatch } from 'firebase/firestore';
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
  with: [],
  addedBy: null,
  confirmed: [],
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

describe('viajes compartidos y km apuntados por otra persona', () => {
  const EVA = 'eva@gmail.com';
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'members', EVA), { name: 'Eva', color: 'c3' }));
  });
  it('un viaje propio con acompañantes de la familia', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { with: [LUIS, EVA] })));
  });
  it('acompañantes que no son de la familia, repetidos o el propio conductor: denegado', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { with: [EVIL] })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { with: [LUIS, LUIS] })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { with: [ANA] })));
  });
  it('no se puede crear un viaje ya confirmado por otros', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(ANA, { with: [LUIS], confirmed: [LUIS] })));
  });
  it('apuntar km olvidados a nombre de otro, marcado con quién lo apuntó', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS, { addedBy: ANA })));
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 't2'), trip(LUIS, { addedBy: ANA, with: [EVA] })));
  });
  it('a nombre de otro: sin ocultar quién lo apuntó, sin fotos ajenas, terminado y a alguien de la familia', async () => {
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS, { addedBy: LUIS })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS, { addedBy: null })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS, { addedBy: ANA, start: { km: 1000, photoId: id20(2) } })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(LUIS, { addedBy: ANA, end: { km: null, photoId: null } })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 't1'), trip(EVIL, { addedBy: ANA })));
  });
  it('quien lo apuntó no puede editarlo; la persona apuntada puede confirmarlo o borrarlo siempre', async () => {
    await env.withSecurityRulesDisabled(async (ctx) =>
      setDoc(doc(ctx.firestore(), 'trips', 'olvido'), { ...trip(LUIS, { addedBy: ANA }), createdAt: Timestamp.fromMillis(Date.now() - 864e5 * 30), updatedAt: Timestamp.now() }),
    );
    await assertFails(updateDoc(doc(as(ANA), 'trips', 'olvido'), { end: { km: 1200, photoId: null }, updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(ANA), 'trips', 'olvido'))); // pasadas 24 h, quien lo apuntó ya no lo borra
    await assertFails(updateDoc(doc(as(ANA), 'trips', 'olvido'), { confirmed: [ANA], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'olvido'), { end: { km: 1200, photoId: null }, updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(LUIS), 'trips', 'olvido'), { confirmed: [LUIS], updatedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(as(LUIS), 'trips', 'olvido')));
  });
  it('cada acompañante confirma o se quita solo a sí mismo', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'trips', 'juntos'), { ...trip(ANA, { with: [LUIS, EVA] }), createdAt: Timestamp.now(), updatedAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'juntos'), { confirmed: [LUIS, EVA], updatedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'juntos'), { with: [LUIS], updatedAt: serverTimestamp() })); // quitar a otro
    await assertFails(updateDoc(doc(as(EVIL), 'trips', 'juntos'), { confirmed: [EVIL], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(LUIS), 'trips', 'juntos'), { confirmed: [LUIS], updatedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(EVA), 'trips', 'juntos'), { with: [LUIS], updatedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(LUIS), 'trips', 'juntos'))); // un acompañante no borra el viaje
  });
  it('los viajes guardados antes de este cambio (sin los campos nuevos) se siguen editando', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const { with: _w, addedBy: _a, confirmed: _c, ...old } = trip(ANA, { end: { km: null, photoId: null } });
      await setDoc(doc(ctx.firestore(), 'trips', 'antiguo'), { ...old, createdAt: Timestamp.now(), updatedAt: Timestamp.now() });
    });
    await assertSucceeds(updateDoc(doc(as(ANA), 'trips', 'antiguo'), { end: { km: 1100, photoId: null }, updatedAt: serverTimestamp() }));
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

describe('repostar con un viaje en curso', () => {
  // Ana sale en 1450, reposta en 1500 sin haber terminado: el viaje se termina en 1500 y empieza otro desde ahí.
  beforeEach(async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      const db = ctx.firestore();
      await setDoc(doc(db, 'evidence', id20(3)), { owner: ANA, kind: 'odometer', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() });
      await setDoc(doc(db, 'evidence', id20(4)), { owner: LUIS, kind: 'receipt', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() });
      await setDoc(doc(db, 'trips', 'enCurso'), { ...trip(ANA, { start: { km: 1450, photoId: null }, end: { km: null, photoId: null } }), createdAt: Timestamp.fromMillis(Date.now() - 864e5 * 10), updatedAt: Timestamp.now() });
    });
  });
  const splitBatch = (who: string, receipt: string) => {
    const db = as(who);
    const at = { km: 1500, photoId: who === ANA ? id20(3) : null };
    const b = writeBatch(db);
    b.update(doc(db, 'trips', 'enCurso'), { end: at, updatedAt: serverTimestamp() });
    b.set(doc(db, 'trips', 'sigue'), trip(who, { start: at, end: { km: null, photoId: null }, note: 'Sigue después de repostar' }));
    b.set(doc(db, 'refuels', 'r2'), refuel(who, receipt, { odometerKm: 1500, odometerPhotoId: at.photoId }));
    return b.commit();
  };
  it('se guardan juntos: repostaje, viaje terminado (aunque sea de hace días) y viaje nuevo', async () => {
    await assertSucceeds(splitBatch(ANA, id20(1)));
  });
  it('nadie puede terminar el viaje en curso de otra persona al repostar', async () => {
    await assertFails(splitBatch(LUIS, id20(4)));
    // y como el lote es todo o nada, no se ha guardado ni el repostaje
    await env.withSecurityRulesDisabled(async (ctx) => {
      const r = await getDoc(doc(ctx.firestore(), 'refuels', 'r2'));
      if (r.exists()) throw new Error('el repostaje no debería haberse guardado');
    });
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
  it('ni usar como cuentakilómetros la foto de un ticket propio', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => setDoc(doc(ctx.firestore(), 'evidence', id20(4)), { owner: LUIS, kind: 'receipt', mime: 'image/jpeg', data: JPEG, createdAt: Timestamp.now() }));
    await assertFails(updateDoc(doc(as(LUIS), 'trips', 'viejo'), { start: { km: 1000, photoId: id20(4) }, updatedAt: serverTimestamp() }));
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

describe('Bizum que no se marcó o que no llegó', () => {
  // Repostaje id20(9): lo pagó Ana. Luis le debe su parte.
  it('quien lo recibió puede anotarlo como recibido; nadie puede anotarse dinero a su favor de parte de otro', async () => {
    const p = (over: Record<string, unknown> = {}) => ({ refuelId: id20(9), debtor: LUIS, creditor: ANA, amountCents: 2000, status: 'confirmed', sentAt: serverTimestamp(), confirmedAt: serverTimestamp(), ...over });
    await assertSucceeds(setDoc(doc(as(ANA), 'payments', `${id20(9)}__${LUIS}`), p()));
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'members', ANA), { name: 'Ana', color: 'c1' });
      await setDoc(doc(ctx.firestore(), 'members', LUIS), { name: 'Luis', color: 'c2' });
      await setDoc(doc(ctx.firestore(), 'refuels', id20(9)), { ...refuel(ANA, id20(1)), createdAt: Timestamp.now() });
    });
    // Luis no puede anotar como «recibido» un pago a su favor (no es quien llenó)
    await assertFails(setDoc(doc(as(LUIS), 'payments', `${id20(9)}__${ANA}`), p({ debtor: ANA, creditor: LUIS })));
    // ni Luis confirmarse a sí mismo su propio pago a Ana
    await assertFails(setDoc(doc(as(LUIS), 'payments', `${id20(9)}__${LUIS}`), p()));
    // ni Ana anotar a alguien de fuera de la familia
    await assertFails(setDoc(doc(as(ANA), 'payments', `${id20(9)}__${EVIL}`), p({ debtor: EVIL })));
  });
  it('quien lo iba a recibir puede rechazar un Bizum marcado que no llegó; uno confirmado ya no se borra', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'payments', `${id20(9)}__${LUIS}`), { refuelId: id20(9), debtor: LUIS, creditor: ANA, amountCents: 2000, status: 'sent', sentAt: Timestamp.now(), confirmedAt: null });
    });
    await assertSucceeds(deleteDoc(doc(as(ANA), 'payments', `${id20(9)}__${LUIS}`)));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'payments', `${id20(9)}__${LUIS}`), { refuelId: id20(9), debtor: LUIS, creditor: ANA, amountCents: 2000, status: 'confirmed', sentAt: Timestamp.now(), confirmedAt: Timestamp.now() });
    });
    await assertFails(deleteDoc(doc(as(ANA), 'payments', `${id20(9)}__${LUIS}`)));
    await assertFails(deleteDoc(doc(as(LUIS), 'payments', `${id20(9)}__${LUIS}`)));
  });
});

describe('Km misterio: respuestas', () => {
  const ans = (over: Record<string, unknown> = {}) => ({ fromKm: 1000, toKm: 1100, member: ANA, used: true, km: 40, day: '2026-11-03', createdAt: serverTimestamp(), ...over });
  it('cada uno responde por sí mismo (sí con día y km, o no) y puede cambiarlo', async () => {
    await assertSucceeds(setDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), ans()));
    await assertSucceeds(updateDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), { used: false, km: 0, day: null }));
    await assertSucceeds(setDoc(doc(as(LUIS), 'gapAnswers', `1000-1100__${LUIS}`), ans({ member: LUIS, used: false, km: 0, day: null })));
    await assertSucceeds(getDoc(doc(as(LUIS), 'gapAnswers', `1000-1100__${ANA}`)));
  });
  it('no se puede responder por otro, ni cambiar la respuesta de otro, ni datos sin sentido', async () => {
    await assertFails(setDoc(doc(as(LUIS), 'gapAnswers', `1000-1100__${ANA}`), ans()));
    await assertFails(setDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), ans({ km: 101 }))); // más km que el hueco
    await assertFails(setDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), ans({ km: 0 })));
    await assertFails(setDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), ans({ used: false })));
    await assertFails(setDoc(doc(as(ANA), 'gapAnswers', `1000-1200__${ANA}`), ans()));
    await assertFails(setDoc(doc(as(EVIL), 'gapAnswers', `1000-1100__${EVIL}`), ans({ member: EVIL })));
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'gapAnswers', `1000-1100__${ANA}`), { ...ans(), createdAt: Timestamp.now() });
    });
    await assertFails(updateDoc(doc(as(LUIS), 'gapAnswers', `1000-1100__${ANA}`), { used: false, km: 0, day: null }));
    await assertFails(updateDoc(doc(as(ANA), 'gapAnswers', `1000-1100__${ANA}`), { toKm: 1500 }));
    await assertFails(deleteDoc(doc(as(LUIS), 'gapAnswers', `1000-1100__${ANA}`)));
  });
});

describe('Fecha y hora de llegada', () => {
  it('se guarda con el km final; no antes de la salida ni sin km final', async () => {
    const at = (ms: number) => Timestamp.fromMillis(Date.now() + ms);
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 'llegada1'), trip(ANA, { endDate: at(-30_000) })));
    await assertFails(setDoc(doc(as(ANA), 'trips', 'llegada2'), trip(ANA, { endDate: at(-120_000) }))); // antes de salir
    await assertFails(setDoc(doc(as(ANA), 'trips', 'llegada3'), trip(ANA, { end: { km: null, photoId: null }, endDate: at(-30_000) }))); // sin km final
    await assertFails(setDoc(doc(as(ANA), 'trips', 'llegada5'), trip(ANA, { endDate: at(2 * 3600_000) }))); // en el futuro
    // Un viaje sin llegada (como los antiguos) sigue valiendo.
    await assertSucceeds(setDoc(doc(as(ANA), 'trips', 'llegada4'), trip(ANA)));
  });
});
