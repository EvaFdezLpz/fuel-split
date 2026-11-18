---
name: Depósito común
description: Libro de cuentas de gasolina del coche familiar, leído como el tótem de precios de una gasolinera.
colors:
  ground: "oklch(95.2% 0.004 250)"
  surface: "oklch(99.2% 0.002 250)"
  surface-2: "oklch(97.4% 0.003 250)"
  ink: "oklch(21% 0.014 258)"
  ink-2: "oklch(43% 0.014 258)"
  ink-3: "oklch(55% 0.012 258)"
  line: "oklch(89% 0.005 255)"
  line-strong: "oklch(80% 0.006 255)"
  panel: "oklch(19.5% 0.012 258)"
  panel-2: "oklch(25% 0.014 258)"
  panel-line: "oklch(31% 0.014 258)"
  panel-ink: "oklch(94% 0.006 250)"
  panel-ink-2: "oklch(74% 0.012 250)"
  led: "oklch(83% 0.165 74)"
  led-off: "oklch(29% 0.028 70)"
  led-ok: "oklch(82% 0.17 152)"
  led-bad: "oklch(72% 0.19 28)"
  accent: "oklch(80% 0.16 72)"
  accent-press: "oklch(74% 0.16 68)"
  accent-ink: "oklch(22% 0.03 60)"
  ok: "oklch(50% 0.12 155)"
  ok-bg: "oklch(95% 0.035 155)"
  warn: "oklch(52% 0.12 65)"
  warn-bg: "oklch(95.5% 0.045 80)"
  bad: "oklch(52% 0.18 27)"
  bad-bg: "oklch(95.5% 0.03 25)"
  c1: "#2a64a8"
  c2: "#d47a38"
  c3: "#27a078"
  c4: "#8a7ad6"
  c5: "#ab4277"
typography:
  headline:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.45rem"
    fontWeight: 650
    lineHeight: 1.45
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 92"
  title:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "1.02rem"
    fontWeight: 620
    lineHeight: 1.45
    letterSpacing: "-0.012em"
    fontVariation: "'wdth' 92"
  body:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    fontFeature: "'tnum'"
  label:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.84rem"
    fontWeight: 580
    lineHeight: 1.45
  code:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 620
    letterSpacing: "0.03em"
    fontVariation: "'wdth' 85"
  caption:
    fontFamily: "Archivo Variable, system-ui, -apple-system, Segoe UI, sans-serif"
    fontSize: "0.72rem"
    fontWeight: 450
    lineHeight: 1.45
rounded:
  xs: "3px"
  sm: "4px"
  md: "6px"
  lg: "10px"
  full: "999px"
spacing:
  2xs: "4px"
  xs: "6px"
  sm: "10px"
  md: "12px"
  lg: "16px"
  stack: "18px"
  stack-desktop: "22px"
  page-desktop: "28px 32px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  button-primary-hover:
    backgroundColor: "{colors.accent-press}"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  button-secondary-hover:
    backgroundColor: "{colors.surface-2}"
  button-dark:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.panel-ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "42px"
  button-dark-hover:
    backgroundColor: "{colors.panel-2}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "0 16px"
  button-sm:
    rounded: "{rounded.md}"
    padding: "0 11px"
    height: "34px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "9px 12px"
    height: "44px"
  input-big:
    typography: "{typography.headline}"
    height: "52px"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.full}"
    padding: "5px 12px 5px 6px"
  chip-selected:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
  pill-ok:
    backgroundColor: "{colors.ok-bg}"
    textColor: "{colors.ok}"
    rounded: "{rounded.full}"
    padding: "2px 8px 2px 6px"
  pill-warn:
    backgroundColor: "{colors.warn-bg}"
    textColor: "{colors.warn}"
    rounded: "{rounded.full}"
    padding: "2px 8px 2px 6px"
  pill-bad:
    backgroundColor: "{colors.bad-bg}"
    textColor: "{colors.bad}"
    rounded: "{rounded.full}"
    padding: "2px 8px 2px 6px"
  pill-neutral:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.full}"
    padding: "2px 8px 2px 6px"
  totem:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.panel-ink}"
    rounded: "{rounded.lg}"
  totem-row:
    padding: "12px 16px"
  block:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "0 16px 16px"
  nav-rail:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.panel-ink-2}"
    width: "236px"
    padding: "20px 14px"
  nav-rail-link-active:
    backgroundColor: "{colors.panel-2}"
    textColor: "{colors.panel-ink}"
    rounded: "{rounded.md}"
    padding: "9px 10px"
  tab-bar:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.panel-ink-2}"
  tab-active:
    textColor: "{colors.led}"
  avatar:
    rounded: "{rounded.full}"
    size: "30px"
  toast:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.panel-ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
---

# Design System: Depósito común

## Overview

**Creative North Star: "El tótem de la gasolinera"**

Las cifras que importan (lo que debes, lo que te deben, el cuentakilómetros, el último €/l) se encienden en un panel grafito como dígitos de siete segmentos ámbar, con la etiqueta a la izquierda y el número a la derecha, igual que el poste de precios de una estación de servicio. Todo lo demás es papel de trabajo: bloques claros sobre un suelo gris de poste, tablas densas, separadores de un pelo. La interfaz es un instrumento de lectura rápida para usar de pie junto al coche, no un panel de control.

El sistema tiene dos materiales y no más: el **panel** (grafito casi negro con un punto azulado, el tótem, la barra superior, el rail y la barra de pestañas) y el **papel** (superficies claras con borde fino). La luz solo existe dentro del panel: ámbar para cifras, verde para lo cobrado, rojo para lo que se debe. En modo oscuro el papel baja a grafito medio y el panel se hunde todavía más, de modo que el tótem sigue siendo lo más oscuro y lo más iluminado de la pantalla.

Se rechaza explícitamente el dashboard fintech de tarjetas blancas con acento azul marino y gráficos de donut.

**Key Characteristics:**
- Un solo acento ámbar (LED) para cifras encendidas, la pestaña activa y la acción principal.
- Dígitos SVG de siete segmentos con los segmentos apagados visibles y tenues.
- Archivo Variable con numerales tabulares en toda la interfaz y anchura comprimida en títulos.
- Esquinas casi rectas (6px), separadores de 1px, tablas densas.
- Cada registro lleva su código secuencial (V-0042, R-007) y cada miembro su color fijo e iniciales.

## Colors

Grafito frío y gris de poste como base, una única luz ámbar, y verde y rojo reservados para su significado.

### Primary
- **Ámbar LED** (`led`): relleno de los segmentos encendidos, indicador de pestaña activa, icono activo del rail, icono del toast, color de selección de texto. Siempre con su halo (`led-glow`, 45% de opacidad).
- **Ámbar de botón** (`accent`): fondo de la acción principal ("Registrar viaje"); al pulsar o pasar por encima baja a **Ámbar prensado** (`accent-press`), que también es el color del anillo de foco, del cursor de texto y del punto pulsante de viaje en curso. El texto sobre ámbar es **Tinta tostada** (`accent-ink`), nunca blanco.

### Secondary
- **Verde cobrado** (`led-ok` en el panel, `ok` / `ok-bg` en papel): "Te deben", pagos confirmados, evidencias con foto o que cuadran.
- **Rojo debido** (`led-bad` en el panel, `bad` / `bad-bg` en papel): "Debes", errores, campos inválidos, acciones destructivas.
- **Ocre de aviso** (`warn` / `warn-bg`): evidencias sin foto o inferidas, avisos generales.

### Tertiary
- **Colores de miembro** (`c1` azul, `c2` naranja, `c3` verde, `c4` violeta, `c5` rosa): uno fijo por persona, en el punto junto al nombre, el avatar, los segmentos de la barra de tramo y las barras del gráfico de km. En oscuro se sustituyen por variantes ajustadas (ver sidecar). No se usan para nada más.

### Neutral
- **Gris de poste** (`ground`): fondo de página.
- **Papel** (`surface`) y **Papel sombreado** (`surface-2`): bloques, campos, botones secundarios; `surface-2` para hover de filas, cabeceras de tramo, controles segmentados.
- **Tinta** (`ink`, `ink-2`, `ink-3`): texto principal, secundario (subtítulos, cabeceras de tabla, unidades) y terciario (placeholder, escalas).
- **Filete** (`line`) y **Filete marcado** (`line-strong`): divisores de filas y bordes de bloque; bordes de botón y campo, línea bajo cabeceras de tabla.
- **Grafito de panel** (`panel`, `panel-2`, `panel-line`, `panel-ink`, `panel-ink-2`): tótem, barra superior, rail, barra de pestañas, login y toast; `panel-2` para hover y elemento activo, `panel-line` para divisores dentro del panel.
- **Segmento apagado** (`led-off`): ámbar casi negro de los segmentos no encendidos.

Modo oscuro (cascada final de `styles.css`): `ground` oklch(20.5% 0.01 258), `surface` oklch(24% 0.011 258), `surface-2` oklch(27% 0.012 258), `line` oklch(32% 0.012 258), `line-strong` oklch(40% 0.012 258), `panel` oklch(12.5% 0.01 258), `panel-2` oklch(17% 0.012 258), `panel-line` oklch(30% 0.014 258); la tinta se invierte y los estados `ok`/`warn`/`bad` suben de luminosidad. Los LED y el ámbar no cambian. El tótem gana un borde `panel-line` y el botón oscuro pasa a `panel-2` con borde `line-strong` para no perderse.

### Named Rules
**La Regla de la Luz Única.** El ámbar es la única luz del sistema. Aparece en cifras encendidas, en lo activo y en una sola acción principal por pantalla; nunca como color decorativo de texto, borde o fondo de bloque.

**La Regla del Semáforo Honesto.** Verde y rojo solo significan cobrado y debido (o válido e inválido). Una cifra en cero o sin datos se muestra en tono atenuado, nunca en verde ni en rojo por estética.

**La Regla del Color Propio.** Cada miembro tiene un color fijo (`c1`–`c5`) que se usa siempre igual: punto, avatar, barra. Ese color no se reutiliza para estados ni para categorías.

## Typography

**Display Font:** dígitos de siete segmentos en SVG (`segments.ts`), no una tipografía.
**Body Font:** Archivo Variable (con system-ui, -apple-system, Segoe UI, sans-serif)

**Character:** Una grotesca industrial con eje de anchura: comprimida (88–92%) en títulos y marca, normal en el texto, y con numerales tabulares activados globalmente para que las columnas de km y euros alineen.

### Hierarchy
- **Cifra de tótem** (segmentos SVG, 30px en móvil, 38px en escritorio, 32px en la pantalla del surtidor; altura 1em): solo dentro del tótem. Inclinación de -5°, rellenado por la izquierda con dígitos apagados (`minDigits`). Unidad al lado en 0.8rem / 560 / `panel-ink-2`.
- **Headline** (650, 1.45rem, anchura 92%): título de página (h1).
- **Title** (620, 1.02rem, anchura 92%): cabeceras de bloque y diálogo (h2); h3 a 600 / 0.95rem.
- **Etiqueta de tótem** (560, 0.95rem, anchura 90%, interlineado 1.2) con subtítulo a 420 / 0.76rem.
- **Body** (400, 15px, interlineado 1.45): texto corriente, tablas a 0.9rem.
- **Label** (580, 0.84rem): etiquetas de campo. Pistas a 0.8rem en `ink-2`.
- **Código** (620, 0.82rem, anchura 85%, espaciado 0.03em, `ink-2`): códigos de registro V-0018, R-003.
- **Caption** (450–520, 0.7–0.72rem): pestañas inferiores, escalas, etiquetas de barras, subtítulo de marca.

### Named Rules
**La Regla de la Cifra Encendida.** Solo las cifras que deciden algo (saldo, cuentakilómetros, €/l) van en segmentos, y solo dentro del panel. En papel los números van en Archivo con numerales tabulares y peso 620–650.

**La Regla del Tabular.** `font-variant-numeric: tabular-nums` está en `body`; ninguna pieza lo desactiva.

## Layout

Móvil primero. En móvil: barra superior grafito fija (marca + avatar), contenido en una columna con relleno 16px y 96px abajo para la barra de pestañas fija de cinco entradas. Desde 960px: rail grafito fijo de 236px a la izquierda, barra superior y pestañas ocultas, contenido con relleno 28px 32px y ancho máximo 1180px.

El ritmo vertical entre bloques es 18px en móvil y 22px en escritorio (`stack`). Dentro de un bloque: cabecera 14px 16px 10px, cuerpo 0 16px 16px, filas 12px 16px. Desde 960px el tótem pasa de filas apiladas a 3 o 4 columnas con divisores verticales, y aparece la rejilla 1.35fr / 1fr para tabla de viajes y pagos pendientes. Desde 1100px los formularios se parten en columna de 620px más un lateral fijo (sticky). Por debajo de 640px las tablas marcadas como fichas se convierten en filas-ficha de dos columnas y los filtros en rejilla de 2.

Las acciones principales en móvil son dos botones a partes iguales de 52px de alto; en escritorio, botones en línea de 44px.

## Elevation & Depth

Sistema plano con capas tonales. El papel se separa del suelo por el borde de 1px, no por sombra. La profundidad real es el contraste panel / papel: el tótem es la pieza más oscura y la única que lleva sombra de reposo, junto con el toast. El diálogo usa una sombra larga sobre un velo grafito al 55%. En oscuro las sombras se endurecen y el tótem añade borde.

### Shadow Vocabulary
- **Reposo de panel** (`--shadow`): tótem y toast.
- **Diálogo** (`0 24px 60px -20px oklch(10% 0.02 258 / 0.5)`): solo diálogos modales.
- **Halo LED** (`drop-shadow(0 0 3px <glow>)`): segmentos encendidos; `0 0 8px` en el indicador de pestaña activa.
- **Segmento pulsado** (`0 1px 2px oklch(20% 0.02 258 / 0.12)`): opción activa del control segmentado.

### Named Rules
**La Regla del Papel Plano.** Los bloques de papel nunca llevan sombra; si algo necesita destacar, va al panel.

**La Regla del Brillo con Causa.** El halo solo rodea luz encendida (segmentos, pestaña activa, pulso en curso). Nada de papel brilla.

## Shapes

Esquinas casi rectas: 6px (`md`) para botones, campos, avisos, toast y enlaces del rail; 10px (`lg`) para contenedores (tótem, bloques, lecturas, diálogos, viaje en curso); 4px para piezas pequeñas (barra de tramo, barras del gráfico, opciones segmentadas); 3px para la matrícula del tótem y el anillo de foco. Píldoras y chips son totalmente redondos, igual que avatares y puntos de miembro. Los segmentos son hexágonos alargados con puntas en bisel. Bordes siempre de 1px; el discontinuo queda reservado al recuadro de cálculo derivado y la trama diagonal a 135° a los huecos sin km registrados en la barra de tramo.

## Components

### Buttons
Firmes y planos, con una ligera presión al pulsar.
- **Shape:** esquinas casi rectas (6px), alto 42px, relleno horizontal 16px, peso 580, icono a 8px.
- **Primary:** ámbar con tinta tostada; uno por pantalla.
- **Secondary:** papel con borde `line-strong`; hover a `surface-2` y borde `ink-3`.
- **Dark:** panel grafito con `panel-ink`; acompaña a la principal ("Repostar").
- **Ghost:** sin borde ni fondo; hover `surface-2`. Danger: tinta `bad`.
- **Hover / Focus:** transición 0.15s de fondo y borde; `translateY(1px)` al pulsar; foco con contorno 2px `accent-press` a 2px de distancia. Deshabilitado al 55%; ocupado muestra un spinner de 14px y texto "Guardando…".
- **Small:** 34px, relleno 11px, 0.86rem.

### Chips
- **Style:** papel con borde `line-strong`, redondo, 0.88rem / 540, con avatar pequeño a la izquierda.
- **State:** seleccionado o página actual se invierte a fondo `ink` y texto `surface`.

### Píldoras de evidencia
- **Style:** redondas, 0.76rem / 560, icono de 13px; `ok` (Foto, Cuadra), `warn` (Sin foto, Inferido), `neutral` (En curso). Si abren la foto son botones con borde `currentColor` al hover.

### Cards / Containers
- **Corner Style:** 10px.
- **Background:** `surface` sobre `ground`.
- **Shadow Strategy:** ninguna (La Regla del Papel Plano).
- **Border:** 1px `line`.
- **Internal Padding:** 16px; filas internas separadas por filete superior.

### Inputs / Fields
- **Style:** papel, borde `line-strong`, 6px, alto 44px, 1rem; variante grande 52px a 1.35rem / 620 para lecturas de km e importes, con la unidad dentro a la derecha.
- **Focus:** borde `accent-press` y anillo ámbar de 3px al 30%.
- **Error / Disabled:** borde `bad` y mensaje 0.82rem / 540 en `bad`.

### Navigation
- **Rail (escritorio):** grafito, enlaces 9px 10px a 520 en `panel-ink-2`; hover y activo a `panel-2` con `panel-ink`, icono activo en ámbar LED. Usuario y cierre de sesión al pie tras un filete `panel-line`.
- **Pestañas (móvil):** grafito, cinco columnas, icono sobre texto 0.7rem / 520; la activa en ámbar con una barra de luz de 2px arriba y halo.

### Tótem (componente firma)
Panel grafito de 10px con cabecera pequeña (saludo y matrícula "C3 · 2005" en recuadro de 3px) y filas etiqueta–cifra separadas por `panel-line`. Las cifras son segmentos SVG con todos los segmentos dibujados: encendidos en ámbar, verde o rojo según el tono, apagados en `led-off`; sin datos se muestra `------` en ámbar al 32% sin halo. Las filas enlazables se aclaran a `panel-2` al hover.

### Barra de tramo
Barra de 14px con esquinas de 4px, mismo eje de km en todos los tramos para que se comparen; cada tramo en el color del miembro que condujo, huecos con trama diagonal, escala 0 / mitad / máximo debajo y leyenda de puntos con km.

## Do's and Don'ts

### Do:
- **Do** poner saldo, cuentakilómetros y €/l en segmentos dentro de un panel grafito, etiqueta a la izquierda y cifra a la derecha.
- **Do** dibujar siempre los segmentos apagados (`led-off`) y rellenar por la izquierda para que las cifras no bailen.
- **Do** usar un único botón ámbar por pantalla; la acción hermana va en botón oscuro de panel.
- **Do** acompañar cada registro de su código (V-0000, R-000) en el estilo de código y cada persona de su punto o avatar de color fijo.
- **Do** separar con filetes de 1px y mantener las esquinas en 6px / 10px.
- **Do** respetar `prefers-reduced-motion`: todas las animaciones y transiciones se anulan.

### Don't:
- **Don't** construir el dashboard fintech de tarjetas blancas con acento azul marino y gráficos de donut.
- **Don't** usar verde o rojo para algo que no sea cobrado / debido o válido / inválido.
- **Don't** poner sombra a los bloques de papel ni halo a nada que no sea luz encendida.
- **Don't** usar segmentos fuera del panel ni para cifras secundarias (importes de lista, km de viaje).
- **Don't** reutilizar los colores de miembro para estados o categorías.
