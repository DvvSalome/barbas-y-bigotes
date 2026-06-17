# Onboarding — Barbas & Bigotes

App de gestión y reservas para **Barbas & Bigotes Barbershop**, una barbería con
dos sedes en Barranquilla: Parque Venezuela y Plaza de la Paz. El sitio cubre la
landing pública, el booking de citas, el panel de administración (multi-sede) y
la app del barbero (agenda + walk-in + cobro + historial + lista de espera).
Pagos: registro manual fuera de la app (decisión del cliente).

## Stack y versiones

- **Next.js 16** (App Router) + **React 19** + **TypeScript**.
- **Tailwind v4** — sin `tailwind.config.ts`; los tokens viven en
  `src/app/globals.css` (`@theme inline`).
- **Supabase** (Postgres + Auth + RLS + Storage) — proyecto cloud
  `wvmdsxznujklgfezqtfy`, región us-east-1.
- **n8n** (`n8n.fourgsolutions.com`) para los recordatorios por email.

## Setup local (5 minutos)

```bash
git clone https://github.com/FOURGSOLUTIONS-FGS/barbas-y-bigotes.git
cd barbas-y-bigotes
npm install
```

Crear `.env.local` en la raíz (pedirle los valores a Adrián por canal privado —
no van al repo):

```
NEXT_PUBLIC_SUPABASE_URL=https://wvmdsxznujklgfezqtfy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon JWT>
SUPABASE_SERVICE_ROLE_KEY=<service_role JWT — secreto, server-only>
```

Antes del primer commit, fijar la identidad git **local del repo** para que no
herede la global de la máquina:

```bash
git config user.email "four4gsolutions@gmail.com"
git config user.name "FourG Solutions"
```

(El default del Windows de la oficina suele ser `agarzon@ises.com.co`, y Vercel
rechaza los deploys con ese committer — ya nos pasó.)

Levantar:

```bash
npm run dev   # http://localhost:3000
```

## Accesos que vas a necesitar (pedir a Adrián)

| Recurso | Para qué |
|---|---|
| Invitación al repo `FOURGSOLUTIONS-FGS/barbas-y-bigotes` | Pushear cambios |
| Acceso al proyecto Supabase `wvmdsxznujklgfezqtfy` | Ver/editar schema, migraciones, advisor, Auth |
| Login admin de la app (correo + pass) | Entrar a `/admin` y `/barbero` |
| (Opcional) acceso a n8n | Si tocás el workflow de recordatorios |

## Estructura del código

```
src/
  app/                       # App Router
    page.tsx                 # Landing (hero, sedes, galería, testimonios)
    reservar/page.tsx        # Wizard público de booking
    barbero/                 # App del barbero (protegida)
      layout.tsx             # getUser() → redirect /login si no hay sesión
      page.tsx               # Agenda + EsperaPanel
    admin/                   # Panel admin (protegido)
      layout.tsx
      page.tsx               # Resumen (KPIs reales)
      cuadre/                # Cuadre de caja por sede
      precios/               # Precios por sede
      inventario/            # Productos + descuento de stock
      comisiones/            # Tabla de comisiones
    login/page.tsx
  components/
    BookingWizard.tsx        # Wizard con disponibilidad real
    barbero/
      AgendaList.tsx         # Cola unificada (reservas + walk-ins)
      EsperaPanel.tsx        # Lista de espera + acciones
    admin/                   # AdminNav, AdminTopbar, formularios
    home/                    # WhyUs, Testimonios, Ubicacion
  lib/
    supabase/
      client.ts              # Browser client (anon)
      server.ts              # 3 clientes: anon / auth(cookies) / admin(service_role)
    data/
      queries.ts             # Lecturas (incluye getStaffContext)
      types.ts               # Tipos del dominio
      seed.ts                # Seed estático (todavía lo usa la landing)
    actions.ts               # Server actions ("use server") — escrituras
    format.ts                # cop(), helpers
supabase/
  migrations/
    0001_init.sql            # Esquema base
    0002_live_sync_2026-05-25.sql  # Todo lo aplicado por MCP después de 0001
public/                      # Logo, fotos de sedes, galería de cortes
contenido cliente/           # Originales del cliente (gitignored)
```

Para reproducir la base desde cero, aplicar **0001 + 0002** en orden.

## Patrones críticos (no romperlos)

### 1. Tres clientes Supabase

| Cliente | Uso | RLS |
|---|---|---|
| `supabaseServer()` (anon) | Lecturas públicas de catálogos (sedes, servicios, barberos, productos) | Aplica |
| `supabaseServerAuth()` (cookies) | Lecturas/escrituras con sesión de staff | Aplica |
| `supabaseAdmin()` (service_role) | **Server-only.** Flujos públicos sin sesión (crear reserva desde el sitio, `getDisponibilidad`) | Bypassa |

**Nunca exponer `service_role` al cliente.** Va sólo en `.env.local` (sin prefijo
`NEXT_PUBLIC_`) y se usa exclusivamente en server actions de confianza.

### 2. RLS por rol via `is_staff()`

Las 7 tablas operativas (`ventas`, `venta_items`, `gastos`, `adelantos`,
`reservas`, `clientes`, `productos`, `lista_espera`) tienen políticas
`staff_*` que requieren `public.is_staff() = true`. Esa función lee
`profiles.rol` del usuario logueado y devuelve `true` si es `admin` o `barbero`.
Catálogos (sedes, servicios, etc.) siguen abiertos a anon en lectura.

Para que un usuario nuevo escriba, tiene que tener un row en `profiles` con
`auth_id = auth.users.id` y `rol in ('admin','barbero')`.

### 3. Anti doble-reserva (DB-enforced)

Hay un constraint `EXCLUDE` con `btree_gist` en `reservas` que rechaza solapes
del mismo barbero (estados no cancelados). Si el insert dispara `23P01`,
capturalo en la server action y devolvé un mensaje legible — el wizard ya hace
esto y vuelve al paso de horario.

### 4. Disponibilidad real, no fake

El wizard llama `getDisponibilidad({ barberoId, fechaISO })` (server action,
service_role). Devuelve sólo `[{ inicio, fin }]` (sin PII). Nunca volver a
generar slots con hashes determinísticos como en el primer prototipo.

### 5. Filtro de agenda por barbero

`getStaffContext()` lee `rol` + `barbero_id` del logueado. En `/barbero`, si
`rol = 'barbero'` con `barbero_id` no nulo, las queries filtran a su agenda.
Admin (o cualquier rol sin `barbero_id`) ve todo. La verificación se hizo
manualmente cambiando el perfil del admin a `barbero=Meyer` y de vuelta.

## Lo que ya está hecho (verificado end-to-end)

- Landing (hero, banda de stats, sedes, galería, testimonios, ubicación).
- Wizard con disponibilidad real, anti doble-reserva, paso de barbero
  photo-first (foto grande o avatar con inicial), email opcional para
  recordatorios, sin `alert()`.
- Panel admin: resumen con KPIs reales, cuadre de caja por sede, precios,
  inventario (alta + descuento de stock via RPC `decrement_stock`), comisiones.
- App del barbero: cola unificada (reservas + walk-ins), Llegó / Completar /
  No llegó / Historial, lista de espera con Avisar / Asignar / Quitar.
- Auth real Supabase con protección server-side en `/admin` y `/barbero`.
- Recordatorios email via n8n: workflow `🔔 Barbas & Bigotes · recordatorios de
  cita` (id `x8B5l6NbG2supIbH`) ACTIVO, schedule diario 9 a.m. — lee la vista
  `v_recordatorios_pendientes`, envía vía Gmail FourG, marca `reminder_sent`.

## Pendientes (en orden sugerido)

1. **Provisionar 6 cuentas auth de barberos.** Definir esquema de emails (ej.
   `meyer@barbasybigotes.com`), crear los usuarios vía Auth Admin API y
   enlazarlos a `profiles` con `rol='barbero'` + `barbero_id`. La infra de
   filtro ya está lista.
2. **"Leaked password protection"** — toggle manual en Supabase Dashboard →
   Auth → Policies. Un clic, no se puede por código.
3. **Fotos reales de barberos** → subir a Supabase Storage y guardar URL en
   `barberos.foto_url`. El wizard ya tiene `next/image` configurado y el
   dominio `wvmdsxznujklgfezqtfy.supabase.co` está en `remotePatterns` de
   `next.config.ts`.
4. **Cuando haya dominio propio de la barbería**, cambiar el remitente del
   workflow n8n (hoy sale del Gmail FourG, credencial `fgs`).
5. **"Cualquier barbero disponible"** en el wizard — pospuesto hasta tener
   auto-asignación al barbero menos ocupado (para no sobre-reservar).
6. **Capturar `comision_pct` en `venta_items`** al cerrar la venta (el campo
   existe en la tabla pero `completarReserva` no lo setea). Sin esto el
   reporte histórico de comisiones por producto pierde el dato.
7. **Limpiar código muerto**: `BarberRegister.tsx` + `createAtencion`
   (reemplazados por `AgendaList` + `completarReserva`), `getVentasHoy` sin
   llamadores.

## Convenciones del repo

- **Next.js 16 ≠ Next 14**: hay breaking changes (APIs async como
  `searchParams`/`cookies`, `proxy` reemplaza middleware, etc.). Ver
  [AGENTS.md](AGENTS.md). Cuando tengas duda, leé `node_modules/next/dist/docs/`
  local antes de inventar.
- **Tailwind v4 sin `tailwind.config`**: los tokens viven en `globals.css`
  dentro de `@theme inline`. La paleta es **carbón + hueso + rojo barbero**
  (marca propia del cliente, NO la de FourG).
- **Identidad git local**: siempre `four4gsolutions@gmail.com` /
  `FourG Solutions` para este repo. La global de la máquina puede ser
  `@ises.com.co` — eso rompe el deploy en Vercel.
- **Sin emojis en código.** En commits está OK si es algo discreto.
- **`.env*` está en `.gitignore`.** Las keys van como env vars del hosting.
- **Convención de migraciones**: aplicar nuevas con
  `apply_migration` del MCP de Supabase (queda registrada). Si lo hacés vía
  CLI/SQL crudo, después dumpealo a un archivo `00NN_*.sql` en
  `supabase/migrations/`.

## Cómo probar lo que cambiaste

- **Booking**: ir a `/reservar`, completar wizard. Una reserva real se inserta.
  Volvé al mismo barbero/día y el slot debería aparecer tachado.
- **Admin/Barbero**: login con la cuenta admin → `/admin` carga KPIs reales,
  `/barbero` muestra la agenda + el panel de espera. Probar Walk-in →
  Completar → ver `ventas` + `venta_items` + stock decreciente.
- **Recordatorios**: insertar manualmente una reserva con email en la ventana
  18–30 horas, esperar al schedule o disparar el workflow desde la UI de n8n.
  El email sale del Gmail FourG.

## Si te trabás

- El daily del 2026-05-25 del vault de FourG tiene el log completo del estado
  actual con cada decisión. Adrián te lo puede compartir.
- Las decisiones arquitectónicas grandes están en
  `shared/docs/adr/0012-barbas-y-bigotes-app.md` (vault, fuera del repo).
- Pinguea a Adrián.
