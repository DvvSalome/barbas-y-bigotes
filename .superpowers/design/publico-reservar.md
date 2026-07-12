# Spec de diseño — SITIO PÚBLICO + WIZARD DE RESERVA

Fuente: `Barbas y Bigotes.dc.html` (prototipo Claude Design, ~464KB, un solo archivo).
Extraído literal del markup + del script `DCLogic` embebido. Líneas citadas del prototipo entre paréntesis cuando ayuda.
Frames del prototipo: **móvil** = IOSDevice 430×880 (contenido con `padding-top:58px`, fondo `#0c0b0a`); **desktop** = ChromeWindow 1180×760 con URL simulada (`barbasybigotes.co`, `/reservar`, `/barberos`, `/nosotros`).

---

## 0. Fundamentos globales (tokens, fuentes, keyframes)

### Paleta (constantes del script, L3787-3788)
| Token | Valor | Uso |
|---|---|---|
| `ACC` | `#d23f34` | rojo principal (CTA, acentos, kickers, caret) |
| `SOFT` | `#e8675c` | rojo suave (precios, links, hover, nav activa) |
| `INK` | `#f2ede4` | texto principal |
| `MUT` | `#9c958a` | texto secundario / muted |
| `LINE` | `rgba(242,237,228,.14)` | bordes por defecto |
| `accBg` | `rgba(210,63,52,.14)` | fondo de chip seleccionado |
| `accBorder` | `rgba(210,63,52,.75)` | borde de chip seleccionado |
| — | `#0c0b0a` | fondo base de pantallas (`theme-color` meta también) |
| — | `#151311` | fondo de cards/paneles |
| — | `#211d19` | fondo de paneles nivel 2 / gradientes de botón oscuro |
| — | `#050403` | negro profundo (footer, widget) |
| — | `#fbf7f0` | texto sobre rojo |
| — | `#c9c2b6` | texto secundario claro (sobre fotos) |
| — | `#34d399` | verde éxito ("Libre ahora", "Reserva confirmada", "Incluida") |
| — | `#fbbf24` | ámbar warning ("No disponible hoy") |
| — | `#25D366` | verde WhatsApp |

Bordes sutiles recurrentes: `rgba(242,237,228,.1)` (cards), `rgba(242,237,228,.08)` (divisores), `rgba(242,237,228,.07)` (filas internas).

### Fondo del body (L25)
```css
background: radial-gradient(130% 90% at 50% -10%, #1b1613 0%, #0c0b0a 58%, #050403 100%) fixed;
color: #f2ede4;
```
Links: `a { color:#e8675c }` / `a:hover { color:#d23f34 }`. Selección: `::selection { background:#d23f34; color:#fbf7f0 }`. Scrollbars ocultas. Placeholder de inputs: `#9c958a`. `color-scheme: dark`.

### Tipografía
- **Barlow Condensed** (Google Fonts, weights 500/600/700/800) — display: títulos, precios, botones CTA, números. Casi siempre `text-transform:uppercase`.
- **Inter** (400/500/600/700) — body, `font-family: Inter, system-ui, sans-serif`.
- Números siempre con `font-variant-numeric: tabular-nums`.

### Keyframes globales (L35-49, literales)
```css
@keyframes bbping    { 0%{transform:scale(1); opacity:.5} 75%,100%{transform:scale(1.8); opacity:0} }  /* (redefinida; esta versión gana) */
@keyframes bbpop     { 0%{transform:scale(.4) rotate(-8deg);opacity:0} 60%{transform:scale(1.08) rotate(2deg);opacity:1} 100%{transform:scale(1) rotate(0)} }
@keyframes bbcut     { 0%{clip-path:inset(0 0 100% 0)} 100%{clip-path:inset(0 0 -2% 0)} }
@keyframes bbbuzz    { 0%{transform:translateX(-1.3px)} 100%{transform:translateX(1.3px)} }
@keyframes bbclipper { 0%{top:-48px; opacity:0} 8%{opacity:1} 88%{opacity:1} 100%{top:calc(100% - 8px); opacity:0} }
@keyframes bbwob     { 0%{transform:rotate(-9deg)} 100%{transform:rotate(-14deg)} }
@keyframes bbglow    { 0%,100%{filter:drop-shadow(0 0 18px rgba(210,63,52,.25))} 50%{filter:drop-shadow(0 0 44px rgba(210,63,52,.6))} }
@keyframes bbrise    { 0%{transform:translateY(16px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes bbstamp   { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.3) rotate(8deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes bbkb      { 0%{transform:scale(1) translateY(0)} 100%{transform:scale(1.07) translateY(-1.5%)} }  /* Ken Burns */
@keyframes bbwa      { 0%,100%{transform:translateY(0); box-shadow:0 10px 26px -6px rgba(37,211,102,.6)} 50%{transform:translateY(-4px); box-shadow:0 18px 34px -6px rgba(37,211,102,.75)} }
@keyframes bbdrop    { 0%{opacity:0; transform:translateY(-14px) scale(.9)} 100%{opacity:1; transform:translateY(0) scale(1)} }
@keyframes bbcaret   { 0%,49%{opacity:1} 50%,100%{opacity:0} }
```
Regla suelta: `.bb-card:hover .bb-foto { filter: grayscale(0) !important; }` (fotos de barberos pasan de B/N a color en hover).

### Formato de precios
`new Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 }).format(n)` → "$ 35.000". En chips compactos se le quitan los espacios (`.replace(/\s/g,"")` → "+$5.000").

---

## 1. SITIO PÚBLICO · HOME MÓVIL (L75-225)

Contenedor: columna scrolleable `flex:1; overflow-y:auto; padding-bottom:90px` (deja aire para el CTA sticky).

### 1.1 Header
- Flex `space-between`, `padding:10px 18px`, `border-bottom:1px solid rgba(242,237,228,.1)`.
- Izquierda: `public/brand/logo-lockup.png`, `height:44px`.
- Derecha: botón **"Entrar"** → va a Mi cuenta. Pill: `border:1px solid rgba(242,237,228,.16); color:#f2ede4; border-radius:999px; padding:7px 14px; font-size:12px; background:none`.

### 1.2 Hero (380px, typewriter)
- Contenedor `position:relative; height:380px; overflow:hidden`.
- Imagen `public/sedes/parque-venezuela-interior.jpg` con Ken Burns: `position:absolute; inset:-4%; width:108%; height:108%; object-fit:cover; filter:brightness(1.05) contrast(1.05); animation:bbkb 18s ease-in-out infinite alternate`.
- Overlay: `linear-gradient(180deg, rgba(12,11,10,.25) 0%, rgba(12,11,10,.55) 55%, #0c0b0a 100%)` (funde al fondo).
- Badge **"En vivo"** arriba-derecha: pill `background:rgba(5,4,3,.55); border:1px solid rgba(242,237,228,.14); padding:5px 11px`, punto `6px` `#d23f34` con `box-shadow:0 0 8px #d23f34`, texto `9.5px 700 uppercase ls .14em #f2ede4`.
- Bloque de texto anclado abajo (`left:20px; right:20px; bottom:22px`):
  - Kicker: **"Barranquilla · 2 sedes"** — Barlow Condensed `12px 700`, `letter-spacing:.34em`, uppercase, `#e8675c`.
  - H1 typewriter: Barlow Condensed `44px 800`, `line-height:.95`, uppercase, `min-height:126px` (reserva 3 líneas). Caret: `<span>` inline-block `width:3px; height:.85em; margin-left:3px; vertical-align:-2px; background:#d23f34; animation:bbcaret 1s step-end infinite`.
  - Sub: **"Reservá online, sin filas y con el barbero que te conoce."** — `14px #9c958a; max-width:30ch`.
  - CTA **"Reservar cita"**: `background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; border-radius:999px; padding:13px 26px; Barlow Condensed 16px 700 uppercase ls .06em; box-shadow:0 12px 26px -10px rgba(210,63,52,.7)`.

#### Frases del typewriter (LITERAL, L3755)
```js
heroFrases = [
  "Tu mejor versión sale de la silla",
  "Degradados que hablan por vos",
  "Barba perfilada, actitud renovada",
  "El ritual clásico, hecho arte",
];
```
Timing exacto (L3756-3771): `setInterval` de **60ms**. Escribe 1 carácter por tick; al completar la frase, pausa **26 ticks** (~1.56s) y empieza a borrar 1 carácter por tick; al vaciar, pausa **4 ticks** (~0.24s) y pasa a la siguiente frase (loop infinito). Valor inicial antes de montar: `"Tu mejor versión sale de la silla"`.

### 1.3 Fila de stats (3 columnas)
Grid `repeat(3,1fr)`, celdas `text-align:center; padding:16px 6px; border-right:1px solid rgba(242,237,228,.08)`, borde inferior de la fila `rgba(242,237,228,.1)`. Número Barlow Condensed `26px 800 #f2ede4`; label `10.5px uppercase ls .14em #9c958a`.

Datos (L4726): **"2 / Sedes en Barranquilla"**, **"6 / Barberos expertos"**, **"46 / Servicios y combos"**.

### 1.4 Sección Servicios ("Lo que más piden")
- Padding `26px 18px 8px`. Kicker: **"Servicios"** (`11px uppercase ls .3em #d23f34`). H2: **"Lo que más piden"** (Barlow Condensed `28px 700` uppercase).
- Card lista: `border:1px solid rgba(242,237,228,.1); border-radius:16px; background:#151311; overflow:hidden`.
- Filas (5, los primeros 5 del catálogo con precio pv): flex space-between, `padding:13px 16px; border-bottom rgba(242,237,228,.07)`. Nombre `14px 600`; duración `"{dur} min"` `12px #9c958a`; precio Barlow Condensed `19px 700 #e8675c` tabular, `white-space:nowrap`.
- Filas mostradas: Corte (clásico, degradado o tijera) 30 min $ 35.000 · Corte y barba 60 min $ 45.000 · Corte y cejas 40 min $ 35.000 · Corte + barba + cejas 50 min $ 45.000 · Cerquillos 10 min $ 15.000.
- Botón al pie (full width, dentro de la card): **"Ver todos y reservar →"** — `background:rgba(210,63,52,.06); color:#e8675c; padding:13px; font-size:13px; 600`.

### 1.5 Sección Galería ("Nuestros trabajos")
- Kicker **"Galería"**, H2 **"Nuestros trabajos"** (mismos estilos de sección).
- Grid `1fr 1fr; gap:10px`. Tres fotos: `public/cortes/corte-2.jpg`, `corte-3.jpg`, `corte-5.jpg` — `aspect-ratio:3/4; object-fit:cover; border-radius:12px; border:1px solid rgba(242,237,228,.1)`.
- 4ª celda = CTA tile: `aspect-ratio:3/4; border-radius:12px; border:1px solid rgba(210,63,52,.4); background:rgba(210,63,52,.05)`, columna centrada con **"Tu turno"** (Barlow Condensed `24px 700` uppercase `#e8675c`) y **"Reservar cita →"** (`11px #9c958a`).

### 1.6 Sección Sedes ("Dos casas, un mismo oficio")
- Kicker **"Sedes"**, H2 **"Dos casas, un mismo oficio"**. Padding `26px 18px 30px`.
- Dos cards botón apiladas (`gap:12px`), `height:150px; border-radius:16px; overflow:hidden; border:1px solid rgba(242,237,228,.1)`; foto full-bleed (`parque-venezuela-frente.jpg` / `plaza-de-la-paz-frente.jpg`) + overlay `linear-gradient(180deg, transparent 20%, rgba(12,11,10,.85) 100%)`.
- Texto abajo (flex space-between align-end): nombre Barlow Condensed `22px 700` uppercase; **"Lun–sáb 9 am – 8 pm"** `12px #9c958a`; derecha **"Reservar acá →"** `11px 700 uppercase ls .08em #e8675c`.
- Tap → wizard con sede preseleccionada en paso 2 (goReservarPV / goReservarPP).

### 1.7 Footer móvil (L166-203)
- `margin-top:14px; border-top:1px solid rgba(242,237,228,.08); background:linear-gradient(180deg,#0a0908,#050403); padding:36px 22px 104px; text-align:center`.
- Logo lockup `height:52px; opacity:.95`.
- Tagline: **"El ritual clásico de la barbería en Barranquilla. Tradición, estilo y excelencia en cada detalle."** — `12.5px #9c958a; line-height:1.7; max-width:30ch` centrado.
- Social (gap 10): círculo Instagram 46px (`border:1px solid rgba(242,237,228,.14)`, SVG outline stroke currentColor) → `https://instagram.com/barbasybigotes.baq`; círculo WhatsApp 46px `background:#25D366` (SVG blanco path oficial) → `https://wa.me/573006734799`.
- Divisor "SEDES": líneas degradadas de 1px a los lados + label Barlow Condensed `13px 800 uppercase ls .24em #d23f34`.
- 2 cards de sede (`border rgba(242,237,228,.08); background:rgba(21,19,17,.5); border-radius:14px; padding:14px 16px`):
  - **Parque Venezuela** — "Calle 88 #44 - 10, Local 4" — tel link `+57 300 409 7624` (`tel:+573004097624`, `12.5px #e8675c 700`).
  - **Plaza de la Paz** — "Cra. 45 #50-168, frente a la plaza" — tel link `+57 300 673 4799` (`tel:+573006734799`).
- Pill de horario: **"Lun – Sáb"** `#9c958a` · **"9am – 8pm"** `800 tabular` · punto separador · **"Dom cerrado"** `#e8675c 700`. Pill `border rgba(242,237,228,.1); background:rgba(21,19,17,.5); radius 999; padding:11px 20px`.
- Nota: **"Cancelaciones online hasta 2 horas antes de tu cita."** `11.5px #9c958a`.
- Copyright: **"© 2026 Barbas & Bigotes Barbershop"** + `<br>` + **"Tradición y estilo · Barranquilla, CO"** — `11px rgba(156,149,138,.55)`, sobre `border-top rgba(242,237,228,.07)`.

### 1.8 CTA sticky inferior (solo home móvil, L222-224)
- `position:absolute; left:0; right:0; bottom:0; padding:12px 16px 26px; background:linear-gradient(180deg, rgba(12,11,10,0), rgba(12,11,10,.92) 40%)`.
- Botón full width **"Reservar ahora"**: gradient `#e8675c→#d23f34`, `radius 999; padding:15px; Barlow Condensed 17px 700 uppercase ls .08em; shadow 0 12px 26px -10px rgba(210,63,52,.7)`.

### 1.9 Widget de contacto flotante (móvil, L206-220)
- Posición: `absolute; right:16px; bottom:88px; z-index:9` (arriba del CTA sticky), columna alineada a la derecha, `gap:10px`.
- **Tooltip** (visible por defecto, `widgetTip:true`; cerrable con ✕, no reaparece):
  - `border:1px solid rgba(242,237,228,.14); background:rgba(21,19,17,.96); border-radius:14px; padding:10px 34px 10px 14px; box-shadow:0 18px 40px -16px rgba(0,0,0,.8); animation:bbdrop .35s ease both`.
  - Línea 1: **"Contacto"** `10px uppercase ls .14em #d23f34 700`. Línea 2: **"¿Alguna duda, bro? Escríbenos."** `12.5px rgba(255,255,255,.9) 500`.
  - Botón cerrar ✕ 22px circular `background:rgba(242,237,228,.08); color:#9c958a`.
  - Flechita: cuadrado 12px rotado 45°, mismo fondo/bordes, `right:20px; bottom:-6px`.
- **Botón**: `<a>` 58×58 circular, `background:#050403; border:1px solid rgba(242,237,228,.14); box-shadow:0 8px 30px rgba(0,0,0,.55)`; adentro `logo-face-transparent.png` 38×38; anillo ping: span `inset:0; background:#d23f34; opacity:.2; animation:bbping 2.4s ease-out infinite`.
- Link (LITERAL): `https://wa.me/573006734799?text=Hola%20Barbas%20%26%20Bigotes%2C%20quisiera%20saber%20m%C3%A1s%20informaci%C3%B3n%20sobre%20sus%20servicios%20y%20reservas.` — texto prellenado: "Hola Barbas & Bigotes, quisiera saber más información sobre sus servicios y reservas."

---

## 2. SITIO PÚBLICO · DESKTOP (L1813-2156)

Contenedor: `height:100%; overflow-y:auto; background:#0c0b0a`. Se muestra cuando `front==="publico" && screen==="home"`; el widget de contacto desktop aparece en home público y en cuenta (`deskWidget`).

### 2.1 Nav sticky
- `position:sticky; top:0; z-index:30; padding:12px 48px; border-bottom:1px solid rgba(255,255,255,.04); background:rgba(12,11,10,.55); backdrop-filter:blur(12px)`; flex space-between.
- Logo lockup `height:68px` clickeable → home.
- Links (gap 26, `11.5px 600 uppercase ls .1em #9c958a`): **"Barberos"**, **"Nosotros"**, **"Mi cuenta"**. Página activa → color `#e8675c`.
- Botón **"Reservar"**: `background:#d23f34; color:#fbf7f0; radius 999; padding:11px 22px; 11px 700 uppercase ls .14em`.

### 2.2 Hero (panel cinematográfico — comentario del proto: "como HeroVideo.tsx")
- Wrapper `padding:24px 24px 0`; panel `position:relative; height:600px; border-radius:30px; overflow:hidden; border:1px solid rgba(242,237,228,.07); box-shadow:0 45px 120px -50px rgba(0,0,0,.9)`.
- Fondo: misma imagen interior PV con Ken Burns pero `filter:brightness(1.25) contrast(1.05) saturate(1.1)`.
- Overlay: `radial-gradient(120% 120% at 50% 28%, rgba(12,11,10,.08) 0%, rgba(8,7,6,.35) 62%, rgba(4,3,3,.68) 100%)`.
- Badge arriba-derecha: punto rojo 7px con `animation:bbping 1.6s cubic-bezier(0,0,.2,1) infinite` + texto **"Video ambiente del local"** (`10px uppercase ls .14em #c9c2b6`, pill `rgba(5,4,3,.55)` borde `.14`).
- Card central "glass" (centrada vertical e horizontal): `border-radius:24px; border:1px solid rgba(255,255,255,.08); background:rgba(5,4,3,.55); backdrop-filter:blur(3px); padding:44px 56px; box-shadow:0 30px 90px -40px rgba(0,0,0,.75)`; contenido centrado:
  - Kicker con líneas laterales de 32×1px `#d23f34`: **"Barbería · Barranquilla"** (`12px uppercase ls .3em #d23f34 600`).
  - `public/brand/logo-hero.png` — `width:380px; max-width:78%; filter:drop-shadow(0 12px 60px rgba(0,0,0,.75))`.
  - Sub: **"Estilo clásico, manos expertas. Tu mejor versión en cualquiera de nuestras dos sedes."** (`17px rgba(242,237,228,.8); line-height:1.55; max-width:44ch`).
  - CTAs (gap 14): **"Reservar cita"** (`#d23f34`, radius 999, `padding:16px 34px`, `13px 600 uppercase ls .06em`, `shadow 0 18px 50px -14px rgba(210,63,52,.8)`) y **"Conocé a los barberos"** (ghost: `background:rgba(0,0,0,.3); border:1px solid rgba(242,237,228,.3); color:#f2ede4; padding:16px 30px; backdrop-filter:blur(6px)`).
- Scroll cue debajo del panel: **"Desliza"** (`10px uppercase ls .35em rgba(242,237,228,.45)`) + línea vertical 1×26px `linear-gradient(180deg,#d23f34,transparent)`.

### 2.3 Stats (idéntico a móvil, escala mayor)
Número `34px 800`, label `11px ls .16em`, padding `22px 6px`, bordes top+bottom.

### 2.4 "Por qué nosotros" → "La diferencia" (solo desktop)
- Padding `52px 64px 0`. Kicker **"Por qué nosotros"**, H2 **"La diferencia"** (`38px 700` uppercase).
- Grid `repeat(4,1fr); gap:12px`. Card: `border rgba(242,237,228,.1); radius 16; background:#151311; padding:22px`; glyph en círculo 44px (`border:1px solid rgba(210,63,52,.4); color:#d23f34; Barlow Condensed 19px 800`); título `20px 700` uppercase; texto `13px #9c958a lh 1.5`.
- Datos (LITERAL, L4286-4291):
  - ✂ **Barberos expertos** — "6 especialistas en degradados, barba, color y diseño."
  - ◆ **Dos sedes** — "Parque Venezuela y Plaza de la Paz, en Barranquilla."
  - ✓ **Reserva sin filas** — "Agendá online y, si te atrasás, le avisamos al siguiente de la lista."
  - ★ **Experiencia premium** — "Espacio moderno, productos de primera y bebida de cortesía."

### 2.5 Servicios desktop
- Kicker **"Servicios"**, H2 **"Lo que más piden"**. Grid `repeat(3,1fr); gap:12px`.
- Card: `#151311, radius 16, padding:18px` — nombre `14.5px 700`, `"{dur} min"` `12px #9c958a`, precio Barlow Condensed `24px 800 #e8675c` tabular. Mismos 5 servicios que móvil.
- 6ª celda CTA: `border rgba(210,63,52,.4); background:rgba(210,63,52,.05)` — **"Ver todos"** (`22px 700` uppercase `#e8675c`) / **"y reservar →"** (`12px #9c958a`).

### 2.6 Galería desktop (mosaico)
- Grid `repeat(6,1fr); grid-auto-rows:150px; gap:12px`; imágenes `object-fit:cover; radius 14; border rgba(242,237,228,.1)`:
  - `corte-1.jpg` span 4 col × 2 filas (protagonista) · `corte-2.jpg` span 2 · `corte-3.jpg` span 2 · `corte-4.jpg` span 2 · `corte-5.jpg` span 2×2 · `corte-6.jpg` span 2 · `corte-7.jpg` span 2 · tile CTA span 2 (**"Tu turno"** `26px` / **"Reservar cita →"**).

### 2.7 Sedes desktop
- H2 **"Dos casas, un mismo oficio"**. Grid `1fr 1fr; gap:14px`; cards botón `height:230px; radius 18` con foto + overlay `transparent 30% → rgba(12,11,10,.88)`.
- Texto: nombre `28px 700` uppercase; línea `13px #c9c2b6`: **"Cra 65 · Lun–sáb 9 am – 8 pm · Reservar acá →"** (PV) / **"Centro · Lun–sáb 9 am – 8 pm · Reservar acá →"** (PP), con "Reservar acá →" en `#e8675c 600`.

### 2.8 Testimonios ("Clientes felices" — solo desktop)
- Kicker **"Lo que dicen"**, H2 **"Clientes felices"**. Grid 3 cards `#151311, radius 16, padding:24px`: fila `★★★★★` (`letter-spacing:2px; color:#d23f34`), cita `14px rgba(242,237,228,.9) lh 1.6` entre comillas tipográficas, firma `13px #9c958a` con raya.
- Datos (LITERAL): "El mejor degradado que me han hecho en Barranquilla. Ambiente de otro nivel." — Carlos M. · "Reservé por la web y me atendieron sin esperar nada. Súper recomendados." — Andrés R. · "Mi barbero de confianza. La barba siempre me queda perfecta." — Julián P.

### 2.9 Ubicación ("Dónde y cuándo" — comentario: "como Ubicacion.tsx: cards + mapa interactivo")
- Kicker **"Visítanos"**, H2 **"Dónde y cuándo"**.
- 2 cards botón seleccionables (grid 1fr 1fr): `radius 18; padding:26px`. Seleccionada: `border rgba(210,63,52,.7); background:rgba(210,63,52,.03)`; no: `border rgba(242,237,228,.1); background:#151311`.
  - Nombre `24px 700` uppercase. Cuerpo `13.5px rgba(242,237,228,.8) lh 1.6`: "**Dirección:** {dir}<br>**Teléfono:** {tel}". Horario `12px #9c958a`: "Lun – Sáb · 9:00 am – 8:00 pm<br>Domingo · cerrado".
  - Pie `11.5px 700 uppercase ls .1em #e8675c`: **"Seleccionada · mirá el mapa abajo"** / **"Seleccionar para ver el mapa"**.
- Panel de mapa: card `#151311 radius 18 overflow hidden`; header con nombre (`18px 700` uppercase) + dirección (`11.5px #9c958a`) y toggles a la derecha:
  - Botones **"Mapa" / "Satélite" / "Tour 360°"** — `radius 9; padding:7px 14px; 11px 700 uppercase ls .08em`; activo `background:#d23f34; color:#fbf7f0`; inactivo `background:#211d19; color:#9c958a`.
  - Link **"Abrir en Maps ↗"** — `border rgba(242,237,228,.14); background:#211d19; color:#e8675c`; URL `https://www.google.com/maps/dir/?api=1&destination={lat},{lng}`.
- `<iframe>` 100%×340px sin borde, `loading="lazy"`, `referrerPolicy="no-referrer-when-downgrade"`, `key` cambia con sede+vista para recargar.
- Datos de locales (LITERAL, L4304-4306):
  - PV: dirección "Calle 88 #44 - 10, Local 4, Barranquilla", tel "+57 300 409 7624", query = la dirección, lat `11.002041`, lng `-74.823953`.
  - PP: dirección "Cra. 45 #50-168, Frente a la Plaza de la Paz, Barranquilla", tel "+57 300 673 4799", query "BARBAS Y BIGOTES BARBERCLUB FRENTE A LA PLAZA DE LA PAZ", lat `10.986608`, lng `-74.790934`, y streetview embed propio: `https://www.google.com/maps/embed?pb=!4v1782789057569!6m8!1m7!1sxvHbHMym5ue7N9aFT0dW2w!2m2!1d10.98756016276552!2d-74.78914906416058!3f203.76871040234138!4f-0.9862926928934712!5f0.7820865974627469`.
  - URLs de mapa: mapa `https://www.google.com/maps?q={query}&z=17&ie=UTF8&output=embed`; satélite igual + `&t=h`; streetview genérico (fallback PV) `...&layer=c&cbll={lat},{lng}&cbp=11,0,0,0,0&output=svembed`.

### 2.10 FAQ (solo desktop)
- Padding `52px 120px 46px` (más angosto). Kicker **"FAQ"**, H2 **"Preguntas frecuentes"**.
- Card `#151311 radius 18`; ítems `<details>` con `padding:18px 24px; border-bottom rgba(242,237,228,.08)`; `<summary>` sin marker, flex space-between, Barlow Condensed `18px 700` uppercase + signo **"+"** `#d23f34 20px`; respuesta `13.5px rgba(242,237,228,.85) lh 1.65; max-width:64ch`.
- Contenido (LITERAL, L4297-4302):
  1. **¿Cómo reservo una cita?** — "Online en menos de un minuto: elegís sede, servicio, barbero y hora. Te llega la confirmación al correo y el recordatorio antes de la cita."
  2. **¿Puedo cancelar o reagendar?** — "Sí, desde Mi cuenta hasta 2 horas antes de la cita. Si se libera un turno, le avisamos automáticamente a la lista de espera."
  3. **¿Atienden sin reserva?** — "Sí, los walk-ins son bienvenidos. Si el barbero está ocupado, entrás a la lista de espera y te avisamos cuando sea tu turno."
  4. **¿Los precios cambian por sede?** — "Algunos servicios tienen precio distinto entre Parque Venezuela y Plaza de la Paz. El precio exacto lo ves al reservar, sin sorpresas."

### 2.11 Widget de contacto flotante (desktop, L3536-3551)
Igual que móvil pero: contenedor `position:sticky; bottom:0; height:0; z-index:30` con hijo `absolute; right:26px; bottom:26px`; tooltip con `backdrop-filter:blur(6px)` y botón de 60×60 (logo 40×40, borde `.2`). Mismo copy y mismo link de WhatsApp. Visible en home público y en Mi cuenta.

---

## 3. PÁGINA /barberos (desktop, L1993-2038)

- Hero centrado (`padding:60px 64px 10px`): kicker **"Nuestro equipo"** (`12px uppercase ls .4em #d23f34 600`), H1 **"Los barberos"** (Barlow Condensed `58px 800` uppercase `line-height:.95`), sub **"Seis especialistas entre las dos sedes. Pasá el mouse por una carta para conocerlo y reservá directo con él."** (`15px #9c958a lh 1.6; max-width:52ch`).
- Por cada sede, un separador de sección: pill **"Sede"** (`border rgba(210,63,52,.4); color:#e8675c; 11px 700 uppercase ls .3em; padding:5px 14px`) + nombre de sede (`26px 700` uppercase) + línea `linear-gradient(90deg, rgba(242,237,228,.16), transparent)` que llena el resto.
- Grid `repeat(3,1fr); gap:16px`. **Card de barbero** (`.bb-card`):
  - `border rgba(242,237,228,.1); background:#151311; radius 18; overflow:hidden; transition:transform .2s ease, border-color .2s ease`. Hover (prop `style-hover` del proto): `transform:translateY(-6px); border-color:rgba(210,63,52,.4)`.
  - Foto: contenedor `aspect-ratio:4/4.4; background:linear-gradient(165deg,#262019,#0b0a09)`; span `.bb-foto` con `background-image:url(foto); background-position:center top; filter:grayscale(1); transition:filter .6s ease` → color al hover de la card (regla global). Overlay `transparent 40% → rgba(0,0,0,.85)`.
  - Badge **"★ Top"** si `destacado` (arriba-izquierda, `background:#d23f34; 10px 800 uppercase; padding:4px 10px; radius 999`).
  - Sobre la foto: nombre `28px 700` uppercase blanco + label de sede `12px rgba(242,237,228,.85)`.
  - Barra divisoria de **2px** `rgba(210,63,52,.7)`.
  - Cuerpo `padding:16px 18px`: fila rating `★★★★★` (`ls 1px #d23f34`) + **{ratingNum}** en bold + `· {n} reseñas` en `#9c958a`; label **"Especialista en"** (`10px uppercase ls .18em #9c958a`); chips de tags (`border rgba(242,237,228,.14); background:rgba(255,255,255,.04); radius 999; padding:4px 10px; 11px`).
  - Botón **"Reservar con {nombre}"**: full width, `background:#d23f34; radius 12; padding:12px; 11.5px 700 uppercase ls .12em`; hover `background:#e8675c`. → abre wizard en paso 2 con sede+barbero preseleccionados.
- Tags por barbero (LITERAL, L4255-4262):
  - Meyer: Degradados, Tijera, Niños, Diseños · Jhon: Clásicos, Keratinas, Peinados, Niños · Junior: Colorimetría, Degradados, Barbas
  - Brayan: Degradados, Clásicos, Depilación cera · Kevin: Clásicos, Alisado, Hidratación capilar · Abel: Colorimetría, Diseños, Peinados
- No hay versión móvil propia de /barberos en el prototipo (no encontrada; solo existe la selección de barbero dentro del wizard móvil).

---

## 4. PÁGINA /nosotros (desktop, L2040-2098)

- Hero centrado: kicker **"Nuestra esencia"**, H1 **"Quiénes somos"** (`58px 800`), sub **"Tradición, estilo y cuidado para el caballero moderno. Un espacio diseñado para revivir el ritual clásico de la barbería en Barranquilla."** (`16px #9c958a lh 1.65; max-width:56ch`).
- Bloque historia: grid `1fr 1fr; gap:48px; align-items:center; padding:30px 64px 50px`.
  - Izquierda: kicker **"Nuestra historia"**, H2 **"El arte de la barbería"** (`36px 700` uppercase), 3 párrafos (`14.5px rgba(242,237,228,.85) lh 1.7`, LITERAL):
    1. "Nacimos en el corazón de Barranquilla con un propósito claro: rescatar el ritual clásico de la barbería y devolverle al hombre su espacio."
    2. "En Barbas & Bigotes combinamos técnicas tradicionales de afeitado con toalla caliente y navaja libre con las últimas tendencias de corte de cabello y cuidado facial."
    3. "Más que un simple corte, ofrecemos una experiencia completa de relajación, buena música, café y atención al detalle en un ambiente clásico y profesional."
  - Link pill **"Síguenos en Instagram · @barbasybigotes.baq"** (`border rgba(210,63,52,.4); background:rgba(210,63,52,.05); radius 999; padding:10px 20px; 11.5px 700 uppercase ls .1em #e8675c`).
  - Derecha: `public/quienes-somos/logo-vapor-v2.jpg` — `aspect-ratio:4/5; object-fit:cover; radius 18; border rgba(242,237,228,.12); shadow 0 40px 90px -50px rgba(0,0,0,.9)`. Alt: "Emblema Barbas y Bigotes entre vapor cálido".
- Bloque pilares: banda `border-top rgba(242,237,228,.08); background:rgba(21,19,17,.35); padding:56px 64px`; header centrado kicker **"Nuestra filosofía"** + H2 **"Los pilares de Barbas & Bigotes"**.
  - Grid 4 cards (`background:rgba(21,19,17,.6); radius 16; padding:22px`; hover `border-color:rgba(210,63,52,.4)`); glyph en cuadrado 46px `radius 12; background:rgba(210,63,52,.1); color:#d23f34`.
  - Datos (LITERAL, L4243-4248):
    - ✂ **Tradición** — "Técnicas de barbería clásica, afeitado a navaja tradicional y toallas calientes para tu comodidad."
    - ◆ **Estilo** — "Asesoramiento personalizado de imagen para adaptar cortes clásicos y modernos a tus facciones."
    - ✦ **Comunidad** — "Un espacio ideal para conversar, relajarte y pasar un rato agradable en la mejor compañía."
    - ★ **Ambiente** — "Instalaciones premium, excelente iluminación, buena música y café selecto para ti."
- Bloque sedes: header centrado kicker **"Espacios premium"** + H2 **"Nuestras sedes"**; 2 cards con foto interior (`aspect-ratio:16/10`): PV "Calle 88 #44 - 10, Local 4, Barranquilla" / PP "Carrera 45 frente a la Plaza de la Paz, Barranquilla"; botón **"Reservar en esta sede →"** (`#d23f34; radius 999; padding:10px 20px; 11px 700 uppercase ls .1em`).

---

## 5. FOOTER DESKTOP (L2101-2155)

- Banda `border-top rgba(242,237,228,.1); background:linear-gradient(180deg,#0a0908,#050403)`; contenido `max-width:900px` centrado, `padding:52px 40px`.
- CTA final: **"¿Listo para tu mejor versión?"** — Barlow Condensed `42px 800` uppercase, con "mejor versión" en `#e8675c`. Sub: **"Reservá en menos de un minuto · confirmación directa a tu correo."** (`14px #9c958a`). Botón **"Reservar cita"** (gradient `#e8675c→#d23f34`, `radius 999; padding:16px 40px; Barlow Condensed 18px 700 uppercase; shadow 0 16px 40px -12px rgba(210,63,52,.7)`).
- Luego (sobre `border-top rgba(242,237,228,.08)`): logo lockup 54px, mismo tagline del footer móvil, mismos íconos sociales.
- Divisor **"Nuestras sedes"** (mismo patrón de líneas + label rojo). 2 cards de sede idénticas a móvil (grid 1fr 1fr).
- Fila de links (`13px #9c958a`, separados por puntos de 3px): **Barberos · Nosotros · Mi cuenta · Reservar cita →** (el último `#e8675c 700`).
- Pill de horario idéntica a móvil ("Lun – Sáb / 9am – 8pm / Dom cerrado") + nota de cancelaciones.
- Copyright: **"© 2026 Barbas & Bigotes Barbershop · Todos los derechos reservados"** + `<br>` + **"Tradición y estilo · Barranquilla, CO"**.

---

## 6. WIZARD DE RESERVA /reservar (móvil L227-409 · desktop L2162-2355)

Concepto: **una sola pantalla** con 5 pasos internos (no rutas), header fijo arriba, cuerpo scrolleable, footer sticky de resumen/total siempre visible. En desktop se renderiza dentro de una columna app (`isAppDesk`) con `width:100%` para el flujo público (deskAppWidth), fondo `radial-gradient(120% 90% at 50% -10%, #1b1613 0%, #0c0b0a 60%, #080706 100%)` alrededor y bordes laterales `rgba(242,237,228,.08)` + `box-shadow:0 0 80px rgba(0,0,0,.55)`; los paddings laterales usan `calc(max(56px, (100% - 1040px) / 2))` (columna útil máx 1040px).

### 6.1 Header del wizard
- Flex, `padding:12px 16px` (desktop `14px calc(...)`), `border-bottom rgba(242,237,228,.1)`.
- Botón atrás **"←"** (`#9c958a 20px`, sin fondo). Lógica: paso>1 → paso−1; paso 1 → vuelve al home.
- Título **"Reservá tu turno"** (Barlow Condensed `22px 800` uppercase) + subtítulo **"Paso {n} de 5 · {título}"** (`11.5px #9c958a`).
- Derecha: **"{n}/5"** (Barlow Condensed `18px 800 #e8675c` tabular).
- Títulos por paso (L4748): `["Sede", "Servicio", "Barbero", "Día y hora", "Tus datos"]`.

### 6.2 Barra de progreso
Track `height:3px; radius 99; background:rgba(242,237,228,.08)`; fill `linear-gradient(90deg,#e8675c,#d23f34)` con `width: {paso*20}%`.

### 6.3 Paso 1 — Sede ("¿En qué sede?")
- H `26px 800` uppercase (título estándar de cada paso). Sub: **"Las dos abren de lunes a sábado, 9 am – 8 pm."** (`12px #9c958a`).
- Cards de sede (móvil: apiladas `height:130px`; desktop: grid `auto-fit minmax(340px,1fr)`, `height:300px`): foto frente full-bleed, overlay `transparent 25% → rgba(12,11,10,.88)`, `radius 16`, **`border:2px solid`** — seleccionada `#d23f34`, no `rgba(242,237,228,.12)`.
  - Check seleccionado: círculo 24px `#d23f34` con "✓" `#fbf7f0 12px 800`, arriba-derecha.
  - Texto: **"Parque Venezuela"** / sub **"Cra 65 · Barranquilla"**; **"Plaza de la Paz"** / sub **"Centro · Barranquilla"** (nombre `23px 800` uppercase; sub `11.5px #c9c2b6`).
- Elegir sede resetea el barbero elegido (`rBarbero:null`). Default: parque-venezuela.

### 6.4 Paso 2 — Servicio ("¿Qué servicio?")
- Label **"Categorías"** (`10px 700 uppercase ls .24em #e8675c`).
- Chips de categoría (móvil grid `1fr 1fr`; desktop `auto-fit minmax(230px,1fr)`): `min-height:44px; radius 10; padding:9px 12px; background:linear-gradient(90deg,#211d19,#151311); border:1px solid` — activa `rgba(210,63,52,.75)`, inactiva `rgba(242,237,228,.14)`. Nombre Barlow Condensed `14px 700` uppercase (activa `#f2ede4`, inactiva `#9c958a`) + contador de servicios a la derecha (`10px #e8675c`).
- Categorías (LITERAL): **Cortes, Barba, Cejas y diseños, Faciales, Capilar y color, Depilación, Combos** (ids: cortes, barba, cejas-disenos, faciales, capilar, depilacion, combos). Default: cortes.
- Fila: **"Servicios disponibles"** (mismo estilo del label) + **"{n} opciones"** (`11px #9c958a`).
- Cards de servicio (móvil grid `1fr 1fr; gap:9px`; desktop `auto-fill minmax(230px,260px)` con `justify-content:center`): `radius 12; border:2px solid` (sel `#d23f34`, no `rgba(242,237,228,.1)`); columna:
  - Foto `aspect-ratio:4/3` (background-image; el proto cicla `["corte-2","corte-3","corte-5","corte-1"].jpg` por índice).
  - Badge de duración abajo-izquierda: pill `background:rgba(5,4,3,.85); radius 5; padding:3px 8px; Barlow Condensed 11px 800`, con icono de reloj SVG (círculo + manecillas, stroke `#e8675c`). Formato duración: `<60` → `"30M"`; `>=60` → `"1H"`, `"1H 15M"` (L3819-3823).
  - Check "✓" 21px si seleccionado.
  - Nombre `12.5px 700; min-height:34px; padding:9px 10px 4px`.
  - Pie con `border-top rgba(242,237,228,.07)`: label **"Precio"** (`9.5px 700 uppercase ls .12em #9c958a`) + precio Barlow Condensed `17px 800 #e8675c` tabular.
- Precio mostrado = `pv` si sede PV, `pp` si sede PP (L3780).

### 6.5 Paso 3 — Barbero ("Elegí tu barbero")
- Sub: **"{Sede} · o seguí sin elegir y te asignamos uno."** — se puede continuar sin seleccionar (queda "Cualquier barbero").
- Cards (móvil grid `1fr 1fr`; desktop `auto-fit minmax(230px,1fr)`): `aspect-ratio:3/3.6; radius 14; border:2px solid` (sel `#d23f34`, no `rgba(242,237,228,.12)`).
  - Fondo de card: sel `radial-gradient(circle at 50% 30%, rgba(210,63,52,.22), #151311 72%)`; no `radial-gradient(circle at 50% 30%, #272119, #0e0d0b 76%)`.
  - Foto (`background-position:center top`) con máscara radial: `mask-image:radial-gradient(ellipse 82% 92% at 50% 40%, black 48%, transparent 74%)` (y `-webkit-`), y `filter`: seleccionado `none`, no `grayscale(1) contrast(1.05) brightness(.88)`; `transition:filter .35s ease`. Overlay `rgba(12,11,10,0) 45% → rgba(12,11,10,.82)`.
  - Badge **"★ TOP"** arriba-izquierda si `destacado` (pill `#d23f34; 9.5px 800 ls .08em`). Check "✓" 22px arriba-derecha si seleccionado.
  - Abajo: nombre `21px 800` uppercase; meta **"★ {rating}"** (`10px #c9c2b6`, p.ej. "★ 4.9 · 212 reseñas"); chip de estado: pill `border 1px + background rgba(5,4,3,.55)` con punto de 6px del color de estado:
    - **"Libre ahora"** → color `#34d399`, borde `rgba(52,211,153,.4)`.
    - **"En silla · sale 11:10 am"** → color `#e8675c`, borde `rgba(210,63,52,.45)` (usa `enSilla` del barbero).
    - **"No disponible hoy"** → color `#fbbf24`, borde `rgba(251,191,36,.45)`; la card NO es seleccionable (onPick vacío).

### 6.6 Paso 4 — Día y hora ("¿Cuándo pasás?")
- **Móvil**: fila de 3 botones de día (grid `repeat(3,1fr)`), luego secciones "Mañana" y "Tarde" con grids `repeat(3,1fr)` de slots.
- **Desktop**: layout 2 columnas `320px 1fr`: panel izquierdo card `#151311 radius 16 padding 16` con label **"Elegí el día"**, lista vertical de días (con chevron "›") y nota al pie: **"Horario de la sede: 9:00 am – 8:00 pm."** `<br>` **"Domingos cerrado."** (`11px #9c958a`); derecha los slots (grids `auto-fill minmax(110px,1fr)`).
- Días (datos del proto): `Hoy / vie 10 jul`, `Mañana / sáb 11 jul`, `Lun 13 / lun 13 jul`. Botón día: `radius 12`; seleccionado `background:linear-gradient(180deg,#e8675c,#d23f34); border rgba(232,103,92,.9); color:#fbf7f0; fecha rgba(251,247,240,.85); shadow 0 10px 22px -8px rgba(210,63,52,.65)`; no seleccionado `background:linear-gradient(180deg,#211d19,#151311); border LINE; color:#f2ede4; fecha #9c958a`. Cambiar de día resetea la hora.
- Labels de sección: **"Mañana"** / **"Tarde"** (`11px 700 uppercase ls .14em #9c958a`).
- Slots definidos (L3743): `9:00 am, 9:30 am, 10:00 am, 10:30 am, 11:00 am, 11:30 am` (mañana) y `2:00 pm, 2:30 pm, 3:00 pm, 3:30 pm, 4:00 pm, 4:30 pm` (tarde) — se separan por `am`/`pm`.
- Ocupados demo (L3744): Hoy `[9:00, 9:30, 11:00 am, 3:00 pm]`; Mañana `[10:00 am, 2:00 pm]`; Lun 13 `[9:00–10:30 am]`.
- Botón slot: `min-height:54px` (desktop 50px); `radius 13` (desktop 12); Barlow Condensed `18px 800` (desktop 17px) tabular. Estados:
  - **Seleccionado**: `background:linear-gradient(180deg,#e8675c,#d23f34); border rgba(232,103,92,.9); color:#fbf7f0; shadow 0 10px 22px -8px rgba(210,63,52,.65)`.
  - **Libre**: `background:linear-gradient(180deg,#211d19,#151311); border LINE; color:#f2ede4`.
  - **Ocupado**: `disabled`, `background:transparent; border rgba(242,237,228,.05); color:rgba(156,149,138,.4)` y **`text-decoration:line-through`** (tachado).
  - **Hora ya pasada (solo "Hoy")**: mismo look apagado pero **sin** tachado (`deco:"none"`), también deshabilitado. Cálculo contra `new Date()` real (L3872-3882).

### 6.7 Paso 5 — Datos ("Tus datos")
- Sub: **"Te llega la confirmación al correo."**
- Dos inputs apilados (gap 8): placeholder **"Tu nombre"** y **"Correo (te llega la confirmación)"** (`inputMode="email"`). Estilo input: `radius 12; border LINE; background:#151311; color:#f2ede4; padding:13px 14px; font-size:14px; outline:none`. **No hay campo teléfono** (existe `rTel` en el estado pero no se renderiza).
- Card resumen **"Tu reserva"** (`#151311 radius 14; padding:13px 16px`; label `10px 700 uppercase ls .2em #e8675c`): filas `12.5px` label `#9c958a` / valor `600`:
  - **Sede** {nombre} · **Servicio** {nombre + " + bebida (incluida)" si aplica, o "—"} · **Barbero** {nombre | "Cualquier barbero"} · **Cuándo** {"Hoy, 4:30 pm" | "—"}.

### 6.8 Footer sticky del wizard
- `position:absolute; left:0; right:0; bottom:0; padding:12px 16px 26px` (desktop lateral `calc(...)`); `border-top rgba(242,237,228,.1); background:rgba(12,11,10,.95); backdrop-filter:blur(10px)`.
- Izquierda: línea resumen `11px #9c958a` ellipsis — con servicio: `"{servicio}{ + bebida( (incluida))} · {barbero|Cualquier barbero}{ · {día} {hora}}"`; sin servicio: **"Elegí un servicio y una hora"**. Debajo el total Barlow Condensed `24px 800` tabular (o **"—"**).
- Total = precio del servicio (pv/pp) + bebida si no es gratis (L3900).
- Botón: **"Continuar"** (pasos 1-4) / **"Confirmar"** (paso 5) — gradient `#e8675c→#d23f34`, `radius 14; padding:15px 22px; Barlow Condensed 16px 700 uppercase ls .05em; shadow 0 12px 26px -10px rgba(210,63,52,.7)`.
- Deshabilitado visual `opacity:.4` (y no avanza) cuando: paso 2 sin servicio elegido, o paso 4 sin hora / con hora ya pasada. Pasos 1 y 3 siempre pueden continuar (defaults). Paso 5 → confirmar siempre habilitado (nombre por defecto "Cliente app"/"crack").

### 6.9 Upsell de bebida (bottom sheet, L390-408 — "mensaje gestionado desde el admin")
- **Disparo** (L4752-4759): al tocar "Continuar" en el **paso 2** (una sola vez por flujo, `upsellSeen`):
  - Si el nombre del servicio contiene "bebida" (combo) y `comboOn` → modo **combo**.
  - Si no incluye bebida y `upsellOn` → modo **extra**.
  - Elegir bebida o rechazar cierra el sheet y salta al paso 3.
- Overlay: `absolute inset:0; z-index:9; background:rgba(5,4,3,.65); backdrop-filter:blur(2px)`, contenido pegado abajo.
- Sheet: `background:#0c0b0a; border-top LINE; border-radius:22px 22px 0 0; padding:20px 18px 30px`; handle 38×4px `rgba(242,237,228,.18)` centrado.
- Título (Barlow Condensed `24px 800` uppercase centrado) = mensaje configurable; defaults (L3608-3609):
  - extra: **"¿Le sumás una bebida a tu corte?"**
  - combo: **"Tu combo incluye bebida. ¿Cuál querés?"**
- Subtítulo (`12px #9c958a` centrado): extra **"Te la sirven apenas te sentás en la silla."** / combo **"Va incluida en el precio del combo."**
- Opciones = productos `cat:"bebidas"` del inventario: **Gaseosa $5.000, Agua $3.000, Energizante $8.000, Cerveza $7.000**. Grid `1fr 1fr` (desktop `auto-fit minmax(230px,1fr)`); botón `min-height:54px; radius 13; border LINE; background:linear-gradient(180deg,#211d19,#151311)`; nombre `13.5px 700` + etiqueta de precio Barlow Condensed `16px 800` tabular:
  - extra: **"+$5.000"** (sin espacios) en `#e8675c`; combo: **"Incluida"** en `#34d399` (bebida gratis).
- Botón rechazo full width: extra **"No, gracias"** / combo **"Sin bebida"** — `min-height:46px; radius 12; border LINE; color:#9c958a; 13px 600`.

### 6.10 Pantalla RESERVA OK (confirmación animada, L411-457)
Pantalla completa centrada, `background:radial-gradient(90% 50% at 50% 0%, rgba(210,63,52,.12), transparent 60%)`.

**Animación firma** (logo "afeitado" por una máquina):
- Wrapper 160×145px con `animation:bbglow 2.6s ease-in-out 1.5s infinite` (respiración de glow rojo tras terminar).
- `logo-face-transparent.png` 140px con `animation: bbcut 1.4s ease-in-out .2s both, bbbuzz .07s linear .2s 20 alternate` — el logo se "revela" de arriba a abajo con clip-path mientras vibra 20 veces.
- Máquina de cortar (puro CSS, absolute `left:50%; margin-left:-14px`) con `animation:bbclipper 1.4s ease-in-out .2s both` (baja de -48px a `calc(100% - 8px)` apareciendo/desapareciendo) y wobble interno `bbwob .09s linear .2s 16 alternate`:
  - Dientes: 28×8px `repeating-linear-gradient(90deg, #d8d2c7 0 2.5px, transparent 2.5px 6px)`, `radius 2px 2px 0 0`.
  - Cuerpo: 23×38px `radius 5px 5px 11px 11px; background:linear-gradient(180deg,#4a433b,#211d19); border rgba(242,237,228,.3); shadow 0 6px 16px rgba(0,0,0,.5)`; luz roja 5×11px `#d23f34` con glow.
- Entradas escalonadas con `bbrise .5s ease-out` en `.15s / .25s / .35s / .45s / .55s`:
  1. Badge **"✓ Reserva confirmada"** — pill `border rgba(52,211,153,.4); background:rgba(52,211,153,.08); color:#34d399; Barlow Condensed 12px 800 uppercase ls .1em`.
  2. H2 **"¡Listo,<br>te esperamos!"** — `40px 800` uppercase `line-height:.95`.
  3. Párrafo resumen (L4784): **"Ya quedó agendada, {nombre|crack}. Te enviamos el comprobante y el recordatorio al correo{ {correo}}. Sede {sede}."** (`13.5px #9c958a; max-width:30ch`).
  4. Card detalle (`#151311 radius 16; text-align:left`), filas con `border-bottom rgba(242,237,228,.07)`, labels `10.5px 700 uppercase ls .12em #9c958a`:
     - **Servicio** — con thumbnail 46×46 `radius 10` (foto del servicio) + nombre (incluye "+ gaseosa (incluida)" si eligió bebida).
     - **Barbero** — con avatar 34×34 circular (foto del barbero, `center top`).
     - **Cuándo** — "{día}, {hora}".
     - **Total** — sub **"Lo pagás en la barbería."** (`11px #9c958a`) + precio Barlow Condensed `22px 800 #e8675c` tabular.
  5. Botones (gap 10): **"Ver mi cuenta"** (flex 1.3, gradient rojo, `radius 14; min-height:50px; Barlow Condensed 15px 800 uppercase`) y **"Volver al inicio"** (flex 1, ghost `border rgba(242,237,228,.16); color:#9c958a; 13px`).
- Al confirmar también se inserta la cita en la agenda del barbero (estado "confirmada") — el proto simula la integración.

---

## 7. DATOS QUE CONSUME (mapeo a DB)

### Sedes (2)
`parque-venezuela` y `plaza-de-la-paz`: nombre, detalle corto ("Cra 65 · Barranquilla" / "Centro · Barranquilla"), dirección completa, teléfono, lat/lng + queries de Maps, fotos frente/interior, horario `abre:9 / cierra:20` (configurable en admin), Lun–Sáb, domingo cerrado.

### Servicios — catálogo completo del proto (comentario: "catálogo real (seed.ts)", L3651-3698)
Campos: `id, nombre, cat, dur (min), pv (precio Parque Venezuela), pp (precio Plaza de la Paz)`. El wizard muestra `pv` o `pp` **según la sede elegida**.

| id | nombre | cat | dur | pv | pp |
|---|---|---|---|---|---|
| corte | Corte (clásico, degradado o tijera) | cortes | 30 | 35000 | 30000 |
| corte-barba | Corte y barba | cortes | 60 | 45000 | 40000 |
| corte-cejas | Corte y cejas | cortes | 40 | 35000 | 35000 |
| corte-barba-cejas | Corte + barba + cejas | cortes | 50 | 45000 | 45000 |
| cerquillos | Cerquillos | cortes | 10 | 15000 | 10000 |
| cerquillo-barba | Cerquillo y barba | cortes | 35 | 30000 | 30000 |
| perfilamiento-barba | Perfilamiento de barba | barba | 20 | 25000 | 20000 |
| ritual-barba | Ritual de barba | barba | 30 | 35000 | 30000 |
| disenos | Diseños | cejas-disenos | 10 | 7000 | 7000 |
| perfilamiento-cejas | Perfilamiento de cejas | cejas-disenos | 10 | 5000 | 5000 |
| mascarilla-puntos-negros | Mascarilla puntos negros | faciales | 15 | 10000 | 10000 |
| mascarilla-hidratante | Mascarilla hidratante | faciales | 15 | 10000 | 10000 |
| parches-colageno | Parches de colágeno | faciales | 10 | 7000 | 7000 |
| limpieza-silver | Limpieza facial silver | faciales | 20 | 20000 | 20000 |
| limpieza-gold | Limpieza facial gold | faciales | 35 | 35000 | 40000 |
| peinados | Peinados | capilar | 20 | 15000 | 15000 |
| hidratacion-capilar | Hidratación capilar | capilar | 30 | 20000 | 20000 |
| relajante-ondas | Relajante de ondas | capilar | 20 | 30000 | 30000 |
| keratina | Keratina | capilar | 60 | 90000 | 90000 |
| rayitos | Rayitos | capilar | 180 | 150000 | 150000 |
| tintura-barba | Tintura de barba | capilar | 20 | 20000 | 20000 |
| tintura-canas | Tintura de canas | capilar | 20 | 30000 | 30000 |
| tintura-color | Tintura de cabello color | capilar | 180 | 150000 | 150000 |
| tintura-pigmento | Tintura barba o cabello con pigmento | capilar | 10 | 15000 | 15000 |
| depil-nariz-orejas | Depilación cera nariz/orejas | depilacion | 10 | 10000 | 10000 |
| depil-nariz-y-orejas | Depilación cera nariz y orejas | depilacion | 15 | 16000 | 16000 |
| depil-bozo | Depilación cera bozo | depilacion | 10 | 10000 | 10000 |
| depil-barba | Depilación cera barba | depilacion | 10 | 15000 | 15000 |
| depil-bozo-barba | Depilación cera bozo y barba | depilacion | 20 | 20000 | 20000 |
| combo-silver | Corte + limpieza silver + bebida | combos | 60 | 55000 | 55000 |
| combo-gold | Corte + limpieza gold + bebida | combos | 75 | 75000 | 75000 |
| combo-barba-silver | Corte + barba + limpieza silver + bebida | combos | 70 | 65000 | 65000 |
| combo-barba-gold | Corte + barba + limpieza gold + bebida | combos | 90 | 85000 | 85000 |
| combo-cera | Corte + cera orejas o nariz + bebida | combos | 45 | 45000 | 45000 |
| combo-barba-cera | Corte + barba + cera + bebida | combos | 60 | 55000 | 55000 |
| combo-hidratacion | Corte + hidratación | combos | 60 | 55000 | 55000 |
| combo-barba-hidratacion | Corte + barba + hidratación | combos | 70 | 65000 | 65000 |
| combo-keratina | Corte + keratina | combos | 90 | 140000 | 140000 |
| combo-keratina-hidratacion | Corte + keratina + hidratación + bebida | combos | 120 | 160000 | 160000 |
| combo-relajante | Corte + relajante de ondas | combos | 60 | 70000 | 70000 |
| combo-relajante-hidratacion | Corte + relajante + hidratación + bebida | combos | 90 | 90000 | 90000 |
| combo-tintura | Corte + tintura de barba o tapacanas | combos | 60 | 50000 | 50000 |
| combo-diseno | Corte + diseño | combos | 45 | 40000 | 40000 |
| combo-peinado | Corte + peinado | combos | 60 | 45000 | 45000 |
| deluxe-1 | Deluxe: corte + gold + depilación + cejas + hidratación + masaje + bebida | combos | 120 | 115000 | 115000 |
| deluxe-2 | Deluxe full: todo + pigmento + masaje + bebida | combos | 150 | 150000 | 150000 |

Detección de combo con bebida: `nombre.toLowerCase().includes("bebida")`.

### Barberos (6, L3700-3707)
| id | nombre | sede | rating (string mostrado) | destacado (TOP) | enSilla | foto |
|---|---|---|---|---|---|---|
| meyer | Meyer | parque-venezuela | "4.9 · 212 reseñas" | sí | "sale 11:10 am" | public/barberos/generico.jpg |
| jhon | Jhon | parque-venezuela | "4.8 · 176 reseñas" | sí | — | public/barberos/jhon.jpg |
| junior | Junior | parque-venezuela | "4.8 · 143 reseñas" | — | — | public/barberos/junior.jpg |
| brayan | Brayan | plaza-de-la-paz | "4.9 · 198 reseñas" | — | "sale 11:20 am" | public/barberos/brayan.jpg |
| kevin | Kevin | plaza-de-la-paz | "4.7 · 121 reseñas" | — | — | public/barberos/kevin.jpg |
| abel | Abel | plaza-de-la-paz | "4.9 · 167 reseñas" | sí | — | public/barberos/abel.jpg |

En /barberos además: tags de especialidad por barbero (ver §3). El estado en vivo del paso 3 sale de `enSilla` + un mapa de `ausentes` (gestionado desde admin en el proto).

### Slots / disponibilidad
Turnos de 30 min; ocupación por día (en la app real: por barbero+sede desde reservas). Horas pasadas del día actual se deshabilitan. Horario configurable por sede (9–20 en el proto).

### Bebidas (upsell) — del inventario, `cat:"bebidas"`
Gaseosa $5.000 · Agua $3.000 · Energizante $8.000 · Cerveza $7.000 (con stock por sede en el inventario del admin).

### Configuración admin que afecta estos frentes
- `upsellOn` (bool) + `upsellMsg` (texto del pop-up extra).
- `comboOn` (bool) + `comboMsg` (texto del pop-up de combos).
- `cancelHoras` (2 por defecto) — aparece como copy en footer y FAQ.
- Horarios abre/cierra por sede.

### Contenido estático (hardcodeado en el proto)
Stats (2/6/46), whyUs, testimonios, FAQ, pilares, textos de /nosotros, frases del typewriter, direcciones/teléfonos/coordenadas.

---

## 8. ASSETS REFERENCIADOS (público + reservar)

- `public/brand/logo-lockup.png` (headers/footers), `logo-face-transparent.png` (widget, confirmación), `logo-hero.png` (hero desktop), `icon-192x192.png`, `icon-512x512.png`; `src/app/apple-icon.png`.
- `public/sedes/parque-venezuela-interior.jpg` (hero móvil+desktop, /nosotros), `parque-venezuela-frente.jpg`, `plaza-de-la-paz-frente.jpg`, `plaza-de-la-paz-interior.jpg`.
- `public/cortes/corte-1.jpg` … `corte-7.jpg` (galerías; el wizard usa corte-2/3/5/1 como fotos de servicio cíclicas).
- `public/barberos/generico.jpg, jhon.jpg, junior.jpg, brayan.jpg, kevin.jpg, abel.jpg`.
- `public/quienes-somos/logo-vapor-v2.jpg` (/nosotros).
- Fuentes Google: Barlow Condensed 500-800 + Inter 400-700.
- Links externos: `https://instagram.com/barbasybigotes.baq`, `https://wa.me/573006734799` (con y sin texto prellenado), `tel:+573004097624`, `tel:+573006734799`, embeds de Google Maps (§2.9).

---

## 9. Diferencias vs la app actual (evidenciadas por el propio prototipo)

1. **Form de datos sin teléfono**: el paso 5 solo pide "Tu nombre" y "Correo (te llega la confirmación)". `rTel` existe en el estado pero no se renderiza. Toda la confirmación/recordatorio es **por correo** ("Te llega la confirmación al correo", "confirmación directa a tu correo", okResumen).
2. **Wizard de una sola pantalla** con 5 pasos internos + footer sticky permanente de resumen/total — no páginas separadas.
3. **Upsell de bebida** entre paso 2 y 3 (bottom sheet), con dos modos (extra/combo) y mensajes editables desde el admin — funcionalidad nueva.
4. **Slots del proto omiten el mediodía**: solo 9:00–11:30 am y 2:00–4:30 pm (la lógica real de `slots.ts` es OPEN 9–CLOSE 20 cada 30 min; el proto usa una lista fija demo).
5. **Estado del barbero en vivo** en el paso 3 ("Libre ahora" / "En silla · sale 11:10 am" / "No disponible hoy") y opción explícita de **"Cualquier barbero"** (continuar sin elegir).
6. **Precio por sede (pv/pp)** visible en el wizard según la sede elegida — el catálogo tiene precios distintos por sede en varios servicios.
7. **Hero móvil con typewriter** de 4 frases; **hero desktop tipo "video ambiente"** (en el proto es imagen con Ken Burns + badge "Video ambiente del local"; el comentario lo referencia "como HeroVideo.tsx").
8. **Página /barberos** con tags de especialidad, rating + nº de reseñas, foto B/N→color al hover, y CTA "Reservar con {nombre}" que preselecciona sede+barbero.
9. **Mapa interactivo** en home desktop con toggles Mapa/Satélite/Tour 360° y streetview embed propio para Plaza de la Paz.
10. **Confirmación animada** (logo afeitado por clipper CSS + entradas escalonadas) en vez de una pantalla estática; con nota "Lo pagás en la barbería." y CTA a Mi cuenta.
11. Fechas de los días del paso 4 hardcodeadas en el proto ("vie 10 jul", "sáb 11 jul", "lun 13 jul") — en la app real se generan.
12. El deep-link de las cards de sede (home) y de /nosotros abre el wizard **directo en el paso 2** con la sede fijada; el de /barberos abre en paso 2 con sede+barbero.
