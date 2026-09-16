# Tanda 2 del rediseño — admin y mostrador hacia el patrón WeiBook

**Fecha:** 15-sep-2026 · **Versión:** 2 (corregida tras la crítica) · **Alcance:** `/admin/*` y `/barbero`
**Lector:** el dev que lo ejecuta y el dueño que decide.
**Estado previo:** tanda 1 cerrada en producción (commit `4f0cdb4`, 9-sep): AA 0 fallos, textos ≥12 px, targets ≥44 px **salvo 33 controles móviles, los 33 en `/admin/horarios`**.

---

## 1. Resumen ejecutivo

1. Se adapta la **estructura** de WeiBook, no su marca: nav inferior fija, hub de Ajustes con listas agrupadas, filas de 72 px, hojas con pie pegado, FAB, tira de semana, estados vacíos ilustrados.
2. Los tokens siguen siendo los de la casa: carbón `#0c0b0a`, hueso, **rojo barbero solo para la acción primaria**, verde/ámbar para estado, radio 16, Barlow + Inter. **Cero azul** salvo que el dueño lo pida.
3. El motor ya está hecho —calendario día×barbero con mover y bloquear, dos paneles con aside, chips invertidos, Switch de 44, hojas con grabber, buckets de fotos con el host ya permitido en CSP y `remotePatterns`—: falta **cromo y patrones**.
4. El cambio con más palanca es la **navegación**: 8 grupos + 2 secundarias con scroll horizontal pasan a 5 destinos fijos abajo, y el cromo del celular cae de **146–206 px medidos** a ~60.
5. El segundo es el **mostrador**: la barra inferior tiene 7 controles en 360 px y las etiquetas se partieron en dos líneas. Queda con 4 destinos y un FAB de **una sola acción por pestaña**.
6. El tercero es el **hub `/admin/ajustes`**, que absorbe Catálogo, Equipo, Marketing, Métricas y Ayuda **sin mover una sola ruta**.
7. Para el dueño que MIRA: saludo, cifras del mes contra el mes anterior, últimas visitas, badges que dicen dónde intervenir y un **ojo para tapar la plata** delante de los clientes.
8. Para el barbero que REGISTRA: walk-in a un toque, «Llegó / Cobrar / No vino» **también desde el calendario**, y Cierre y Caja convertidos en hubs de filas grandes.
9. **23 pasos deployables sueltos**, con **2 migraciones** que el dueño aplica a mano antes del deploy que las usa, y **3 verificaciones de RLS** bloqueantes escritas antes de tocar código.
10. Nada retrocede la tanda 1 —y ahora hay con qué probarlo— y nada toca `/`, `/reservar` ni `/cuenta`.

---

## 2. Qué cambió respecto de la versión 1 de este plan

La crítica tenía razón en 5 huecos, 7 choques y 8 riesgos. Se resolvieron todos; ninguno quedó en el limbo.

### 2.1 Lo que faltaba

| # | Faltante | Qué se hizo |
|---|---|---|
| 1 | **Caja (`/admin/cuadre`) sin paso propio** | **Se incorpora como paso 14.** El argumento es medible y peor de lo que decía la crítica: Caja es la **segunda pantalla más larga** del panel en celular — **3.734 px, 48 interactivos, 24 botones, 5 radios**. Convertirla en destino fijo de la nav y no rediseñarla era dejar el cromo viejo al lado de todo lo nuevo. |
| 2 | **Paso de medición** | **Se incorpora dos veces: paso 1 (línea base) y paso 23 (cierre).** Y se corrige el instrumento: `qa/e2e-admin-ux.py` **no existe** — `grep` sobre `scripts/`, `*.py`, `*.mjs` y `*.ts` no encuentra nada que escriba `metricas.json`. Lo que hay es `scripts/qa/` con recorridos del **sitio público** y `sesion-staff.mjs`, que sí sabe emitir cookies de admin/sede/barbero. El paso 1 escribe el arnés que falta. |
| 3 | **Kit sin adoptar en Cupones, Ausencias, CobradosHoy, vacíos** | **Se incorpora como paso 21.** Verificado: `CuponesAdmin.tsx:81-92` tiene 5 inputs con `placeholder` en mayúsculas y clase `fld` propia; `CuadreForms.tsx:125-156` otros 5. |
| 4 | **Teléfono enmascarado asumido en silencio** | **Sube a decisión del dueño** (la única del lote con implicación de privacidad), con recomendación: enmascarado en la lista, completo en la ficha. |
| 5 | **«Link y QR para reservar» y soporte** | **El link y el QR entran** en el hub (paso 16) — con una corrección: el QR que existe hoy es el de **reseña** (`public/qr/resena-<sede>.svg`, usado en `AgendaList.tsx:1244`), no el de reserva; son 2 SVG generados una vez, igual que aquellos. **Soporte** va a decisión del dueño (a quién escribe). |

### 2.2 Los choques, resueltos eligiendo

| # | Choque | Se elige |
|---|---|---|
| 1 | FAB a `safe+20` (admin) vs pill de nav de 64 px que el propio plan le pone al admin | **Un solo offset en todas partes: `bottom: calc(env(safe-area-inset-bottom) + 84px)`**, y la **nav sube al paso 3**, antes que cualquier paso con FAB. El arnés mide `solapados` para que no vuelva a pasar inadvertido. |
| 2 | El FAB del mostrador con tres definiciones (walk-in / +Cita / menú contextual) | **El FAB es SIEMPRE una sola acción, nunca un menú**, y cambia con la pestaña: Turnos → `+ CLIENTE`, Agenda → `+ CITA`, Espera → `+ EN ESPERA`, Cierre → sin FAB. El barbero no pierde el `+ Cita` fijo: sigue como botón en Turnos y es el FAB del calendario. |
| 3 | Ocultar el `SectionHeader` y a la vez mandar la leyenda al «?» que vive dentro de él | **No se oculta: se compacta.** `SectionHeader` gana `compacto` (44 px, sin eyebrow, h1 a 20 px, misma `AyudaSeccion`). Verificado en `SectionHeader.tsx:33`. |
| 4 | La fila de 5 accesos de Inicio repetía Agenda y Caja, ya fijos en la nav | **La fila queda con lo que la nav NO cubre**: `+ Cita`, `Cobrar`, `Métricas`, `Stock`, `Equipo`. |
| 5 | FAB prometido en Equipo, con el alta de barbero fuera de alcance | **Equipo sin FAB.** Sería el control muerto que el plan prohíbe en Inicio y Ajustes. |
| 6 | «Cobrar sin cita» y «Agendar cita» perdían alcance al bajar a una sola pestaña | **Quedan alcanzables desde tres lugares** (botón fijo en Turnos + fila del Cierre / FAB de Agenda + Ctrl-K), y con «Ambas sedes» el botón **deja de esconderse** (`AgendaList.tsx:592`): la hoja pide la sede con dos chips. |
| 7 | `CierreCaja` reescrito en dos pasos | **Lo toca solo el paso 6**, que ya lo mueve a `Hoja`; el paso 5 lo excluye por nombre. |

### 2.3 Los riesgos, declarados

- **Solapamiento FAB/nav** → offset único + `solapados = 0` como criterio de aceptación del paso 23.
- **Fotos de barbero a un bucket (toca lo público)** → **verificado que no hacen falta cambios de cabeceras**: `wvmdsxznujklgfezqtfy.supabase.co` ya está en `next.config.ts` `images.remotePatterns` y en el `img-src` del CSP (línea 63). Igual el paso no se cierra sin mirar `/barberos` y `/reservar` en producción con el service worker activo — el commit `f2a1ae7` fue exactamente eso rompiéndose.
- **Teléfono público desde la base** → sale del paso 7 y queda como **fase 2 con respaldo `?? SEDE_INFO`** y verificación en vivo del pie y del JSON-LD.
- **RLS de `servicios` / `servicio_sede`** → verificación **bloqueante** escrita en el paso 19 (la memoria ya registra «la RLS los bloqueaba en silencio» con precios y contratos).
- **Lectura de `gastos`** → declarada: `supabaseServerAuth()` en páginas admin-only (es como lee `getCuadre`, `queries.ts:708-731`, y el admin sí pasa la RLS); `supabaseAdmin()` solo donde hoy ya se usa, en el desglose de caja del mostrador. Prohibido leer `gastos` con sesión desde una pantalla que abra un barbero: saldría **$0 sin error**.
- **`MAPA_NAV` incompleto** → ahora enumera `/admin/ajustes`, `/admin/ajustes/negocio`, `/admin/ajustes/informes`, `/admin/informes/gastos` y `/admin/informes/resenas`, y `destinoDe()` devuelve `undefined` sin marcar nada ante una ruta desconocida.
- **`?cobrar=` inexistente** → lo **implementa el paso 4** en `/barbero`, y el paso 10 (HojaCita) depende de él.
- **Deuda de Horarios abierta 17 pasos** → «El local» **sube al puesto 7**.

### 2.4 El orden

`nav (3) → El local (7) → Solo yo (9, ahora valor alto) → …`. Además: el **ojo de ocultar montos sube al kit** (lo usan el paso 4 y el 15 por igual), el paso 11 deja de depender del Cierre y pasa a depender de la HojaCita y del `?barbero=`, y el paso de consistencia va antes del Cierre pero sin pisarlo.

---

## 3. Decisiones de sistema

| Tema | Decisión | Razón |
|---|---|---|
| **Medición** | El arnés se escribe y la línea base se genera **antes** de tocar nada | No está versionado, `/admin` móvil falló por red y el mostrador nunca se midió. |
| **Navegación** | Nav inferior flotante en celular; pestañas arriba solo en escritorio | Con scroll horizontal, «dónde estoy» depende de dónde quedó la barra. |
| **Destinos** | Admin: Inicio · Agenda · Caja · Clientes · Ajustes. Mostrador: Turnos · Agenda · Espera · Cierre | Son los de uso diario; el resto cabe en el hub. |
| **Rutas** | **Ninguna cambia.** Un `MAPA_NAV` único deriva nav, hub, migas y el «Ir a» de Ctrl-K | Enlaces, marcadores, correos y el push de caja siguen sirviendo. |
| **Acento** | Rojo único para la acción primaria; «activo» = inverso `bg-ink`/`text-bg` | La tanda 1 acaba de sacar al rojo de hacer cinco trabajos. |
| **Radios** | 16 en tarjetas y campos, 24 arriba en las hojas, 12 en los tiles | Copiar el 20–24 de WeiBook es transversal y no aporta legibilidad. |
| **Tiles** | `IconTile` 44×44 con 5 tintes de tokens existentes, `aria-hidden` | Requiere una línea: `--color-bar: var(--bar)` en `@theme inline`. |
| **Campos** | Label fija en el borde, 56 px, foco en **tinta** | El placeholder desaparece al escribir; hoy hay 6 estilos de input y todos enfocan en rojo. |
| **Cabeceras** | `SectionHeader` se **compacta**, no se oculta | El «?» envuelve al título: sin título no hay ayuda. |
| **Hojas** | Lista de 72 px para mirar, **una** `Hoja` con pie pegado para tocar; en `lg` es el aside | Equipo 4.993 px, Productos 4.591 (107 interactivos), Caja 3.734, Catálogo 2.842. |
| **FAB** | **Una sola acción, nunca menú.** Offset único `safe + 84px`. Solo donde hay un alta real | En Inicio, Ajustes, Cierre y Equipo sería un control muerto. |
| **Registrar** | Donde hay varias cosas que anotar (Cierre, Caja) → grupo `REGISTRAR` de filas de 72 px | Se lee sin abrir nada y no mete un toque extra. |
| **Diálogos** | Fuera los 4 `confirm` y los 2 `alert` del staff; dos toques | El cuadro nativo rompe el registro visual y en la TWA se ve como sistema. |
| **Un archivo, un paso** | `CierreCaja` lo toca solo el paso 6 | Evita la doble pasada. |
| **Vacíos** | `EstadoVacio` único | Hoy conviven seis vacíos ad hoc. |
| **Densidad** | Nada bajo 44 px ni bajo 12 px | El paso 7 cierra los 33 de Horarios; el paso 3, los 37 de escritorio del topbar. |
| **Clientes de Supabase** | Cada lectura nueva declara el suyo | `gastos` es admin-only: elegir mal da $0 silencioso. |
| **Alcance** | No se toca `/`, `/nosotros`, `/barberos`, `/reservar`, `/cuenta`, `/entrar` | Zona 1:1 del handoff. Lo que cambia ahí es **dato**, no UI. |

### Lo que YA existe (no es trabajo nuevo)

Calendario día×barbero con carriles, línea de «ahora», drag y mover · bloquear/desbloquear horas · vista semana · horario real de la sede (`horarioEfectivo`, 0048) · patrón dos paneles con aside sticky · `Boton`/`botonClases` con 4 variantes y 2 tamaños (`md` = 44 px, `sm` = **40**, no 36) · `ChipFiltro` invertido y `ChipEstado` · `Switch` de 44 px · `Kpi`, `SectionHeader`, `.eyebrow`, `AyudaSeccion` · `HojaInferior` con grabber · autocompletado de clientes en `AgendarCitaForm` · `Elegir*` con buscador · unir fichas (0056) con doble confirmación · cobro desde el cuadre con `PendientesCobrar` · export CSV · badge en la pestaña Espera · safe-area · realtime · «Libres ahora» a un toque · buckets de fotos (0019/0055/0058) con el host ya en `remotePatterns` y en el CSP · QR de reseña por sede · AA y targets de la tanda 1.

---

## 4. Plan

> Cada paso se deploya solo. `dep.` = de qué paso depende.
>
> **Hechos al 16-sep: 1, 2, 3, 4, 5 y 6.** Sigue el 7.

| # | Paso | Esf. | Valor | dep. | Migración |
|---|---|---|---|---|---|
| 1 | **Arnés de medición del staff y línea base real** | S | alto | — | — |
| 2 | Kit de piezas (`Hoja`, `Campo`, `Segmentado`, `Plegable`, `IconTile`, `ListaAgrupada`, `EstadoVacio`, `Fab`, `NavInferior`, `OcultarMontos`, `SectionHeader compacto`, `--color-bar`, 16 íconos) | M | alto | 1 | — |
| 3 | **Admin: nav inferior de 5 destinos, cabecera de una fila, `MAPA_NAV`** | M | alto | 2 | — |
| 4 | Mostrador: nav de 4, FAB de una acción, cabecera fundida, `?cobrar=` | M | alto | 2 | — |
| 5 | Una sola `Hoja`; fuera `confirm()` y `alert()` (sin `CierreCaja`) | M | alto | 2 | — |
| 6 | Mostrador · Cierre como hub (dueño único de `CierreCaja`) | M | alto | 2, 5 | — |
| 7 | **«El local»: Perfil \| Horario \| Días especiales — cierra la deuda de la tanda 1** | M | alto | 2, 3 | **0075** |
| 8 | Agenda: cabecera compacta + tira de semana + FAB; leyenda al «?» | M | alto | 2, 3 | — |
| 9 | **Agenda: filtro por barbero «Solo yo» + hora grande** | M | alto | 8 | — |
| 10 | `HojaCita`: registrar desde el calendario | M | alto | 4, 5, 8 | — |
| 11 | Turnos y Espera: mi columna primero, chevron a la hoja, filas de 72 | S | medio | 2, 9, 10 | — |
| 12 | Clientes: cabecera compacta, filas de 72, FAB, `ClienteSheet` antidoblete | M | alto | 2, 5 | — |
| 13 | `ClienteCampos` también en walk-in y Agendar cita | S | alto | 12 | — |
| 14 | **Caja (`/admin/cuadre`): grupo REGISTRAR, `Campo`, filas y anclas** | M | alto | 2, 5 | — |
| 15 | Inicio A: saludo, ojo, 5 accesos sin duplicar la nav | M | alto | 2, 3, 5 | — |
| 16 | Hub `/admin/ajustes` + `Mi negocio` (+ link y QR de reserva) | M | alto | 3, 14 | — |
| 17 | Hub `Estadísticas e informes` (+ Gastos y Reseñas) | M | medio | 16 | — |
| 18 | Inicio B: cifras del mes, últimas visitas, «Ahora mismo» | M | medio | 15 | — |
| 19 | Catálogo e Inventario: filas + `ServicioSheet` / `ProductoSheet` | M | medio | 2, 5 | *(RLS)* |
| 20 | Equipo: una ficha por colaborador + baja | M | medio | 2, 16 | **0076** |
| 21 | **Marketing y sueltos: `Campo` y `EstadoVacio` donde el hub señala** | S | medio | 2, 16 | — |
| 22 | Ficha del cliente: secciones apiladas en vez de 8 pestañas | L | medio | 12 | *(RLS)* |
| 23 | **Cierre de medición: re-correr el arnés y publicar el «después»** | S | alto | 1,3,7,8,12,14 | — |

### Migraciones — el dueño las aplica a mano en el SQL Editor, **antes** del deploy que las usa

**`0075_sedes_contacto.sql`** — antes del paso 7.

> **Renumerada el 16-sep.** El plan la había llamado `0074`, pero ese número se lo llevó
> `0074_ajustes_equipo.sql` (el interruptor de «que el barbero vea su semana»), aplicada y
> verificada ese mismo día. Los dos números de este bloque corren uno: 0075 y 0076.

```sql
alter table public.sedes
  add column if not exists telefono    text,
  add column if not exists whatsapp    text,
  add column if not exists instagram   text,
  add column if not exists descripcion text;

notify pgrst, 'reload schema';
```

`google_review_url` ya existe (0018) y `foto_url` también (0058). `getSedes` debe tolerar columnas ausentes mientras no esté aplicada — el patrón ya está en el repo: `getCuadre` hace `select("*")` sobre `gastos` justamente por eso.

**`0076_bucket_barberos.sql`** — antes del paso 20.

```sql
insert into storage.buckets (id, name, public)
values ('barberos', 'barberos', true)
on conflict (id) do nothing;

notify pgrst, 'reload schema';
```

Sin columnas nuevas: `barberos.foto_url`, `activo` y `sede_id` ya existen y `barberos_write_admin` (0045) cubre la RLS. Las actions escriben con `supabaseAdmin()` tras `requireAdmin`, igual que `subirFotoSede`.

### Verificaciones bloqueantes sin DDL

| Paso | Qué confirmar antes de escribir código | Si no está |
|---|---|---|
| 19 | Políticas de `INSERT`/`UPDATE` en `public.servicios` y `public.servicio_sede` para admin | Las actions van por `supabaseAdmin()` tras `requireAdmin` |
| 22 | Política de `UPDATE` en `public.clientes` para admin (hoy solo se actualiza `notas`) | Ídem |
| 15 | Que `completarReserva` acepte una reserva ya `'completada'` sin venta (`actions.ts:2045–2075`) | Las «atendidas sin cobrar» quedan de lectura con «Ver cuadre» |

---

## 5. Wireframes a 360 px

### 5.1 Anatomías del kit (paso 2)

```
┌──────────────────────────────────────────┐  Campo · 56 px · radio 16 · border-line
│ Nombre del servicio *                    │  label FIJA en el borde (bg-panel detrás)
│ Corte y cejas                            │  valor 15 px · foco border-ink/60 (NO rojo)
└──────────────────────────────────────────┘
 ⚠ Entre 5 min y 8 horas.                     error 12 px --warn

╭────────────────────┬─────────────────────╮  Segmentado · riel bg-panel · ítems 44
│    Información     │      Por sede       │  activo bg-elevated text-ink
╰────────────────────┴─────────────────────╯

┌──────────────────────────────────────────┐  Plegable <details> · 56 px
│ Configuración adicional              ⌄   │
└──────────────────────────────────────────┘

 CATÁLOGO                                     .eyebrow 12 px · tracking .12em
╭──────────────────────────────────────────╮  ListaAgrupada · radio 16 · bg-panel
│ ┌────┐  Servicios y precios           ›  │  Fila 72 px · IconTile 44 (radio 12)
│ │ ✂  │  48 activos · 21 combos · 48 sin  │  título 16 semibold · sub 13 muted
│ └────┘  foto                             │
├──────────────────────────────────────────┤  divide-line/60
│ ┌────┐  Productos y stock        2 ●  ›  │  badge bg-warn text-bg · 20 px
│ │ ▣  │  Stock, mínimos y upsell          │
│ └────┘                                   │
╰──────────────────────────────────────────╯

────────────────────────────────────────────  Hoja · pie PEGADO (sticky, safe-area)
  Cancelar                    [ GUARDAR ]    terciario | primario gris hasta ser válido

FAB — UNA acción, etiqueta cuando ayuda:     NAV — pill h64, etiqueta siempre visible
        ╭───────────────╮                     ╭──────────────────────────────────────╮
        │  +  CLIENTE   │  56 alto · r16      │ ╭─⌂ Inicio─╮  ▦    $    ☺    ⚙      │
        ╰───────────────╯  bottom:            ╰──────────────────────────────────────╯
                           calc(safe + 84px)   ↑ 64 + 12 de aire = los 84 del FAB

Tintes de IconTile (oscuro / claro):
  marca   bg-accent/10  text-accent-soft   #e8675c / #a52f25
  equipo  bg-ok/10      text-ok            #34d399 / #065f46
  plata   bg-warn/10    text-warn          #fbbf24 / #92400e
  local   bg-bar/15     text-bar           #a3907c / #8f7a60   ← utility nueva
  neutro  bg-elevated   text-muted         #9c958a / #6f6858
```

### 5.2 Mostrador · Turnos (pasos 4, 11)

```
ANTES (captura real, 390 px):
│Turnos Agenda Espera Cierre│Cobrar│ + │ + │   7 controles; «+ Cliente» y «+ Cita»
│                           │      │Cli│Cit│   partidos en dos líneas

DESPUÉS:
┌──────────────────────────────────────────────┐
│ ☠  Buenas tardes, Meyer                 (◉)  │ saludo 12 muted · avatar 44
│    PARQUE VENEZUELA                          │ display 26 → 64 px de cabecera
├──────────────────────────────────────────────┤
│ ┌ COBRADO HOY EN LA SEDE            (👁) ──┐ │ Kpi ancho · ojo 44 (kit, paso 2)
│ │ $ 310.000                                │ │ display 36 --ok · .bb-monto
│ │ 8 de 11 atenciones · ● 2 sin responder   │ │ 12 px; alerta warn si hay
│ └──────────────────────────────────────────┘ │
│ [ COBRAR SIN CITA ]   [ AGENDAR CITA ]       │ 2 × Boton secundario 44 (a la vista)
│ [Solo yo] [Todos]                            │ chipFiltro 44 (paso 9)
│ AHORA                                        │ .eyebrow
│ ┌──────────────────────────────────────────┐ │ mi columna PRIMERA, ring-ok/40
│ │ (◉) MEYER · Atendiendo         $120.000  │ │
│ ├──────────────────────────────────────────┤ │
│ │ 2:00  Carlos Arias      $45.000 EN SILLA │ │ hora text-ink (ya no accent)
│ │  pm   Corte + barba                   ›  │ │ › 44 → HojaCita
│ │       [         COBRAR $45.000        ]  │ │ primario 56 (ya existe)
│ ├──────────────────────────────────────────┤ │
│ │ 1:30  Andrés R.                 ¿LLEGÓ?  │ │ la hora pasó → pregunta (ya existe)
│ │  pm   [ Sí, en la silla ] [ No llegó ]   │ │ 56 + 56
│ └──────────────────────────────────────────┘ │
│ LIBRES AHORA · 2                             │
│ ┌────────────────┐ ┌────────────────┐        │ 72 px · 1 toque = walk-in (ya existe)
│ │ (◉) Jhon     + │ │ (◉) Junior   + │        │
│ └────────────────┘ └────────────────┘        │
│                          ╭───────────────╮   │ FAB de ESTA pestaña: walk-in directo
│                          │  +  CLIENTE   │   │ (en Agenda dirá «+ CITA»,
│ ╭────────────────────────╰───────────────╯─╮ │  en Espera «+ EN ESPERA»,
│ │ ╭─≡ Turnos─╮   ▦     ◔²     $           │ │  en Cierre no hay FAB)
│ ╰──────────────────────────────────────────╯ │
└──────────────────────────────────────────────┘ safe-area-inset-bottom + 12
```

### 5.3 Mostrador · Cierre (paso 6)

```
┌──────────────────────────────────────────────┐
│ ┌──────────────────────────────────────────┐ │ tarjeta destacada
│ │ CAJA DE LA SEDE       ● ABIERTA 9:12 am  │ │ eyebrow + ChipEstado ok
│ │ $ 182.000                                │ │ display 36 tabular · .bb-monto
│ │ efectivo esperado · digital $128.000     │ │ 13 muted
│ │ [       CERRAR CAJA DE LA SEDE         ] │ │ primario 48 → Hoja
│ └──────────────────────────────────────────┘ │
│ PENDIENTE                                    │
│ │ [⚠] Pendientes por cobrar        (2)  ›  │  tile plata · badge warn
│ │     Luis 2:45 · Andrés 1:30 · $75.000    │
│ HOY                                          │
│ │ [✂] Qué se llevó cada cliente         ›  │  8 cobros · $310.000
│ │ [⚇] Por barbero                       ›  │  Meyer $120.000 · Jhon $95.000 · +1
│ │ [★] Mi comisión                          │  solo rol barbero, sin chevron
│ REGISTRAR                                    │ ← el patrón que reemplaza al FAB-menú
│ │ [▤] Consumo del equipo                ›  │  → Hoja ConsumoBarbero
│ │ [$] Gasto del local                   ›  │  → Hoja GastoRapido
│ │ [▸] Cobro sin cita                    ›  │  → Hoja CheckoutForm
│ ╭──────────────────────────────────────────╮ │
│ │  ✂    ▦    ◔    ╭─$ Cierre─╮            │ │ sin FAB en esta pestaña
│ ╰──────────────────────────────────────────╯ │
└──────────────────────────────────────────────┘

Hoja «Cerrar caja»:
│                 ▬▬▬▬                         │ grabber
│  CERRAR CAJA · Parque Venezuela              │ display 22
│  Esperado en efectivo             $ 182.000  │
│  ┌ ¿Cuánto contaste en efectivo? ─────────┐  │ Campo 56 · inputMode numeric
│  │ $ 180.000                              │  │
│  └────────────────────────────────────────┘  │
│  Diferencia  −$ 2.000 · falta            ⚠   │ en vivo; ok si 0
│  ┌ Nota (opcional) ───────────────────────┐  │
├──────────────────────────────────────────────┤ pie pegado
│ Cancelar   [ CERRAR CON DIFERENCIA −$2.000 ] │ 2º toque (ex window.confirm:99)
```

### 5.4 Agenda — admin y mostrador (pasos 8, 9)

```
ANTES: la cabecera de barberos aparece a y≈375 de 844 → se ven ~4 horas.
DESPUÉS: a ≤270 px → ~6 horas.

┌──────────────────────────────────────────────┐
│ ☠  [⌖ Parque Venezuela ▾]        (🔍) (A)    │ topbar 56 (una fila, paso 3)
├──────────────────────────────────────────────┤
│ AGENDA (?)                                   │ SectionHeader COMPACTO 44 px
│ (‹)   ▦ Mié 9 sep · Hoy  ▾  (›)   (⚲) (⋯)   │ 48 · ▾ abre <input type=date>
│  LUN   MAR   MIÉ   JUE   VIE   SÁB   DOM     │ 12 px muted
│   7     8   ( 9 )   10    11    12    13     │ 17 display · activo bg-ink/text-bg
│   ·     ·     ·           ·                  │ punto 4 px = hay citas
├──────────────────────────────────────────────┤ ← cabecera de barberos ≤270 px
│      │ ◉ Meyer  │ ◉ Jhon   │ ◉ Junior        │ sticky 44 (ya existe)
│  9   ├──────────┼──────────┼──────────       │
│  am  │┃Carlos   │          │┃Luis            │ hora grande + «am» debajo
│ 10   ├ ─ ─ ─ ─ ─┼ ─ ─ ─ ─ ─┼ ─ ─ ─ ─ ─       │ media hora punteada
│  am  │          │▒Almuerzo▒│                 │ bloqueo rayado (ya existe)
│[11:47]●━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │ ahora + pill con la hora exacta
│ 12   ├──────────┼──────────┼──────────       │   ┌────┐
│  pm  │          │          │                 │   │ +  │ FAB «+ CITA»
└──────────────────────────────────────────────┘   └────┘   (safe + 84)
Hoja del (⋯): [Ver semana] [Bloquear horas] · (dueño) sede: [Parque][Plaza]
El «?» del encabezado guarda la leyenda de los 6 estados.

Filtrada a «Solo yo» (paso 9): la columna ocupa todo el ancho
│      │ ◉ Meyer · Solo yo         [Todos]     │
│  9   ├────────────────────────────────────── │
│  am  │┃ Carlos Arias                 $45.000 │ nombre completo + precio
│      │┃ 9:00 – 9:45 · Corte + barba          │
│      ├ · · · · · · · · · · · · · · · · · · · │ marcas de 15 min (solo filtrado)
```

### 5.5 HojaCita (paso 10)

```
┌──────────────────────────────────────────────┐
│░░░░░░░░ agenda atenuada (black/60) ░░░░░░░░░░│
├──────────────────────────────────────────────┤ rounded-t-[24px] bg-panel
│                 ▬▬▬▬                         │ grabber
│  9:30 am                   ● CONFIRMADA      │ display 32 + ChipEstado
│  Mié 9 sep · 45 min                          │ 13 muted
│ ┌──────────────────────────────────────────┐ │ bg-elevated r16
│ │ (CA) Carlos Arias                     ›  │ │ 56 → ficha (solo admin)
│ │      300 123 4567                        │ │
│ ├──────────────────────────────────────────┤ │
│ │ ✂  Corte + barba · 45 min      $ 45.000  │ │ 56 · toca = cambiar servicio
│ ├──────────────────────────────────────────┤ │
│ │ ◉  Meyer · Parque Venezuela              │ │ CaraBarbero 28
│ │ ✎  «viene con el hijo»                   │ │ nota si hay
│ └──────────────────────────────────────────┘ │
│ [WhatsApp][Mover][Cambiar servicio][Histor.]→│ secundarios 44, scroll-x
│  ─────────────────────────────────────────── │
│  No vino            Cancelar cita            │ peligro ámbar, 2 toques
├──────────────────────────────────────────────┤ pie pegado
│  Cerrar                    [   ✓ LLEGÓ    ]  │ terciario | primario 48
└──────────────────────────────────────────────┘
Variantes del pie: en_curso → [ COBRAR $45.000 ] (mostrador: evento 'bb:cobrar';
admin: /barbero?tab=turnos&cobrar=<id>, parámetro creado en el paso 4) ·
temprano → [ Llegó · faltan 2h ] deshabilitado · completada → «Ver venta» ·
cancelada/no vino → solo Cerrar.
```

### 5.6 Admin · Caja (paso 14 — el que faltaba)

```
ANTES: 3.734 px, 48 interactivos, 24 botones, 5 radios. Dos formularios abiertos
       con placeholders en vez de labels y un cobro escondido tras un botón suelto.

┌──────────────────────────────────────────────┐
│ ☠  [⌖ Parque Venezuela ▾]        (🔍) (A)    │ topbar 56
├──────────────────────────────────────────────┤
│ CAJA (?)                               (👁)  │ SectionHeader compacto + ojo 44
│ martes 15 de septiembre                      │ 13 muted
│ ┌───────────┬───────────┬────────┬─────────┐ │ los 4 KPI de hoy se conservan
│ │ $ 310.000 │ $  75.000 │ $ 42k  │ $ 268k  │ │ display 20 tabular · .bb-monto
│ │ entró hoy │ pendiente │ gastos │  neto   │ │ 12 px muted
│ └───────────┴───────────┴────────┴─────────┘ │
│ REGISTRAR                                    │ .eyebrow  ← mismo patrón del Cierre
│ ╭──────────────────────────────────────────╮ │
│ │ [$]  Gasto del local                  ›  │ │ tile plata → Hoja (ex CuadreForms)
│ │      Agua, aseo, un arreglo              │ │
│ ├──────────────────────────────────────────┤ │
│ │ [W]  Adelanto a barbero               ›  │ │ tile equipo → Hoja
│ │      Descuenta de la liquidación         │ │
│ ├──────────────────────────────────────────┤ │
│ │ [▸]  Cobro sin cita                   ›  │ │ tile marca → Hoja CobroDirectoAdmin
│ │      Servicio suelto o solo productos    │ │
│ ╰──────────────────────────────────────────╯ │
│ PENDIENTE POR COBRAR · 2                     │
│ │ 2:45 pm Luis · Corte · Meyer    $40.000 › │  PendientesCobrar (ya existe)
│ HOY                                          │
│ │ [▦] Corte del día por sede            ›  │
│ │ [$] Historial de cajas · 1 abierta    ›  │  id=historial  ← ancla del paso 17
│ │ [▤] Medios de pago                    ›  │  id=medios    ← ancla del paso 16
│ ╭──────────────────────────────────────────╮ │
│ │  ⌂    ▦   ╭─$ Caja─╮   ☺    ⚙           │ │ sin FAB (una acción, no menú)
│ ╰──────────────────────────────────────────╯ │
└──────────────────────────────────────────────┘

Hoja «Gasto del local» (antes: 3 placeholders sueltos en la página):
│ ┌ Categoría * ─────────────────────────┐ │ chips + Campo, ya no placeholder
│ ┌ Monto * ─────────────────────────────┐ │ inputMode numeric
│ ┌ Cómo se pagó ──────────────────────▾─┐ │ solo efectivo descuenta del cajón
│ ┌ Descripción (opcional) ──────────────┐ │
├──────────────────────────────────────────┤
│ Cancelar                  [ REGISTRAR ]  │ gris hasta monto > 0
```

### 5.7 Admin · Inicio (pasos 15 y 18)

```
┌──────────────────────────────────────────┐
│ ☠  [◎ Ambas sedes ▾]        (🔍)  (A)    │ topbar 56 (paso 3)
├──────────────────────────────────────────┤
│ ⚠ La caja lleva 4 días sin cerrar Cerrar→│ AvisoCaja (se conserva)
│ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │ .bb-poste 4 px
│ Buenas tardes, Jhan            ┌──────┐  │ 13 muted
│ BARBAS &                       │ logo │  │ display 30 · 2 líneas
│ BIGOTES                        └──────┘  │ tile 44 (foto de sede si ?sede=)
│ Las dos sedes · martes 15 de septiembre  │ 12,5 muted
│ ┌──────────────────────────────────────┐ │
│ │ TUS VENTAS · SEPTIEMBRE       [👁]   │ │ eyebrow + ojo 44
│ │ $ 4.860.000                          │ │ display 40 tabular · .bb-monto
│ │ Hoy $60.000 · 3 atenciones · 40 % ag.│ │ 12,5 muted (lo diario, en línea)
│ │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░  │ │ h-2 · relleno --bar (no verde)
│ │ ▦ Quedan 15 días de septiembre       │ │
│ │ ● P. Venezuela $3,1M · ● Plaza $1,7M │ │ solo con «Ambas»
│ │ ──────────────────────────────────── │ │
│ │ [+]   [$]¹  [Ch]  [▣]²  [⚇]¹        │ │ 5 accesos que la NAV NO cubre
│ │+Cita Cobrar Métric Stock Equipo      │ │ (Agenda y Caja están fijos abajo)
│ └──────────────────────────────────────┘ │
│ ┌ accent/6 ────────────────────────────┐ │
│ │ ATENDIDAS SIN COBRAR      Ver cuadre │ │ se conserva (solo si hay)
│ └──────────────────────────────────────┘ │
│ ┌──────────────────────────────────────┐ │
│ │(Últimas visitas·3) ( Lo que viene·2 )│ │ Segmentado 44 (paso 18)
│ │ 3:40 pm Carlos P. · Corte+Barba $45k›│ │ fila 64 · › a la ficha
│ └──────────────────────────────────────┘ │
│ AHORA MISMO                   Ver equipo │
│ │ ◉ Meyer · Carlos · Corte   sale 3:30 │  SOLO excepciones (56 px)
│ │ ◉ Kevin · Luis · Barba     +12 min   │  pasado de hora · accent/6
│ │ ◎◎◎◎  4 libres                       │  pila de caras 28 px
│ ┌──────────────────────────────────────┐ │
│ │ TUS CIFRAS · SEPTIEMBRE  Ver métricas│ │
│ │ CRECIMIENTO ▲12%  │ CORTES 138 ▲9    │ │ mini-KPI 2×2 · display 22
│ │ NUEVOS 21         │ GASTOS $420k ▲18 │ │ Gastos con delta INVERTIDO
│ │ ★ 4,8 · 12 calificaciones · 30 días  │ │
│ └──────────────────────────────────────┘ │
│ CAJA / POR HACER (id=por-hacer)          │ se conservan tal cual
│ ╭──────────────────────────────────────╮ │
│ │ ╭─⌂ Inicio─╮  ▦    $    ☺    ⚙      │ │ sin FAB acá (nada que crear)
│ ╰──────────────────────────────────────╯ │
└──────────────────────────────────────────┘

Con el ojo cerrado: «$ ▒▒▒▒▒▒▒▒▒» (blur 7 px, mismo alto, sin reflow).
Las atenciones y el % no se ocultan: no son plata.
```

### 5.8 Admin · Clientes (pasos 12, 13)

```
ANTES: el buscador aparece a y≈340 de 844; entran 4 filas; la página mide 2.193 px.
DESPUÉS: a y≈230; entran 6.

┌──────────────────────────────────────────┐
│ CLIENTES (?)                      [ ↓ ]  │ SectionHeader compacto · Excel 44×44
│ 22 clientes · 7 con compras              │ 13 muted
│ ┌──────────────────────────────────────┐ │
│ │ 🔍  Buscar por nombre o teléfono     │ │ 48 · bg-panel · SIN borde · r16
│ └──────────────────────────────────────┘ │ focus ring-line (no accent)
│ [Filtros ›]                              │ UN chip 44 (antes 4 en 2 filas)
│ ┌──────────────────────────────────────┐ │
│ │ (JM) Juan Martínez                 › │ │ 72 · avatar 44, 2 iniciales
│ │      300 ··· 4128 · hace 27 d ·      │ │ enmascarado = decisión del dueño
│ │      Parque · ✂ 3/5                  │ │ UNA línea, truncate
│ ├──────────────────────────────────────┤ │
│ │ (T)  Tito                          › │ │
│ │      300 ··· 6787 · ayer · Parque    │ │
│ └──────────────────────────────────────┘ │
│                                 ┌────┐   │ FAB 56 r16, bottom safe+84
│                                 │ +  │   │ (se oculta si la lista está vacía)
│                                 └────┘   │
╰──────────────────────────────────────────╯

Hoja «Crear cliente»:
│ ┌ Nombre y apellido * ─────────────────┐ │ UN campo (clientes.nombre)
│ ┌ Teléfono * ──────────────────────────┐ │ inputMode=tel
│ ┌ ¿Es él? ─────────────────────────────┐ │ aparece al tipear (debounce 300)
│ │ Juna · 310 ··· 3288   Usar ficha  ›  │ │ 44 · ESTO frena los duplicados
│ └──────────────────────────────────────┘ │
│ Campos adicionales                    ▾  │ 56 · correo, nota, fidelización
├──────────────────────────────────────────┤ pie pegado · safe-area
│ Salir                     [ GUARDAR ]    │ gris hasta nombre + tel ≥7 dígitos
└──────────────────────────────────────────┘
El MISMO bloque se monta en el walk-in del mostrador y en Agendar cita (paso 13).
```

### 5.9 Admin · Ajustes (paso 16)

```
┌──────────────────────────────────────────────┐
│ AJUSTES                                 (?)  │ h1 display 28 · ayuda 44
│ ═════════════════════════════════════════════│ bb-poste 3 px
│ ╭──────────────────────────────────────────╮ │ fila destacada (bb-relieve)
│ │ ┌────┐ BARBAS & BIGOTES                › │ │ tile = cara de la marca
│ │ │ B& │ 2 sedes · horarios, fotos y datos│ │ → /admin/horarios
│ ╰──────────────────────────────────────────╯ │
│ GESTIÓN                                      │
│ │ [St] Mi negocio                        › │  Servicios, productos, equipo, local
│ │ [Ch] Estadísticas e informes           › │  Métricas, cajas, gastos, liquidación
│ CLIENTES Y PROMOCIONES                       │ (reemplaza la pestaña Marketing)
│ │ [Tk] Cupones                     2 ●  ›  │
│ │ [★]  Tarjeta de cortes                 › │
│ │ [Be] Avisos al cliente                 › │
│ │ [QR] Link y QR para reservar           › │  ← fila nueva: copiar/compartir + SVG
│ APLICACIÓN                                   │
│ │ [✂] App del barbero                    ↗ │  → /barbero
│ │ [Bk] Cómo se usa                       › │
│ │ [☾]  Tema              [Oscuro | Claro ] │  segmentado del PerfilMenu
│ │ [?]  Soporte                           ↗ │  destino = decisión del dueño
│ │ [→]  Cerrar sesión                       │  terciario, sin chevron
│ ╭──────────────────────────────────────────╮ │
│ │  ⌂    ▦    $    ☺   ╭─⚙ Ajustes─╮       │ │ sin FAB
│ ╰──────────────────────────────────────────╯ │
└──────────────────────────────────────────────┘

Ajustes › Mi negocio, y cómo se vuelve:
│ ‹ Ajustes                                    │ VolverA 44 · text-muted
│ MI NEGOCIO                                   │
│ CATÁLOGO   │ [✂] Servicios y precios      › │  48 activos · 21 combos · 48 sin foto
│            │ [▣] Productos y stock  2 ●   › │
│ EQUIPO     │ [⚇] Barberos y PINes   1 ●   › │  6 barberos · perfil, foto y PIN
│            │ [%] Comisiones y contratos   › │  (solo lectura + ✎ → ficha)
│ LOCAL      │ [⏱] El local                 › │  horarios, foto y datos
│            │ [$] Medios de pago           › │  → /admin/cuadre#medios
Dentro de una hoja (p. ej. /admin/precios):
│ ‹ Mi negocio                                 │
│ ( Servicios y precios ) ( Productos y stock )│ AdminSubTabs sobrevive SOLO acá
```

### 5.10 Ajustes › Estadísticas e informes (paso 17)

```
│ ‹ Ajustes                                    │
│ ESTADÍSTICAS E INFORMES                      │
│ ╭──────────────────────────────────────────╮ │ destacada
│ │ [Ch] Métricas del negocio              › │ │
│ │      $ 4.860.000 este mes · ▲12% · Excel │ │ ← dato vivo: mirar sin entrar
│ ╰──────────────────────────────────────────╯ │
│ CAJA       │ [$] Historial de cajas · 1 abierta › │ /admin/cuadre#historial
│            │ [↓] Gastos · por sede y período    › │ /admin/informes/gastos (nueva)
│            │ [W] Adelantos a barberos           › │ /admin/liquidacion
│ EQUIPO     │ [W] Liquidación semanal · Excel    › │ acá, no en Mi negocio: es plata
│ INVENTARIO │ [!] Stock bajo mínimo        2 ●   › │ /admin/inventario?filtro=bajo
│ CLIENTES   │ [★] Reseñas · 4,6 · 12 en 30 días  › │ /admin/informes/resenas (nueva)
│            │ [↓] Excel de clientes              ↓ │ /admin/clientes/csv
Las dos páginas nuevas leen con supabaseServerAuth() (admin-only) y entran en MAPA_NAV.
```

### 5.11 Catálogo: lista + sheet (paso 19)

```
ANTES: 2.842 px con UNA categoría abierta; 74 interactivos; 2 servicios por pantalla.
       (Productos y stock está peor: 4.591 px y 107 interactivos.)
DESPUÉS: filas de 72 px → 8 por pantalla.

│ 🔍 Buscar servicio…                        │
│ (Todos 50)(Cortes 7)(Barba 2)(Cejas…)  →   │ chips 44, scroll-x
│ CORTES                                     │ .eyebrow
│ │ [C ] CORTE Y CEJAS                    › │  72 · 40 min · $35.000/$30.000
│ │      · sin foto                         │  «sin foto» en --warn
│ │ [📷] CORTE Y BARBA                    › │  thumb real 44
│ │ [C ] CERQUILLO · fuera del catálogo   › │  opacity-60 si inactivo
│                                     ( + )  │ FAB «+ SERVICIO» (o «+ COMBO»)

Sheet «Editar servicio»:
│ INFORMACIÓN BÁSICA                         │
│ ┌ Nombre del servicio * ─────────────────┐ │ Campo 56
│ ┌ Tiempo del servicio * ─────────────▾ ──┐ │ select 5…480, paso 5
│ PRECIO POR SEDE                            │
│ ┌ Parque      $ ┐ ┌ Plaza          $ ┐    │ vacío = no se ofrece ahí
│ ┌ Configuración adicional            ⌃ ──┐ │
│ │ Se puede reservar online       [═══●]  │ │ (ex window.confirm, ya sin él)
│ │ Suma sello en la tarjeta       [═══●]  │ │
│ │ ┌ Categoría                      ▾ ──┐ │ │ las 7 del seed
│ │ ┌ Descripción (la ve el cliente) ────┐ │ │ 200 chars · (✦ IA, opcional)
│ │ IMAGEN DEL SERVICIO  [📷] 16/9        │ │ tile cámara 44, capture=environment
│ └────────────────────────────────────────┘ │
│  ‹ Anterior     47 sin foto   Siguiente ›  │ modo vestir (opcional)
├────────────────────────────────────────────┤
│  Cancelar                    [ GUARDAR ]   │ gris hasta que cambie algo
```

### 5.12 Equipo (paso 20)

```
ANTES: 4.993 px, 29 botones, y el mismo barbero en 5 lugares.

│ PIN DEL MOSTRADOR                          │
│ │ [⌂] PARQUE VENEZUELA · PIN listo     › │  72
│ │ [⌂] PLAZA DE LA PAZ · PIN listo      › │
│ ⚠ 2 de 6 barberos sin correo de avisos  ›  │ fila ámbar (si aplica)
│ PARQUE VENEZUELA                           │ .eyebrow por sede
│ │ (◉) MEYER                            › │  CaraBarbero 44
│ │     Comisión 50% · PIN listo · correo ✓│
│ │ (◉) JHON · ● sin correo              › │  ● en --warn
│                                            │ SIN FAB: el alta queda fuera

Ficha (Hoja):
│                 ╭────────╮                 │
│                 │   ◉    │(📷)             │ avatar 96 + cámara 44 (bucket 0075)
│                 ╰────────╯                 │
│ ┌ Nombre * ──────────────────────────────┐ │
│ ┌ Cuéntanos sobre el barbero (opcional) ─┐ │
│ ┌ Especialidades (máx 6) ────────────────┐ │ chips 44 removibles
│ CONTRATO                                   │
│ ╭ Comisión %    │  Arriendo de silla ────╮ │ Segmentado 44 (antes pills de 28)
│ ┌ Se lleva                          % ───┐ │
│ ┌ Configuración adicional            ⌄ ──┐ │
│ │  ┌ Sede                          ▾ ──┐ │ │
│ │  PIN personal  [CAMBIAR][DESBLOQUEAR] │ │ 44 (antes el Guardar medía ~32)
│ │  ┌ Correo de avisos ┐    [ PROBAR ]   │ │
│ │  [📅] Google Calendar ● compartida  › │ │
│ │  Ya no trabaja acá                    │ │ peligro ámbar, 2 toques
├────────────────────────────────────────────┤
│  Cancelar             [ GUARDAR CAMBIOS ]  │
```

### 5.13 «El local» (paso 7 — el que cierra la deuda)

```
/admin/horarios (la RUTA no cambia; el label sí)
│ ‹ Panel  (→ «‹ Mi negocio» cuando exista el hub)                │
│ ╭──────────┬────────────┬─────────────────╮ │
│ │  Perfil  │  Horario   │ Días especiales │ │ Segmentado 44
│ ╰──────────┴────────────┴─────────────────╯ │
│ PERFIL DEL NEGOCIO              (👁)  (⇪)   │ ojo = vista previa de /reservar
│ ┌─────────────────────────────────────────┐ │ compartir = navigator.share
│ │        fachada · Parque Venezuela       │ │ portada 5/2 (FotoSede)
│ │                                  [📷]   │ │ cámara en tile 44 TOCABLE (hoy 32)
│ └─────────────────────────────────────────┘ │
│ ┌ Nombre * ───────────────────────────────┐ │
│ ┌ Dirección ──────────────────────────────┐ │ hoy es solo lectura
│ ┌ Teléfono / WhatsApp ────────────────────┐ │ NUEVO (0074; hoy en 5 archivos)
│ ┌ Campos opcionales                   ⌄ ──┐ │ Instagram, reseñas Google, texto
│ │ [📅] Horario del local               ›  │ │ Lun–Sáb 9:00–20:00 · Dom cerrado
├─────────────────────────────────────────────┤
│  Cancelar               [ GUARDAR CAMBIOS ] │
└─────────────────────────────────────────────┘

Segmento HORARIO — acá mueren los 33 controles <40 px de la tanda 1:
│ LUNES                            [═══●]     │ Switch 44 (antes checkbox 13 px)
│ ┌ Abre ─────────┐ ┌ Cierra ───────┐         │ Campo time 56 (antes 34 px)
│ │ 09:00         │ │ 20:00         │         │
│ DOMINGO                          [○═══]     │ cerrado
```

### 5.14 Ficha del cliente (paso 22)

```
ANTES: 8 pestañas en scroll horizontal (caben ~3,5 a 360 px).

│ ‹ Clientes                           │ 44
│ (JM)  JUAN MARTÍNEZ                  │ avatar 56 · display 28
│       300 258 4128 · desde ago 26    │ acá COMPLETO (se entró a propósito)
│ [ WhatsApp ] [ + Cita ] [ Editar ]   │ 3 × Boton secundario sm
│ ┌──────────────────────────────────┐ │
│ │ FACTURADO VISITAS ÚLTIMA  WALLET │ │ eyebrow 12
│ │ $ 35.000     1    hace 27d   $ 0 │ │ display 20 tabular · .bb-monto
│ └──────────────────────────────────┘ │ (antes: 4 Kpi sueltos en 2×2)
│ VISITAS   │ Historial      1 venta › │ 56
│           │ Reservas     próxima: — › │
│ FIDELIDAD │ Tarjeta      ●○○○○ 1/5 › │ puntos bg-ink/bg-line (no emoji)
│           │ Puntos          35 pts › │
│           │ Wallet             $ 0 › │
│ NOTAS     │ Nota  alérgico al talco ✎│ inline editable, lápiz visible
│           │ Bitácora        2 notas › │
│ OPINIONES │ Nota del staff ★ 4,5 · 2 › │
│           │ Su opinión  3 califs.  › │
Cada › abre una Hoja cuyo cuerpo es el *Tab que YA existe, sin reescribirlo.
En lg la sección abierta va al aside sticky (Historial por defecto).
```

---

## 6. Decisiones que solo puede tomar el dueño

Cada una se contesta eligiendo **una** opción.

1. **Acento.** ¿Azul de WeiBook como acento secundario, o **rojo único**? → *Recomendado: rojo único.*
2. **Navegación del admin.** ¿**Nav inferior** de 5 destinos en el celular, o se quedan las pestañas? → *Recomendado: nav inferior.*
3. **Nombre del 2º destino.** ¿**«Agenda»** o «Reservas»? → *Recomendado: Agenda.*
4. **Teléfono en la lista de clientes.** ¿**Enmascarado** («300 ··· 4128») o completo? La lista se abre delante del cliente que está pagando. → *Recomendado: enmascarado en la lista, completo en la ficha.*
5. **Mostrador.** ¿«Cobrar sin cita» y «Agendar cita» como **dos botones fijos** en Turnos, o dentro del «+»? → *Recomendado: dos botones fijos (usted los pidió a la vista el 5-sep); no pierden alcance.*
6. **Ocultar montos.** ¿El ojo tapa **todas** las cifras de plata o solo el número grande? ¿Se recuerda por aparato? → *Recomendado: todas, y sí.*
7. **Foto de la sede en Inicio.** ¿**Tile de 44 px** junto al saludo, o banda con foto detrás del texto? → *Recomendado: tile.*
8. **Permisos en el calendario.** ¿Un barbero puede marcar «No vino»/cancelar la cita de un **colega**, o **solo la suya**? → *Recomendado: solo la suya.*
9. **Catálogo.** ¿Se **crean servicios** desde la app, o solo se edita lo que existe? → *Recomendado: sí, crear. Si es no, el FAB queda como «+ COMBO».*
10. **Equipo.** ¿Se construye **«Ya no trabaja acá»** y el **alta** sigue por SQL? → *Recomendado: sí a la baja, alta por SQL.*
11. **Soporte.** La fila «Soporte» del hub, ¿a quién escribe: WhatsApp de FourG, correo, o no se pone? → *Recomendado: WhatsApp de FourG.*
12. **Teléfono de la sede en lo público.** ¿El pie y schema.org lo **leen de la base** o sigue en el código? → *Recomendado: de la base, pero como **fase 2 aparte**, con respaldo `?? SEDE_INFO` y verificación en vivo: una columna vacía deja el pie sin teléfono y el JSON-LD incompleto.*

---

## 7. Lo que se descarta de WeiBook (y del plan anterior)

| Qué | Por qué |
|---|---|
| Abono / anticipo (% \| $, slider, Billetera) | No hay pasarela ni modelo de pagos. |
| Impuesto por servicio / DIAN | La app no factura electrónicamente. |
| WeiLink, Suscripción, Talento, Calificar App, Crece tu negocio, Contenido para compartir | Son el negocio de WeiBook con sus clientes. |
| Préstamos, historial de depósitos, historial de pagos liquidados | No hay fiado, ni depósitos, ni persistencia de «pagos ya hechos». |
| Grupos de clientes e «Importar contactos» | Tabla nueva + Contact Picker que iOS no soporta. |
| Color en la agenda por servicio | El color ya es por **estado**; dos códigos en la misma celda se anulan. |
| Portafolio, galería y perfil público | Es el sitio público, zona 1:1 del handoff. |
| «Nombre \| Apellido» en dos columnas | `clientes` tiene una sola columna `nombre`; partirlo rompe `unir_clientes`. |
| Grilla desde las 04:00 AM | La agenda arranca en la apertura real de la sede (0048). |
| Inputs de ~72 px | Con el teclado abierto a 360 px entran 3 campos. |
| Negro puro, radios 20–24, azul #1f6fff | Es la marca de WeiBook; se copia la estructura. |
| Etiqueta solo en el ítem activo de la nav | El aparato del mostrador lo rotan barberos nuevos. |
| Campana / centro de notificaciones | No hay avisos in-app: sería un control muerto. |
| «Visitas en tu sitio» y lápiz para elegir KPIs | La analítica vive en Vercel; las 4 cifras son fijas. |
| «Mostrar tiempo» y «Tipo de precio» | El wizard siempre muestra la duración; solo existe el booleano «desde». |
| «Tipo de colaborador» | Acá lo que define a un barbero es el **contrato**. |
| Barra del mes en verde | El verde es `--ok` (estado); el avance del calendario no lo es → `--bar`. |
| Ilustraciones a color en los vacíos | Íconos del set en tile monocromo, que también sirven en tema claro. |
| **FAB que despliega un menú de 2-3 opciones** | Mete un toque a lo más frecuente. Donde hay varias cosas que anotar va el grupo `REGISTRAR` de filas, que además se lee sin abrir nada. |
| **FAB en Equipo** | El alta de barbero queda fuera de la tanda: no habría nada que crear. |
| **Ocultar el h1 de la agenda (`sr-only`)** | El «?» de `AyudaSeccion` envuelve al título (`SectionHeader.tsx:33`): sin título no hay ayuda. Se compacta a 44 px. |
| **Tiles de «Agenda» y «Caja» en los accesos de Inicio** | La nav los tiene fijos; repetirlos gasta 2 de 5 lugares y deja sin atajo a Métricas, Stock y Equipo. |
| **Calendario de mes 6×7 propio** | El `<input type="date">` nativo ya es ese calendario, y es accesible. |
| **Cablear el teléfono público dentro del paso «El local»** | Sale a fase 2 con respaldo: una columna vacía deja el pie y el JSON-LD sin teléfono. No es «cero cambio visual». |

---

## 8. Cómo se mide cada paso

Con `scripts/qa/vista-staff.py` (paso 1) a 375 y 1280 px, contra un build local y con los tres roles, comparando `docs/auditoria-visual/antes-tanda2/metricas.json` → `despues-tanda2/metricas.json`.

**No pueden subir nunca:** `nContrasteMal` = 0 · `textoChico` = 0 · `emojiUI` = 0.

| Medida | Hoy (verificado) | Meta | Paso |
|---|---|---|---|
| Controles < 40 px, móvil | **33** (33 de 33 en Horarios) | 0 | 7 |
| Controles < 40 px, escritorio | **71** (34 Horarios + 37 del topbar: lockup 32, chips 36) | 0 | 3 y 7 |
| Controles que pisan la nav o el FAB (`solapados`) | sin medir | 0 en las 6 pantallas con FAB | 8, 12, 19 |
| Cromo del admin en celular | 146–206 px | ≈60 px | 3 |
| Agenda: `yPrimerDato` (cabecera de barberos) | y≈375 de 844 | ≤270 px | 8 |
| Inicio (Hoy), móvil | **sin línea base** (la corrida falló) | −40 % contra la del paso 1 | 1, 15, 18 |
| Caja (cuadre), móvil | **3.734 px · 48 interactivos** | ≈1.400 px | 14 |
| Productos y stock, móvil | **4.591 px · 107 interactivos** | ≈1.000 px | 19 |
| Equipo, móvil | **4.993 px · 29 botones** | ≈1.100 px | 20 |
| Servicios y precios, móvil | **2.842 px · 74 interactivos** | ≈900 px | 19 |
| Clientes, móvil | **2.193 px** | ≈1.300 px | 12 |
| Etiquetas partidas en la barra del mostrador | 2 | 0 | 4 |
| `nFirmasBoton` / `nRadii` por pantalla | hasta 7 / 6 | ≤3 / ≤3 | 2 + adopción |

> Recordatorio operativo: los deploys se esperan con el MCP de Vercel, no leyendo el HTML; las migraciones van **antes** del deploy que las usan; y las tres verificaciones de RLS se hacen **antes** de escribir la action, no después de que falle en silencio.