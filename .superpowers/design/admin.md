# Spec de diseño — PANEL ADMIN (`/admin`)

Extraído literalmente del prototipo Claude Design `Barbas y Bigotes.dc.html` (frente "PANEL ADMIN": móvil líneas 1047–1808, desktop líneas 2998–3556, lógica/datos líneas 3563–5145). Todo el copy y CSS citado es textual del prototipo. Lo que no aparece en el prototipo se marca como **no encontrado en el prototipo**.

---

## 0. Sistema de diseño global (compartido por todo el prototipo)

**Fuentes** (Google Fonts):
- `Barlow Condensed` wght 500;600;700;800 — títulos, cifras, labels de nav. Casi siempre `text-transform:uppercase`.
- `Inter` wght 400;500;600;700 — texto de UI. `font-family:Inter, system-ui, sans-serif`.

**Fondo del body**: `radial-gradient(130% 90% at 50% -10%, #1b1613 0%, #0c0b0a 58%, #050403 100%) fixed`. `color-scheme: dark`. Scrollbars ocultas (`::-webkit-scrollbar{display:none}`, `scrollbar-width:none`).

**Paleta (constantes del script)**:
| Token | Valor | Uso |
|---|---|---|
| `ACC` | `#d23f34` | rojo marca (acentos, barras activas, botones sólidos) |
| `SOFT` | `#e8675c` | rojo suave (texto acento, precios modificados, links) |
| `INK` | `#f2ede4` | texto principal |
| `MUT` | `#9c958a` | texto secundario/mutado |
| `LINE` | `rgba(242,237,228,.14)` | bordes por defecto |
| `accBg` | `rgba(210,63,52,.14)` | fondo de chip/botón seleccionado (global) |
| `accBorder` | `rgba(210,63,52,.75)` | borde de chip/botón seleccionado (global) |
| — | `rgba(210,63,52,.55)` / `rgba(210,63,52,.12)` | variante accBorder/accBg usada dentro de los modales Reasignar y Agendar |
| éxito | `#34d399` (bordes `rgba(52,211,153,.35–.4)`, fondos `.07–.14`) | estados OK, toggles activos, dinero a favor |
| alerta | `#fbbf24` (bordes `rgba(251,191,36,.35–.45)`, fondos `.07–.13`) | stock bajo, ausencias, cambios sin guardar, caja abierta |
| error | `#e8675c` sobre `rgba(210,63,52,.1)` borde `rgba(210,63,52,.4)` | mensajes de error de formularios |
| WhatsApp | `#25D366` sólido (botón), icono/texto `#34d399`, borde `rgba(37,211,102,.4)`, fondo `rgba(37,211,102,.08)` | todo lo relacionado a WhatsApp |
| texto sobre rojo | `#fbf7f0` | |
| texto intermedio | `#cfc7ba` | subtítulos secundarios |

**Superficies**: card `#151311` con `border:1px solid rgba(242,237,228,.1)`; superficie interna/inset `#211d19`; fondo de app/modal `#0c0b0a`; sidebar desktop `#0e0d0b`; separadores internos `1px solid rgba(242,237,228,.07)` (a veces `.06`/`.08`).

**Radios**: cards y acordeones `16px`; filas/inputs `12px` (a veces `11px`); slots de hora `11–12px`; botones CTA `13–14px`; pills/chips/steppers `999px`; bottom sheets `22px 22px 0 0`; modal desktop `20px`; miniaturas de foto `10px`.

**CTA primario**: `background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; font-weight:800; text-transform:uppercase; letter-spacing:.04–.05em; border:none;` — deshabilitado se expresa con `opacity:.5` (o `.4`/`.45`).

**Steppers** (patrón repetido en toda la app): contenedor `display:flex; align-items:center; border:1px solid rgba(242,237,228,.14); background:#211d19; border-radius:999px;` con botones `−`/`+` cuadrados sin borde (34–38px móvil, 32–34px desktop) y valor central `font-weight:800; font-variant-numeric:tabular-nums`.

**Números**: siempre `font-variant-numeric:tabular-nums`. Moneda formateada con `Intl.NumberFormat("es-CO", { style:"currency", currency:"COP", maximumFractionDigits:0 })` → `$ 315.000`. Compacto para semanas: `>= 1.000.000` → `"$2,2M"` (coma decimal).

**Labels de sección** (patrón repetido): `font-size:11px; font-weight:700; text-transform:uppercase; letter-spacing:.14em; color:#9c958a; margin-bottom:8px;`.

**Títulos de pantalla**: móvil `font-family:'Barlow Condensed'; font-size:24px; font-weight:800; text-transform:uppercase; line-height:1;` — desktop `font-size:32px`.

**Acordeón** (inventario y precios): header `padding:14px 16–18px; background:linear-gradient(90deg, #211d19, #151311);` nombre Barlow 17–18px 800 uppercase ls `.04em` + contador `10.5px #e8675c`; flecha `▾` abierto / `▸` cerrado (`#9c958a` 13px); borde de card `rgba(210,63,52,.45)` abierto / `rgba(242,237,228,.1)` cerrado.

**Animaciones** definidas en `<style>` global (keyframes `bbping`, `bbpop`, `bbcut`, `bbbuzz`, `bbclipper`, `bbwob`, `bbglow`, `bbrise`, `bbstamp`, `bbkb`, `bbwa`, `bbdrop`, `bbcaret`). En admin solo se usa `bbdrop` (tooltip del widget WA desktop) y `bbping` (halo del widget). El widget flotante de WhatsApp **no se muestra en admin** (`deskWidget` solo aplica a público home y cuenta).

---

## 1. Shell del admin

### 1.1 Móvil (frame iOS 430×880, `padding-top:58px`, fondo `#0c0b0a`)

**Header** (`padding:12px 16px 0; border-bottom:1px solid rgba(242,237,228,.1);`):
- Izq: `public/brand/logo-lockup.png` a `height:26px`.
- Der: texto `Panel admin` — `font-size:10px; text-transform:uppercase; letter-spacing:.24em; color:#d23f34;`.
- Debajo, **switcher de sede**: 2 botones `flex:1; border-radius:999px; padding:9px 6px; font-size:12px; font-weight:700;` — `Parque Venezuela` / `Plaza de la Paz`. Activo: `border rgba(210,63,52,.75); bg rgba(210,63,52,.14); color #f2ede4`. Inactivo: `border rgba(242,237,228,.14); bg transparent; color #9c958a`.
- Regla: si hay cambios sin guardar en Precios (`pDirty`) y se toca la otra sede, NO cambia — abre el aviso "Tenés cambios sin guardar" (ver §6).

**Nav inferior** ("Shell staff unificado: misma nav inferior que el barbero" — comentario literal del prototipo): `position:absolute; left:0; right:0; bottom:0; z-index:6; border-top:1px solid rgba(242,237,228,.1); background:rgba(12,11,10,.96); backdrop-filter:blur(10px); padding:6px 4px 18px; display:flex;`. Cada tab es `flex:1; min-height:54px;` con:
- indicador: barrita `width:26px; height:3px; border-radius:99px;` — `#d23f34` activa / `transparent` inactiva;
- label: `font-family:'Barlow Condensed'; font-size:13.5px; font-weight:800; text-transform:uppercase; letter-spacing:.03em;` — `#f2ede4` activa / `#9c958a` inactiva.

Tabs (labels cortas móvil, literales): `Hoy` · `Stock (7)` (el número = productos de la sede activa) · `Clientes` · `Precios` · `Comis.` · `Ajustes`.

Contenido scrolleable: `flex:1; overflow-y:auto; padding:16px 14px 116px;`.

### 1.2 Desktop (ChromeWindow 1180×760, URL mostrada `barbasybigotes.co/admin`)

Layout `display:flex; height:100%`:
- **Sidebar** `width:236px; border-right:1px solid rgba(242,237,228,.1); background:#0e0d0b; padding:20px 14px;`:
  - Marca: `public/brand/logo-face-transparent.png` a 34px + `Panel admin` en `Barlow Condensed 12px 700; letter-spacing:.22em; uppercase; color:#e8675c;`.
  - Switcher de sede: botones apilados `border-radius:10px; padding:10px 12px; font-size:12.5px; font-weight:700; text-align:left;` (mismos estados on/off que móvil), bajo el bloque `border-bottom:1px solid rgba(242,237,228,.08)`.
  - Nav: botones con dot `8px` redondo (`#d23f34` activo / `transparent`) + label `Barlow Condensed 16px 800 uppercase ls .04em` (`#f2ede4`/`#9c958a`). Mismas labels cortas que móvil.
- **Main** `flex:1; overflow-y:auto; padding:28px 32px 40px;`. Cada tab limita ancho: Inventario/Precios `max-width:680px`, Clientes `760px`, Comisiones `620px`; Hoy usa grid 2 col.

---

## 2. Vista HOY (tab por defecto)

### Encabezado
- Título: `El día en {sede}` (ej. "El día en Parque Venezuela").
- Subtítulo: `viernes, 10 de julio · cierre {hora}` — `{hora}` sale del ajuste de horario de la sede (default `8:00 pm`). Móvil `12px #9c958a`; desktop a la derecha del título, `12.5px`.

### Card "Cobrado hoy" (con desglose por medio en barras)
Card `#151311 r16` p16 (desktop `18px 20px`):
- Label `Cobrado hoy` (`11.5px #9c958a`; desktop en uppercase ls `.14em`).
- Total: Barlow `38px` 800 (desktop `44px`) tabular — suma de los medios.
- Línea: `**{n} atenciones** · {propinas} en propinas` (el número de atenciones en `#f2ede4` 600, resto `#9c958a`).
- Barras por medio de pago (una fila por medio): grid `70px 1fr 76px` (desktop `76px 1fr 84px`); nombre `12px #9c958a`; barra track `height:13px; border-radius:4px; background:rgba(242,237,228,.07)` (desktop `9px`, r`99px`) con fill `background:#a3907c; width:{pct}%` — **pct relativo al medio máximo** (`n/maxMedio*100`), no al total; monto a la derecha 700.

Datos demo:
- Parque Venezuela: Efectivo `$ 189.000`, Nequi `$ 86.000`, Daviplata `$ 25.000`, Tarjeta `$ 15.000` → total `$ 315.000` · `14 atenciones` · `$ 12.000` propinas.
- Plaza de la Paz: Efectivo `$ 142.000`, Nequi `$ 74.000`, Daviplata `$ 32.000`, Tarjeta `$ 20.000` → total `$ 268.000` · `11 atenciones` · `$ 9.000` propinas.

### Sección "Caja"
Card listada con las 2 sedes (siempre ambas, independiente de la sede activa):
1. `Parque Venezuela` — foto `public/sedes/parque-venezuela-frente.jpg` (42px r10; desktop 44px), detalle `Abierta desde 9:04 am`, total dinámico (= suma de caja por barbero, `$ 315.000` base), chip `ABIERTA` — texto `#fbbf24`, `chipBg rgba(251,191,36,.13)`, fila con `background:rgba(251,191,36,.04)`.
2. `Plaza de la Paz` — foto `public/sedes/plaza-de-la-paz-frente.jpg`, detalle `Cerrada 6:40 pm · Brayan`, total `$ 268.000`, chip `CUADRA` — `#34d399`, `chipBg rgba(52,211,153,.12)`.

Chip: `border-radius:999px; padding:2px 9px; font-size:9.5px; font-weight:800; uppercase; ls .06em`. En desktop el estado va sin píldora (solo texto 10px 800 uppercase coloreado).

### Sección "Equipo ahora"
Card con una fila por barbero de la sede. Fila clickeable (`onPerfil` → abre Perfil de barbero, §4):
- Avatar 34px (desktop 36px) redondo con **dot de estado** (9px, borde 2px del color de la card): `#34d399` libre · `#e8675c` en silla · `#fbbf24` ausente.
- Nombre 13.5px 700; detalle 11.5px `#9c958a`: en silla → `{servicio} · {cliente}` (ej. `Combo silver · Camilo Ruiz`); libre → nombre de la sede; ausente → `Ausente · citas para reasignar`.
- Chip de estado (`999px; padding:3px 9–10px; 10.5px 700`): `Libre` (verde, borde `rgba(52,211,153,.35)`) / `En silla · sale 11:10a` (rojo suave, borde `rgba(210,63,52,.4)`) / `No vino hoy` (ámbar, borde `rgba(251,191,36,.45)`).
- Chip extra opcional `PIN bloqueado` (ámbar, borde `rgba(251,191,36,.4)`) — en demo lo tiene **Junior**.

Datos demo — PV: Meyer (en silla `Combo silver · Camilo Ruiz`, sale `11:10a`), Jhon (libre), Junior (libre, PIN bloqueado). PLAZA: Brayan (en silla `Corte y barba · Luis Mercado`, sale `11:20a`), Kevin, Abel.

### Banner de reasignación (condicional)
Tras reasignar/pedir reagenda aparece arriba del botón WA: `border-radius:14px; border:1px solid rgba(52,211,153,.35); background:rgba(52,211,153,.07); padding:12px 14px; font-size:12.5px; color:#34d399; font-weight:600;` con el mensaje (ver §3).

### Botón "Agendar cita (cliente de WhatsApp)"
`width:100%; min-height:50px (desktop 52px); border-radius:14px; border:1px solid rgba(37,211,102,.4); background:rgba(37,211,102,.08); color:#34d399; font-size:13.5px (desktop 14px); font-weight:700;` con el logo SVG oficial de WhatsApp (19–20px, `fill:#34d399`) a la izquierda. Abre el modal de §3.1.

### Sección "Siguientes citas"
Card con filas grid `56px 1fr auto` (desktop `64px 1fr auto`):
- Hora: Barlow 15px 800 tabular (desktop 16px). Formato corto `11:30a` / `2:30p`.
- Cliente 13.5px 700 + detalle 11.5px `#9c958a` (`{servicio} · {barbero}`).
- Tag derecha: `10px 800 ls .06em`, color `#9c958a` por defecto. Valores demo: `P. Venezuela` / `PLAZA`.

Datos demo — PV: `11:30a Santiago Meza — Corte · Meyer`; `12:00p Iván Osorio — Ritual de barba · Meyer`; `2:30p Jorge Llanos — Corte + barba + cejas · Jhon`. PLAZA: `11:00a Óscar Trillos — Corte · Abel`; `12:30p Rafa Domínguez — Corte y barba · Brayan`; `3:00p Walk-in — Limpieza gold · Kevin`.

**Estados dinámicos de una cita**:
- Barbero marcado ausente → tag pasa a `REASIGNAR →` en `#fbbf24`, detalle agrega ` · no vino, tocá para reasignar`, y la fila abre el modal Reasignar (§3.2).
- Reasignada → detalle `{servicio} · {nuevoBarbero} · {hora} · reasignada`, tag `REASIGNADA` en `#34d399`.
- Se pidió reagendar por correo → detalle `{servicio} · esperando nueva hora del cliente`, tag `CORREO ENVIADO` en `#34d399`.
- Agendada desde el modal WhatsApp → se inserta al tope con tag `WHATSAPP` en `#34d399`.

### Sección "Para hacer" (solo móvil; no aparece en el grid desktop)
Tareas en cards grid `30px 1fr auto` (`r12`, p`10px 12px`): icono en caja 28px `#211d19 r8` (`!` en `#fbbf24`, `★` en `#e8675c`), título 12.5px 700, detalle 11px, y botón-link de acción a la derecha (`#e8675c 12px 600`) que navega a otro tab.
- PV: `1 producto bajo mínimo` / `Shampoo anticaspa (PV) · quedan 3` → acción `Reponer` (va a Inventario); `Calificación de 2★ · Junior` / `“Esperé 20 minutos con cita” · 8 jul` → acción `Leer` (va a Clientes).
- PLAZA: `1 producto bajo mínimo` / `Gel fijador (PLAZA) · quedan 2` → `Reponer`.

### Sección "Postventa · 30 días" (solo móvil)
Card: promedio Barlow 30px 800 (`4,8` PV / `4,9` PLAZA) + `★★★★★` en `#fbbf24` (13px, ls 1.5px) + `{36|28} calificaciones` 11.5px. Debajo, reseñas separadas por borde `.07`: texto entre comillas 12.5px `rgba(242,237,228,.85)` + meta 11px `#9c958a`.
- PV: `"Meyer es un crack, el degradado quedó perfecto"` — `★★★★★ · Meyer · P. Venezuela · 8 jul`; `"Buena atención, el ritual de barba vale cada peso"` — `★★★★★ · Jhon · P. Venezuela · 5 jul`.
- PLAZA: `"Brayan siempre atina con la barba, cero quejas"` — `★★★★★ · Brayan · PLAZA · 7 jul`; `"El local impecable y la limpieza facial de 10"` — `★★★★★ · Abel · PLAZA · 3 jul`.

### Sección "Últimos 7 días" (solo móvil)
Card con sparkline: total semanal compacto (Barlow 17px 800; PV serie `[280,310,240,350,300,410,315]`·1000 → `$2,2M`) + `vs {total*0.92} semana pasada` (11.5px `#9c958a`). SVG `viewBox="0 0 300 56"`, `preserveAspectRatio="none"`, polyline `stroke:#a3907c; stroke-width:2; stroke-linecap:round` y círculo final `r=3.5 fill:#e8675c`. Puntos: `x = 8 + i*(284/(n-1))`, `y = 48 - ((v-min)/rango)*38`.

### Desktop — diferencias
El tab Hoy desktop es `display:grid; grid-template-columns:1fr 1fr; gap:14px; align-items:start;` con 4 cards: Cobrado hoy · Caja / Equipo ahora · (botón WA + Siguientes citas). **No incluye** "Para hacer", "Postventa" ni el sparkline (no encontrados en el desktop del prototipo). Los headers de card van adentro como label uppercase (`padding:16px 20px 8px`).

---

## 3. Modales del tab Hoy

### 3.1 "Agendar cita" (cliente de WhatsApp)

**Móvil**: overlay `position:absolute; inset:0; z-index:22; background:rgba(5,4,3,.62); backdrop-filter:blur(2px);` con bottom sheet `background:#0c0b0a; border-top:1px solid rgba(242,237,228,.14); border-radius:22px 22px 0 0; max-height:92%`.
**Desktop**: overlay centrado `rgba(5,4,3,.66); blur(3px)` con dialog `width:560px; border-radius:20px; border:1px solid rgba(242,237,228,.14); box-shadow:0 40px 90px -30px rgba(0,0,0,.85);`.

**Header**: círculo 34–36px `rgba(37,211,102,.12)` con SVG WhatsApp `#34d399`; título `Agendar cita` (Barlow 21–22px 800 uppercase); sub `Para el cliente que te escribe · {sede}` (11.5–12px `#9c958a`); botón cerrar `✕` circular 32–34px borde LINE.

**Formulario** (scrolleable, gap 16px):
1. Label `Datos del cliente` (solo móvil; desktop pone los 2 inputs en grid 1fr 1fr sin label) — inputs `border-radius:12px; border:1px solid rgba(242,237,228,.14); background:#151311; color:#f2ede4; padding:13px 14px; font-size:14px;`:
   - placeholder `Nombre del cliente`
   - placeholder `WhatsApp (ej: 300 123 4567)` (desktop: solo `WhatsApp`), `inputMode="tel"`.
2. Label `¿Con qué barbero?` — grid `repeat(auto-fill, minmax(90px,1fr))` (desktop 96px): tarjetitas `r13; padding:10px 6px` con avatar 40–42px (ring 2px: `#d23f34` activo / `rgba(242,237,228,.2)`), nombre 12px 700. Activo: borde `rgba(210,63,52,.55)` + bg `rgba(210,63,52,.12)`. Solo barberos de la sede activa y no ausentes.
3. Label `Servicio` — chips pill `min-height:40px; padding:8px 14px; 12.5px 600` con `{nombre} {precio}` (precio tabular, `#e8675c` activo / `#9c958a`). Servicios ofrecidos (subset fijo): `corte`, `corte-barba`, `perfilamiento-barba`, `ritual-barba`, `perfilamiento-cejas`; nombres > 22 chars se truncan a 20 + `…`. Precio según sede (pv/pp).
4. Label `Día` — 3 botones: `Hoy` (`vie 11 jul`), `Mañana` (`sáb 12 jul`), `Lun` (`lun 14 jul`). Móvil: 3 en fila, nombre Barlow 16px 800 + fecha 10px. Desktop: apilados a la izquierda en grid `1fr 1.4fr` junto a las horas.
5. Label `Hora` — grid `minmax(84px,1fr)` (desktop 74px): botones `min-height:46px (44 desktop); r12 (11); Barlow 16px (15) 800 tabular`. 18 slots: `9:00`–`12:00` y `2:00`–`7:00` cada 30 min. Ocupadas (horas ya tomadas por ese barbero en las citas de la sede): `disabled`, `text-decoration:line-through`, bg `#100f0e`, color `#5b554d`. Activa: gradiente CTA.
6. Error (si falta algo): caja `r10; border rgba(210,63,52,.4); bg rgba(210,63,52,.1); color:#e8675c; 12.5px` → texto literal `Completá nombre, barbero, servicio y hora.`

**Footer fijo** (`border-top LINE; background:#0c0b0a`): CTA `Agendar {· $precio}` — `min-height:54px (52 desktop); r14; gradiente; 15px 800 uppercase ls .05em`; `opacity:.5` hasta que nombre+barbero+servicio+hora estén completos.

**Estado "hecha"**: check `✓` en círculo 64–66px `rgba(52,211,153,.14)` color `#34d399` 30–32px; título `Cita agendada` (Barlow 26–28px 800 uppercase); resumen `{nombre} · {servicio} · con {barbero} · {día} {fecha} a las {hora}`; botón `Enviar confirmación por WhatsApp` (`background:#25D366; color:#fff; r14; min-height:52px; 14.5px 800`) que abre `https://wa.me/{57+tel}?text={mensaje}` con mensaje literal: `¡Hola {nombre}! Confirmamos tu cita en Barbas & Bigotes {sede}: {servicio} con {barbero} el {día} {fecha} a las {hora}. ¡Te esperamos!` (si no hay tel usa `573006734799`); botón secundario `Listo` (borde LINE). La cita queda insertada en "Siguientes citas" con tag `WHATSAPP` verde.

### 3.2 "Reasignar cita" (barbero ausente) — solo móvil en el prototipo

Bottom sheet igual al anterior (`z-index:22`, `rgba(5,4,3,.6)`, blur 2px). **No encontrado en el prototipo** un equivalente desktop (en desktop las filas de citas no tienen onClick de reasignar).

- Header: título `Reasignar cita` (Barlow 21px 800 uppercase) + sub `{cliente} · {hora}`; botón `✕`.
- Aviso ámbar: `border rgba(251,191,36,.35); bg rgba(251,191,36,.07); r12; padding:11px 14px; 12.5px; color:#fbbf24` — texto `{servicio} estaba con {barberoOriginal}, que hoy no vino.`
- Paso `1 · Pasala a un barbero disponible` (label uppercase estándar): lista en card de los barberos de la sede, no ausentes, distintos del original. Fila: avatar 36px, nombre 14px 700, meta `★ {rating}` (ej. `★ 4.8 · 176 reseñas`), chip derecha `Elegir` (verde, borde `rgba(52,211,153,.35)`) → al elegir la fila toma `bg rgba(210,63,52,.12)` y el chip pasa a `Elegido` (`#e8675c`, borde `rgba(210,63,52,.55)`).
- Paso `2 · Confirmá o cambiá la hora` (aparece al elegir barbero): grid `repeat(4,1fr)` de horas `["9:30a","10:00a","10:30a","11:00a","11:30a","12:00p","2:00p","2:30p","3:00p","3:30p","4:00p","4:30p"]`, botones `min-height:42px; r11; Barlow 14px 800 tabular`; las horas ya ocupadas por el barbero elegido van tachadas/deshabilitadas. Preselecciona la hora original de la cita.
- CTA: `Pasar a {barbero} · {hora}` (gradiente, `min-height:52px; r13; 14.5px 800 uppercase`); mientras no hay barbero muestra `Elegí un barbero` con `opacity:.5`.
- Botón secundario: `Mejor pedirle al cliente que reagende (correo)` (`min-height:46px; r12; borde rgba(242,237,228,.16); 13px 600`).

Resultados (banner verde en Hoy):
- Confirmar → `Cita de {cliente} pasada a {barbero} a las {hora} · el cliente ya fue avisado por correo.`
- Correo → `Le pedimos a {cliente} por correo que elija un nuevo horario.`

---

## 4. Perfil de barbero (bottom sheet desde "Equipo ahora") — solo móvil

Overlay `z-index:20; rgba(5,4,3,.6); blur(2px)`; sheet `#0c0b0a; r 22px 22px 0 0; max-height:88%`.

**Header**: avatar 46px con `border:2px solid rgba(210,63,52,.6)`; nombre Barlow 22px 800 uppercase; meta `{sede} · ★ {rating}` (11.5px); chip de estado (mismos 3 estados de Equipo ahora); `✕`.

**Cuerpo** (scroll, gap 16px):
1. **Botón de ausencia** (full width, `min-height:46px; r12; 13px 700`): estado normal → `No vino hoy` (ámbar: borde `rgba(251,191,36,.45)`, bg `rgba(251,191,36,.08)`, color `#fbbf24`); si ya está ausente → `Marcar que sí vino` (verde: `rgba(52,211,153,.4)` / `.08` / `#34d399`).
2. Si está ausente, aviso ámbar con texto literal: `No vino hoy: sus citas quedan **para reasignar** (otro barbero libre o reagendar, con aviso al cliente por correo), no recibe reservas nuevas por hoy y figura en $0 en la caja — el cierre de la sede no se bloquea.` (el "para reasignar" va en `<b>`).
3. **KPIs de hoy** — grid 3 col, cards `r12; padding:10px 8px; text-align:center`: valor Barlow 20px 800 tabular + label 9.5px uppercase ls `.1em` `#9c958a`. Labels: `Atenciones` / `Cobrado` / `Propinas` (propinas en `#34d399`).
4. **`Últimos 7 días · cobrado`** — gráfico de barras: contenedor card `r14; padding:14px 14px 10px`; 7 columnas flex con barra `border-radius:5px 5px 2px 2px`, altura = `v/max*100%` sobre 74px; última barra `#d23f34`, anteriores `#a3907c`; labels de día 9.5px: `V S L M M J V`. Footer con borde: `Semana: {total}` (total = suma·1000) y `{vs}` en `#34d399` 700 (ej. `+12% vs anterior`).
5. **`Este mes`** — card con filas clave/valor (`padding:11px 14px; 13px`): `Ventas` / `Comisión (50%)` (valor `#34d399`, = ventas/2) / `Atenciones` / `Rating` (`★ {rating}`).
6. **`Lo que más hace`** — top 3: posición Barlow 16px 800 `#e8675c`, nombre 13px 600, `{n} este mes` 12px `#9c958a`.
7. **Reseña** — card con cita entre comillas tipográficas `“…”` 12.5px + meta 11px.

**Datos demo (`perfilesDef`)** — `hoy:[atenciones, cobrado, propinas]`, `semana` en miles:
| Barbero | hoy | semana | vs | mesVentas | mesAt | top | reseña |
|---|---|---|---|---|---|---|---|
| Meyer | 5 · $145.000 · $6.000 | 180,220,160,240,205,310,145 | +12% vs anterior | $4.850.000 | 186 | Corte y barba 42 / Corte 38 / Combo silver 17 | "Meyer es un crack, el degradado quedó perfecto" · ★★★★★ · hace 2 días |
| Jhon | 4 · $118.000 · $4.000 | 150,190,140,210,175,260,118 | +8% | $4.120.000 | 158 | Corte 51 / Keratina 12 / Peinados 11 | "Buena atención, el ritual de barba vale cada peso" · ★★★★★ · hace 5 días |
| Junior | 3 · $96.000 · $3.000 | 120,160,130,170,150,220,96 | +5% | $3.480.000 | 141 | Corte 44 / Tintura de barba 15 / Rayitos 6 | "El color quedó tal cual la foto que llevé" · ★★★★★ · hace 1 semana |
| Brayan | 4 · $132.000 · $5.000 | 160,200,150,220,190,280,132 | +10% | $4.390.000 | 172 | Corte y barba 39 / Corte 35 / Depilación cera barba 14 | "Brayan siempre puntual, el corte impecable" · ★★★★★ · hace 3 días |
| Kevin | 3 · $89.000 · $2.000 | 110,150,120,160,140,200,89 | +4% | $3.150.000 | 128 | Corte 46 / Hidratación capilar 13 / Cerquillos 12 | "Buen servicio con los niños, mucha paciencia" · ★★★★☆ · hace 4 días |
| Abel | 5 · $139.000 · $7.000 | 170,210,155,230,195,290,139 | +11% | $4.610.000 | 179 | Corte 40 / Diseños 22 / Tintura de canas 10 | "Los diseños de Abel no los hace nadie más en Barranquilla" · ★★★★★ · ayer |

**Regla "No vino hoy"** (efectos en toda la app): sus citas en "Siguientes citas" pasan a `REASIGNAR →`; en Equipo ahora chip `No vino hoy` + detalle `Ausente · citas para reasignar`; su caja figura `$ 0 · no vino`; en el wizard público de reserva su card muestra `No disponible hoy` (ámbar) y no es seleccionable; no aparece en los pickers de Agendar/Reasignar.

---

## 5. Tab INVENTARIO

- Título: móvil `Inventario` / desktop `Inventario · {sede}` + botón `+ Producto` (pill `r999; padding:9px 16px (10px 18px desktop); 12px 700; gradiente CTA`). El botón se oculta mientras el form está abierto.
- Subtítulo dinámico (12px `#9c958a`): `{n} producto{s} por debajo del mínimo en {sede}.` o, si no hay alertas, `Todo el stock de {sede} está sano.`

**Form "Nuevo producto"** (card `r16; padding:14–16px; gap:9px`):
- Título Barlow 18px 700 uppercase `Nuevo producto`.
- Selector de categoría: 2 pills flex-1 `Bebidas` / `Productos` (estados sel estándar).
- Input `Nombre del producto` (`r12; bg #0c0b0a; padding:12px 14px; 14px` — ojo: inputs dentro de card usan bg `#0c0b0a`).
- Grid 3 col: `Precio` / `Stock` / `Mínimo` (numéricos).
- Errores literales: `Poné el nombre del producto.` / `Poné el precio.` (caja de error estándar).
- Botones: `Agregar a {sede}` (sólido `#d23f34`, pill, uppercase) + `Cancelar` (ghost pill `#9c958a`).

**Acordeón por categoría** (`Bebidas`, `Productos`): header estándar (§0) con `{n}` ítems y, si aplica, badge `{n} en alerta` (`r999; bg rgba(251,191,36,.13); color #fbbf24; 10px 800; padding:2px 9px`).

**Ítem de producto**:
- Móvil: card `r14; padding:12px 14px` (borde ámbar `rgba(251,191,36,.35)` si stock ≤ mínimo). Fila 1: cuadro 40px `r10 #211d19` con la inicial del producto (Barlow 17px 800 `#9c958a`), nombre 13.5px 700, `{precio} · mínimo {min}` 11.5px tabular, chip de estado a la derecha. Fila 2: label `Ajustar stock` (11px) + stepper `− {stock} +` (botones 38px; valor 15px 800; `−` deshabilitado visual `rgba(242,237,228,.2)` en 0; valor coloreado por estado) + botón `Quitar` (`min-height:38px; r11; borde .12; #9c958a 11.5px`).
- Desktop: todo en una fila (`padding:12px 18px`): inicial · nombre+meta · chip · stepper (34px) · `Quitar`.

**Chips de estado de stock** (uppercase 10px 700 ls .06em):
- `OK` → bg `rgba(52,211,153,.12)` color `#34d399`
- `Poco stock` (stock ≤ mínimo) → bg `rgba(251,191,36,.13)` color `#fbbf24`
- `Agotado` (stock ≤ 0) → bg `rgba(210,63,52,.15)` color `#e8675c`

**Datos demo** (por sede):
- PV Bebidas: Gaseosa $5.000 stock 40 min 12 · Agua $3.000/24/10 · Energizante $8.000/16/8 · Cerveza $7.000/12/6. PV Productos: Cera mate fijación fuerte $28.000/14/5 · Aceite para barba $32.000/9/4 · Shampoo anticaspa $25.000/**3**/5 (en alerta).
- PLAZA Bebidas: Gaseosa $5.000/33/12 · Agua $3.000/18/10. PLAZA Productos: Cera mate fijación fuerte $28.000/7/5 · Gel fijador $18.000/**2**/6 (en alerta).

---

## 6. Tab CLIENTES (CRM)

- Título: móvil `Clientes` / desktop `Clientes · {sede}`.
- Sub: `CRM de la sede · fidelización y última visita.`

**Móvil** — card lista; fila `padding:12px 16px`:
- Nombre 13.5px 700; `{tel} · {visitas} visitas` 11.5px tabular `#9c958a`; `Última visita: {x}` 11.5px — color `#34d399` si reciente, `rgba(242,237,228,.75)` si no.
- Derecha: `{puntos} pts` en Barlow 16px 800 `#e8675c` tabular.

**Desktop** — tabla en card: header grid `1.4fr 1fr .6fr 1.3fr .5fr` con `Cliente / Teléfono / Visitas / Última visita / Pts` (`10px 800 uppercase ls .12em #9c958a`); filas mismas columnas 13px, pts a la derecha Barlow 16px 800 `#e8675c`.

**Datos demo**:
- PV: Andrés Pertuz · 300 812 4455 · 12 visitas · `hoy, 10 jul` (reciente) · 240 pts / Camilo Ruiz · 301 447 2210 · 8 · `hoy, 10 jul` (reciente) · 155 / Jorge Llanos · 315 220 9087 · 6 · `mié 2 jul (hace 8 días)` · 120 / Santiago Meza · 310 660 1123 · 4 · `mié 25 jun (hace 15 días)` · 75.
- PLAZA: Luis Mercado · 302 118 6640 · 9 · `hoy, 10 jul` (reciente) · 180 / Rafa Domínguez · 300 554 7789 · 7 · `hoy, 10 jul` (reciente) · 140 / Óscar Trillos · 311 902 3345 · 5 · `sáb 28 jun (hace 12 días)` · 95.

No hay búsqueda, filtros ni acciones por fila en el prototipo (**no encontrado en el prototipo**).

---

## 7. Tab PRECIOS

- Título `Precios · {sede}` + botón `+ Servicio` (gradiente pill, se oculta con el form abierto).
- Sub móvil: `Catálogo completo · ajustá de a $1.000, cambia solo en esta sede.`
- Sub desktop: `Catálogo completo · ajustá de a $1.000, cambia solo en esta sede. Para el armador de combos y cambio de fotos, usá también la vista móvil.` (Nota: en desktop el botón `+ Servicio` existe pero el markup del form NO está en la vista desktop del prototipo; el form completo, con armador de combos, solo está en móvil.)

### 7.1 Form "Nuevo servicio" (móvil)
Card `r16; padding:14px; gap:9px`:
- Título Barlow 18px 700 uppercase `Nuevo servicio`.
- Input `Nombre del servicio`; grid 2 col `Precio (COP)` / `Duración (min)` (numéricos).
- Chips de categoría (7): `Cortes`, `Barba`, `Cejas y diseños`, `Faciales`, `Capilar y color`, `Depilación`, `Combos` (pills `padding:8px 12px; 11.5px 600`).
- **Armador de combos** (aparece si la categoría es Combos): panel `border:1px solid rgba(210,63,52,.35); background:rgba(210,63,52,.05); r14; padding:12px; gap:10px`:
  - Label `Armá el combo · tocá lo que incluye` (`11px 700 uppercase ls .14em #e8675c`).
  - Chips toggle de partes con precio `+$X` (pill `min-height:38px`): partes disponibles (comboPartsDef): `Corte`, `Barba` (=perfilamiento-barba), `Ritual de barba`, `Cejas` (=perfilamiento-cejas), `Cerquillo`, `Limpieza silver`, `Limpieza gold`, `Mascarilla` (=mascarilla-hidratante), `Peinado`. Precio según sede.
  - Botón toggle `Incluye bebida · +$5.000` — apagado LINE/MUT, prendido verde (`rgba(52,211,153,.5)` borde, `.1` bg, `#34d399`).
  - Resumen (cuando hay ≥1 parte, con `border-top` interno): nombre auto-generado 12.5px 700; línea `Suelto vale {suma} · {dur} min · precio de combo sugerido {sugerido} (10% menos)` (sugerido en `#34d399` 700); nota `Nombre, precio y duración ya quedaron abajo — ajustalos si querés.`
  - Reglas del armador: nombre = partes unidas con ` + ` (+ ` + bebida`), primera letra en mayúscula; duración = suma de duraciones; sugerido = `max(1000, round((suma*0.9)/1000)*1000)`; al tocar chips se auto-rellenan los inputs nombre/precio/duración.
- Errores: `Poné el nombre del servicio.` / `Poné el precio.`
- Botones: `Agregar al catálogo` (sólido `#d23f34` pill uppercase) + `Cancelar`. El servicio nuevo se agrega con el mismo precio en ambas sedes.

### 7.2 Avisos de estado
- **Cambios sin guardar al cambiar de sede** (`pSedeConfirm`, card ámbar `r14; border rgba(251,191,36,.4); bg rgba(251,191,36,.07)`): título `Tenés cambios sin guardar en {sede}` (13px 700 `#fbbf24`); sub (solo móvil) `¿Qué hacemos antes de cambiar de sede?`; botones `Guardar y cambiar` (sólido `#d23f34`, flex 1.3 en móvil) / `Descartar` (ghost borde .16) / `Volver` (texto `#9c958a`).
- **Guardado** (`pGuardadoMsg`, card verde estándar): `Cambios guardados en {sede}.`

### 7.3 Catálogo (acordeón con foto y stepper por sede)
Acordeón por categoría — header estándar con `{n} servs`. Ítem:
- Foto del servicio 44px móvil / 42px desktop, `r10`, `background-size:cover` — rota entre 4 assets: `public/cortes/corte-2.jpg`, `corte-3.jpg`, `corte-5.jpg`, `corte-1.jpg` (índice = posición en la categoría mod 4).
- Nombre 13px 600 + `{dur} min` 11px.
- Botón `Cambiar foto` (pill ghost `min-height:36px (34 desktop); 11px 600`) — cicla a la siguiente foto; el label se pinta `#e8675c` cuando hay cambio de foto pendiente.
- Stepper de precio: botones `−`/`+` circulares 36px (34 desktop) `bg #211d19 borde LINE`; precio central Barlow 18px (17) 800 tabular `min-width:72–74px` — de a **$1.000**, piso **$5.000**; el precio se pinta `#e8675c` mientras el cambio no esté guardado. El ajuste es por servicio+sede (`key = id@sede`).

### 7.4 Barra sticky Guardar/Descartar (`pDirty`)
- Móvil: `position:absolute; left:0; right:0; bottom:78px; z-index:7; padding:10px 14px; background:linear-gradient(180deg, rgba(12,11,10,0), rgba(12,11,10,.9) 45%);` conteniendo card `border:1px solid rgba(251,191,36,.4); background:#1c1712; r14; padding:10px 12px` → mensaje `{N} cambio(s) sin guardar` (12px 700 `#fbbf24`) + `Descartar` (texto) + `Guardar cambios` (gradiente `r11; min-height:42px; 13px 800`).
- Desktop: `position:sticky; bottom:14px;` misma card con `box-shadow:0 18px 40px -14px rgba(0,0,0,.7)`.
- Cuenta cambios = ajustes de precio + fotos pendientes. Guardar consolida y muestra el mensaje verde.

### 7.5 Catálogo completo demo (seed literal, `pv` = Parque Venezuela / `pp` = Plaza de la Paz)
Cortes: Corte (clásico, degradado o tijera) 30min $35.000/$30.000 · Corte y barba 60 $45.000/$40.000 · Corte y cejas 40 $35.000/$35.000 · Corte + barba + cejas 50 $45.000/$45.000 · Cerquillos 10 $15.000/$10.000 · Cerquillo y barba 35 $30.000/$30.000.
Barba: Perfilamiento de barba 20 $25.000/$20.000 · Ritual de barba 30 $35.000/$30.000.
Cejas y diseños: Diseños 10 $7.000 · Perfilamiento de cejas 10 $5.000.
Faciales: Mascarilla puntos negros 15 $10.000 · Mascarilla hidratante 15 $10.000 · Parches de colágeno 10 $7.000 · Limpieza facial silver 20 $20.000 · Limpieza facial gold 35 $35.000/$40.000.
Capilar y color: Peinados 20 $15.000 · Hidratación capilar 30 $20.000 · Relajante de ondas 20 $30.000 · Keratina 60 $90.000 · Rayitos 180 $150.000 · Tintura de barba 20 $20.000 · Tintura de canas 20 $30.000 · Tintura de cabello color 180 $150.000 · Tintura barba o cabello con pigmento 10 $15.000.
Depilación: cera nariz/orejas 10 $10.000 · cera nariz y orejas 15 $16.000 · cera bozo 10 $10.000 · cera barba 10 $15.000 · cera bozo y barba 20 $20.000.
Combos (14): Corte + limpieza silver + bebida 60 $55.000 · Corte + limpieza gold + bebida 75 $75.000 · Corte + barba + limpieza silver + bebida 70 $65.000 · Corte + barba + limpieza gold + bebida 90 $85.000 · Corte + cera orejas o nariz + bebida 45 $45.000 · Corte + barba + cera + bebida 60 $55.000 · Corte + hidratación 60 $55.000 · Corte + barba + hidratación 70 $65.000 · Corte + keratina 90 $140.000 · Corte + keratina + hidratación + bebida 120 $160.000 · Corte + relajante de ondas 60 $70.000 · Corte + relajante + hidratación + bebida 90 $90.000 · Corte + tintura de barba o tapacanas 60 $50.000 · Corte + diseño 45 $40.000 · Corte + peinado 60 $45.000 · Deluxe: corte + gold + depilación + cejas + hidratación + masaje + bebida 120 $115.000 · Deluxe full: todo + pigmento + masaje + bebida 150 $150.000. (Donde no se indica pp, es igual a pv.)

---

## 8. Tab COMISIONES

- Título `Comisiones · hoy`.
- Sub móvil: `Contrato al 50% · lo que se le paga a cada barbero.` / desktop: `Contrato al 50% · lo que se le paga a cada barbero en {sede}.`

Card lista — fila por barbero (`padding:11px 14px` móvil / `12px 18px` desktop):
- Avatar 32px (36 desktop) redondo; nombre 13.5px (14) 700; detalle `{n} servicios · {ventas}` 11.5px (12) tabular `#9c958a`.
- Derecha: pago en `#34d399` 13.5px (14.5) 800 tabular + `50%` 10px `#9c958a` debajo.

Footer de card (`background:rgba(210,63,52,.06); padding:13px 16px (14px 18px)`): `Total a pagar` (`12px 700 uppercase ls .08em #e8675c`) + total Barlow 20px (22) 800 tabular.

**Datos demo** — PV: Meyer `6 servicios · $ 150.000` → `$ 75.000` / Jhon `5 · $ 105.000` → `$ 52.500` / Junior `3 · $ 60.000` → `$ 30.000` — total `$ 157.500`. PLAZA: Brayan `5 · $ 110.000` → `$ 55.000` / Abel `4 · $ 95.000` → `$ 47.500` / Kevin `3 · $ 63.000` → `$ 31.500` — total `$ 134.000`.

Regla: comisión = 50% de las ventas del barbero. No hay edición del % en el prototipo (**no encontrado en el prototipo**).

---

## 9. Tab AJUSTES

- Título `Ajustes`. Sub móvil: `Sedes, horarios y reglas de la reserva.` / desktop: `Sedes, horarios, reglas de la reserva, fidelidad, cupones y PINes.`
- Desktop organiza en grid 2 col: izquierda (Sede y horario → Fidelidad → PINes), derecha (Reglas de reserva → Cupones). Móvil apila: Sede y horario → Reglas → Fidelidad → Cupones → PINes.

### 9.1 `Sede y horario · {sede}`
Card por sede (solo la sede activa — el dato se filtra por `aSede`): foto de la sede 48px `r10`; nombre 14px 800; dirección 11.5px (`Cra 65 · Barranquilla` para PV / `Centro · Barranquilla` para Plaza); chip `Lun–Sáb` (verde `rgba(52,211,153,.12)` / `#34d399`, uppercase 10px 800). Debajo, grid 2 col con steppers `Abre` / `Cierra` (valor formato `9:00 am` / `8:00 pm`, `min-width:56px`, 12px 800 tabular). Reglas: paso de 1 hora; abre ≥ 6; cierra ≤ 23; abre < cierra (mínimo 1 h de diferencia). El cierre alimenta el subtítulo del tab Hoy (`cierre 8:00 pm`).

### 9.2 `Reglas de reserva`
Card única con divisores internos:
1. **Cancelación del cliente** — sub `Solo hasta {n} h antes de la cita.`; stepper `{n} h` (botones 38px móvil / 34 desktop), rango **1–6**, default **2**.
2. Nota informativa (solo móvil, tras divisor): `Al liberarse un turno, se les avisa por notificación a la fila y a los clientes de la app.`
3. **Ofrecer bebida al reservar** — sub `Pop-up en servicios sin bebida incluida.`; botón toggle pill (`min-height:38px (36); padding:0 16px; 12.5px (12) 800`): `Activado` (verde borde `rgba(52,211,153,.4)` bg `.1` color `#34d399`) / `Apagado` (LINE/transparent/`#9c958a`). Si activado, aparece input `Mensaje del pop-up` con valor default `¿Le sumás una bebida a tu corte?`.
4. **Elegir bebida en combos** — sub `Si el combo incluye bebida, el cliente elige cuál.`; mismo toggle; input `Mensaje del pop-up de combos`, default `Tu combo incluye bebida. ¿Cuál querés?`.

### 9.3 `Fidelidad · tarjeta de cortes`
Card con 3 filas de stepper:
1. **Corte con descuento** — sub dinámico `En el corte {fidMeta5} el cliente tiene {fidDesc}% off.`; stepper valor `{fidMeta5}` (default **5**, rango 2 a fidMeta10−1).
2. **% de descuento** — stepper `{fidDesc}%` (default **50**, rango 10–90, de a 10).
3. **Corte gratis** — sub `Al llegar al corte {fidMeta10}.`; stepper `{fidMeta10}` (default **10**, rango fidMeta5+1 a 15).
Botones del stepper 36px móvil / 32 desktop. Estas metas alimentan la tarjeta del portal cliente y el canje automático en el cobro del barbero.

### 9.4 `Cupones`
Card lista:
- Fila por cupón: código `13.5px 800 ls .04em` (ej. `BIENVENIDO10`); sub `{desc} · el barbero lo aplica en el cobro` — desc = `{v}% de descuento` (tipo pct) o `−{$v}` (tipo monto); toggle a la derecha `Activo` (verde) / `Inactivo` (gris) — pill `min-height:36px (34); 11.5px 700`.
- Botón `+ Cupón` full-width (`background:rgba(210,63,52,.06); color:#e8675c; padding:13px; 13px 600; border:none`), se reemplaza por el form al abrir.
- **Form**: input `Código (ej: SEPTIEMBRE15)` (uppercase forzado, sin espacios); fila `Valor` (numérico) + botones `%` / `$` (r11, seleccionado con accBorder/accBg); errores literales: `Poné el código.` / `El % va de 1 a 100.` / `Poné el valor del descuento.`; botones `Crear cupón` (sólido `#d23f34` pill uppercase) + `Cancelar`. El cupón nuevo nace activo.
- Nota bajo la card: `Los cupones activos valen en las dos sedes.` (11.5px `#9c958a`).

Datos demo: `BIENVENIDO10` — 10% de descuento — **activo**; `COMBOPAPA` — −$ 5.000 — **inactivo**.

### 9.5 `Equipo · PINes · {sede}`
Card lista — fila por barbero de la sede activa: avatar 32px, nombre 13.5px 700, sede 11.5px `#9c958a`. A la derecha:
- Estado normal: botón `Resetear PIN` (pill ghost `min-height:38px (36); 11.5px 600; borde LINE`).
- Tras resetear: chip `PIN enviado` (`r999; padding:4px 11px; 10px 800 uppercase; bg rgba(52,211,153,.12); color #34d399`).
No hay flujo de setear PIN manualmente en el prototipo (**no encontrado en el prototipo** — solo reset con confirmación visual).

---

## 10. Datos de negocio transversales visibles en el prototipo

- **Sedes**: `parque-venezuela` ("Parque Venezuela") y `plaza-de-la-paz` ("Plaza de la Paz"). Fotos frente: `public/sedes/parque-venezuela-frente.jpg` / `plaza-de-la-paz-frente.jpg`.
- **Barberos** (id · sede · rating · foto): Meyer · PV · `4.9 · 212 reseñas` · `public/barberos/generico.jpg` (destacado, en silla `sale 11:10 am`); Jhon · PV · `4.8 · 176 reseñas` · `jhon.jpg` (destacado); Junior · PV · `4.8 · 143 reseñas` · `junior.jpg`; Brayan · PLAZA · `4.9 · 198 reseñas` · `brayan.jpg` (en silla `sale 11:20 am`); Kevin · PLAZA · `4.7 · 121 reseñas` · `kevin.jpg`; Abel · PLAZA · `4.9 · 167 reseñas` · `abel.jpg` (destacado).
- **Medios de pago**: Efectivo (`public/brand/pagos/efectivo.svg`), Nequi (`nequi.svg`), Daviplata (`daviplata.png`), Tarjeta (`datafono.svg`).
- **Precio por sede**: cada servicio tiene `pv` (Parque Venezuela) y `pp` (Plaza de la Paz); todos los cambios de precios/inventario/PINes/clientes son por sede; cupones y fidelidad son globales.
- **Fidelidad en el cobro** (lógica visible en app barbero, la configura admin): con `fidMeta5=5, fidDesc=50, fidMeta10=10`, en el corte 5 → 50% off automático; en el corte 10 → gratis. Copy en el cobro: `Tarjeta de cortes: corte {n} → {d}% de descuento (−$X). Se aplica solo.` / `Tarjeta de cortes: ¡este es su corte {n} → GRATIS! (−$X). Se aplica solo.` / info: `Tarjeta de cortes: con este va {n} de {meta}.`
- **Cupones en el cobro**: el barbero escribe el código; inválido/inactivo → `Cupón inválido o inactivo.` / vacío → `Escribí el código.`; monto = pct sobre subtotal (servicio − fidelidad + extras + productos) o monto fijo topado al subtotal.
- Estados de cita (chip): Pendiente `rgba(242,237,228,.08)/#9c958a` · Confirmada `rgba(210,63,52,.15)/#e8675c` · En curso `rgba(52,211,153,.9)/#06281c` · Completada `rgba(52,211,153,.14)/#34d399` · No llegó `rgba(251,191,36,.12)/#fbbf24` · Cancelada `rgba(242,237,228,.06)/#9c958a`.

## 11. Assets referenciados por el admin
`public/brand/logo-lockup.png` · `public/brand/logo-face-transparent.png` · `public/sedes/parque-venezuela-frente.jpg` · `public/sedes/plaza-de-la-paz-frente.jpg` · `public/barberos/{generico,jhon,junior,brayan,kevin,abel}.jpg` · `public/cortes/corte-{1,2,3,5}.jpg` (fotos de servicios en Precios) · SVG inline del logo WhatsApp (path oficial, fill `#34d399`).
