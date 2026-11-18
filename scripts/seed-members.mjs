// Da de alta (o actualiza) la lista blanca de la familia en Firestore con el Admin SDK.
// Uso:
//   1. Descarga una clave de cuenta de servicio (Consola > Configuración > Cuentas de servicio)
//      y guárdala como service-account.json en esta carpeta (está en .gitignore: NO la subas).
//   2. Copia members.example.json a members.json y pon los 5 correos de Google.
//   3. npm run seed:members
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const sa = JSON.parse(readFileSync('service-account.json', 'utf8'));
const members = JSON.parse(readFileSync('members.json', 'utf8'));
if (!Array.isArray(members) || members.length === 0 || members.length > 10) throw new Error('members.json debe ser una lista de 1 a 10 personas');

initializeApp({ credential: cert(sa) });
const db = getFirestore();
const COLORS = ['c1', 'c2', 'c3', 'c4', 'c5'];
const keep = new Set();
for (const [i, m] of members.entries()) {
  const email = String(m.email ?? '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error(`Correo no válido: ${m.email}`);
  const name = String(m.name ?? '').trim().slice(0, 60);
  if (!name) throw new Error(`Falta el nombre de ${email}`);
  const color = COLORS.includes(m.color) ? m.color : COLORS[i % COLORS.length];
  await db.doc(`members/${email}`).set({ name, color, admin: m.admin === true });
  keep.add(email);
  console.log('✓', email, name, color);
}
// Quien ya no está en el fichero pierde el acceso (sus viajes y pagos se conservan).
const existing = await db.collection('members').get();
for (const d of existing.docs) {
  if (!keep.has(d.id)) {
    await d.ref.delete();
    console.log('✗ acceso retirado:', d.id);
  }
}
console.log('Lista blanca actualizada.');
