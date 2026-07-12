# Tarjeta de cortes (fidelización) — diseño

Fecha: 2026-07-08 · Estado: aprobado en brainstorming, pendiente review del spec.

## Contexto

La barbería ya usa una **tarjeta de sellos física**: 10 cortes, al 5º un 50% de
descuento y al 10º un corte gratis. Este spec la digitaliza y la integra al cobro
y al portal del cliente. Reemplaza la vista de "puntos" del portal (el ledger
`puntos_mov` de 1pt/$1.000 sigue corriendo por dentro, pero deja de mostrarse al
cliente).

No confundir con: cupones (`cupones`), wallet de dinero (`cliente_wallet_mov`) ni
el ledger de puntos — todos siguen existiendo sin cambios de comportamiento.

## Objetivo

- El cliente ve su tarjeta (X/10) y el próximo premio en `/cuenta`.
- El barbero, al cobrar a un cliente fidelizado con corte, ve y aplica
  automáticamente el beneficio del 5º/10º corte; el total baja solo.
- El dueño ve el estado de la tarjeta de cada cliente en el admin (solo lectura).

## No-objetivos (a propósito)

- Niveles de fidelidad. · Panel admin para editar la regla (es fija). · Referidos.
- Estimado de tiempo en la fila. · Canje de "puntos" por catálogo (se descarta el
  modelo de puntos-catálogo; la tarjeta lo reemplaza).

## La regla

- Tarjeta de **10 cortes**; al completarse **se reinicia** (ciclo infinito).
- **5º corte del ciclo → 50%** de descuento sobre el corte.
- **10º corte del ciclo → gratis** (descuento = valor de un corte), y reinicia a 0.
- **1 sello por venta** que incluya al menos un corte (máx. 1 por venta).
- El beneficio aplica **solo al corte**, topado al **precio del corte base de la
  sede** (servicio `corte` en esa sede), NO al combo completo.
  - 5º: `descuento = floor(base / 2)`
  - 10º: `descuento = base`
  - `base` = precio del servicio `corte` en la sede de la venta.
  - El descuento se topa además al precio de la línea de corte de esa venta y al
    bruto (nunca deja el total en negativo — ya lo garantiza `calcularCobro`).

## Qué cuenta como "corte"

Lista fija de `servicio_id` en un módulo nuevo `src/lib/tarjeta.ts` (como las
constantes de `slots.ts`), sin migración ni columna nueva. Cuentan:

`corte`, `corte-barba`, `corte-cejas`, `corte-barba-cejas`, `cerquillo-barba`, y
**todos los `combo-*`** (todos incluyen corte).

NO cuentan: barba sola, faciales, capilar/tinturas, depilación, cejas sueltas,
cerquillos solos, productos.

> Ajustable en una línea si el dueño quiere sumar/quitar un servicio.

## Modelo de datos

**Sin tabla nueva.** El conteo se deriva de las ventas (fuente única de verdad):

```
cortesTotales(clienteRef) =
  count(ventas v where v.cliente_ref = clienteRef
        and exists (venta_items vi where vi.venta_id = v.id
                    and vi.tipo = 'servicio' and vi.ref_id = any(CORTE_IDS)))
```

- Posición en la tarjeta actual = `cortesTotales mod 10` (0..9 sellos llenos).
- El corte que se está por cobrar será el nº `cortesTotales + 1` del histórico;
  su posición en el ciclo = `((cortesTotales) mod 10) + 1` (1..10).
- Hito: si esa posición == 5 → 50%; si == 10 → gratis (y el ciclo reinicia solo,
  porque `10 mod 10 = 0`).

**Una columna nueva** para trazabilidad del beneficio aplicado:

```sql
-- migración 0024_tarjeta_beneficio.sql
alter table public.ventas
  add column if not exists beneficio_tarjeta text; -- '50%' | 'gratis' | null
```

Se llena en el cobro cuando se aplica el beneficio. Sirve para reportes y para
que el recibo/admin lo muestren. NO cambia el conteo (el conteo mira los ítems,
no esta columna).

## Constantes — `src/lib/tarjeta.ts`

```
export const TARJETA_SIZE = 10;
export const HITO_50 = 5;      // 5º corte: 50%
export const HITO_GRATIS = 10; // 10º corte: gratis
export const CORTE_IDS = ["corte","corte-barba","corte-cejas","corte-barba-cejas",
  "cerquillo-barba","combo-silver","combo-gold","combo-barba-silver",
  "combo-barba-gold","combo-cera","combo-barba-cera","combo-hidratacion",
  "combo-barba-hidratacion"]; // se confirma contra el catálogo real de la DB

// Puro y testeable: dada la posición previa (cortes ya hechos) y el precio base
// del corte en la sede, devuelve el beneficio del PRÓXIMO corte.
export function beneficioProximoCorte(cortesPrevios: number, baseCorte: number):
  { tipo: "50%" | "gratis" | null; descuento: number } { ... }
```

`CORTE_IDS` se valida en build/arranque contra el catálogo (un test comprueba que
todos existen en la DB seed) para que un rename de servicio no lo rompa en silencio.

## Integración con el cobro (`completarReserva` + `calcularCobro`)

Servidor = fuente de verdad. `calcularCobro` sigue puro; se le agrega un input
opcional `beneficioTarjeta: number` (monto de descuento) que se suma al descuento
del cupón antes del tope al bruto. La trazabilidad (`beneficio_tarjeta` texto) la
setea `completarReserva`.

Flujo en `completarReserva` (solo si `clienteRef` presente y venta con corte):
1. Contar `cortesPrevios` del cliente (query derivada, con `supabaseAdmin`/auth
   según el contexto de escritura ya usado).
2. `base` = precio de `corte` en la sede de la venta.
3. `beneficioProximoCorte(cortesPrevios, base)` → `{ tipo, descuento }`.
4. Pasar `descuento` a `calcularCobro`; registrar `beneficio_tarjeta = tipo`.
5. Devolver en el `ActionResult` el estado de tarjeta post-venta para el "¡Cobrado!".

Idempotencia: el `idem_token` ya evita doble venta; como el conteo deriva de las
ventas y el beneficio se recomputa del conteo, no hay doble aplicación posible.

UI del cobro (`AgendaList` → `CheckoutForm`): al abrir el cobro de un cliente con
`clienteRef`, se trae su estado de tarjeta (nueva query) y se muestra un aviso
"🎫 Corte #5 · −50%" / "🎫 Corte #10 · ¡gratis!". El total en vivo
(`calcularCobro` en el cliente) incluye el mismo `beneficioTarjeta` para que el
número que cobra el barbero coincida con el del servidor. El beneficio va
**aplicado por defecto** (no se puede olvidar); no hay toggle en v1.

## UI del cliente (`/cuenta`)

- El card de "Puntos de fidelidad" se **reemplaza** por **Tarjeta de cortes**:
  - 10 sellos (íconos de tijera): llenos = `cortesTotales mod 10`.
  - Texto del próximo premio: si posición < 5 → "Faltan N para 50%"; si 5..9 →
    "Faltan N para corte gratis".
  - CTA "Reservar" se mantiene.
- Los puntos abstractos ya no se muestran. `getCuenta` deja de exponer
  `puntosBalance` al portal y expone `tarjeta: { cortes: number, posicion: number,
  proximo: {...} }` (nueva forma). El ledger sigue insertándose en el cobro.

## UI del barbero

- "¡Cobrado!" muestra "🎫 Corte X/10" (o "¡Corte gratis aplicado!") en vez de
  "+N puntos".
- Nada más cambia del flujo de cobro.

## Admin

- En `/admin/clientes/[id]` (`ClienteDetalle`), agregar un bloque de solo lectura
  con el estado de la tarjeta (X/10 y cuántas tarjetas completó). Sin edición.

## Archivos afectados

- `supabase/migrations/0024_tarjeta_beneficio.sql` (nuevo) — columna + comentario.
- `src/lib/tarjeta.ts` (nuevo) — constantes + `beneficioProximoCorte` (puro).
- `src/lib/cobro.ts` — input opcional `beneficioTarjeta` en `calcularCobro`.
- `src/lib/actions.ts` — `completarReserva`: contar cortes, aplicar beneficio,
  registrar, devolver estado de tarjeta.
- `src/lib/data/queries.ts` — `getCuenta` (tarjeta en vez de puntos), nueva query
  `getTarjetaCliente(clienteRef)` para el cobro y el admin.
- `src/app/cuenta/page.tsx` — card Tarjeta de cortes.
- `src/components/barbero/AgendaList.tsx` — aviso de beneficio en el cobro +
  "¡Cobrado!" con tarjeta.
- `src/components/admin/ClienteDetalle.tsx` — bloque de tarjeta (solo lectura).
- `scripts/check-tarjeta.ts` (nuevo) — self-check de la matemática (ver abajo).

## Validación ("que quede bien integrado")

1. **Unit (puro):** `scripts/check-tarjeta.ts` con asserts sobre
   `beneficioProximoCorte`:
   - cortesPrevios 0..3 → sin beneficio.
   - 4 (próximo = 5º) → `50%`, descuento = floor(base/2).
   - 5..8 → sin beneficio.
   - 9 (próximo = 10º) → `gratis`, descuento = base.
   - 10 (próximo = 11º = 1º del nuevo ciclo) → sin beneficio (reinicio).
   - Tope: descuento nunca > base ni > línea de corte.
2. **Integración de conteo:** un test que arma ventas con/sin corte y verifica que
   `CORTE_IDS` existen en el catálogo y que el conteo derivado coincide.
3. **`tsc --noEmit` + `npm run build`** limpios (gate del proyecto).
4. **Smoke en dev:** cobrar un cliente de prueba 5 veces y verificar que en la 5ª
   baja el 50% y en la 10ª queda gratis; que el portal muestra X/10 correcto; que
   el "¡Cobrado!" refleja el avance. (Manual, guiado.)
5. **Migración aplicada** a prod antes del deploy (columna `beneficio_tarjeta`), con
   `notify pgrst reload schema`.

## Riesgos / decisiones

- **Historial previo:** el conteo respeta las ventas-con-corte ya existentes; un
  cliente con 9 cortes previos recibe el gratis en el próximo. Aceptado (es justo).
- **Definición de "corte" por lista fija:** si el dueño renombra/crea un servicio
  de corte nuevo, hay que sumarlo a `CORTE_IDS` (lo cubre el test de existencia).
- **Beneficio auto sin toggle:** elegido para que el barbero no se lo olvide; si en
  el piloto piden poder declinarlo, se agrega un toggle en v2.
