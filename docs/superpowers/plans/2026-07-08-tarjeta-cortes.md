# Tarjeta de cortes — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Digitalizar la tarjeta de sellos (10 cortes; 5º = 50%, 10º = gratis, reinicia) integrada al cobro, al portal del cliente y al admin.

**Architecture:** El conteo de cortes se DERIVA de las ventas (ventas del cliente con ≥1 ítem de servicio de corte), sin tabla nueva. La matemática del beneficio es pura y testeable (`tarjeta.ts`). El servidor (`completarReserva`) es la fuente de verdad: calcula el hito, baja el total vía `calcularCobro`, y registra el tipo en una columna nueva `ventas.beneficio_tarjeta`. El portal y el admin muestran el estado; el cobro muestra y aplica el beneficio en vivo.

**Tech Stack:** Next.js 16 App Router (server components + server actions), Supabase (Postgres + RLS), TypeScript, Node type-stripping para los self-checks (sin framework de test).

## Global Constraints

- Código, comentarios y copy en **español (voseo)**. Nada de em/en dashes (— – −) en copy visible.
- Verificación del proyecto: `npx tsc --noEmit` + `npm run build` deben quedar en verde. No hay test runner; los self-checks son scripts Node con `assert` (patrón `scripts/check-*.ts`).
- Migraciones: se versionan como `.sql`; las aplica el usuario o vía Management API. NO romper el orden de despliegue (aplicar la migración ANTES de mergear el código que la usa).
- "Corte" para la tarjeta = servicio de `categoria in ('cortes','combos')` EXCEPTO `cerquillo`, `cerquillos`, `cerquillo-barba`. (Confirmado contra la DB real: los 18 combos empiezan con "Corte + …".)
- Beneficio topado al **precio del corte base de la sede** (`servicio_sede` de `corte`), no al combo; y nunca mayor que la línea de corte de esa venta ni que el bruto.
- Constantes: `TARJETA_SIZE = 10`, `HITO_50 = 5`, `HITO_GRATIS = 10`.
- Los puntos (`puntos_mov`, 1pt/$1.000) NO se tocan: siguen insertándose en el cobro; solo dejan de mostrarse al cliente.

---

### Task 1: Migración — columna `beneficio_tarjeta`

**Files:**
- Create: `supabase/migrations/0024_tarjeta_beneficio.sql`

**Interfaces:**
- Produces: columna `public.ventas.beneficio_tarjeta text` (valores `'50%'` | `'gratis'` | `null`).

- [ ] **Step 1: Escribir la migración**

```sql
-- 0024_tarjeta_beneficio.sql — Barbas & Bigotes
-- Tarjeta de cortes: traza qué beneficio de fidelidad se aplicó en la venta.
-- El conteo de sellos se deriva de las ventas-con-corte (no hay tabla nueva);
-- esta columna es solo para reportes / recibo / admin. NO ejecutar acá: el .sql
-- se versiona y lo aplica el proceso de migración.
alter table public.ventas
  add column if not exists beneficio_tarjeta text; -- '50%' | 'gratis' | null
```

- [ ] **Step 2: Aplicar a prod (Management API) y recargar el schema cache de PostgREST**

```bash
curl -s -X POST "https://api.supabase.com/v1/projects/wvmdsxznujklgfezqtfy/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query":"alter table public.ventas add column if not exists beneficio_tarjeta text; notify pgrst, '"'"'reload schema'"'"';"}'
```
Expected: `[]` (sin error). Verificar: `...ventas?select=beneficio_tarjeta&limit=1` responde 200.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0024_tarjeta_beneficio.sql
git commit -m "feat(tarjeta): migración 0024 columna beneficio_tarjeta en ventas"
```

---

### Task 2: Módulo puro `tarjeta.ts` + self-check

**Files:**
- Create: `src/lib/tarjeta.ts`
- Create: `scripts/check-tarjeta.ts`

**Interfaces:**
- Produces:
  - `TARJETA_SIZE: 10`, `HITO_50: 5`, `HITO_GRATIS: 10`, `CERQUILLO_EXCLUIDOS: Set<string>`.
  - `beneficioProximoCorte(cortesPrevios: number, baseCorte: number): { tipo: "50%" | "gratis" | null; descuento: number; posicion: number }`
  - `estadoTarjeta(cortesTotales: number): { sellos: number; cortesTotales: number; proximo: { tipo: "50%" | "gratis"; faltan: number } }`

- [ ] **Step 1: Escribir el self-check (falla primero)**

```ts
// scripts/check-tarjeta.ts — self-check de la matemática de la tarjeta de cortes.
//   node scripts/check-tarjeta.ts
import assert from "node:assert/strict";
import { beneficioProximoCorte, estadoTarjeta, TARJETA_SIZE } from "../src/lib/tarjeta.ts";

const BASE = 30000;
// 0..3 cortes previos -> el próximo (1º..4º) no tiene beneficio
for (const prev of [0, 1, 2, 3]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null);
// 4 previos -> el próximo es el 5º -> 50%
assert.deepEqual(beneficioProximoCorte(4, BASE), { tipo: "50%", descuento: 15000, posicion: 5 });
// 5..8 previos -> 6º..9º sin beneficio
for (const prev of [5, 6, 7, 8]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null);
// 9 previos -> el próximo es el 10º -> gratis (descuento = base)
assert.deepEqual(beneficioProximoCorte(9, BASE), { tipo: "gratis", descuento: 30000, posicion: 10 });
// 10 previos -> reinicio: el próximo es el 1º del nuevo ciclo, sin beneficio
assert.equal(beneficioProximoCorte(10, BASE).tipo, null);
// 14 previos -> próximo 15º = 5º del 2º ciclo -> 50%
assert.equal(beneficioProximoCorte(14, BASE).tipo, "50%");

// estadoTarjeta: sellos y próximo premio
assert.deepEqual(estadoTarjeta(0), { sellos: 0, cortesTotales: 0, proximo: { tipo: "50%", faltan: 5 } });
assert.deepEqual(estadoTarjeta(3), { sellos: 3, cortesTotales: 3, proximo: { tipo: "50%", faltan: 2 } });
assert.deepEqual(estadoTarjeta(5), { sellos: 5, cortesTotales: 5, proximo: { tipo: "gratis", faltan: 5 } });
assert.deepEqual(estadoTarjeta(9), { sellos: 9, cortesTotales: 9, proximo: { tipo: "gratis", faltan: 1 } });
assert.deepEqual(estadoTarjeta(10), { sellos: 0, cortesTotales: 10, proximo: { tipo: "50%", faltan: 5 } });
assert.equal(TARJETA_SIZE, 10);

console.log("check-tarjeta OK");
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node scripts/check-tarjeta.ts`
Expected: FAIL (`Cannot find module '../src/lib/tarjeta.ts'`).

- [ ] **Step 3: Escribir `tarjeta.ts`**

```ts
// Tarjeta de cortes (fidelización): matemática pura, sin I/O. La usan el cobro
// (completarReserva), el total en vivo del form de cobro, el portal y el admin.
// Mantener libre de imports de Next/Supabase (Node la corre directo en el self-check).
//
// Regla: tarjeta de 10 cortes; el 5º corte del ciclo tiene 50% y el 10º es gratis;
// al completarla se reinicia. 1 sello por venta con corte. El beneficio aplica al
// corte, topado al precio del corte base de la sede.

export const TARJETA_SIZE = 10;
export const HITO_50 = 5; // 5º corte: 50%
export const HITO_GRATIS = 10; // 10º corte: gratis

// Servicios de categoría 'cortes'/'combos' que NO son un corte completo (flequillos).
export const CERQUILLO_EXCLUIDOS = new Set(["cerquillo", "cerquillos", "cerquillo-barba"]);

// Beneficio del PRÓXIMO corte dado cuántos cortes ya hizo el cliente y el precio
// del corte base de la sede. `descuento` es el monto a descontar (topar afuera al
// precio real de la línea de corte de la venta).
export function beneficioProximoCorte(
  cortesPrevios: number,
  baseCorte: number,
): { tipo: "50%" | "gratis" | null; descuento: number; posicion: number } {
  const posicion = (cortesPrevios % TARJETA_SIZE) + 1; // 1..10
  if (posicion === HITO_50) return { tipo: "50%", descuento: Math.floor(baseCorte / 2), posicion };
  if (posicion === HITO_GRATIS) return { tipo: "gratis", descuento: baseCorte, posicion };
  return { tipo: null, descuento: 0, posicion };
}

// Estado de la tarjeta para mostrar: sellos llenos (0..9) y el próximo premio.
export function estadoTarjeta(cortesTotales: number): {
  sellos: number;
  cortesTotales: number;
  proximo: { tipo: "50%" | "gratis"; faltan: number };
} {
  const sellos = cortesTotales % TARJETA_SIZE; // 0..9
  const proximo =
    sellos < HITO_50
      ? { tipo: "50%" as const, faltan: HITO_50 - sellos }
      : { tipo: "gratis" as const, faltan: HITO_GRATIS - sellos };
  return { sellos, cortesTotales, proximo };
}
```

- [ ] **Step 4: Correr y ver que pasa**

Run: `node scripts/check-tarjeta.ts`
Expected: `check-tarjeta OK`

- [ ] **Step 5: Commit**

```bash
git add src/lib/tarjeta.ts scripts/check-tarjeta.ts
git commit -m "feat(tarjeta): módulo puro tarjeta.ts + self-check"
```

---

### Task 3: `calcularCobro` acepta `descuentoExtra`

**Files:**
- Modify: `src/lib/cobro.ts:35-61`
- Modify: `scripts/check-cobro.ts` (agregar caso)

**Interfaces:**
- Consumes: `calcularCobro` (Task existente).
- Produces: `calcularCobro` acepta `descuentoExtra?: number` que se suma al descuento del cupón, con el total combinado topado al bruto. Firma nueva:
  `calcularCobro(input: { items; cupon?; propina?; descuentoExtra?: number }): Cobro`

- [ ] **Step 1: Agregar el caso al self-check de cobro (falla primero)**

En `scripts/check-cobro.ts`, agregar antes del `console.log` final:

```ts
// Beneficio de tarjeta (descuentoExtra) se suma al descuento y topa al bruto.
{
  const c = calcularCobro({ items: [{ precio: 40000, cantidad: 1 }], descuentoExtra: 15000 });
  assert.equal(c.descuento, 15000);
  assert.equal(c.total, 25000);
}
{
  // Cupón + tarjeta combinados, topados al bruto (nunca total negativo).
  const c = calcularCobro({
    items: [{ precio: 30000, cantidad: 1 }],
    cupon: { tipo: "monto", valor: 20000 },
    descuentoExtra: 30000,
  });
  assert.equal(c.descuento, 30000); // topado al bruto
  assert.equal(c.total, 0);
}
```

- [ ] **Step 2: Correr y ver que falla**

Run: `node scripts/check-cobro.ts`
Expected: FAIL (descuento 0 en vez de 15000).

- [ ] **Step 3: Modificar `calcularCobro`**

Reemplazar el cuerpo del cálculo de descuento (líneas ~40-49) por:

```ts
  const bruto = input.items.reduce((a, it) => a + it.precio * it.cantidad, 0);
  let descuentoCupon = 0;
  if (input.cupon) {
    descuentoCupon =
      input.cupon.tipo === "porcentaje"
        ? Math.round((bruto * input.cupon.valor) / 100)
        : input.cupon.valor;
  }
  const descuentoExtra = Number.isFinite(input.descuentoExtra) ? Math.max(0, input.descuentoExtra as number) : 0;
  // Cupón + beneficio de tarjeta; nunca más que el bruto (total jamás negativo).
  const descuento = Math.max(0, Math.min(descuentoCupon + descuentoExtra, bruto));
  const total = Math.max(0, bruto - descuento);
```

Y agregar `descuentoExtra?: number;` al tipo del parámetro `input` de `calcularCobro`.

- [ ] **Step 4: Correr y ver que pasa**

Run: `node scripts/check-cobro.ts`
Expected: `check-cobro OK` (o el mensaje de éxito existente).

- [ ] **Step 5: Commit**

```bash
git add src/lib/cobro.ts scripts/check-cobro.ts
git commit -m "feat(tarjeta): calcularCobro acepta descuentoExtra (beneficio de tarjeta)"
```

---

### Task 4: Queries — conteo de cortes, precio base, tarjeta en getCuenta

**Files:**
- Modify: `src/lib/data/queries.ts` (helpers nuevos + `getCuenta` + `CuentaData`)

**Interfaces:**
- Consumes: `estadoTarjeta` (Task 2).
- Produces:
  - `getCorteIds(sb): Promise<string[]>` — ids de servicios que cuentan como corte.
  - `contarCortesCliente(sb, clienteRef: string): Promise<number>` — nº de ventas del cliente con ≥1 corte.
  - `precioCorteBase(sb, sede: string): Promise<number>` — precio de `corte` en la sede (0 si no hay).
  - `getTarjetaCliente(clienteRef: string): Promise<{ cortesTotales: number; sellos: number; tarjetasCompletas: number; proximo: { tipo: "50%" | "gratis"; faltan: number } }>` — para admin.
  - `getCuenta(clienteRef: string)` (firma cambia: ahora recibe `clienteRef`) devuelve `CuentaData` con `tarjeta: { cortes: number; sellos: number; proximo: { tipo: "50%" | "gratis"; faltan: number } }`. Se conserva `puntosBalance`/`puntos` en el tipo (no se rompen otros consumidores), pero el portal usa `tarjeta`.

> `sb` es el cliente Supabase ya resuelto por el caller (`supabaseServerAuth()` o `supabaseAdmin()`), tipado como el retorno de esos helpers (usar `Awaited<ReturnType<typeof supabaseServerAuth>>`).

- [ ] **Step 1: Agregar los helpers de conteo (arriba de `getCuenta`)**

```ts
import { CERQUILLO_EXCLUIDOS, estadoTarjeta, TARJETA_SIZE } from "@/lib/tarjeta";

type SB = Awaited<ReturnType<typeof supabaseServerAuth>>;

// Ids de servicios que cuentan como "corte" para la tarjeta: categoría cortes/combos
// menos los cerquillos (flequillos). Los combos SIEMPRE incluyen corte ("Corte + …").
export async function getCorteIds(sb: SB): Promise<string[]> {
  const { data } = await sb.from("servicios").select("id").in("categoria", ["cortes", "combos"]);
  return ((data ?? []) as { id: string }[]).map((s) => s.id).filter((id) => !CERQUILLO_EXCLUIDOS.has(id));
}

// Nº de ventas del cliente que incluyeron al menos un corte (1 sello por venta).
export async function contarCortesCliente(sb: SB, clienteRef: string): Promise<number> {
  if (!clienteRef) return 0;
  const corteIds = await getCorteIds(sb);
  if (corteIds.length === 0) return 0;
  const { data } = await sb
    .from("venta_items")
    .select("venta_id, ventas!inner(cliente_ref)")
    .eq("tipo", "servicio")
    .in("ref_id", corteIds)
    .eq("ventas.cliente_ref", clienteRef);
  return new Set(((data ?? []) as { venta_id: string }[]).map((r) => r.venta_id)).size;
}

// Precio del corte base en la sede (para topar el beneficio). 0 si no está priceado.
export async function precioCorteBase(sb: SB, sede: string): Promise<number> {
  const { data } = await sb
    .from("servicio_sede")
    .select("precio")
    .eq("servicio_id", "corte")
    .eq("sede_id", sede)
    .maybeSingle();
  return (data as { precio?: number } | null)?.precio ?? 0;
}

// Estado de la tarjeta para el admin (solo lectura).
export async function getTarjetaCliente(clienteRef: string) {
  const sb = await supabaseServerAuth();
  const cortesTotales = await contarCortesCliente(sb, clienteRef);
  const est = estadoTarjeta(cortesTotales);
  return {
    cortesTotales,
    sellos: est.sellos,
    tarjetasCompletas: Math.floor(cortesTotales / TARJETA_SIZE),
    proximo: est.proximo,
  };
}
```

- [ ] **Step 2: Actualizar `CuentaData` y `getCuenta`**

En el tipo `CuentaData` agregar:
```ts
  tarjeta: { cortes: number; sellos: number; proximo: { tipo: "50%" | "gratis"; faltan: number } };
```
Cambiar la firma a `export async function getCuenta(clienteRef: string): Promise<CuentaData>` y, dentro, agregar el conteo al `Promise.all` (usando el mismo `sb`), y armar `tarjeta`:
```ts
  const cortesTotales = await contarCortesCliente(sb, clienteRef);
  const est = estadoTarjeta(cortesTotales);
  const tarjeta = { cortes: cortesTotales, sellos: est.sellos, proximo: est.proximo };
```
Y agregar `tarjeta` al objeto retornado (mantener `puntosBalance`, `puntos`, `proximas`, `pasadas`, `cola`).

- [ ] **Step 3: Actualizar el caller de `getCuenta`**

En `src/app/cuenta/page.tsx`, `Portal` ya recibe `clienteId`. Cambiar `getCuenta()` por `getCuenta(clienteId)` en el `Promise.all`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 5: Commit**

```bash
git add src/lib/data/queries.ts src/app/cuenta/page.tsx
git commit -m "feat(tarjeta): conteo de cortes + estado de tarjeta en queries/getCuenta"
```

---

### Task 5: `completarReserva` aplica el beneficio + acción `getTarjetaParaCobro`

**Files:**
- Modify: `src/lib/actions.ts` (`completarReserva` + `ActionResult` + nueva acción)

**Interfaces:**
- Consumes: `beneficioProximoCorte` (Task 2), `getCorteIds`/`contarCortesCliente`/`precioCorteBase` (Task 4), `calcularCobro` con `descuentoExtra` (Task 3).
- Produces:
  - `ActionResult` gana `tarjeta?: { cortesTotales: number; posicion: number; beneficio: "50%" | "gratis" | null }`.
  - `getTarjetaParaCobro(clienteRef: string, sede: string): Promise<{ ok: true; cortesPrevios: number; posicion: number; tipo: "50%" | "gratis" | null; descuento: number } | { ok: false }>` — para el preview del form de cobro.

- [ ] **Step 1: Extender `ActionResult`**

Agregar a la unión de `ActionResult` (línea ~14):
```ts
  tarjeta?: { cortesTotales: number; posicion: number; beneficio: "50%" | "gratis" | null };
```

- [ ] **Step 2: Calcular el beneficio en `completarReserva` (antes de `calcularCobro`)**

Justo antes del bloque `const cobro = calcularCobro({...})` (línea ~549), insertar:

```ts
  // Tarjeta de cortes: si la venta incluye un corte y hay cliente, el 5º corte
  // del ciclo va 50% y el 10º gratis (topado al precio del corte base de la sede).
  // El conteo se deriva de las ventas previas; se recomputa acá (fuente de verdad).
  let beneficioTarjeta: "50%" | "gratis" | null = null;
  let descuentoTarjeta = 0;
  let tarjetaPos = 0;
  let cortesPrevios = 0;
  if (input.clienteRef) {
    const corteIds = await getCorteIds(sb);
    const corteItem = items
      .filter((it) => it.tipo === "servicio" && corteIds.includes(it.ref_id as string))
      .sort((a, b) => (b.precio_unitario as number) - (a.precio_unitario as number))[0];
    if (corteItem) {
      cortesPrevios = await contarCortesCliente(sb, input.clienteRef);
      const base = await precioCorteBase(sb, input.sede);
      const b = beneficioProximoCorte(cortesPrevios, base);
      beneficioTarjeta = b.tipo;
      tarjetaPos = b.posicion;
      descuentoTarjeta = Math.min(b.descuento, corteItem.precio_unitario as number);
    }
  }
```

- [ ] **Step 3: Pasar el descuento a `calcularCobro` y registrar el tipo**

Cambiar la llamada a `calcularCobro` para incluir `descuentoExtra: descuentoTarjeta`:
```ts
  const cobro = calcularCobro({
    items: items.map((it) => ({ precio: it.precio_unitario as number, cantidad: it.cantidad as number })),
    cupon,
    propina: input.propina,
    descuentoExtra: descuentoTarjeta,
  });
```
En el `insert` de `ventas` (línea ~615), agregar el campo:
```ts
      beneficio_tarjeta: beneficioTarjeta,
```

- [ ] **Step 4: Devolver el estado de tarjeta post-venta**

Cambiar el `return { ok: true, ... }` final (línea ~706) por:
```ts
  return {
    ok: true,
    total: cobro.total,
    descuento: cobro.descuento,
    propina: cobro.propina,
    puntos,
    tarjeta: beneficioTarjeta !== null || tarjetaPos > 0
      ? { cortesTotales: cortesPrevios + (tarjetaPos > 0 ? 1 : 0), posicion: tarjetaPos, beneficio: beneficioTarjeta }
      : undefined,
  };
```

- [ ] **Step 5: Nueva acción `getTarjetaParaCobro` (para el preview del form)**

Agregar (cerca de `getDisponibilidad`/acciones de staff; requiere `requireStaff`):
```ts
export async function getTarjetaParaCobro(
  clienteRef: string,
  sede: string,
): Promise<{ ok: true; cortesPrevios: number; posicion: number; tipo: "50%" | "gratis" | null; descuento: number } | { ok: false }> {
  const sb = await supabaseServerAuth();
  const denied = await requireStaff(sb);
  if (denied || !clienteRef) return { ok: false };
  const cortesPrevios = await contarCortesCliente(sb, clienteRef);
  const base = await precioCorteBase(sb, sede);
  const b = beneficioProximoCorte(cortesPrevios, base);
  return { ok: true, cortesPrevios, posicion: b.posicion, tipo: b.tipo, descuento: b.descuento };
}
```
Agregar los imports arriba del archivo:
```ts
import { beneficioProximoCorte } from "@/lib/tarjeta";
import { getCorteIds, contarCortesCliente, precioCorteBase } from "@/lib/data/queries";
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit`
Expected: sin errores.

- [ ] **Step 7: Commit**

```bash
git add src/lib/actions.ts
git commit -m "feat(tarjeta): completarReserva aplica el beneficio + getTarjetaParaCobro"
```

---

### Task 6: Portal — card "Tarjeta de cortes" reemplaza puntos

**Files:**
- Modify: `src/app/cuenta/page.tsx` (bloque de puntos → tarjeta)

**Interfaces:**
- Consumes: `getCuenta(clienteRef)` que ahora trae `tarjeta` (Task 4).

- [ ] **Step 1: Reemplazar el `<section>` de "Puntos de fidelidad"**

Sustituir el bloque de puntos (el `<section>` con "Puntos de fidelidad" y `puntosBalance`) por la tarjeta de cortes. Desestructurar `tarjeta` de `getCuenta` en `Portal`. Markup:

```tsx
{/* Tarjeta de cortes (reemplaza puntos): sellos reales derivados de las ventas */}
<section
  className="mb-8 rounded-2xl border border-line p-5"
  style={{ background: "linear-gradient(155deg, #1c1714, var(--panel))" }}
>
  <div className="flex items-center justify-between">
    <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
      Tarjeta de cortes
    </div>
    <span className="font-display text-sm font-bold tabular-nums text-accent-soft">
      {tarjeta.sellos}/10
    </span>
  </div>
  <div className="mt-4 grid grid-cols-5 gap-2.5" aria-hidden>
    {Array.from({ length: 10 }).map((_, i) => {
      const lleno = i < tarjeta.sellos;
      const hito = i === 4 || i === 9; // 5º y 10º
      return (
        <span
          key={i}
          className={`flex aspect-square items-center justify-center rounded-full border ${
            lleno ? "border-accent bg-accent/20 text-accent-soft" : hito ? "border-accent/40 text-muted" : "border-line text-muted/50"
          }`}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
            <circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" />
            <path d="M8.1 8.1 20 20M8.1 15.9 20 4M12 12l3 3" />
          </svg>
        </span>
      );
    })}
  </div>
  <p className="mt-4 text-sm text-muted">
    {tarjeta.proximo.tipo === "50%" ? (
      <>Faltan <b className="text-accent-soft">{tarjeta.proximo.faltan} corte{tarjeta.proximo.faltan === 1 ? "" : "s"}</b> para el <b className="text-ink">50%</b>.</>
    ) : (
      <>Faltan <b className="text-accent-soft">{tarjeta.proximo.faltan} corte{tarjeta.proximo.faltan === 1 ? "" : "s"}</b> para tu <b className="text-ink">corte gratis</b>.</>
    )}
  </p>
</section>
```

- [ ] **Step 2: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde; `/cuenta` en la tabla de rutas.

- [ ] **Step 3: Commit**

```bash
git add src/app/cuenta/page.tsx
git commit -m "feat(tarjeta): card de tarjeta de cortes en el portal (reemplaza puntos)"
```

---

### Task 7: Cobro del barbero — aviso + total con beneficio + "¡Cobrado!"

**Files:**
- Modify: `src/components/barbero/AgendaList.tsx` (`CheckoutForm` + pantalla de resumen)

**Interfaces:**
- Consumes: `getTarjetaParaCobro` (Task 5), `ActionResult.tarjeta` (Task 5).

- [ ] **Step 1: Traer el estado de tarjeta al abrir el cobro de una reserva con cliente**

En `CheckoutForm`, agregar estado y efecto (solo cobro de reserva con `reserva?.clienteRef`):
```tsx
const [tarjeta, setTarjeta] = useState<{ tipo: "50%" | "gratis" | null; descuento: number } | null>(null);
useEffect(() => {
  if (!reserva?.clienteRef) return;
  let vivo = true;
  getTarjetaParaCobro(reserva.clienteRef, reserva.sede).then((r) => {
    if (vivo && r.ok && r.tipo) setTarjeta({ tipo: r.tipo, descuento: r.descuento });
  });
  return () => { vivo = false; };
}, [reserva?.clienteRef, reserva?.sede]);
```
Importar `getTarjetaParaCobro` de `@/lib/actions` y `useEffect` de React.

- [ ] **Step 2: Incluir el beneficio en el total en vivo**

Calcular el descuento efectivo (topado al precio del corte fijo de la reserva) y pasarlo a `calcularCobro`:
```tsx
const descuentoTarjeta = tarjeta && precioFijo != null ? Math.min(tarjeta.descuento, precioFijo) : 0;
```
Agregar `descuentoExtra: descuentoTarjeta` al objeto que se pasa a `calcularCobro` (en `const vivo = calcularCobro({...})`).

- [ ] **Step 3: Aviso del beneficio arriba de la barra de cobro**

Antes del bloque `sticky` de cobro, si `tarjeta`:
```tsx
{tarjeta && (
  <div className="mx-4 mb-2 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/[0.08] px-3.5 py-2.5 text-sm text-accent-soft">
    <span aria-hidden>🎫</span>
    <span>
      {tarjeta.tipo === "gratis" ? "Corte #10: ¡corte gratis!" : "Corte #5: 50% en el corte"}
      {" "}· −{cop(descuentoTarjeta)}
    </span>
  </div>
)}
```

- [ ] **Step 4: Mostrar la tarjeta en el "¡Cobrado!"**

En la pantalla de `resumen`, si `resumen` incluyó tarjeta, mostrar el avance. Guardar la tarjeta del `ActionResult` al setear `resumen` (agregar `tarjeta` al estado `resumen`), y renderizar:
```tsx
{resumen.tarjeta && (
  <div className="mt-2 text-sm text-accent-soft">
    🎫 {resumen.tarjeta.beneficio === "gratis" ? "¡Corte gratis aplicado! Tarjeta completa." : resumen.tarjeta.beneficio === "50%" ? "50% aplicado (corte #5)." : `Corte ${((resumen.tarjeta.cortesTotales - 1) % 10) + 1}/10 de su tarjeta.`}
  </div>
)}
```
Ajustar el tipo del estado `resumen` para incluir `tarjeta?: ActionResult["tarjeta"]` y setearlo desde `res.tarjeta`.

- [ ] **Step 5: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 6: Commit**

```bash
git add src/components/barbero/AgendaList.tsx
git commit -m "feat(tarjeta): aviso + beneficio en vivo en el cobro y en el ¡Cobrado!"
```

---

### Task 8: Admin — estado de tarjeta en el detalle del cliente

**Files:**
- Modify: `src/components/admin/ClienteDetalle.tsx`
- Modify: `src/app/admin/clientes/[id]/page.tsx` (pasar la tarjeta si el detalle se arma en el server)

**Interfaces:**
- Consumes: `getTarjetaCliente(clienteRef)` (Task 4).

- [ ] **Step 1: Cargar la tarjeta donde se arma `ClienteDetalle`**

En el server component que renderiza `ClienteDetalle` (page de `/admin/clientes/[id]`), llamar `getTarjetaCliente(id)` y pasarlo como prop `tarjeta` (agregar a las props del componente el tipo correspondiente).

- [ ] **Step 2: Bloque de solo lectura en `ClienteDetalle`**

Agregar cerca del bloque de puntos existente:
```tsx
<div className="rounded-xl border border-line bg-panel p-4">
  <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">Tarjeta de cortes</div>
  <div className="mt-1 flex items-baseline gap-2">
    <span className="font-display text-2xl font-bold tabular-nums">{tarjeta.sellos}/10</span>
    <span className="text-xs text-muted">
      · {tarjeta.tarjetasCompletas} completada{tarjeta.tarjetasCompletas === 1 ? "" : "s"} · próximo: {tarjeta.proximo.tipo === "50%" ? "50%" : "corte gratis"} en {tarjeta.proximo.faltan}
    </span>
  </div>
</div>
```

- [ ] **Step 3: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: verde.

- [ ] **Step 4: Commit**

```bash
git add src/components/admin/ClienteDetalle.tsx src/app/admin/clientes/[id]/page.tsx
git commit -m "feat(tarjeta): estado de la tarjeta en el detalle del cliente (admin)"
```

---

### Task 9: Validación integral

**Files:** (ninguno nuevo; verificación)

- [ ] **Step 1: Self-checks puros**

Run: `node scripts/check-tarjeta.ts && node scripts/check-cobro.ts`
Expected: ambos OK.

- [ ] **Step 2: Verificar que los IDs de corte existen en la DB (no drift)**

Run:
```bash
curl -s -X POST "https://api.supabase.com/v1/projects/wvmdsxznujklgfezqtfy/database/query" \
  -H "Authorization: Bearer $SUPABASE_PAT" -H "Content-Type: application/json" \
  -d '{"query":"select count(*) as cortes from public.servicios where categoria in ('"'"'cortes'"'"','"'"'combos'"'"') and id not in ('"'"'cerquillo'"'"','"'"'cerquillos'"'"','"'"'cerquillo-barba'"'"');"}'
```
Expected: `cortes` ≥ 20 (los 4 cortes + los combos).

- [ ] **Step 3: Gate del proyecto**

Run: `npx tsc --noEmit && npm run build`
Expected: verde, `/cuenta`, `/barbero`, `/admin/clientes/[id]` en la tabla de rutas.

- [ ] **Step 4: Smoke guiado en dev**

`npm run dev`; con un cliente de prueba fidelizado, cobrar 5 ventas con corte y verificar: en la 5ª el aviso "🎫 Corte #5: 50%" y el total baja `floor(base/2)`; el portal muestra `5/10` y "faltan 5 para corte gratis". Repetir hasta la 10ª: aviso "corte gratis", total baja `base`, y el portal vuelve a `0/10`. (Manual; documentar resultado.)

- [ ] **Step 5: Aplicar migración 0024 a prod ANTES del merge** (si no se hizo en Task 1 Step 2), con `notify pgrst reload schema`, y verificar `ventas?select=beneficio_tarjeta` → 200.

- [ ] **Step 6: Merge a main + deploy**

```bash
git checkout main && git merge --ff-only spec/tarjeta-cortes && git push origin main
```
Verificar deploy live (`/api/health` ok) y el portal mostrando la tarjeta.

---

## Self-Review

**Spec coverage:**
- Regla (10/5º/10º/reset) → Task 2 (`beneficioProximoCorte`/`estadoTarjeta`). ✓
- Conteo derivado de ventas → Task 4 (`contarCortesCliente`). ✓
- Qué cuenta como corte (categoría − cerquillos) → Task 4 (`getCorteIds`) + Task 2 (`CERQUILLO_EXCLUIDOS`). ✓
- Beneficio topado al corte base → Task 5 (`descuentoTarjeta = min(b.descuento, corteItem/precioFijo)`). ✓
- Columna `beneficio_tarjeta` → Task 1. ✓
- Integración de cobro (server fuente de verdad) → Task 5. ✓
- Total en vivo del barbero coincide → Task 7 (preview vía `getTarjetaParaCobro` + `descuentoExtra`). ✓
- Portal tarjeta reemplaza puntos → Task 6. ✓
- "¡Cobrado!" con tarjeta → Task 7. ✓
- Admin solo lectura → Task 8. ✓
- Validación → Task 9. ✓

**Placeholder scan:** sin TBD/TODO; todo el código de las tasks es real. ✓

**Type consistency:** `beneficioProximoCorte` devuelve `{tipo,descuento,posicion}` (usado igual en Tasks 5/7); `estadoTarjeta` devuelve `{sellos,cortesTotales,proximo}` (usado en Tasks 4/6/8); `getTarjetaParaCobro` y `ActionResult.tarjeta` con firmas consistentes entre Tasks 5 y 7. ✓

**Nota de refinamiento vs spec:** el spec proponía una lista fija `CORTE_IDS`; el plan usa detección por categoría (`cortes`/`combos` − cerquillos) para que los combos nuevos cuenten solos. Mismo conjunto de servicios, más robusto ante cambios de catálogo.
