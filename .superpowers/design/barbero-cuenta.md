# Spec de diseño — APP DEL BARBERO (/barbero) y PORTAL DEL CLIENTE (/cuenta)

Fuente: prototipo Claude Design `Barbas y Bigotes.dc.html` (handoff, 5.149 líneas).
Extraído literal del HTML/CSS/JS embebido. Lo que no está en el prototipo se marca
como **no encontrado en el prototipo**. Los `{{ … }}` son bindings del prototipo;
sus valores/lógica vienen del script (`class Component extends DCLogic`, líneas 3563–5145).

---

## 0. Sistema de diseño global (compartido por ambos frentes)

### Tipografías (Google Fonts)
```html
<link href="https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700;800&family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
```
- **Display / títulos / cifras**: `'Barlow Condensed'`, casi siempre `font-weight:800; text-transform:uppercase;` y `font-variant-numeric:tabular-nums` en montos/horas.
- **Cuerpo / UI**: `Inter, system-ui, sans-serif`.

### Fondo y base (CSS global literal)
```css
html, body { margin:0; padding:0; color-scheme: dark; }
::-webkit-scrollbar { display:none; }
* { scrollbar-width:none; }
body {
  background: radial-gradient(130% 90% at 50% -10%, #1b1613 0%, #0c0b0a 58%, #050403 100%) fixed;
  color: #f2ede4;
  font-family: Inter, system-ui, sans-serif;
  min-height: 100dvh;
}
a { color: #e8675c; text-decoration: none; }
a:hover { color: #d23f34; }
::selection { background:#d23f34; color:#fbf7f0; }
input::placeholder { color:#9c958a; }
```
`theme-color` meta: `#0c0b0a`.

### Paleta (constantes del script)
| Token | Valor | Uso |
|---|---|---|
| `ACC` | `#d23f34` | rojo marca (acciones primarias, líneas activas) |
| `SOFT` | `#e8675c` | rojo suave (acentos, precios de extras, links) |
| `INK` | `#f2ede4` | texto principal |
| `MUT` | `#9c958a` | texto secundario/mudo |
| `LINE` | `rgba(242,237,228,.14)` | bordes neutros |
| fondo app | `#0c0b0a` | shell |
| tarjeta | `#151311` | cards |
| tarjeta interna | `#211d19` | inputs/sub-cards |
| verde éxito | `#34d399` (bordes `rgba(52,211,153,.35–.5)`, fondos `.06–.12`) | en curso / dinero / OK |
| ámbar aviso | `#fbbf24` (fondos `rgba(251,191,36,.12–.13)`) | no llegó / poco stock |
| crema botón | `#fbf7f0` | texto sobre rojo |
| gris cálido | `#a3907c` | progreso, avatares |
| texto suave 2 | `#cfc7ba` / `#c9c2b6` | subtítulos en tarjetas hero |
| selección chips | on: `border rgba(210,63,52,.75)` + `bg rgba(210,63,52,.14)`; off: `border LINE` + `bg transparent` |

Botón primario recurrente: `background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0;` con
sombra `box-shadow:0 12px 26px -10px rgba(210,63,52,.6)` (variantes .65/.7).

### Keyframes relevantes a estos frentes (CSS global, literal)
```css
@keyframes bbping { 0%{transform:scale(1);opacity:.7} 80%,100%{transform:scale(2.4);opacity:0} }
/* OJO: bbping está declarado DOS veces; la segunda pisa a la primera y es la vigente: */
@keyframes bbping { 0%{transform:scale(1); opacity:.5} 75%,100%{transform:scale(1.8); opacity:0} }
@keyframes bbstamp { 0%{transform:scale(0) rotate(-30deg);opacity:0} 60%{transform:scale(1.3) rotate(8deg);opacity:1} 100%{transform:scale(1) rotate(0);opacity:1} }
@keyframes bbrise { 0%{transform:translateY(16px);opacity:0} 100%{transform:translateY(0);opacity:1} }
@keyframes bbdrop { 0%{opacity:0; transform:translateY(-14px) scale(.9)} 100%{opacity:1; transform:translateY(0) scale(1)} }
```
- `bbping` → anillo pulsante del "¡Es tu turno!" del portal: `animation:bbping 1.6s cubic-bezier(0,0,.2,1) infinite`.
- `bbstamp` → sello ✕ de la tarjeta de cortes: `animation:bbstamp .45s cubic-bezier(.2,1.4,.4,1) {delay} both` con `delay = index*0.08s` (escalonado).

### Formato de moneda
```js
cop(n) { return new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n); }
```
En chips se compacta quitando el espacio: `this.cop(x.precio).replace(/\s/g, "")` → `$5.000`.

### Móvil vs Desktop
- Móvil: frame iOS 430×880, shell `background:#0c0b0a; padding-top:58px`.
- Desktop (`<!-- ===== APP (reserva / barbero / cuenta) · DESKTOP: mismas vistas, columna centrada ===== -->`):
  **exactamente el mismo markup** dentro de una columna centrada:
  ```html
  <div style="height:100%; display:flex; justify-content:center; background:radial-gradient(120% 90% at 50% -10%, #1b1613 0%, #0c0b0a 60%, #080706 100%);">
    <div style="position:relative; width:{{ deskAppWidth }}; max-width:100%; height:100%; display:flex; flex-direction:column; overflow:hidden; background:#0c0b0a; border-left:1px solid rgba(242,237,228,.08); border-right:1px solid rgba(242,237,228,.08); box-shadow:0 0 80px rgba(0,0,0,.55);">
  ```
  - `deskAppWidth`: **`780px` para /barbero, `900px` para /cuenta**.
  - URL simulada del browser: `barbasybigotes.co/barbero` y `barbasybigotes.co/cuenta`.
  - Diff literal móvil→desktop (verificado con diff): **una sola diferencia** en barbero — el grid del
    walk-in pasa de `grid-template-columns:1fr 1fr` a `repeat(auto-fit, minmax(230px, 1fr))`.
    Mi Cuenta desktop es 100% idéntico al móvil. Todo lo demás (nav inferior, hoja de cobro,
    tarjetas) se reusa igual.

---

# 1. APP DEL BARBERO (/barbero)

## 1.1 Header (compartido por las 3 tabs)

```html
<div style="padding:12px 16px 0; border-bottom:1px solid rgba(242,237,228,.1);">
  <div style="display:flex; align-items:center; justify-content:space-between;">
    <img src="public/brand/logo-lockup.png" style="height:47px; width:139px">
    <div style="display:flex; align-items:center; gap:8px;">
      <span style="font-size:10px; text-transform:uppercase; letter-spacing:.24em; color:#d23f34;">App del barbero</span>
      <span style="width:30px; height:30px; border-radius:999px; overflow:hidden; border:1px solid rgba(242,237,228,.2);"><img src="public/barberos/generico.jpg" alt="Meyer" style="object-fit:cover;"></span>
    </div>
  </div>
  <div style="height:10px;"></div>
</div>
```
Copy literal: **"App del barbero"** + avatar del barbero logueado (Meyer en el demo).

## 1.2 Nav inferior (shell staff, targets grandes)

Comentario del prototipo: `<!-- Shell staff unificado: nav inferior, targets grandes -->`
```html
<div style="position:absolute; left:0; right:0; bottom:0; z-index:6; border-top:1px solid rgba(242,237,228,.1); background:rgba(12,11,10,.96); backdrop-filter:blur(10px); padding:6px 8px 18px; display:flex;">
  <!-- por tab: -->
  <button style="flex:1; background:none; border:none; padding:8px 2px; min-height:54px; display:flex; flex-direction:column; align-items:center; justify-content:center; gap:5px;">
    <span style="width:34px; height:3px; border-radius:99px; background:{line};"></span>
    <span style="font-family:'Barlow Condensed'; font-size:16px; font-weight:800; text-transform:uppercase; letter-spacing:.04em; color:{color};">{label}</span>
  </button>
</div>
```
Tabs (labels dinámicos con contador):
```js
bNav: [
  { id: "agenda", label: "Agenda (" + <citas activas: estado ∉ [completada, no_show, cancelada]> + ")" },
  { id: "espera", label: "Espera (" + espera.length + ")" },
  { id: "caja",   label: "Caja" },
]
// activa:  color #f2ede4, línea superior #d23f34
// inactiva: color #9c958a, línea transparent
```
El contenido de cada tab lleva `padding-bottom:116px` para no chocar con la nav.

## 1.3 Tab AGENDA

Contenedor: `flex:1; overflow-y:auto; padding:14px 14px 116px;`

### a) Encabezado del día
```html
<div style="display:flex; align-items:baseline; justify-content:space-between; margin-bottom:12px;">
  <div>
    <div style="font-family:'Barlow Condensed'; font-size:26px; font-weight:800; text-transform:uppercase; line-height:1;">Hoy, {{ hoyLabel }}</div>   <!-- "Hoy, vie 10 jul" -->
    <div style="font-size:12px; color:#9c958a; margin-top:3px;">Meyer · Parque Venezuela</div>
  </div>
  <div style="text-align:right;">
    <div style="font-family:'Barlow Condensed'; font-size:22px; font-weight:800; color:#34d399; font-variant-numeric:tabular-nums;">{{ ventasHoy }}</div>
    <div style="font-size:10px; text-transform:uppercase; letter-spacing:.12em; color:#9c958a;">cobrado hoy</div>
  </div>
</div>
```
- `ventasHoy = cop(80000 + cobradoExtra)` — arranca en $80.000 y suma cada cobro de la sesión.

### b) Card "Tu día" (progreso)
```html
<div style="margin-bottom:12px; border:1px solid rgba(242,237,228,.1); background:#151311; border-radius:14px; padding:11px 14px;">
  <div style="display:flex; justify-content:space-between; font-size:11px; text-transform:uppercase; letter-spacing:.1em; color:#9c958a;"><span>Tu día</span><span>{{ bProgLabel }}</span></div>
  <div style="height:5px; border-radius:99px; background:rgba(242,237,228,.08); margin-top:7px; overflow:hidden;"><div style="height:100%; width:{{ bProgPct }}; border-radius:99px; background:linear-gradient(90deg,#a3907c,#d23f34);"></div></div>
  <!-- si hay siguiente: -->
  <div style="margin-top:9px; font-size:12.5px;"><span style="color:#9c958a;">Sigue:</span> <b>{{ bSigue }}</b></div>
</div>
```
- `bProgLabel = hechas.length + " de " + agenda.length + " atenciones"` (ej. "2 de 6 atenciones").
- `bProgPct = round(hechas/total*100)+"%"`.
- `bSigue = <primer activo no en curso>.cliente + " · " + hora` (ej. "Santiago Meza · 11:30 am").

### c) Botonera Walk-in / Venta rápida (visible con el form cerrado)
```html
<div style="display:flex; gap:8px; margin-bottom:14px;">
  <button style="flex:1; border:none; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; border-radius:999px; padding:12px; font-size:13px; font-weight:700;">+ Walk-in</button>
  <button style="flex:1; background:rgba(210,63,52,.06); border:1px solid rgba(210,63,52,.5); color:#e8675c; border-radius:999px; padding:12px; font-size:13px; font-weight:700;">Venta rápida</button>
</div>
```
- "Venta rápida" abre la hoja de cobro con `cobroFor:"venta"` (sin cita: título "Venta rápida",
  subtítulo "Mostrador · sin cita", sección extras titulada "Servicios sueltos", sin servicio fijo).

### d) Formulario walk-in ("Cliente sin reserva")
```html
<div style="border:1px solid rgba(242,237,228,.1); background:#151311; border-radius:16px; padding:14px; margin-bottom:14px; display:flex; flex-direction:column; gap:10px;">
  <div style="font-family:'Barlow Condensed'; font-size:18px; font-weight:700; text-transform:uppercase;">Cliente sin reserva</div>
  <div style="display:grid; grid-template-columns:1fr 1fr; gap:7px;">   <!-- desktop: repeat(auto-fit, minmax(230px,1fr)) -->
    <button ...>Cliente genérico</button>
    <button ...>Con nombre</button>   <!-- toggle wModo: selección estilo chip rojo -->
  </div>
  <!-- modo "Con nombre" (default): -->
  <input placeholder="Nombre del cliente" style="border-radius:12px; border:1px solid rgba(242,237,228,.14); background:#0c0b0a; color:#f2ede4; padding:12px 14px; font-size:14px;">
  <input placeholder="Correo (opcional)" inputMode="email" ...igual...>
  <div style="font-size:11.5px; color:#9c958a; line-height:1.45;">Si el correo no está registrado, se le envía la <span style="color:#e8675c; font-weight:600;">invitación por email</span> para crear su cuenta y empezar a sumar puntos.</div>
  <!-- chips servicio: "Corte" / "Corte y barba" / "Cejas" (pill selección roja) -->
  <div style="display:flex; gap:8px;">
    <button style="flex:1; background:#d23f34; color:#fbf7f0; border-radius:999px; padding:12px; font-size:13px; font-weight:700; text-transform:uppercase;">Agregar a la agenda</button>
    <button style="background:none; border:1px solid rgba(242,237,228,.16); color:#9c958a; border-radius:999px; padding:12px 16px; font-size:13px;">Cancelar</button>
  </div>
</div>
```
Lógica `walkinAdd()`: crea cita `{ hora:"ahora", cliente: <nombre|"Cliente genérico"|"Walk-in">, canal:"walkin", servicioId: map[Corte|Corte y barba|Cejas → corte|corte-barba|corte-cejas], estado:"en_curso" }`.
Si puso correo → banner verde: **"Invitación enviada a {correo} · cuando cree su cuenta, esta visita le suma puntos."**

### e) Banner "Se liberó un turno" (verde)
```html
<div style="margin-bottom:12px; border-radius:14px; border:1px solid rgba(52,211,153,.35); background:rgba(52,211,153,.07); padding:12px 14px;">
  <div style="font-size:13px; font-weight:700; color:#34d399;">Se liberó un turno</div>
  <div style="font-size:12px; color:#9c958a; margin-top:2px;">{{ turnoLibreDetalle }} · La fila y los clientes de la app ya fueron notificados.</div>
</div>
```
- Desde no-show: `turnoLibre = hora + " quedó libre (" + cliente + " no llegó)"`.
- Desde cancelación del cliente: `turnoLibre = fecha + " · " + servicio + " · " + barbero`.

### f) Tarjeta HERO del cliente en foco (la primera cita activa)
La agenda se ordena: activos primero, `en_curso` al tope (`sort((a,b)=>(b.enCurso?1:0)-(a.enCurso?1:0))`).
`agendaHero = activos.slice(0,1)`, `agendaResto = activos.slice(1)`.

```html
<div style="position:relative; border-radius:22px; border:1px solid {heroBorder}; background:{heroBg}; padding:18px 16px 16px; overflow:hidden; box-shadow:0 24px 50px -30px rgba(0,0,0,.8);">
  <span style="position:absolute; left:0; top:0; bottom:0; width:4px; background:{heroBar};"></span>  <!-- barra lateral -->
  <!-- fila 1: chip estado + hora -->
  <span style="display:inline-flex; align-items:center; gap:7px; border-radius:999px; padding:5px 12px; font-size:10.5px; font-weight:800; text-transform:uppercase; letter-spacing:.1em; background:{chipBg}; color:{chipColor};"><span style="width:6px; height:6px; border-radius:99px; background:{chipColor};"></span>{heroEstado}</span>
  <span><span style="font-family:'Barlow Condensed'; font-size:30px; font-weight:800; line-height:1; font-variant-numeric:tabular-nums;">{hora}</span><span style="font-size:11px; color:#9c958a;">· {durMin} min</span></span>
  <!-- fila 2: avatar 66px + nombre -->
  <span style="width:66px; height:66px; border-radius:999px; overflow:hidden; border:2px solid {heroRing}; background:{aviBg};">
    <!-- con foto: background-image cover; sin foto: iniciales Barlow 26px weight 800 color #0c0b0a -->
  </span>
  <div style="font-family:'Barlow Condensed'; font-size:27px; font-weight:800; text-transform:uppercase; line-height:1;">{cliente}</div>
  <div style="font-size:13.5px; color:#cfc7ba; margin-top:4px;">{servicio}</div>
  <!-- chip bebida opcional: -->
  <div style="border-radius:999px; border:1px solid rgba(210,63,52,.35); background:rgba(210,63,52,.08); color:#e8675c; padding:3px 10px; font-size:10.5px; font-weight:700;">{bebidaLabel}</div>
  <!-- fila 3 (separada con border-top rgba(242,237,228,.1)): canal + precio -->
  <span style="font-size:11.5px; color:#9c958a;">{canalLabel}</span>
  <span style="font-family:'Barlow Condensed'; font-size:24px; font-weight:800; font-variant-numeric:tabular-nums;">{precio}</span>
  <!-- acciones -->
</div>
```
**Estados/colores del hero** (del script, literal):
- `en_curso` (verde, "en silla"):
  - `heroEstado: "En la silla ahora"`
  - `heroBorder: "rgba(52,211,153,.5)"`
  - `heroBg: "linear-gradient(160deg, rgba(52,211,153,.16), #12201a 55%, #12100e 100%)"`
  - `heroBar: "#34d399"`, `heroRing: "rgba(52,211,153,.7)"`
- resto (rojo, "próximo"):
  - `heroEstado: <label del estado>` ("Confirmada", "Pendiente"…)
  - `heroBorder: "rgba(210,63,52,.4)"`
  - `heroBg: "linear-gradient(160deg, rgba(210,63,52,.14), #1c1210 55%, #12100e 100%)"`
  - `heroBar: "#d23f34"`, `heroRing: "rgba(210,63,52,.6)"`

**Chips de estado** (mapa `estados`, usado en hero, lista "Después" y "Terminadas"):
```js
pendiente:  { label: "Pendiente",  bg: "rgba(242,237,228,.08)", color: "#9c958a" }
confirmada: { label: "Confirmada", bg: "rgba(210,63,52,.15)",   color: "#e8675c" }
en_curso:   { label: "En curso",   bg: "rgba(52,211,153,.9)",   color: "#06281c" }
completada: { label: "Completada", bg: "rgba(52,211,153,.14)",  color: "#34d399" }
no_show:    { label: "No llegó",   bg: "rgba(251,191,36,.12)",  color: "#fbbf24" }
cancelada:  { label: "Cancelada",  bg: "rgba(242,237,228,.06)", color: "#9c958a" }
```

**canalLabel** (copy literal):
- walk-in → `"Sin reserva · en la barbería"`
- app + pendiente → `"Reservó por la app · aún no confirma el correo"`
- app → `"Reservó por la app"`

**bebidaLabel**: `"Pidió: " + nombreBebida + (bebidaGratis ? " · incluida" : "")`.

**Avatar del cliente** (comentario del prototipo: "foto de la cuenta Google si existe; si no,
iniciales sobre un tono cálido derivado del nombre"):
```js
fotosCliente = { "Camilo Ruiz": "public/cortes/corte-3.jpg", "Andrés Pertuz": "public/cortes/corte-2.jpg" };
aviTonos = ["#a3907c", "#e8675c", "#c9b18a", "#8f7a60", "#d9a066"];
aviTono(nombre) = aviTonos[nombre.length % 5];
iniciales(nombre) = primeras letras de cada palabra, máx 2, uppercase;
```

**Acciones del hero** (solo si no está done):
- Si NO está en curso (`showLlego`):
  ```html
  <button style="width:100%; margin-top:14px; min-height:58px; border-radius:15px; border:none; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; font-size:16px; font-weight:800; box-shadow:0 12px 26px -10px rgba(210,63,52,.6);">✓ Llegó · pasá a la silla</button>
  ```
  → pasa la cita a `en_curso`.
  - Si además es `pendiente`, botón secundario:
    `El cliente confirmó (llamada o WhatsApp)` (min-height:44px; border LINE; ghost) → pasa a `confirmada`.
  - Siempre: botón fantasma `No llegó · avisar a la fila` (min-height:40px; sin borde; color #9c958a)
    → estado `no_show`, marca a TODA la espera como "notificado" y setea el banner "Se liberó un turno".
- Si está en curso (`showCobrar`):
  ```html
  <button style="...idéntico al Llegó...; white-space:nowrap;">Cobrar {precio} →</button>
  ```
  → abre la hoja de cobro (resetea extras/propina/cupón; si la cita traía bebida NO gratis, la pre-carga en consumos qty 1).

### g) Estado vacío del hero ("Silla libre")
```html
<div style="border:1px dashed rgba(242,237,228,.16); border-radius:18px; padding:34px 20px; text-align:center;">
  <div style="font-family:'Barlow Condensed'; font-size:22px; font-weight:800; text-transform:uppercase;">Silla libre</div>
  <div style="font-size:13px; color:#9c958a; margin-top:6px;">No tenés a nadie en la silla ahora. Sumá un walk-in o esperá la próxima cita.</div>
</div>
```

### h) Sección "Después" (resto de la agenda)
Separador: label `Después` (11px, 700, uppercase, letter-spacing .14em, #9c958a) + línea `rgba(242,237,228,.08)`.
Fila compacta:
```html
<div style="display:flex; align-items:center; gap:12px; border-radius:14px; border:1px solid rgba(242,237,228,.09); background:#151311; padding:11px 13px;">
  <span style="font-family:'Barlow Condensed'; font-size:18px; font-weight:800; color:#e8675c; width:52px;">{hora}</span>
  <span style="width:38px; height:38px; border-radius:999px; ...avatar (iniciales 14px)..."></span>
  <div style="flex:1;">{cliente 14px w700 ellipsis} / {servicio 11.5px #9c958a ellipsis}</div>
  <span style="border-radius:999px; padding:3px 9px; font-size:9px; font-weight:800; uppercase; background:{chipBg}; color:{chipColor};">{estadoLabel}</span>
</div>
```

### i) "Terminadas hoy" (colapsable)
```html
<button style="width:100%; margin-top:12px; min-height:46px; border-radius:13px; border:1px solid rgba(242,237,228,.12); background:none; color:#9c958a; font-size:13px; font-weight:700;">Terminadas hoy ({{ hechasN }}) {{ hechasCaret }}</button>
```
`hechasCaret`: `▲` abierto / `▼` cerrado. Filas a `opacity:.75` con hora (#9c958a), cliente, chip estado y precio.

### j) Datos demo de agenda (contexto)
```js
agenda: [
  { hora:"9:00 am",  cliente:"Andrés Pertuz", canal:"app",    servicioId:"corte-barba",       estado:"completada" },
  { hora:"10:00 am", cliente:"Walk-in",       canal:"walkin", servicioId:"corte",             estado:"completada" },
  { hora:"10:30 am", cliente:"Camilo Ruiz",   canal:"app",    servicioId:"combo-silver",      estado:"en_curso", bebida:"gaseosa", bebidaGratis:true },
  { hora:"11:30 am", cliente:"Santiago Meza", canal:"app",    servicioId:"corte",             estado:"confirmada" },
  { hora:"12:00 pm", cliente:"Iván Osorio",   canal:"app",    servicioId:"ritual-barba",      estado:"pendiente" },
  { hora:"2:30 pm",  cliente:"Jorge Llanos",  canal:"app",    servicioId:"corte-barba-cejas", estado:"pendiente" },
]
```

## 1.4 Hoja de cobro (bottom sheet)

Overlay + sheet:
```html
<div style="position:absolute; inset:0; z-index:20; background:rgba(5,4,3,.6); backdrop-filter:blur(2px); display:flex; flex-direction:column; justify-content:flex-end;">
  <div style="background:#0c0b0a; border-top:1px solid rgba(242,237,228,.14); border-radius:22px 22px 0 0; max-height:86%; display:flex; flex-direction:column;">
```
Header: título `{{ cobroTitulo }}` (Barlow 21px 800 uppercase) = **"Cerrar y cobrar"** (o **"Venta rápida"**),
subtítulo `{{ cobroCliente }}` = `"{cliente} · {hora}"` (o "Mostrador · sin cita"),
botón cerrar `✕` (32×32, redondo, border LINE, color #9c958a).

Cuerpo scrolleable `padding:14px 18px; gap:16px`, secciones en orden:

### a) Servicio base
```html
<div style="border:1px solid rgba(242,237,228,.1); background:#211d19; border-radius:12px; padding:12px 14px;">
  <span style="font-size:13.5px; font-weight:700;">{{ cobroServicio }}</span>
  <span style="font-weight:800; tabular-nums;">{{ cobroServicioPrecio }}</span>
  <!-- si la cita traía bebida (sub-fila con border-top): -->
  <span style="font-size:12px; color:#e8675c; font-weight:600;">Pidió: {bebida}</span>
  <span style="font-size:11.5px; color:#34d399; font-weight:700;">{{ cobroBebidaPrecio }}</span>  <!-- "Incluida · sin cargo" | "va en consumos" -->
</div>
```
Nota: el precio del servicio en el cobro usa `pv` (precio Parque Venezuela) — el prototipo cobra con el precio de la sede del barbero.

### b) Fidelidad — canje automático de la tarjeta de cortes
Banner verde (solo si el corte que se cobra ES el 5 o ≥10):
```html
<div style="border:1px solid rgba(52,211,153,.4); background:rgba(52,211,153,.08); border-radius:12px; padding:11px 14px; font-size:12.5px; color:#34d399; font-weight:600; line-height:1.45;">{{ cobroFidLabel }}</div>
```
Copy literal (generado):
- corte 10+: `"Tarjeta de cortes: ¡este es su corte {n} → GRATIS! (−{monto}). Se aplica solo."`
- corte 5:   `"Tarjeta de cortes: corte {n} → 50% de descuento (−{monto}). Se aplica solo."`
Si no toca premio pero el cliente tiene tarjeta, línea informativa gris (11.5px #9c958a):
`"Tarjeta de cortes: con este va {n} de 10."`

Lógica exacta:
```js
clientesCortes = { "Camilo Ruiz": 4, "Andrés Pertuz": 2, "Santiago Meza": 9, "Iván Osorio": 6, "Jorge Llanos": 1 }; // cortes previos
fidEste = cortesPrevios + 1;                    // este cobro es el corte N
fidTipo = fidEste >= 10 ? "gratis" : fidEste === 5 ? "desc" : null;   // metas: fidMeta5=5, fidMeta10=10, fidDesc=50
fidMonto = gratis ? base : desc ? Math.round(base * 50 / 100) : 0;    // SOLO sobre el servicio base, no extras/consumos
```
(Los walk-ins genéricos no tienen tarjeta → sin banner.)

### c) Extras — "¿Se sumó algo en la silla?" (en venta rápida: "Servicios sueltos")
Chips toggle (multi-select), pill 40px min-height:
```js
extrasDef = [
  { nombre: "Cejas",           precio: 5000 },
  { nombre: "Cerquillo",       precio: 15000 },
  { nombre: "Perf. barba",     precio: 25000 },
  { nombre: "Limpieza silver", precio: 20000 },
  { nombre: "Mascarilla",      precio: 10000 },
];
```
Render: `{nombre} +{precio}` (precio en `#e8675c` si activo, `#9c958a` si no; borde/fondo rojo al activarse).

### d) Consumos · stock real
Título de sección literal: **"Consumos · stock real"**. Dos acordeones ("Bebidas", "Productos"):
- Cabecera del acordeón: nombre (Barlow 16px 800 uppercase) + contador de ítems (10.5px #e8675c) +
  badge qty si hay carrito (`rgba(210,63,52,.18)` / #e8675c) + flecha `▾/▸`. Borde rojo `rgba(210,63,52,.45)` al abrir.
  Fondo cabecera `linear-gradient(90deg, #211d19, #151311)`.
- Ítem: nombre (13px 600) + `"{precio} · quedan {n}"`; si quedan ≤3 agrega `" · poco stock"` y el texto va `#fbbf24`.
- Stepper − / qty / + (36×36 por botón, pill border LINE, fondo #211d19); − deshabilitado visualmente a `rgba(242,237,228,.2)` con qty 0; el + se frena en el stock.
```js
prodsDef = [
  { nombre:"Gaseosa", cat:"bebidas", precio:5000, stock:40 }, { nombre:"Agua", cat:"bebidas", precio:3000, stock:24 },
  { nombre:"Energizante", cat:"bebidas", precio:8000, stock:16 }, { nombre:"Cerveza", cat:"bebidas", precio:7000, stock:12 },
  { nombre:"Cera mate fijación fuerte", cat:"productos", precio:28000, stock:14 },
  { nombre:"Aceite para barba", cat:"productos", precio:32000, stock:9 },
  { nombre:"Shampoo anticaspa", cat:"productos", precio:25000, stock:3 },
];
```

### e) Propina
Chips: `[0, 2000, 5000, 10000]` → labels `"Sin propina"`, `"$2.000"`, `"$5.000"`, `"$10.000"` + botón `"Otra…"`
que abre input numérico pill (width 110px, border `rgba(210,63,52,.6)`, placeholder "Monto", autoFocus).
**La propina NO entra al total del cobro** — se muestra aparte ("en la mano").

### f) Cupón
- Input `placeholder="Código (ej: BIENVENIDO10)"` (uppercase forzado) + botón **"Aplicar"**
  (border `rgba(210,63,52,.5)`, bg `rgba(210,63,52,.08)`, color #e8675c).
- Error (11.5px #e8675c): `"Cupón inválido o inactivo."` / `"Escribí el código."`
- Aplicado → caja verde con `"{CODIGO} · −{monto}"` + botón `✕ Quitar`.
- Cupones demo (los gestiona el admin): `BIENVENIDO10` (10% activo), `COMBOPAPA` (−$5.000, inactivo).
- Cálculo: `pct → round(subtotal*valor/100)`, `monto → min(valor, subtotal)`; se aplica DESPUÉS de fidelidad:
  `cupSub = base − fidMonto + extras + consumos; total = max(0, cupSub − cupMonto)`.

### g) ¿Cómo pagó? (medios de pago)
Título literal: **"¿Cómo pagó?"**. Grid `repeat(4,1fr)`, botones 56px min-height, verticales
(logo arriba en placa clara `background:#f2ede4; border-radius:7px; height:24px`, label 11.5px abajo).
Selección = borde/fondo rojo estándar. Default: Efectivo.
```js
mediosDef = [
  { id:"efectivo",  nombre:"Efectivo",  logo:"public/brand/pagos/efectivo.svg" },
  { id:"nequi",     nombre:"Nequi",     logo:"public/brand/pagos/nequi.svg" },
  { id:"daviplata", nombre:"Daviplata", logo:"public/brand/pagos/daviplata.png" },
  { id:"tarjeta",   nombre:"Tarjeta",   logo:"public/brand/pagos/datafono.svg" },
];
```

### h) Footer fijo del sheet (total + CTA)
```html
<div style="border-top:1px solid rgba(242,237,228,.1); background:rgba(12,11,10,.97); padding:12px 18px 26px;">
  <div style="font-size:11px; color:#9c958a;">Total a cobrar · {{ cobroMedioNombre }}</div>
  <div style="font-family:'Barlow Condensed'; font-size:27px; font-weight:800; tabular-nums; line-height:1.1;">{{ cobroTotal }}</div>
  <!-- si hay propina: -->
  <div style="font-size:11.5px; color:#34d399;">+ {{ cobroPropinaFmt }} de propina · en la mano {{ cobroEnMano }}</div>
  <button style="min-height:52px; background:#d23f34; color:#fbf7f0; border-radius:14px; padding:0 22px; font-size:15px; font-weight:800; opacity:{{ cobrarOpacity }};">Cobrar {{ cobroTotal }}</button>
</div>
```
- Habilitado si `total > 0 || fidTipo || cupón aplicado` (si no, `opacity:.45` y no-op).
- `cobroEnMano = total + propina`.

### i) Pantalla "¡Cobrado!" (dentro del mismo sheet)
```html
<div style="padding:26px 22px 34px; text-align:center;">
  <div style="font-family:'Barlow Condensed'; font-size:34px; font-weight:800; text-transform:uppercase; color:#e8675c;">¡Cobrado!</div>
  <div style="margin-top:8px; font-size:14px;">Total cobrado: <b>{{ cobradoTotal }}</b></div>
  <!-- si hubo propina: -->
  <div style="font-size:12.5px; color:#9c958a;">+ {{ cobradoPropina }} de propina · en la mano <b style="color:#f2ede4;">{{ cobradoEnMano }}</b></div>
  <div style="font-size:12.5px; color:#34d399;">+{{ cobradoPuntos }} puntos de fidelidad para el cliente</div>
  <div style="margin-top:14px; border-top:1px solid rgba(242,237,228,.1); padding-top:13px; text-align:left;">
    <div style="font-size:13px; font-weight:700;">Reseñas</div>
    <div style="font-size:12px; color:#9c958a; line-height:1.45;">Al cobrar, al cliente le llega solo el correo de seguimiento con este mismo enlace para dejar la reseña en Google. Si está acá, mostrale el QR de Google:</div>
    <a href="<LINK GOOGLE — ver §3.5>" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:7px; margin-top:10px; min-height:44px; border-radius:12px; border:1px solid rgba(242,237,228,.16); color:#f2ede4; font-size:13px; font-weight:600;">★ Abrir reseña de Google</a>
  </div>
  <button style="margin-top:18px; background:#d23f34; color:#fbf7f0; border-radius:999px; padding:13px 34px; font-size:13px; font-weight:800; text-transform:uppercase;">Listo</button>
</div>
```
- `cobradoPuntos = Math.round(total / 1000)` → **1 punto por cada $1.000 cobrados**.
- Al cobrar: cita → `completada`, `cobradoExtra += total` (alimenta "cobrado hoy" y la caja).

## 1.5 Tab ESPERA (lista de espera)

```html
<div style="font-family:'Barlow Condensed'; font-size:24px; font-weight:800; text-transform:uppercase;">Lista de espera</div>
<p style="margin:4px 0 14px; font-size:12.5px; color:#9c958a;">Si alguien no llega o cancela, avisás al siguiente.</p>
```
Estado vacío (card #151311, centrada):
- Título: **"Nadie en espera"** (Barlow 19px 700 uppercase)
- Texto: **"Los walk-ins con el barbero ocupado caen acá solos."**

Item de espera (card #151311, radius 14, padding 12px 14px):
```html
<span style="font-family:'Barlow Condensed'; font-size:24px; font-weight:800; color:#e8675c;">{pos}</span>  <!-- posición 1,2,… -->
<span style="font-size:14px; font-weight:700;">{cliente}</span>
<!-- badge si fue avisado: -->
<span style="border-radius:999px; padding:2px 8px; font-size:9.5px; font-weight:700; uppercase; background:rgba(210,63,52,.15); color:#e8675c;">Avisado</span>
<div style="font-size:12px; color:#9c958a;">{detalle}</div>  <!-- "Meyer · Corte · hace 12 min" -->
<!-- acciones: -->
<button style="flex:1; min-height:42px; border-radius:11px; border:1px solid rgba(242,237,228,.16); background:none; color:#f2ede4; font-size:13px; font-weight:600;">Avisar</button>  <!-- solo si NO avisado -->
<button style="flex:1.3; min-height:42px; border:none; border-radius:11px; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; font-size:13px; font-weight:700;">Atender ahora</button>
<button style="min-height:42px; padding:0 12px; border-radius:11px; border:1px solid rgba(242,237,228,.12); background:none; color:#9c958a; font-size:12px;">Quitar</button>
```
- "Atender ahora" → lo saca de espera y crea cita `{ hora:"ahora", canal:"walkin", servicioId:"corte", estado:"en_curso" }`.
- Datos demo: Luis Mercado (Corte, hace 12 min), Rafa Domínguez (Corte y barba, hace 4 min).
- El no-show de agenda marca `estado:"notificado"` a todos los de la fila (aparece el badge "Avisado").

## 1.6 Tab CAJA (caja de la sede)

```html
<div style="font-family:'Barlow Condensed'; font-size:24px; font-weight:800; text-transform:uppercase;">Caja · Parque Venezuela</div>
<p style="margin:4px 0 14px; font-size:12.5px; color:#9c958a;">La caja es de la sede: suma lo de los 3 barberos. Se abrió sola con la primera venta.</p>
```

### Desglose "Por barbero"
Label sección: `Por barbero` (11px 700 uppercase ls .14em #9c958a). Card lista (#151311, radius 16):
```html
<div style="display:flex; align-items:center; gap:10px; padding:11px 14px; border-bottom:1px solid rgba(242,237,228,.07);">
  <span style="width:30px; height:30px; border-radius:999px; border:1px solid rgba(242,237,228,.14); background:cover center top #211d19; background-image:{foto};"></span>
  <span style="flex:1; font-size:13.5px; font-weight:700;">{nombre}</span>
  <!-- si es el barbero logueado: -->
  <span style="border-radius:999px; background:rgba(210,63,52,.15); color:#e8675c; padding:2px 8px; font-size:9.5px; font-weight:700; uppercase;">vos</span>
  <span style="font-weight:800; tabular-nums; font-size:13.5px;">{total}</span>
</div>
```
Datos demo: Meyer (= ventasHoy, `esMi:true`), Jhon $128.000, Junior $107.000. Si un barbero fue
marcado ausente en admin: total `"$ 0 · no vino"`.

### Filas del cuadre (card lista igual, filas `justify-content:space-between; padding:13px 16px; font-size:13.5px`)
```js
cajaFilas = [
  { k: "Ventas de la sede",             v: cop(cajaSedeN),                 color: "#f2ede4" },
  { k: "Efectivo esperado",             v: cop(round(cajaSedeN * 0.6)),    color: "#f2ede4" },
  { k: "Digital (Nequi + Daviplata)",   v: cop(round(cajaSedeN * 0.4)),    color: "#f2ede4" },
  { k: "Propinas (sede)",               v: cop(12000),                     color: "#34d399" },
  { k: "Mi comisión (50% de mis ventas)", v: cop(round(ventasHoyN / 2)),   color: "#34d399" },
];
```
(Los porcentajes 60/40 efectivo/digital son datos demo, no regla; **la comisión 50% sí es regla**.)

### Cierre
```html
<button style="width:100%; margin-top:14px; border:none; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; border-radius:14px; padding:15px; font-family:'Barlow Condensed'; font-size:16px; font-weight:700; text-transform:uppercase; letter-spacing:.05em;">Cerrar caja de la sede</button>
<p style="margin:8px 0 0; font-size:11.5px; color:#9c958a; text-align:center;">Un solo cierre por sede y día — lo confirma cualquier barbero con su PIN y el cuadre le llega al admin.</p>
```
Cerrada → banner verde: **"Caja cerrada. El cuadre quedó en el panel del admin."**

---

# 2. PORTAL DEL CLIENTE (/cuenta)

## 2.1 Header
```html
<div style="display:flex; align-items:center; justify-content:space-between; padding:10px 18px; border-bottom:1px solid rgba(242,237,228,.1);">
  <img src="public/brand/logo-lockup.png" style="height:59px; width:175px">
  <button style="border:none; color:#FFFFFF; font-size:12px; width:68px; height:26px; background-color:#D70202EB; text-align:center; border-radius:100px;">Salir</button>
</div>
```
(El botón "Salir" tiene estilos editados a mano en el prototipo — rojo `#D70202EB` pill 68×26.)

## 2.2 Saludo
```html
<span style="width:46px; height:46px; border-radius:999px; border:2px solid rgba(210,63,52,.5); background:cover center url('public/cortes/corte-3.jpg');"></span>
<p style="font-family:'Barlow Condensed'; font-size:11px; font-weight:700; uppercase; letter-spacing:.3em; color:#e8675c;">Mi cuenta</p>
<h1 style="font-family:'Barlow Condensed'; font-size:28px; font-weight:800; uppercase; line-height:1;">Hola, Camilo</h1>
```
Contenido scrolleable: `padding:18px 16px 40px`.

## 2.3 Banner "¡Es tu turno!" (turno llamado, con anillo pulsante)
```html
<div style="margin-bottom:16px; border-radius:18px; border:1px solid rgba(210,63,52,.45); background:linear-gradient(165deg, rgba(210,63,52,.14), rgba(210,63,52,.04) 60%, #151311); padding:18px;">
  <span style="position:relative; width:62px; height:62px;">
    <span style="position:absolute; inset:-4px; border-radius:999px; border:2px solid rgba(210,63,52,.7); animation:bbping 1.6s cubic-bezier(0,0,.2,1) infinite;"></span>
    <img src="public/barberos/generico.jpg" alt="Meyer" style="position:absolute; inset:0; width:100%; height:100%; border-radius:999px; object-fit:cover; border:2px solid #d23f34;">
  </span>
  <h2 style="font-family:'Barlow Condensed'; font-size:30px; font-weight:800; uppercase; line-height:.95;">¡Es tu <span style="color:#e8675c;">turno</span>!</h2>
  <p style="font-size:13px; color:#c9c2b6;">Meyer te está esperando en la silla.</p>
  <!-- chips: -->
  <span style="border-radius:999px; background:rgba(210,63,52,.18); color:#e8675c; padding:6px 12px; font-family:'Barlow Condensed'; font-size:12px; font-weight:700; uppercase; letter-spacing:.05em;">Corte y barba</span>
  <span style="border-radius:999px; border:1px solid rgba(242,237,228,.16); color:#c9c2b6; ...igual...">Parque Venezuela</span>
  <button style="width:100%; margin-top:14px; border:none; min-height:50px; border-radius:13px; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; font-family:'Barlow Condensed'; font-size:16px; font-weight:800; uppercase; letter-spacing:.05em; box-shadow:0 12px 26px -10px rgba(210,63,52,.7);">Ya voy en camino</button>
</div>
```
- El anillo usa `bbping` (la 2.ª definición: scale 1→1.8, opacity .5→0, 1.6s infinito).
- El botón "Ya voy en camino" NO tiene handler en el prototipo (decorativo).
- Controlado por prop `turnoLlamado` (boolean, default true en demo).

## 2.4 Reseña / calificación "¿Cómo te fue?"
Pendiente (card #151311 radius 18):
```html
<div style="font-family:'Barlow Condensed'; font-size:19px; font-weight:800; uppercase;">¿Cómo te fue?</div>
<div style="font-size:12.5px; color:#9c958a;">Tu corte de hoy terminó · Corte y barba con Meyer</div>
<!-- 5 botones estrella: flex:1; min-height:50px; border-radius:12px; border:1px solid rgba(242,237,228,.14); background:#211d19; color:#9c958a; font-size:22px; contenido "★"; aria-label "{n} estrellas" -->
<div style="font-size:11px; color:#9c958a; margin-top:9px;">Tu calificación se publica sola en la app.</div>
```
Hecha (card verde `border rgba(52,211,153,.35)` / `bg rgba(52,211,153,.06)`):
```html
<div style="font-size:14px; font-weight:700; color:#34d399;">¡Gracias! Tu calificación de {{ ratingVal }}★ ya está publicada en la app.</div>
<a href="<LINK GOOGLE — ver §3.5>" target="_blank" style="display:flex; align-items:center; justify-content:center; gap:7px; margin-top:11px; min-height:46px; border-radius:12px; border:1px solid rgba(242,237,228,.16); color:#f2ede4; font-size:13px; font-weight:600;">★ Dejala también en Google</a>
```

## 2.5 Tarjeta de cortes (fidelidad, 10 casillas)
```html
<div style="margin-bottom:16px; border-radius:18px; border:1px solid rgba(242,237,228,.12); background:linear-gradient(155deg, #1c1714, #151311); padding:16px 18px; position:relative; overflow:hidden;">
  <!-- fila superior -->
  <img src="public/brand/logo-face-transparent.png" style="height:38px;">
  <div style="font-family:'Barlow Condensed'; font-size:17px; font-weight:800; uppercase; line-height:1;">Tarjeta de cortes</div>
  <div style="font-size:11.5px; color:#9c958a;">{{ fidResumen }}</div>   <!-- "Llevás 4 de 10 cortes" -->
  <button style="background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; border-radius:999px; padding:11px 18px; font-family:'Barlow Condensed'; font-size:13px; font-weight:700; uppercase; box-shadow:0 12px 26px -10px rgba(210,63,52,.7);">Reservar</button>
  <!-- grilla 10 casillas -->
  <div style="display:grid; grid-template-columns:repeat(5,1fr); gap:8px; margin-top:14px;">
    <div style="position:relative; aspect-ratio:1; border-radius:11px; border:1px solid {f.border}; background:{f.bg}; display:flex; align-items:center; justify-content:center;">
      <span style="font-family:'Barlow Condensed'; font-size:{f.numSize}; font-weight:800; color:{f.numColor}; line-height:1;">{f.label}</span>
      <!-- si la casilla está cumplida: sello animado -->
      <span style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; animation:bbstamp .45s cubic-bezier(.2,1.4,.4,1) {f.delay} both;">
        <span style="font-size:24px; color:#e8675c; font-weight:800; text-shadow:0 0 12px rgba(210,63,52,.7);">✕</span>
      </span>
    </div>
  </div>
  <div style="margin-top:11px; font-size:11.5px; color:{{ fidNotaColor }};">{{ fidNota }}</div>
</div>
```
Lógica exacta de casillas (`fidSlots`, 10 celdas — grid 5×2):
```js
label:    casilla 10 → "GRATIS" (10px) · casilla 5 → "50%" (13px, = fidDesc+"%") · resto → número (16px)
numColor: cumplida → rgba(242,237,228,.35) · especial (5/10) → #e8675c · normal → #f2ede4
border:   especial → rgba(210,63,52,.5) · normal → rgba(242,237,228,.12)
bg:       cumplida → rgba(210,63,52,.07) · pendiente → #211d19
delay del sello: index * 0.08s   (los ✕ caen en cascada)
```
Nota inferior (`fidNota`, copy literal generado):
- `cortes >= 10`: `"¡Tenés un corte GRATIS! Canjealo en tu próxima visita."` (color #34d399)
- `cortes >= 5`:  `"¡Ya ganaste el 50% off! Al corte 10 es gratis."` (color #34d399)
- si no:          `"Al corte 5 tenés 50% de descuento · al 10, corte gratis."` (color #9c958a)
`fidResumen = "Llevás {cortes} de 10 cortes"`.
Parámetros configurables desde admin en el prototipo: `fidMeta5=5, fidDesc=50, fidMeta10=10`.

## 2.6 Banners verdes (cancelación / reagendado)
Mismo estilo: `border-radius:14px; border:1px solid rgba(52,211,153,.35); background:rgba(52,211,153,.07); padding:13px 15px; font-size:13px; color:#34d399; font-weight:600;`
- `libreBanner`: `"Cita cancelada. El turno de {fecha} con {barbero} quedó libre y le avisamos a la fila."`
- `reagMsg`: `"Cita reagendada para {día} a las {hora} · te llegó la confirmación al correo."`

## 2.7 Próximas citas
Título: `Próximas citas` (Barlow 20px 800 uppercase). Card por cita (#151311, radius 16, padding 14):
```html
<div style="font-family:'Barlow Condensed'; font-size:17px; font-weight:700; uppercase;">{servicio}</div>
<div style="font-size:12.5px; color:#9c958a;">{fecha} · {barbero}</div>   <!-- "hoy, 4:30 pm · Meyer" -->
<span style="border-radius:999px; background:rgba(210,63,52,.15); color:#e8675c; padding:3px 10px; font-family:'Barlow Condensed'; font-size:10px; font-weight:700; uppercase; letter-spacing:.06em;">{estado}</span>  <!-- "Confirmada" / "Pendiente" / "Reagendada" -->
<!-- acciones -->
<button style="flex:1; min-height:44px; border-radius:11px; border:1px solid {reagBorder}; background:{reagBg}; color:#f2ede4; font-size:12.5px; font-weight:600;">Reagendar</button>
<button style="min-height:44px; padding:0 14px; border-radius:11px; border:1px solid rgba(242,237,228,.1); background:none; color:#9c958a; font-size:12px;">Cancelar</button>  <!-- solo si cancelable -->
```
**Regla de horas** (`cancelHoras = 2`, configurable 1–6 desde admin):
- `cancelable = c.horasAntes >= cancelHoras`. La cita demo de hoy 4:30 pm tiene `horasAntes: 1.7` → bloqueada.
- Si bloqueada, en vez del botón Cancelar aparece la nota (11.5px #9c958a), copy literal generado:
  **"Empieza pronto: solo se puede cancelar hasta 2 h antes. Si te surgió algo, escribinos por WhatsApp."**
  (En el prototipo la nota es texto, no link; el flujo WhatsApp real no está cableado acá.)
  ⚠️ Ojo: el botón **Reagendar sigue visible** aunque la cita esté bloqueada para cancelar (así está en el prototipo).

**Reagendar (inline, dentro de la card)** — al tocar Reagendar el botón toma borde/fondo rojo
(`rgba(210,63,52,.6)` / `rgba(210,63,52,.1)`) y se abre el panel:
```html
<div style="margin-top:11px; border-radius:12px; border:1px solid rgba(210,63,52,.35); background:rgba(210,63,52,.05); padding:12px;">
  <div style="font-size:12.5px; font-weight:700; margin-bottom:8px;">Elegí el nuevo horario</div>
  <!-- chips de día: "Hoy" / "Mañana" / "Lun 13" (pill, selección roja; default "Mañana") -->
  <!-- grid de horas: grid-template-columns:repeat(4,1fr); botones 40px min-height, radius 10, bg #211d19 -->
  <!-- horas demo: "9:00 am", "10:30 am", "3:00 pm", "4:30 pm" -->
  <div style="margin-top:8px; font-size:11px; color:#9c958a;">Tocá una hora y queda confirmada · te llega el correo con el cambio.</div>
</div>
```
Tocar una hora: cierra el panel, cambia `fecha` a `"{día}, {hora}"`, estado → `"Reagendada"`, y muestra `reagMsg`.

**Confirmación de cancelar (inline)**:
```html
<div style="margin-top:11px; border-radius:12px; border:1px solid rgba(210,63,52,.35); background:rgba(210,63,52,.06); padding:12px;">
  <div style="font-size:13px; font-weight:700;">¿Cancelar esta cita?</div>
  <div style="font-size:11.5px; color:#9c958a;">El turno se libera y le avisamos a quienes están en la fila.</div>
  <button style="flex:1; min-height:44px; border:none; border-radius:11px; background:#d23f34; color:#fbf7f0; font-size:13px; font-weight:800;">Sí, cancelar</button>
  <button style="flex:1; min-height:44px; border-radius:11px; border:1px solid rgba(242,237,228,.16); background:none; color:#f2ede4; font-size:13px; font-weight:600;">No, la dejo</button>
</div>
```
Confirmar: elimina la cita, muestra `libreBanner` en /cuenta y setea el banner "Se liberó un turno" en la app del barbero.

**Estado vacío**:
- Título: **"Todavía no tenés citas"** — texto: **"Reservá tu próximo corte y empezá a sumar puntos."**
- CTA: **"Reservar una cita"** (gradiente rojo pill).

Citas demo: `Corte y barba · hoy, 4:30 pm · Meyer · Confirmada (horasAntes 1.7)` y
`Ritual de barba · mié 15 jul, 6:00 pm · Jhon · Pendiente (horasAntes 100)`.

## 2.8 Historial
Título: `Historial` (Barlow 20px 800 uppercase). Card lista (#151311, radius 16, `padding:0 14px`):
```html
<div style="display:flex; align-items:center; justify-content:space-between; gap:10px; padding:12px 0; border-bottom:1px solid rgba(242,237,228,.06);">
  <span style="width:26px; height:26px; border-radius:999px; background:#211d19; color:#9c958a; font-size:12px;">✓</span>
  <div style="font-size:13px;">{servicio}</div>
  <div style="font-size:11px; color:#9c958a;">{fecha}</div>
  <span style="font-size:12.5px; color:#9c958a; tabular-nums;">{total}</span>
</div>
```
Demo: Corte y barba · vie 26 jun · $45.000 / Combo silver + bebida · sáb 13 jun · $55.000 / Corte · vie 29 may · $35.000.

---

# 3. Reglas de negocio visibles en el prototipo

## 3.1 Fidelidad (tarjeta de cortes)
- Meta 1: **corte 5 → 50% de descuento** sobre el servicio base (`fidDesc = 50`, casilla "50%").
- Meta 2: **corte 10 → corte GRATIS** (descuenta el 100% del servicio base, casilla "GRATIS").
- El canje es **automático en la hoja de cobro** ("Se aplica solo") — el barbero no toca nada.
- El descuento aplica SOLO al servicio base; extras y consumos se cobran completos.
- El cupón se calcula sobre el subtotal ya descontada la fidelidad.
- Puntos: **+1 punto por cada $1.000 cobrados** (`round(total/1000)`), mostrados en ¡Cobrado!
  y prometidos en el walk-in con correo. (Relación puntos ↔ casillas de la tarjeta: **no definida en el prototipo**;
  la tarjeta cuenta cortes, los puntos son un contador aparte.)
- Parámetros editables desde admin (Ajustes): meta 5 (2–9), % descuento (10–90 en pasos de 10), meta 10 (6–15).

## 3.2 Comisión
- **"Mi comisión (50% de mis ventas)"** en la caja del barbero: `round(misVentas / 2)`.
- Refuerzo en admin: comisiones por barbero = 50% de sus ventas, y perfil del barbero muestra "Comisión (50%)".

## 3.3 Caja
- La caja es **por sede** (no por barbero): "suma lo de los 3 barberos".
- "Se abrió sola con la primera venta" (apertura automática).
- **Un solo cierre por sede y día**, lo confirma **cualquier barbero con su PIN**, y el cuadre llega al admin.

## 3.4 Cancelación / reagendado (cliente)
- Ventana mínima: **2 horas** (`cancelHoras: 2`, configurable 1–6 en admin) — coincide con `CANCELACION_MIN_HORAS` del código real.
- Dentro de la ventana: no se puede cancelar desde la app; el copy deriva a WhatsApp.
- Cancelar libera el turno y **notifica a la lista de espera** automáticamente.
- Reagendar: elegir día + hora → confirmación instantánea + correo.

## 3.5 Links de reseña de Google (por sede, literales)
```js
resenaLinks = {
  "parque-venezuela": "https://www.google.com/maps/place/BARBAS+Y+BIGOTES+BARBERSHOP/@11.002038,-74.8940253,12854m/data=!3m1!1e3!4m10!1m2!2m1!1sBarbas+y+Bigotes+Barbershop+Parque+Venezuela+Barranquilla!3m6!1s0x8ef42d03f9340a79:0xa2172f4c13dd7df9!8m2!3d11.002038!4d-74.8239875!16s%2Fg%2F11y43yry_j",
  "plaza-de-la-paz": "https://www.google.com/maps/place/BARBAS+Y+BIGOTES+BARBERCLUB+FRENTE+A+LA+PLAZA+DE+LA+PAZ/@11.002038,-74.8940253,12854m/data=!3m1!1e3!4m10!1m2!2m1!1sBarbas+y+Bigotes+Barbershop+Parque+Venezuela+Barranquilla!3m6!1s0x8ef42d962530b5bd:0xe8dfd6b438a6a6f0!8m2!3d10.9873701!4d-74.7892852!16s%2Fg%2F11x32h1_qk",
}
```
⚠️ En el HTML, los `<a>` de "¡Cobrado!" y de "Dejala también en Google" tienen **hardcodeado el link de
Parque Venezuela** (el objeto `resenaLinks` existe en el script pero no está cableado a los anchors).
En la implementación real debe resolverse por sede.
- Reseñas in-app: la calificación 1–5★ del cliente "se publica sola en la app"; al cobrar "al cliente
  le llega solo el correo de seguimiento" con el link de Google (post-venta automática).

## 3.6 Otras reglas visibles
- Walk-in genérico vs con datos; con correo no registrado → invitación por email para crear cuenta y sumar puntos.
- No-show: libera el turno y notifica a la fila y a los clientes de la app.
- Estados de cita: pendiente → confirmada → en_curso → completada | no_show | cancelada.
  "Pendiente" = reservó por la app pero no confirmó el correo; el barbero puede confirmarla manualmente
  ("El cliente confirmó (llamada o WhatsApp)").
- Propina fuera del total (va "en la mano" del barbero); propinas se reportan por sede en caja.
- Precios por sede: `pv` (Parque Venezuela) / `pp` (Plaza de la Paz) por servicio.

---

# 4. Assets referenciados (existen en el handoff `public/`)

- Marca: `public/brand/logo-lockup.png` (header 47×139 barbero, 59×175 cuenta), `public/brand/logo-face-transparent.png` (tarjeta de cortes, 38px), `public/brand/logo-hero.png`, `public/brand/icon-192x192.png`, `public/brand/icon-512x512.png`, `src/app/apple-icon.png`, `public/manifest.json`.
- Pagos: `public/brand/pagos/efectivo.svg`, `nequi.svg`, `daviplata.png`, `datafono.svg` (sobre placa `#f2ede4`).
- Barberos: `public/barberos/generico.jpg` (Meyer), `jhon.jpg`, `junior.jpg`, `brayan.jpg`, `kevin.jpg`, `abel.jpg`.
- Avatares de cliente (demo): `public/cortes/corte-2.jpg` (Andrés Pertuz), `corte-3.jpg` (Camilo Ruiz y avatar de /cuenta).
- Sedes: `public/sedes/parque-venezuela-frente.jpg`, `plaza-de-la-paz-frente.jpg` (+ interiores).
- El "QR de Google" mencionado en ¡Cobrado!: **no hay asset QR en el prototipo** — solo el link (el QR habría que generarlo).

# 5. No encontrado en el prototipo (no inventar)
- Login del barbero por PIN dentro de esta app (la pantalla /entrar no está en el prototipo; el PIN solo se menciona en el copy del cierre de caja y en admin/equipo).
- Comportamiento del botón "Ya voy en camino" (sin handler).
- Push/notificaciones reales (solo copys "ya fueron notificados", "te llega el correo").
- Estado "Reagendada" con estilos propios (usa el mismo chip rojo del estado).
- Selector de sede en la app del barbero (está fijo "Meyer · Parque Venezuela").
- Paginación/fechas futuras en la agenda del barbero (solo "Hoy").
- Un QR real de reseña (solo el anchor al link de Google).
- Relación explícita entre "puntos" y casillas de la tarjeta.
