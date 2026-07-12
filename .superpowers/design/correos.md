# Spec de diseño — PLANTILLAS DE CORREO (5)

Extraído literalmente y completo del prototipo Claude Design `Correos Barbas y Bigotes.dc.html` (221 líneas). Todo el copy y CSS citado es textual. Los valores marcados `{{var}}` son los que en producción salen de n8n (`{{ $json.* }}` leyendo las vistas de Supabase); en el prototipo aparecen con datos de ejemplo (cliente "Camilo", barbero "Meyer", etc.).

Nota literal al pie del prototipo: *"Estos correos se disparan desde n8n (Gmail) leyendo las vistas de Supabase. Este preview usa datos de ejemplo; en producción cada dato viene de la reserva/caja real."*

---

## 0. Chrome del preview (no es parte del email, pero define asuntos y remitente)

- Página del prototipo: fondo `radial-gradient(120% 80% at 50% -10%, #1a1512 0%, #0a0908 55%, #060504 100%)`, `Inter`, color `#f2ede4`, contenedor `max-width:680px` centrado. Encabezado: kicker `Barbas & Bigotes` (`11px uppercase ls .4em #d23f34 700`), H1 `Plantillas de correo` (Barlow Condensed 40px 800 uppercase), sub: *"Los 5 correos automáticos, con la identidad de la barbería. Elegí uno para previsualizarlo tal como le llega al cliente o al dueño."*
- Tabs pill (labels): `Confirmación` · `Recordatorio` · `Cupo libre` · `Seguimiento` · `Cierre de caja`. Activa: `border rgba(210,63,52,.55); bg rgba(210,63,52,.14); color #f2ede4` / inactiva `rgba(242,237,228,.14)` + `#9c958a`.
- Fila estilo bandeja Gmail (`bg #151311; r 12px 12px 0 0; padding:12px 16px`): avatar 36px circular `#050403` con `public/brand/logo-face-transparent.png` 24px; remitente `Barbas & Bigotes <hola@barbasybigotes.com>` (13px 700, email en `#9c958a` 400); asunto 12.5px `#cfc7ba`; a la derecha etiqueta de destinatario 11px `#9c958a`.

**Asuntos y destinatario por plantilla (literales)**:
| id | Asunto | Para |
|---|---|---|
| confirmacion | `¡Tu reserva en Barbas & Bigotes está confirmada!` | Para el cliente |
| recordatorio | `Recordatorio de tu cita 🔔` | Para el cliente |
| cupo | `¡Se liberó un cupo! 🎉` | Lista de espera |
| resena | `¿Cómo te quedó? Dejanos tu reseña ✂️` | Para el cliente |
| caja | `Cierre de caja · Parque Venezuela · viernes 11 de julio` | Para el dueño |

---

## 1. Estructura compartida del email (las 5 plantillas)

Contenedor del email: `background:#0c0b0a; border:1px solid rgba(242,237,228,.1); border-top:none; border-radius:0 0 18px 18px; overflow:hidden;`. Tipografías vía Google Fonts: `Barlow Condensed` 600/700/800 + `Inter` 400–700. Links por defecto `a{color:#e8675c}` hover `#f0897f`.

1. **Franja barber-pole** (tope): `height:5px; background:repeating-linear-gradient(115deg, #d23f34 0 14px, #f2ede4 14px 28px, #12100e 28px 42px);`
2. **Cabecera de marca con foto del local** (compartida): `position:relative; padding:34px 24px 28px; text-align:center;`
   - Fondo: `<img src="public/sedes/parque-venezuela-interior.jpg" alt="Interior Barbas y Bigotes">` a `object-fit:cover; opacity:.28` + velo `linear-gradient(180deg, rgba(10,9,8,.65), rgba(10,9,8,.92))`.
   - Logo: `public/brand/logo-lockup.png` a `height:50px`.
   - Tagline: `Barbería clásica · Barranquilla` — `font-size:10px; uppercase; letter-spacing:.34em; color:#cfc7ba;`.
3. **Cuerpo de la plantilla** (`padding:34px 30px`; caja usa `padding:34px 30px` con títulos algo menores) — ver §2–§6.
4. **Footer de marca** (compartido): `border-top:1px solid rgba(242,237,228,.08); background:#0a0908; padding:26px 24px; text-align:center;`
   - `logo-face-transparent.png` 30px, `opacity:.8`.
   - Sedes: `Parque Venezuela` `·` `Plaza de la Paz` (11.5px `#9c958a`, separador `rgba(242,237,228,.2)`).
   - Legal (11px `rgba(156,149,138,.6)`): `Barbas & Bigotes Barbershop · Barranquilla, CO` `<br>` `Recibís este correo porque tenés una cuenta o una reserva con nosotros.`
   - Links (11px, `color:#9c958a; text-decoration:none`): `Instagram` → `https://instagram.com/barbasybigotes.baq` `·` `WhatsApp` → `https://wa.me/573006734799`.

**Componentes recurrentes**:
- *Badge de estado* (pill): `display:inline-flex; gap:7px; border-radius:999px; padding:6px 14px; font-size:11px; font-weight:800; uppercase; letter-spacing:.1em;` con variantes verde (`bg rgba(52,211,153,.12); border rgba(52,211,153,.3); color #34d399`), roja (`bg rgba(210,63,52,.12); border rgba(210,63,52,.35); color #e8675c`) y neutra (caja).
- *H2*: `font-family:'Barlow Condensed'; font-size:34px (32 en caja); font-weight:800; uppercase; line-height:.95;`.
- *Párrafo intro*: `max-width:42–44ch; font-size:14px; color:#9c958a; line-height:1.6;` centrado; los datos clave dentro van en `<b style="color:#f2ede4">`.
- *CTA primario*: `display:block; text-align:center; background:linear-gradient(180deg,#e8675c,#d23f34); color:#fbf7f0; border-radius:13px; padding:16–17px; font-family:'Barlow Condensed'; font-size:17–18px; font-weight:700; uppercase; letter-spacing:.05em; box-shadow:0 14px 30px -14px rgba(210,63,52,.7);`.
- *Botón secundario*: `border:1px solid rgba(242,237,228,.18); color:#f2ede4; border-radius:12px; padding:15px; font-size:13.5px; font-weight:700;` (o pill `999px; padding:11px 22px; 12.5px`).
- *Card de dato*: `border:1px solid rgba(242,237,228,.1); background:#151311; border-radius:14–16px; padding:14px 16px;` con label `10.5px uppercase ls .12em #9c958a` + valor `14px 700` + meta `11.5px #9c958a`.
- *Nota al pie del cuerpo*: `font-size:12px; color:#9c958a; text-align:center;`.

**Estilo**: todo CSS inline (apto email), sin media queries, tema oscuro fijo.

---

## 2. Plantilla CONFIRMACIÓN DE RESERVA

Estructura del cuerpo (`padding:34px 30px`):
1. Badge verde con dot (`span 6px` redondo `#34d399`): `Reserva confirmada`.
2. H2: `Nos vemos en la silla, {{nombreCliente}}` (demo: "Camilo").
3. Intro (44ch): `Tu turno quedó agendado. Guardá este correo o mirá los detalles en tu cuenta.`
4. **Card del barbero**: `display:flex; gap:16px; border:1px solid rgba(242,237,228,.1); background:linear-gradient(160deg, rgba(210,63,52,.1), #151311 55%); border-radius:16px; padding:18px 20px;`
   - Avatar 58px circular `border:2px solid rgba(210,63,52,.6); background:#211d19 url('public/barberos/generico.jpg') center/cover;` → **variable**: foto del barbero.
   - Label `Tu barbero` (11px uppercase ls .12em `#9c958a`); nombre `{{barbero}}` (demo "Meyer") Barlow 26px 800 uppercase; meta `{{ratingBarbero}}` (demo `★ 4.9 · degradados y barba`, 12.5px `#cfc7ba`).
5. **Grid de datos** `grid-template-columns:1fr 1fr; gap:10px;`:
   - Card `Servicio` → `{{servicio}}` (demo "Corte y barba") + `{{duracion}}` (demo "60 min").
   - Card `Sede` → `{{sede}}` (demo "Parque Venezuela") + `{{direccion}}` (demo "Calle 88 #44-10").
   - Card destacada full-width (`grid-column:1/-1; border:1px solid rgba(210,63,52,.3); background:rgba(210,63,52,.06); border-radius:14px; padding:16px 18px; display:flex; justify-content:space-between;`): label `Fecha y hora` (`10.5px uppercase #e8675c`) + `{{fechaHora}}` (demo `Vie 11 jul · 4:30 pm`, Barlow 24px 800) + emoji `✂️` 32px a la derecha.
6. CTA: `Ver, reagendar o cancelar` → `https://barbasybigotes.com/cuenta`.
7. Nota: `Podés cambiarla hasta 2 horas antes desde tu cuenta.` (la ventana de 2 h es regla de negocio — `CANCELACION_MIN_HORAS`).

**Variables n8n**: nombre del cliente, barbero (nombre, foto, rating/especialidad), servicio, duración, sede, dirección, fecha y hora.

---

## 3. Plantilla RECORDATORIO

1. Badge rojo: `🔔 Recordatorio`.
2. H2: `Te vemos mañana, {{nombreCliente}}`.
3. Intro (42ch): `Tu cita en Barbas & Bigotes es mañana. Te dejamos todo a mano.`
4. **Card hero de la hora**: `position:relative; border:1px solid rgba(210,63,52,.3); background:linear-gradient(160deg, rgba(210,63,52,.14), #12100e 60%); border-radius:18px; padding:26px 22px; text-align:center;` con **franja barber-pole vertical** al borde izquierdo: `width:5px; background:repeating-linear-gradient(180deg, #d23f34 0 10px, #f2ede4 10px 20px);`
   - Label `Mañana` (11px uppercase ls .16em `#9c958a`) → **variable** (día relativo).
   - Hora gigante: `{{hora}}` (demo `4:30 pm`) — Barlow **52px** 800, `line-height:1`.
   - Línea con avatar: avatar 30px circular (foto barbero) + `{{servicio}} · con {{barbero}}` (demo `Corte y barba · con Meyer`, 13.5px `#cfc7ba`, separada con `border-top` .1).
   - `{{sede}} · {{direccion}}` (demo `Parque Venezuela · Calle 88 #44-10`, 12px `#9c958a`).
5. **Fila de 2 botones** (`display:flex; gap:10px;`): `Confirmar asistencia` (CTA gradiente `flex:1; r12; padding:15px; 13.5px 700` — sin Barlow ni uppercase acá) y `Reagendar` (secundario `flex:1`). Ambos → `https://barbasybigotes.com/cuenta`.
6. Nota: `¿No podés venir? Cancelá a tiempo y le damos el cupo a alguien de la lista.`

**Variables n8n**: nombre, hora, servicio, barbero (+foto), sede, dirección, día relativo ("Mañana").

---

## 4. Plantilla CUPO LIBRE (lista de espera)

1. Badge verde: `🎉 Cupo disponible`.
2. H2: `¡Se abrió un espacio!`
3. Intro (44ch): `Hola {{nombreCliente}}, estabas en la lista de espera de **{{sede}}** y justo se liberó un turno. Es por orden de llegada — asegurá el tuyo.` (sede en `<b style="color:#f2ede4">`).
4. **Card punteada del turno**: `border:1px dashed rgba(52,211,153,.4); background:rgba(52,211,153,.05); border-radius:16px; padding:20px; text-align:center;`
   - `{{servicioYBarbero}}` (demo `Corte con Meyer`) — Barlow 22px 800 uppercase.
   - Sub: `El primero que reserve se queda con el cupo.` (12.5px `#9c958a`).
5. CTA: `Reservar mi turno ahora` → `https://barbasybigotes.com/reservar` (padding 17px, 18px).
6. Nota: `Si ya no lo necesitás, ignorá este correo — el cupo pasa al siguiente.`

**Variables n8n**: nombre, sede, servicio + barbero del turno liberado.

---

## 5. Plantilla SEGUIMIENTO / RESEÑA (post-visita)

1. Estrellas decorativas: `★★★★★` — `font-size:32px; letter-spacing:5px; color:#d23f34;`.
2. H2: `¿Cómo te quedó?`
3. Intro (44ch): `Gracias por venir, {{nombreCliente}}. Hoy **{{barbero}}** te hizo un **{{servicio}}**. Si te fuiste contento, contalo en Google — nos ayuda un montón.` (barbero y servicio en `<b>` claro).
4. CTA: `★ Dejar mi reseña en Google` → `https://www.google.com/maps/place/BARBAS+Y+BIGOTES+BARBERSHOP/` → **variable**: en producción el link de reseña depende de la sede (el prototipo principal define `resenaLinks` con URLs largas distintas por sede para PV y Plaza).
5. **Card "Tu tarjeta de cortes"** (`#151311 r16; padding:18px 20px`):
   - Fila: label `Tu tarjeta de cortes` (13px `#9c958a`) + contador `{{cortes}} / {{meta}}` (demo `3 / 10`) — Barlow 16px 800 `#e8675c`.
   - **Barra de progreso segmentada**: 10 segmentos `flex:1; height:8px; border-radius:99px;` con `gap:5px` — completados `background:#d23f34`, pendientes `rgba(242,237,228,.12)` (demo: 3 llenos, 7 vacíos). El número de segmentos = meta de fidelidad.
   - Nota: `Al llegar a 10, el corte va por la casa 💈` (12px `#9c958a`) → el `10` es variable (meta corte gratis).
   - Botón pill secundario: `Reservar mi próxima cita` → `https://barbasybigotes.com/reservar` (`display:inline-block; border:1px solid rgba(242,237,228,.18); r999; padding:11px 22px; 12.5px 700`).

**Variables n8n**: nombre, barbero, servicio, cortes acumulados, meta de la tarjeta, link de reseña por sede.

---

## 6. Plantilla CIERRE DE CAJA (para el dueño)

1. Badge neutro: `Aviso automático · solo mirás` — `bg rgba(242,237,228,.06); border rgba(242,237,228,.14); color #9c958a; 10.5px 700 uppercase ls .14em;` (refleja el principio de producto "dueño manos libres").
2. H2 (32px): `Cierre de caja`.
3. Sub (13.5px `#9c958a`): `{{sede}} · {{fecha}}` (demo `Parque Venezuela · viernes 11 de julio`).
4. **Card hero del total**: `border:1px solid rgba(52,211,153,.3); background:linear-gradient(160deg, rgba(52,211,153,.12), #12100e 60%); border-radius:18px; padding:22px; text-align:center;`
   - Label `Total del día` (11px uppercase ls .14em `#9c958a`).
   - `{{totalDia}}` (demo `$ 315.000`) — Barlow **46px** 800 **`color:#34d399`**.
   - Chip: `Cuadra exacto ✓` — `bg rgba(52,211,153,.14); color #34d399; r999; padding:4px 12px; 11px 800;` → **variable de estado** (el prototipo solo muestra el caso "cuadra"; el caso descuadre **no encontrado en el prototipo**).
5. **Grid 2 col** (`gap:10px`):
   - Card `Efectivo` → `{{efectivo}}` (demo `$ 189.000`, 16px 800 tabular) + nota `{{propinaEfectivo}}` (demo `+$12.000 propina`, 11px `#34d399`).
   - Card `Nequi + Daviplata` → `{{digital}}` (demo `$ 126.000`) + nota `digital` (11px `#9c958a`).
6. **Card tabla** (`r14`, filas `display:flex; justify-content:space-between; padding:12px 18px;` con divisores `.07`): 
   - `Efectivo contado` → `{{efectivoContado}}` (demo `$ 201.000`)
   - `Atenciones cobradas` → `{{atenciones}}` (demo `12`)
   - `Cerró` → `{{barberoCierre}}` (demo `Meyer`)
7. Sin CTA — es informativo puro (no hay botón en esta plantilla).

**Variables n8n**: sede, fecha, total del día, estado del cuadre, efectivo, propinas en efectivo, digital (Nequi+Daviplata), efectivo contado, atenciones cobradas, quién cerró.

---

## 7. Assets requeridos por los correos

- `public/brand/logo-lockup.png` (cabecera, 50px alto)
- `public/brand/logo-face-transparent.png` (avatar remitente 24px y footer 30px)
- `public/sedes/parque-venezuela-interior.jpg` (fondo cabecera, opacity .28) — **fijo en las 5 plantillas** (no cambia por sede en el prototipo)
- `public/barberos/generico.jpg` (avatar demo del barbero; en producción la foto del barbero real)

## 8. Observaciones para producción

- La dirección demo de PV en los correos es `Calle 88 #44-10` (sin ", Local 4"); el sitio usa `Calle 88 #44 - 10, Local 4, Barranquilla`. Unificar al implementarlo.
- Colores de marca de email idénticos a la app: acento `#d23f34`/`#e8675c`, tinta `#f2ede4`, mutado `#9c958a`, secundario `#cfc7ba`, verde `#34d399`, ámbar (no usado en correos), fondos `#0c0b0a`/`#151311`/`#0a0908`.
- Los correos usan grid/flex y `backdrop`-less CSS inline; si el cliente de correo destino (Gmail) recorta grid, degradar a tablas manteniendo estos valores.
- El prototipo renderiza los 5 cuerpos dentro del mismo shell (stripe + cabecera + footer); cada envío n8n arma stripe + cabecera + cuerpo de su plantilla + footer.
