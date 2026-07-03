# Seed de demo + Cancelar/Reagendar cita — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sembrar datos de demo realistas y aislados en el proyecto Supabase, y permitir que el cliente cancele/reagende su cita desde `/cuenta` con una ventana mínima de 2 horas.

**Architecture:** El seed es un SQL idempotente tageado (`origen='demo'`) que corre contra el proyecto actual. Cancelar/reagendar son server actions que usan `supabaseAdmin()` (service_role) con chequeo de propiedad en TS —el patrón que ya usa `responderPropuestaAdelanto`— sin migración ni RLS nuevas. La lógica de slots (constantes de horario + cómputo de ocupados) se extrae del `BookingWizard` a un módulo compartido `src/lib/slots.ts` que reusan el wizard y el modal de reagendar.

**Tech Stack:** Next.js 16.2.6 (App Router, webpack), React 19, TypeScript, Tailwind 4, Supabase (Postgres + Auth), `@supabase/supabase-js`.

## Global Constraints

- **Next.js 16 tiene breaking changes.** Antes de escribir código que toque APIs de Next (server actions, `revalidatePath`, server/client components), leer la guía en `node_modules/next/dist/docs/` (regla de `AGENTS.md`).
- **No hay test runner en el repo** (solo `eslint`, `tsc`, `next build`). Verificación de cada task = `npx tsc --noEmit` + `npm run build` + queries SQL + recorrido en navegador. **No agregar** framework de tests (eso es Fase 5, otro spec).
- Dev/build corren con `--webpack` (ya está en los scripts). Dev en puerto `3100`: `npm run dev -- -p 3100`.
- Copy de UI en **español**; dinero en COP vía `cop()` de `src/lib/format.ts`.
- **El seed corre contra el Supabase de PRODUCCIÓN** (`wvmdsxznujklgfezqtfy`, prod aún sin datos reales). **Todo `delete` del seed va filtrado por `origen='demo'`**; jamás un `truncate` ni borrado sin filtro.
- **`CANCELACION_MIN_HORAS = 2`** — constante única en `src/lib/slots.ts`; aplica a cancelar y reagendar.
- Cliente cancela/reagenda vía `supabaseAdmin()` + chequeo de propiedad (`cliente_ref === clienteId`). Sin migración, sin RLS nueva.
- Respetar el constraint `reservas_no_overlap` (EXCLUDE GiST sobre `barbero_id` + `tstzrange(inicio,fin)` donde estado no está en `cancelada/no_show`). El pre-chequeo de solape de reagendar **excluye la propia reserva** (`.not("id","eq",reservaId)`).
- Enlazar cliente↔auth solo por `auth_id`, nunca por email.
- Trabajar en la rama `spec/seed-cancelar-reagendar` (ya creada, con el spec commiteado). Commits frecuentes.

---

### Task 1: Seed de demo idempotente

**Files:**
- Create: `supabase/seed/demo.sql`
- Create: `supabase/seed/README.md`

**Interfaces:**
- Consumes: catálogo existente en la DB (`sedes`, `barberos`, `servicios`, `servicio_sede`). Si falta catálogo, el seed no inventa nada (los inserts de reservas quedan vacíos).
- Produces: filas demo tageadas `clientes.origen='demo'` y sus reservas/ventas/lista_espera/puntos. Sede ids conocidas: `'parque-venezuela'`, `'plaza-de-la-paz'`.

- [ ] **Step 1: Escribir `supabase/seed/demo.sql`**

```sql
-- supabase/seed/demo.sql
-- Seed de demo idempotente para Barbas & Bigotes.
-- Todas las filas quedan tageadas con clientes.origen='demo'.
-- Re-ejecutar este archivo = RESET (borra lo demo y vuelve a sembrar).
-- Corre contra el proyecto actual (prod sin datos reales). NUNCA borra filas no-demo.
-- Auto-fechado: las reservas caen SIEMPRE "hoy" (current_date) en hora local Bogotá.

begin;

-- 1) RESET — borrar SOLO lo demo, en orden de dependencias (FK).
delete from public.puntos_mov         where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.venta_items        where venta_id in (
  select v.id from public.ventas v join public.clientes c on c.id = v.cliente_ref where c.origen = 'demo');
delete from public.ventas             where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.lista_espera       where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.reservas           where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_notas      where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_wallet_mov where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.cliente_resenas    where cliente_ref in (select id from public.clientes where origen = 'demo');
delete from public.clientes           where origen = 'demo';

-- 2) CLIENTES demo (~30) — nombres colombianos, teléfono/email únicos, tag origen='demo'.
insert into public.clientes (nombre, telefono, email, origen, fidelizado)
select n.nombre,
       '+57 30' || lpad((10000000 + (row_number() over ()))::text, 8, '0'),
       lower(replace(n.nombre, ' ', '.')) || '@demo.test',
       'demo',
       (row_number() over ()) % 4 <> 0   -- ~75% fidelizados
from (values
  ('Andrés Gómez'),('Camila Rojas'),('Julián Torres'),('Valentina Díaz'),
  ('Sebastián Ruiz'),('Mariana López'),('Santiago Peña'),('Daniela Castro'),
  ('Mateo Herrera'),('Sofía Vargas'),('Nicolás Mora'),('Isabella Ramírez'),
  ('Samuel Ortiz'),('Gabriela Silva'),('Alejandro Niño'),('Laura Jiménez'),
  ('Emmanuel Pardo'),('Antonia Rincón'),('Tomás Guerrero'),('Salomé Cárdenas'),
  ('David Quintero'),('Manuela Suárez'),('Simón Beltrán'),('Juana Acosta'),
  ('Martín Cabrera'),('Emma Villalba'),('Felipe Naranjo'),('Renata Osorio'),
  ('Joaquín Prieto'),('Elena Fuentes')
) as n(nombre);

-- 3) RESERVAS de hoy: por cada barbero activo, 8 citas cubriendo todos los estados.
--    Servicios ≤ 60 min en slots horarios back-to-back → tstzrange '[)' no se solapa
--    (respeta reservas_no_overlap). Hora local Bogotá vía "at time zone".
do $$
declare
  b      record;
  cli    uuid[];
  ncli   int;
  serv   record;
  base   date := current_date;
  estados text[] := array['completada','completada','en_curso','confirmada','confirmada','pendiente','cancelada','no_show'];
  horas   int[]  := array[9,10,11,13,14,15,16,17];
  i      int;
  idx    int := 0;
begin
  select array_agg(id order by creado_en) into cli from public.clientes where origen = 'demo';
  ncli := coalesce(array_length(cli,1), 0);
  if ncli = 0 then return; end if;

  for b in select id, sede_id from public.barberos where activo = true loop
    for i in 1 .. array_length(estados,1) loop
      -- servicio ≤60min disponible en la sede del barbero, elegido deterministamente
      select s.id as sid, s.duracion_min as dur
        into serv
      from public.servicios s
      join public.servicio_sede ss on ss.servicio_id = s.id and ss.sede_id = b.sede_id
      where s.activo and s.duracion_min <= 60
      order by md5(b.id::text || i::text)
      limit 1;
      continue when serv.sid is null;

      idx := idx + 1;
      insert into public.reservas (sede_id, barbero_id, cliente_ref, servicio_id, inicio, fin, estado, canal)
      values (
        b.sede_id, b.id, cli[1 + (idx % ncli)], serv.sid,
        (base + make_time(horas[i],0,0)) at time zone 'America/Bogota',
        ((base + make_time(horas[i],0,0)) at time zone 'America/Bogota') + (serv.dur || ' minutes')::interval,
        estados[i]::estado_reserva,
        (case when i % 3 = 0 then 'walkin' else 'app' end)::canal_reserva
      );
    end loop;
  end loop;
end $$;

-- 4) VENTAS + venta_items + puntos para las reservas 'completada' de hoy (demo).
insert into public.ventas (sede_id, barbero_id, cliente_ref, reserva_id, medio, total, descuento)
select r.sede_id, r.barbero_id, r.cliente_ref, r.id,
       (case when (row_number() over ()) % 2 = 0 then 'efectivo' else 'datafono' end)::medio_pago,
       coalesce(ss.precio, 25000), 0
from public.reservas r
join public.clientes c on c.id = r.cliente_ref and c.origen = 'demo'
left join public.servicio_sede ss on ss.servicio_id = r.servicio_id and ss.sede_id = r.sede_id
where r.estado = 'completada';

insert into public.venta_items (venta_id, tipo, ref_id, descripcion, cantidad, precio_unitario, comision_pct)
select v.id, 'servicio', r.servicio_id, coalesce(s.nombre,'Servicio'), 1, v.total, 50
from public.ventas v
join public.reservas r on r.id = v.reserva_id
join public.clientes c on c.id = v.cliente_ref and c.origen = 'demo'
left join public.servicios s on s.id = r.servicio_id;

insert into public.puntos_mov (cliente_ref, tipo, puntos, venta_id, nota)
select v.cliente_ref, 'ganado', floor(v.total / 1000.0)::int, v.id, 'Compra (demo)'
from public.ventas v
join public.clientes c on c.id = v.cliente_ref and c.origen = 'demo'
where floor(v.total / 1000.0)::int > 0;

-- 5) LISTA DE ESPERA: 3 clientes demo 'esperando' en parque-venezuela
--    (esa sede tiene cancelaciones → sirve para probar la promoción a 'notificado').
insert into public.lista_espera (sede_id, barbero_id, servicio_id, cliente_ref, cliente_nombre, telefono, estado)
select 'parque-venezuela', null, null, c.id, c.nombre, c.telefono, 'esperando'
from public.clientes c
where c.origen = 'demo'
order by c.creado_en desc
limit 3;

commit;
```

- [ ] **Step 2: Escribir `supabase/seed/README.md`**

````markdown
# Seed de demo

`demo.sql` siembra datos de demostración **idempotentes** y **aislados** (todo tageado
`clientes.origen='demo'`). Re-ejecutarlo borra lo demo anterior y vuelve a sembrar = reset.

## Correr / resetear

Con la CLI de Supabase (proyecto ya linkeado) o el SQL Editor del dashboard:

```bash
# vía psql (usar la connection string del proyecto)
psql "$DATABASE_URL" -f supabase/seed/demo.sql
```

O pegar el contenido en el **SQL Editor** de Supabase y ejecutar.

## Ver el portal del cliente con datos

El portal `/cuenta` filtra por `auth_id` (login Gmail). Para verlo poblado, enlazá una
ficha demo a tu login de prueba (una sola vez, tras loguearte con un Gmail):

```sql
-- reemplazá <AUTH_UID> por el auth.users.id de tu sesión de prueba
update public.clientes
set auth_id = '<AUTH_UID>'
where origen = 'demo' and auth_id is null
order by creado_en
limit 1;
```

Luego, para que esa ficha tenga citas próximas visibles, reasigná algunas reservas demo
futuras a esa ficha (opcional; el seed ya deja reservas en varios clientes).

## Seguridad

El seed **solo** toca filas `origen='demo'`. Nunca borra ni modifica datos reales.
Sede ids usadas: `parque-venezuela`, `plaza-de-la-paz`.
````

- [ ] **Step 3: Ejecutar el seed contra el proyecto**

Correr `demo.sql` (SQL Editor de Supabase o `psql`).
Expected: se ejecuta sin error, `COMMIT` al final.

- [ ] **Step 4: Verificar conteos y estados**

```sql
select estado, count(*) from public.reservas r
  join public.clientes c on c.id = r.cliente_ref and c.origen='demo'
  group by estado order by estado;
select count(*) as clientes_demo from public.clientes where origen='demo';           -- 30
select count(*) as en_espera from public.lista_espera
  where estado='esperando' and cliente_ref in (select id from public.clientes where origen='demo'); -- 3
```
Expected: hay filas en `completada`, `en_curso`, `confirmada`, `pendiente`, `cancelada`, `no_show`; `clientes_demo` = 30; `en_espera` = 3.

- [ ] **Step 5: Verificar idempotencia**

Volver a ejecutar `demo.sql` completo, luego re-correr las queries del Step 4.
Expected: mismos conteos (30 clientes, 3 en espera) — no se duplica nada.

- [ ] **Step 6: Commit**

```bash
git add supabase/seed/demo.sql supabase/seed/README.md
git commit -m "feat(seed): datos de demo idempotentes tageados origen='demo'"
```

---

### Task 2: Extraer lógica de slots a `src/lib/slots.ts`

**Files:**
- Create: `src/lib/slots.ts`
- Modify: `src/components/BookingWizard.tsx` (constantes/funciones locales → import; líneas ~37-79, 191-196, 273-293)

**Interfaces:**
- Produces (consumido por Task 4/5/6 y el wizard):
  - `OPEN: number`, `CLOSE: number`, `STEP: number`, `CANCELACION_MIN_HORAS: number`
  - `DOW: string[]`, `MON: string[]`
  - `fmtTime(min: number): string`
  - `fmtDur(min: number): string`
  - `buildSlots(duracionMin: number): number[]`
  - `computeTaken(params: { slots: number[]; ocupados: { inicio: string; fin: string }[]; day: Date; duracionMin: number }): Set<number>`
  - `nextDays(n: number): Date[]`

- [ ] **Step 1: Crear `src/lib/slots.ts`**

```ts
// Utilidades de agendamiento compartidas (wizard público + reagendar del portal).
// Módulo plano: sin "use client"/"use server"; seguro importar desde ambos lados.

export const OPEN = 9 * 60;   // 09:00
export const CLOSE = 20 * 60; // 20:00
export const STEP = 30;       // minutos entre inicios de slot

// Ventana mínima para cancelar/reagendar online (horas). Regla de negocio única.
export const CANCELACION_MIN_HORAS = 2;

export const DOW = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
export const MON = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export function fmtTime(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  const ap = h < 12 ? "am" : "pm";
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function fmtDur(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

// Slots de inicio válidos (min-desde-medianoche) para un servicio de `duracionMin`.
export function buildSlots(duracionMin: number): number[] {
  const out: number[] = [];
  for (let t = OPEN; t + duracionMin <= CLOSE; t += STEP) out.push(t);
  return out;
}

// Slots ocupados: solapan un rango ocupado, o ya pasaron si `day` es hoy.
export function computeTaken(params: {
  slots: number[];
  ocupados: { inicio: string; fin: string }[];
  day: Date;
  duracionMin: number;
}): Set<number> {
  const { slots, ocupados, day, duracionMin } = params;
  const s = new Set<number>();
  for (const o of ocupados) {
    const oi = new Date(o.inicio);
    const of = new Date(o.fin);
    const startMin = oi.getHours() * 60 + oi.getMinutes();
    const endMin = of.getHours() * 60 + of.getMinutes();
    for (const t of slots) {
      if (t < endMin && t + duracionMin > startMin) s.add(t);
    }
  }
  const now = new Date();
  if (day.toDateString() === now.toDateString()) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    for (const t of slots) if (t <= nowMin) s.add(t);
  }
  return s;
}

export function nextDays(n: number): Date[] {
  const out: Date[] = [];
  const base = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d);
  }
  return out;
}
```

- [ ] **Step 2: Refactor `BookingWizard.tsx` — importar de slots.ts**

En `src/components/BookingWizard.tsx`:

1. Agregar el import (junto a los demás imports del tope). Solo lo que el wizard usa directamente — `OPEN`/`CLOSE` quedan encapsulados en `buildSlots`, no se importan (serían imports sin usar → error de `tsc`):
```ts
import { STEP, DOW, MON, fmtTime, fmtDur, buildSlots, computeTaken, nextDays } from "@/lib/slots";
```
2. **Borrar** las constantes/funciones locales ahora duplicadas: `OPEN`, `CLOSE`, `STEP` (líneas ~37-39), `DOW`, `MON` (~41-42), `fmtTime` (~46-52), `fmtDur` (~54-60), `nextDays` (~70-79). **Dejar** `fotoServicio` (es local del wizard).
3. Reemplazar el `useMemo` de `slots` (~191-196) por:
```ts
  const slots = useMemo(() => (servicio ? buildSlots(servicio.duracionMin) : ([] as number[])), [servicio]);
```
4. Reemplazar el `useMemo` de `taken` (~273-293) por:
```ts
  const taken = useMemo(() => {
    if (!day) return new Set<number>();
    return computeTaken({ slots, ocupados, day, duracionMin: servicio?.duracionMin ?? STEP });
  }, [day, ocupados, slots, servicio]);
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Verificar en navegador que el wizard no cambió**

Con el dev server (`npm run dev -- -p 3100`) abrir `http://localhost:3100/reservar`, elegir sede→barbero→servicio→horario.
Expected: el grid de horarios se ve y se comporta igual que antes (slots ocupados tachados, pasados bloqueados).

- [ ] **Step 5: Commit**

```bash
git add src/lib/slots.ts src/components/BookingWizard.tsx
git commit -m "refactor: extraer lógica de slots a src/lib/slots.ts (compartida)"
```

---

### Task 3: `getCuenta()` devuelve barbero/servicio/duración por cita próxima

**Files:**
- Modify: `src/lib/data/queries.ts` (tipo `CuentaData` ~607-613 y `getCuenta` ~616-653)

**Interfaces:**
- Consumes: nada nuevo.
- Produces: `CuentaData.proximas[]` con campos extra `barberoId: string | null`, `servicioId: string | null`, `duracionMin: number` (además de los actuales). Consumido por Task 6.

- [ ] **Step 1: Extender el tipo `CuentaData.proximas`**

En `src/lib/data/queries.ts`, reemplazar la primera línea del tipo `CuentaData`:
```ts
  proximas: { id: string; inicio: string; estado: string; servicio: string; barbero: string; sede: string; nota: string | null }[];
```
por:
```ts
  proximas: { id: string; inicio: string; estado: string; servicio: string; barbero: string; sede: string; nota: string | null; barberoId: string | null; servicioId: string | null; duracionMin: number }[];
```

- [ ] **Step 2: Extender el `select` y el `map` de reservas en `getCuenta`**

Reemplazar el `select` de reservas:
```ts
    sb.from("reservas").select("id,inicio,estado,sede_id,nota,servicios(nombre),barberos(nombre)").order("inicio", { ascending: false }).limit(40),
```
por:
```ts
    sb.from("reservas").select("id,inicio,estado,sede_id,nota,barbero_id,servicio_id,servicios(nombre,duracion_min),barberos(nombre)").order("inicio", { ascending: false }).limit(40),
```
y el `.map` de `reservas` (el que arma `{ id, inicio, estado, sede, nota, servicio, barbero }`) por:
```ts
  const reservas = ((resR.data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    inicio: r.inicio as string,
    estado: r.estado as string,
    sede: r.sede_id as string,
    nota: r.nota as string | null,
    barberoId: (r.barbero_id as string) ?? null,
    servicioId: (r.servicio_id as string) ?? null,
    duracionMin: (r.servicios as { duracion_min?: number } | null)?.duracion_min ?? 30,
    servicio: (r.servicios as { nombre?: string } | null)?.nombre ?? "—",
    barbero: (r.barberos as { nombre?: string } | null)?.nombre ?? "—",
  }));
```
(Los objetos de `pasadas` cargan los campos extra sin problema; su tipo más angosto los ignora.)

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/data/queries.ts
git commit -m "feat(cuenta): getCuenta expone barberoId/servicioId/duracionMin en proximas"
```

---

### Task 4: Server action `cancelarReservaCliente`

**Files:**
- Modify: `src/lib/cliente-actions.ts` (agregar import de `next/cache` y de `CANCELACION_MIN_HORAS`; nueva función)

**Interfaces:**
- Consumes: `ensureCliente()` (mismo archivo), `supabaseAdmin()` (`@/lib/supabase/server`), `CANCELACION_MIN_HORAS` (`@/lib/slots`).
- Produces: `cancelarReservaCliente(reservaId: string): Promise<{ ok: boolean; error?: string }>`. Consumido por Task 6.

- [ ] **Step 1: Agregar imports al tope de `cliente-actions.ts`**

Debajo de los imports existentes:
```ts
import { revalidatePath } from "next/cache";
import { CANCELACION_MIN_HORAS } from "@/lib/slots";
```

- [ ] **Step 2: Agregar la función `cancelarReservaCliente`**

Al final de `src/lib/cliente-actions.ts`:
```ts
// Cancelar la propia cita (portal cliente). Verifica propiedad y ventana de 2h.
// El trigger trg_notificar_cola promueve al siguiente de la lista de espera al cancelar.
export async function cancelarReservaCliente(
  reservaId: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res } = await admin
    .from("reservas")
    .select("id, cliente_ref, estado, inicio")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as { cliente_ref: string | null; estado: string; inicio: string };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (!["pendiente", "confirmada"].includes(r.estado))
    return { ok: false, error: "Esta cita ya no se puede cancelar." };

  const limite = Date.now() + CANCELACION_MIN_HORAS * 3600_000;
  if (new Date(r.inicio).getTime() <= limite)
    return {
      ok: false,
      error: `Las citas solo se cancelan hasta ${CANCELACION_MIN_HORAS} horas antes. Escribinos por WhatsApp para cancelar sobre la hora.`,
    };

  const { error } = await admin.from("reservas").update({ estado: "cancelada" }).eq("id", reservaId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/cuenta");
  return { ok: true };
}
```

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/lib/cliente-actions.ts
git commit -m "feat(cuenta): server action cancelarReservaCliente (ventana 2h + waitlist)"
```

---

### Task 5: Server action `reagendarReservaCliente`

**Files:**
- Modify: `src/lib/cliente-actions.ts` (nueva función)

**Interfaces:**
- Consumes: `ensureCliente()`, `supabaseAdmin()`, `CANCELACION_MIN_HORAS`, `revalidatePath` (ya importados en Task 4).
- Produces: `reagendarReservaCliente(reservaId: string, inicioISO: string): Promise<{ ok: boolean; error?: string }>`. Consumido por Task 6.

- [ ] **Step 1: Agregar la función `reagendarReservaCliente`**

Al final de `src/lib/cliente-actions.ts`:
```ts
// Reagendar la propia cita. Misma ventana de 2h que cancelar. Pre-chequea solape
// EXCLUYENDO la propia reserva; el constraint reservas_no_overlap es la red real.
export async function reagendarReservaCliente(
  reservaId: string,
  inicioISO: string,
): Promise<{ ok: boolean; error?: string }> {
  const ctx = await ensureCliente();
  if (ctx.estado !== "cliente" || !ctx.clienteId) return { ok: false, error: "No autorizado" };

  const admin = supabaseAdmin();
  const { data: res } = await admin
    .from("reservas")
    .select("id, cliente_ref, estado, inicio, barbero_id, servicio_id")
    .eq("id", reservaId)
    .maybeSingle();
  if (!res) return { ok: false, error: "Reserva no encontrada" };
  const r = res as {
    cliente_ref: string | null; estado: string; inicio: string;
    barbero_id: string | null; servicio_id: string | null;
  };

  if (r.cliente_ref !== ctx.clienteId) return { ok: false, error: "Reserva no encontrada" };
  if (!["pendiente", "confirmada"].includes(r.estado))
    return { ok: false, error: "Esta cita ya no se puede reagendar." };

  const limite = Date.now() + CANCELACION_MIN_HORAS * 3600_000;
  if (new Date(r.inicio).getTime() <= limite)
    return { ok: false, error: `Las citas solo se reagendan hasta ${CANCELACION_MIN_HORAS} horas antes. Escribinos por WhatsApp.` };

  const nuevoInicio = new Date(inicioISO);
  if (nuevoInicio.getTime() <= Date.now()) return { ok: false, error: "Elegí un horario futuro." };

  let dur = 30;
  if (r.servicio_id) {
    const { data: serv } = await admin.from("servicios").select("duracion_min").eq("id", r.servicio_id).maybeSingle();
    dur = (serv as { duracion_min?: number } | null)?.duracion_min ?? 30;
  }
  const nuevoFin = new Date(nuevoInicio.getTime() + dur * 60000);

  // Pre-chequeo de solape del barbero, excluyendo la propia reserva.
  if (r.barbero_id) {
    const { data: clash } = await admin
      .from("reservas")
      .select("id")
      .eq("barbero_id", r.barbero_id)
      .not("estado", "in", "(cancelada,no_show)")
      .not("id", "eq", reservaId)
      .lt("inicio", nuevoFin.toISOString())
      .gt("fin", nuevoInicio.toISOString())
      .limit(1);
    if (clash && clash.length) return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
  }

  const { error } = await admin
    .from("reservas")
    .update({ inicio: nuevoInicio.toISOString(), fin: nuevoFin.toISOString() })
    .eq("id", reservaId);
  if (error) {
    if (error.code === "23P01") return { ok: false, error: "Ese horario ya fue tomado. Elegí otro, por favor." };
    return { ok: false, error: error.message };
  }
  revalidatePath("/cuenta");
  revalidatePath("/barbero");
  return { ok: true };
}
```

- [ ] **Step 2: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 3: Commit**

```bash
git add src/lib/cliente-actions.ts
git commit -m "feat(cuenta): server action reagendarReservaCliente (solape self-excluido)"
```

---

### Task 6: UI `CitaAcciones` (cancelar inline + modal reagendar) en `/cuenta`

**Files:**
- Create: `src/components/cuenta/CitaAcciones.tsx`
- Modify: `src/app/cuenta/page.tsx` (import + render dentro del `.map` de `proximas`)

**Interfaces:**
- Consumes: `cancelarReservaCliente`, `reagendarReservaCliente` (`@/lib/cliente-actions`), `getDisponibilidad` (`@/lib/actions`), `buildSlots/computeTaken/nextDays/fmtTime/DOW/MON/CANCELACION_MIN_HORAS` (`@/lib/slots`), y los campos `barberoId/servicioId/duracionMin/inicio` que ahora expone `getCuenta` (Task 3).
- Produces: componente `<CitaAcciones reservaId barberoId servicioId duracionMin inicio />`.

- [ ] **Step 1: Crear `src/components/cuenta/CitaAcciones.tsx`**

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getDisponibilidad } from "@/lib/actions";
import { cancelarReservaCliente, reagendarReservaCliente } from "@/lib/cliente-actions";
import { DOW, MON, fmtTime, buildSlots, computeTaken, nextDays, CANCELACION_MIN_HORAS } from "@/lib/slots";

const WA_NUM = "573006734799";

export function CitaAcciones({
  reservaId,
  barberoId,
  servicioId,
  duracionMin,
  inicio,
}: {
  reservaId: string;
  barberoId: string | null;
  servicioId: string | null;
  duracionMin: number;
  inicio: string;
}) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const dentroVentana = new Date(inicio).getTime() <= Date.now() + CANCELACION_MIN_HORAS * 3600_000;

  if (dentroVentana) {
    const msg = encodeURIComponent(
      `Hola Barbas & Bigotes, necesito cancelar o cambiar mi cita del ${new Date(inicio).toLocaleString("es-CO", {
        weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      })}.`,
    );
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Faltan menos de {CANCELACION_MIN_HORAS}h — no se puede cancelar online.</span>
        <a
          href={`https://wa.me/${WA_NUM}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 font-semibold text-accent-soft transition hover:bg-accent/15"
        >
          Avisar por WhatsApp
        </a>
      </div>
    );
  }

  async function doCancel() {
    setBusy(true);
    setErr(null);
    const res = await cancelarReservaCliente(reservaId);
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      setErr(res.error ?? "No se pudo cancelar");
      setConfirmCancel(false);
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {!confirmCancel ? (
        <>
          <button
            onClick={() => setRescheduleOpen(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
          >
            Reagendar
          </button>
          <button
            onClick={() => setConfirmCancel(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
          >
            Cancelar
          </button>
        </>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted">¿Cancelar esta cita?</span>
          <button
            onClick={doCancel}
            disabled={busy}
            className="rounded-full bg-accent px-3 py-1.5 font-semibold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {busy ? "…" : "Sí, cancelar"}
          </button>
          <button
            onClick={() => setConfirmCancel(false)}
            disabled={busy}
            className="rounded-full border border-line px-3 py-1.5 text-muted transition hover:text-ink"
          >
            No
          </button>
        </div>
      )}
      {err && <span className="text-xs text-accent-soft">{err}</span>}

      {rescheduleOpen && (
        <ReagendarModal
          reservaId={reservaId}
          barberoId={barberoId}
          duracionMin={duracionMin}
          onClose={() => setRescheduleOpen(false)}
          onDone={() => {
            setRescheduleOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReagendarModal({
  reservaId,
  barberoId,
  duracionMin,
  onClose,
  onDone,
}: {
  reservaId: string;
  barberoId: string | null;
  duracionMin: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const days = nextDays(7);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const slots = buildSlots(duracionMin);
  const taken = day ? computeTaken({ slots, ocupados, day, duracionMin }) : new Set<number>();

  async function pickDay(d: Date) {
    setDay(d);
    setSlot(null);
    setErr(null);
    if (!barberoId) return;
    setCargando(true);
    const r = await getDisponibilidad({ barberoId, fechaISO: d.toISOString() });
    setOcupados(r);
    setCargando(false);
  }

  async function confirmar() {
    if (!day || slot === null) return;
    const nuevo = new Date(day);
    nuevo.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    setSaving(true);
    setErr(null);
    const res = await reagendarReservaCliente(reservaId, nuevo.toISOString());
    setSaving(false);
    if (res.ok) onDone();
    else {
      setErr(res.error ?? "No se pudo reagendar");
      setSlot(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl">Reagendar cita</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted transition hover:text-ink">✕</button>
        </div>

        {!barberoId ? (
          <p className="text-sm text-muted">
            Esta cita no tiene barbero asignado; escribinos por WhatsApp para reagendarla.
          </p>
        ) : (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const active = day?.toDateString() === d.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => pickDay(d)}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2.5 ${
                      active ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"
                    }`}
                  >
                    <span className="text-[11px] uppercase text-muted">{DOW[d.getDay()]}</span>
                    <span className="font-display text-xl">{d.getDate()}</span>
                    <span className="text-[10px] text-muted">{MON[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>

            {!day ? (
              <p className="text-sm text-muted">Elegí un día para ver horarios.</p>
            ) : cargando ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg border border-line/50 bg-bg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((t) => {
                  const isTaken = taken.has(t);
                  const active = slot === t;
                  return (
                    <button
                      key={t}
                      disabled={isTaken}
                      onClick={() => {
                        setSlot(t);
                        setErr(null);
                      }}
                      className={`rounded-lg border py-2.5 text-sm transition ${
                        isTaken
                          ? "cursor-not-allowed border-line/50 text-muted/40 line-through"
                          : active
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line hover:border-accent/50"
                      }`}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            )}

            {err && (
              <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
                {err}
              </div>
            )}

            {slot !== null && (
              <button
                onClick={confirmar}
                disabled={saving}
                className="mt-5 w-full rounded-full bg-accent py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
              >
                {saving ? "Guardando…" : `Confirmar ${fmtTime(slot)}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Wire en `src/app/cuenta/page.tsx`**

1. Agregar import junto a los otros de `@/components/cuenta`:
```ts
import { CitaAcciones } from "@/components/cuenta/CitaAcciones";
```
2. Dentro del `.map` de `proximas`, en el `<div ...>` de la tarjeta de cada cita (el que contiene servicio/fecha/estado), agregar `<CitaAcciones .../>` **después** del bloque de servicio+estado y antes de cerrar la tarjeta. Es decir, la tarjeta pasa de un `flex` horizontal a incluir una fila de acciones abajo:
```tsx
                  <div className="rounded-xl border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{r.servicio}</div>
                        <div className="text-sm text-muted">{fechaLarga(r.inicio)} · {r.barbero}</div>
                      </div>
                      <span className="rounded-full bg-accent/15 px-3 py-1 text-[10px] uppercase tracking-wide text-accent-soft">
                        {ESTADO[r.estado] ?? r.estado}
                      </span>
                    </div>
                    <CitaAcciones
                      reservaId={r.id}
                      barberoId={r.barberoId}
                      servicioId={r.servicioId}
                      duracionMin={r.duracionMin}
                      inicio={r.inicio}
                    />
                  </div>
```
(Reemplaza el `<div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-4">…</div>` actual por este bloque envolvente; el `AdelantoBanner` de más abajo queda igual.)

- [ ] **Step 3: Verificar tipos y build**

Run: `npx tsc --noEmit`
Expected: sin errores.
Run: `npm run build`
Expected: build OK.

- [ ] **Step 4: Commit**

```bash
git add src/components/cuenta/CitaAcciones.tsx src/app/cuenta/page.tsx
git commit -m "feat(cuenta): botones cancelar (inline) y reagendar (modal) con fallback WhatsApp"
```

---

### Task 7: Verificación end-to-end contra el seed

**Files:** ninguno (verificación en navegador + DB).

**Interfaces:**
- Consumes: todo lo anterior + el seed de Task 1.

- [ ] **Step 1: Preparar datos y sesión**

1. Correr `supabase/seed/demo.sql` (reset limpio).
2. `npm run dev -- -p 3100`.
3. Loguearse en `/cuenta` con un Gmail de prueba; enlazar una ficha demo a esa sesión (ver `supabase/seed/README.md`), y reasignar 1-2 reservas demo **futuras** (estado `confirmada`, inicio > ahora+2h) a esa ficha para tener citas cancelables/reagendables:
```sql
update public.reservas
set cliente_ref = (select id from public.clientes where auth_id = '<AUTH_UID>')
where id in (
  select id from public.reservas r join public.clientes c on c.id = r.cliente_ref
  where c.origen='demo' and r.estado='confirmada'
  order by r.inicio desc limit 2
);
```

- [ ] **Step 2: Verificar cancelar → alimenta lista de espera**

En `/cuenta` → *Próximas citas*, cancelar una cita (confirmación inline → "Sí, cancelar").
Expected: la cita desaparece de próximas y aparece en Historial como "Cancelada". En DB, una entrada `esperando` de esa sede pasó a `notificado`:
```sql
select estado, count(*) from public.lista_espera
  where cliente_ref in (select id from public.clientes where origen='demo') group by estado;
```
Expected: aparece al menos 1 en `notificado`.

- [ ] **Step 3: Verificar ventana de 2h (WhatsApp fallback)**

Con una cita cuyo `inicio` esté dentro de las próximas 2h (crear una si hace falta con un `update ... set inicio = now() + interval '1 hour'` sobre una reserva demo de la ficha logueada), recargar `/cuenta`.
Expected: en esa cita NO aparecen los botones cancelar/reagendar, sino el texto "Faltan menos de 2h…" + botón "Avisar por WhatsApp" con enlace `wa.me/573006734799`.

- [ ] **Step 4: Verificar reagendar → libera viejo, ocupa nuevo**

Reagendar una cita futura a otro horario libre.
Expected: el modal muestra slots (ocupados tachados); al confirmar, la cita se mueve. En `/barbero` (logueado como staff) la cita aparece en el nuevo horario. Intentar reagendar a un slot ocupado → error "Ese horario ya fue tomado", sin romper la UI.

- [ ] **Step 5: Verificar idempotencia del seed**

Re-correr `supabase/seed/demo.sql`.
Expected: 30 clientes demo, 3 en espera; sin duplicados; la app sigue consistente.

- [ ] **Step 6: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore: verificación e2e seed + cancelar/reagendar contra datos demo"
```

---

## Notas de verificación / limitaciones conocidas
- El modal de reagendar hereda el horario hardcodeado 9:00–20:00/7 días (mismo que el wizard) hasta Fase 4 (Horarios de barbero). Consistente a propósito.
- `en_curso` en el seed usa una hora fija (11:00), no `now()`, para no arriesgar el constraint de solape; es ilustrativo.
- Enlazar la ficha demo al `auth.uid()` es un paso manual documentado (el OAuth de Google no se automatiza en QA).
