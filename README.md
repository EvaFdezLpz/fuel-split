# Depósito común

Cuentas de gasolina del coche familiar (Citroën C3 de 2005, hasta 5 conductores).

- **Viajes**: foto del cuentakilómetros al salir y al llegar (la cifra se lee sola en el móvil) o número a mano. Si alguien olvida el km final, se toma del inicio del siguiente viaje y queda marcado.
- **Repostajes**: foto de la pantalla del surtidor (obligatoria); el importe y el precio por litro se leen solos (lector propio de cifras de 7 segmentos, LCD o LED, y OCR de texto como respaldo) y se comprueba que importe ≈ litros × precio. Todo editable. El importe se reparte por los km que hizo cada uno desde el repostaje anterior.
- **Reservas**: cualquiera anota los días que necesita el coche y para qué. Salen como tarjetas, en el calendario de todos y en el resumen; avisa si coincide con la reserva de otra persona. Cada uno edita y borra solo las suyas (lo exigen las reglas de Firestore).
- **Gastos**: cada uno marca su Bizum como enviado y quien pagó lo confirma.
- **Perfil**: km y dinero de cada persona, por tramos y por viajes, filtrable por fechas.

## Puesta en marcha (una vez)

1. Crea un proyecto en <https://console.firebase.google.com> (el plan gratuito Spark es suficiente: las fotos se guardan comprimidas en Firestore, sin Cloud Storage).
2. **Authentication** → Método de acceso → activa **Google**.
3. **Firestore Database** → Crear base de datos (modo producción, región `eur3` o `europe-southwest1`).
4. **Configuración del proyecto** → Tus apps → añade una app web. Copia `.env.example` a `.env` y rellena los valores. En `VITE_FB_AUTH_DOMAIN` pon `TU-PROYECTO.web.app`.
5. Instala y conecta la CLI:
   ```bash
   npm install
   npx firebase login
   npx firebase use --add      # elige tu proyecto
   ```
6. Lista blanca de la familia: copia `members.example.json` a `members.json` con los 5 correos de Google, descarga una clave de cuenta de servicio como `service-account.json` y ejecuta `npm run seed:members`. Después borra la clave.
7. Despliega:
   ```bash
   npm run deploy
   ```
   Queda en `https://TU-PROYECTO.web.app`.
8. Sigue los pasos de “Lo que tienes que hacer tú en la consola” en [SECURITY.md](SECURITY.md).

## Desarrollo

```bash
npm run dev          # http://localhost:5173/?demo  → datos de ejemplo, sin Firebase
                     # ?demo&como=lucia             → ver la app como otra persona
                     # ?demo&mucho                  → ~2 años de datos para probar paginaciones
npm run movil        # simulador de móvil: la app (demo) dentro de marcos de iPhone, Pixel, Galaxy, iPad
npm test             # pruebas del cálculo de repartos
npm run test:rules   # pruebas de seguridad de las reglas (necesita Java)
```

Para añadir o quitar personas, edita `members.json` y vuelve a ejecutar `npm run seed:members`. Si cambias las cabeceras de `security-headers.mjs`, ejecuta `node scripts/write-firebase-json.mjs`.

## Si alguien se olvida de apuntar

- **Km sin apuntar**: en Viajes (y avisado en el Resumen) salen los huecos entre un viaje y el siguiente. Quien usó el coche pulsa **Fui yo** y guarda el viaje con los km del hueco ya puestos (con foto si la tiene). Si nadie los reclama, se reparten según los km de cada uno.
- **Foto olvidada**: cada uno puede añadir la foto que falte a sus viajes en cualquier momento. Pasada una semana solo se puede añadir la foto; los km y la fecha ya no se cambian.
- **Ajustes**: si un viaje o repostaje apuntado tarde cambia un reparto que ya estaba pagado, la app calcula la diferencia y la pide (o la devuelve quien llenó el depósito) con un **Bizum de ajuste**, que se confirma igual que los demás.

## Cómo se calcula

- Cada repostaje paga los km entre el repostaje anterior y este. A cada persona le toca `importe × sus km / km registrados del tramo`, en céntimos exactos (lo que sobra por redondeo se asigna con el método del mayor resto).
- Km que nadie registró en el tramo (huecos) no se cobran a nadie y se avisan.
- Estados de evidencia: **Foto**, **Cuadra** (sin foto pero coincide con otra lectura con foto), **Sin foto**, **Inferido** (tomado del siguiente viaje) y **En curso**.
