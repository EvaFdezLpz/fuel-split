# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Firebase (Auth con Google, Firestore, Storage, Hosting en `*.web.app`) + Vite + TypeScript sin framework de UI. OCR de cuentakilómetros en cliente (Tesseract.js).

## Users

Una familia de hasta 5 personas que comparte un Citroën C3 de 2005. Usan la app desde el móvil justo al subir o bajar del coche (registrar km) y en la gasolinera (registrar repostaje), y de vez en cuando desde casa para ver cuánto deben o les deben.

## Product Purpose

Repartir de forma justa y con pruebas el gasto de gasolina. Cada viaje registra km inicial y final (foto del cuentakilómetros con lectura automática, o manual). Cada repostaje registra importe, precio por litro y foto del ticket; el importe se reparte entre quienes condujeron en proporción a los km hechos desde el repostaje anterior. Quien reposta paga; los demás le hacen Bizum y lo marcan como pagado. Éxito: nadie discute cuentas porque todo tiene evidencia.

## Positioning

Libro de cuentas del coche familiar basado en evidencias: cada cifra lleva su foto y los huecos del cuentakilómetros se detectan solos comparando la lectura final de un viaje con la inicial del siguiente.

## Operating Context

- Identificación por correo de Google; solo correos en lista blanca acceden.
- Pagos fuera de la app (Bizum); la app solo registra que se hicieron.
- Si a alguien se le olvida la foto o el km, la app infiere el valor a partir del siguiente registro y lo marca como pendiente de evidencia.

## Capabilities and Constraints

- Registro de viajes: km inicio/fin, foto opcional pero exigida como evidencia (se marca si falta), persona, fecha.
- Repostajes: importe, €/l, litros derivados, foto del ticket obligatoria, reparto por km.
- Gastos / deudas: estado pagado por cada deudor, confirmable.
- Perfil: total pagado, total km, desglose por tramos (entre repostajes) y viajes, filtrable por fechas.
- Seguridad: OWASP Top 10 y labs de PortSwigger Web Security Academy aplicables (XSS, CSRF, clickjacking, IDOR/control de acceso, subida de ficheros, etc.).

## Brand Commitments

Aspecto profesional, sector finanzas/carburante; que no parezca hecho con IA.

## Evidence on Hand

Ninguna todavía. No inventar datos de uso ni testimonios.

## Product Principles

1. Toda cifra tiene evidencia o queda marcada como pendiente.
2. El cálculo es transparente: se ve de dónde sale cada euro.
3. Registrar un viaje desde el móvil cuesta segundos.
4. El servidor es la fuente de verdad de permisos; el cliente nunca decide quién puede qué.
