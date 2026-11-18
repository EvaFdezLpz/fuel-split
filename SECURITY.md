# Seguridad de Depósito común

La app es una SPA estática (Firebase Hosting) que habla directamente con Firestore. **La frontera de seguridad son las reglas de Firestore** (`firestore.rules`): el navegador se puede manipular, las reglas no. Están cubiertas por 38 pruebas automáticas contra el emulador (`npm run test:rules`).

## OWASP Top 10 (2021)

| Riesgo | Medidas |
|---|---|
| **A01 Control de acceso roto / IDOR** | Lista blanca en `/members` (solo escribible con Admin SDK). Cada escritura comprueba que el autor es `request.auth.token.email`: nadie crea viajes, repostajes, fotos o pagos a nombre de otro. Solo el conductor edita su viaje; solo quien pagó borra su repostaje (24 h); solo el deudor marca un Bizum y solo el acreedor lo confirma. Una foto solo la puede usar quien la subió, y a un viaje solo se le pueden vincular fotos de cuentakilómetros (no tickets). Pasada una semana, un viaje solo admite añadir la foto que faltaba. Ruta comodín denegada. |
| **A02 Fallos criptográficos** | Solo HTTPS (HSTS con preload, `upgrade-insecure-requests`). Sin secretos en el cliente (la API key de Firebase es pública por diseño; restríngela por dominio). |
| **A03 Inyección / XSS** | El DOM se construye solo con `textContent`/`createElement` (`src/dom.ts`), sin `innerHTML`. CSP estricta sin `unsafe-inline` ni `unsafe-eval`. **Trusted Types obligatorios** con política por defecto que sanea con DOMPurify y solo admite scripts de orígenes permitidos. Atributos `on*`/`style` y URLs no permitidas se descartan. Consultas Firestore sin concatenación de cadenas (no hay inyección NoSQL). |
| **A04 Diseño inseguro** | Validación de negocio en servidor: km enteros y coherentes (final ≥ inicial, ≤ 3.000 km por viaje), importes 1–300 €, precio 0,5–4 €/l, fechas no futuras, `createdAt = request.time`. Repostajes y fotos inmutables. ID de pago determinista (`<repostaje>__<correo>`) → sin duplicados ni condiciones de carrera. |
| **Dinero que no ha llegado** | Un Bizum marcado como enviado pero **sin confirmar** nunca genera deudas a favor de quien lo marcó: los ajustes solo se calculan sobre pagos confirmados por quien los recibe, y los ajustes enviados cubren como mucho lo que falta. Si alguien marca un importe distinto del que le toca, quien lo recibe ve el aviso «No cuadra» antes de confirmar. |
| **A05 Configuración insegura** | Cabeceras: CSP, `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy: no-referrer`, `Permissions-Policy`, COOP. Sin source maps en producción. Mensajes de error genéricos. Modo demo excluido del build de producción. |
| **A06 Componentes vulnerables** | Dependencias fijadas en `package-lock.json`; ningún script cargado de CDNs en tiempo de ejecución; datos del OCR con hash SHA-256 verificado en el build. Revisa `npm audit --omit=dev` antes de desplegar (los avisos actuales de `@grpc/grpc-js` afectan solo a Node, no al navegador). |
| **A07 Fallos de autenticación** | Solo Google (`sign_in_provider == 'google.com'`) con `email_verified`. Si el correo no está en la lista blanca, se cierra la sesión. Sin contraseñas propias que proteger. Al cerrar sesión se borra la copia local de Firestore (viajes, pagos y fotos), para que no quede nada en un dispositivo prestado. |
| **A08 Integridad de software y datos** | Todo el JS se sirve desde el propio dominio. Los documentos que llegan de Firestore se validan campo a campo antes de usarse (`firebase-backend.ts`). |
| **A09 Registro y monitorización** | Cada registro guarda autor y `createdAt` de servidor; las fotos no se pueden borrar. Activa los *Cloud Audit Logs* de Firestore si quieres trazas de acceso. |
| **A10 SSRF** | No hay servidor propio que haga peticiones salientes. |

## Laboratorios de PortSwigger Web Security Academy

| Tema | Estado |
|---|---|
| Cross-site scripting (reflejado, almacenado, DOM) | Sin sumideros HTML; router con lista blanca de rutas y regex estrictas; CSP + Trusted Types. |
| DOM-based (open redirect, cookie manipulation, `postMessage`, DOM clobbering) | No se redirige a URLs de la entrada; sin cookies propias; no se escuchan `postMessage`; no se leen propiedades globales por nombre de elemento. |
| Prototype pollution | No se fusionan objetos desde URL ni JSON externo; parámetros de URL solo se comparan. |
| CSRF | No hay sesión por cookie: Firestore usa tokens Bearer en cabecera. `form-action 'none'`. |
| Clickjacking | `frame-ancestors 'none'`, `X-Frame-Options: DENY` y la app no se pinta si está dentro de un iframe. |
| CORS | No hay API propia; Firestore aplica reglas por usuario, no por origen. |
| Control de acceso / IDOR | Ver A01; probado en `tests/firestore.rules.test.ts`. |
| Vulnerabilidades de subida de ficheros | Firma real del fichero (magic bytes), máx. 15 MB, se decodifica y **se vuelve a codificar como JPEG** en un canvas (elimina EXIF/GPS y contenido políglota). Las reglas solo aceptan base64 de JPEG (`/9j/…`), ≤ 900 KB, sin SVG. Se muestran solo como `data:image/jpeg`. |
| Lógica de negocio | Validaciones de A04; el reparto se calcula de forma determinista con céntimos enteros (sin errores de coma flotante). |
| Condiciones de carrera | IDs deterministas en pagos; las transiciones de estado se validan contra el documento anterior (`resource.data`). |
| Autenticación / OAuth | Delegado en Firebase Auth (estado y nonce gestionados por el SDK); `authDomain` en tu propio dominio. |
| JWT | Verificado por Firestore; la app nunca decodifica ni confía en tokens manualmente. |
| Inyección NoSQL / SQL | No hay consultas construidas con texto del usuario. |
| Revelación de información | Sin source maps, sin trazas en pantalla, `no-referrer`. |
| Deserialización insegura | Solo JSON de Firestore, validado por tipo y tamaño. |
| XXE, SSTI, SSRF, path traversal, request smuggling, host header, web cache poisoning/deception, OS command injection, GraphQL, WebSockets, LLM | No aplican: no hay servidor propio, plantillas de servidor, XML, ni ficheros por ruta. |

## Lo que tienes que hacer tú en la consola

1. **Restringe la API key** en Google Cloud Console → Credenciales → tu clave → Restricciones de aplicación: *Sitios web* `https://TU-PROYECTO.web.app/*` y `https://TU-PROYECTO.firebaseapp.com/*`.
2. En Firebase Auth → Configuración → **Dominios autorizados**: deja solo tus dominios de Hosting (quita `localhost` cuando termines de probar).
3. (Opcional, recomendado) Activa **App Check** con reCAPTCHA Enterprise para bloquear clientes que no sean tu web.
4. Guarda `service-account.json` fuera de cualquier repositorio y bórralo cuando hayas cargado la lista blanca.
