# Spec 1 — Seed de demo + Cancelar/Reagendar cita (cliente)

**Fecha:** 2026-07-03
**Estado:** Diseño aprobado, pendiente de revisión del spec escrito
**Alcance:** Primer spec del roadmap de agendamiento/inventario/UX. Cubre **Fase 0** (base de simulación) + **Fase 1** (cancelar/reagendar del portal cliente).

## Contexto

Barbas & Bigotes es una app de gestión de barbería (Next.js 16 + Supabase + Vercel), multi-sede, en español. El flujo de reserva pública, el cobro del barbero, walk-ins y lista de espera ya funcionan. Este spec ataca dos huecos:

1. **No hay datos de demo/prueba.** No existe seed de clientes/reservas/ventas; la base solo tiene el catálogo real (sedes, barberos, servicios, productos). Sin datos no se puede demostrar la app ni recorrer flujos de QA.
2. **El cliente no puede cancelar ni reagendar** su cita desde `/cuenta`. La confirmación de reserva dice "avisanos si no podés asistir" pero no hay botón — hoy es 100% WhatsApp manual. Es justo la acción que dispara el aviso "se liberó un cupo" de la lista de espera.

### Decisiones de producto ya tomadas
- **Aislamiento del demo:** filas demo tageadas en el proyecto Supabase **actual** (`wvmdsxznujklgfezqtfy`). Confirmado por el usuario: prod aún **no** tiene reservas/clientes reales de la barbería. El reset borra solo lo tageado.
- **Orden del roadmap** (specs siguientes, fuera de este documento): Fase 2 Inventario (reponer/ajustar + kardex) → Fase 3 Pulido UI/UX + fix "adelanto" → Fase 4 Horarios de barbero → Fase 5 Tests E2E (Playwright).

## Hechos del esquema que condicionan el diseño

- `reservas`: usa **`cliente_ref` → `clientes(id)`** (columna viva), no la vieja `cliente_id → profiles`. Estados: enum `estado_reserva` (`pendiente,confirmada,en_curso,completada,cancelada,no_show`). Canal: `canal_reserva` (`link,app,walkin`).
- **Constraint `reservas_no_overlap`** (EXCLUDE GiST): `barbero_id =` + `tstzrange(inicio,fin) &&` donde `estado not in ('cancelada','no_show')`. Un barbero no puede tener dos reservas activas solapadas. **El seed debe espaciar las reservas por barbero; el reagendar debe excluir la propia fila del pre-chequeo.**
- **RLS del cliente** (`0013`): el cliente logueado (`clientes.auth_id = auth.uid()`) tiene **solo policies de SELECT** sobre lo suyo. No tiene UPDATE. → Cancelar/reagendar van por **server action con `supabaseAdmin()` (service_role) + chequeo de propiedad en TS**, exactamente el patrón que ya usa `responderPropuestaAdelanto` en `src/lib/cliente-actions.ts`. **No requiere migración.**
- **Trigger `trg_notificar_cola`** (`0014`): `after update of estado on reservas`; si `NEW.estado in ('cancelada','no_show')`, promueve al más antiguo `esperando` de esa sede a `notificado`, y la vista `v_avisos_cola_pendientes` + n8n le mandan email. → Cancelar dispara la lista de espera **sin código nuevo**.
- `clientes`: `id, nombre, telefono (unique), email, auth_id (unique), notas, origen ('app'|'walkin'|'registrado'|...), fidelizado, creado_en`. El seed usa `origen='demo'` como tag.
- `puntos_mov`: ledger `tipo ('ganado'|'canjeado')`, `puntos` (positivo), `venta_id`, `cliente_ref`.
- `servicio_sede`: precio por (servicio, sede). El seed toma el precio de acá.
- Precio/duración: `servicios.duracion_min`; `getCuenta()` calcula *próximas* como `inicio >= now && estado in (pendiente,confirmada,en_curso)`.

---

## Fase 0 — Seed de demo

### Formato
Un archivo SQL idempotente: **`supabase/seed/demo.sql`**. Se ejecuta contra el proyecto actual (vía `psql`/Supabase SQL editor/MCP). **Re-ejecutarlo = reset** (borra lo demo y vuelve a sembrar). Auto-fechado con `now()` / `current_date` para que las citas siempre caigan "hoy".

Se acompaña de un pequeño runner documentado en el README del seed (`supabase/seed/README.md`): cómo correrlo y cómo resetear.

### Estructura del script (en orden)
1. **Reset (borrado seguro, solo demo):** dentro de una transacción, borrar en orden de FK:
   - `puntos_mov`, `venta_items` (vía `ventas`), `ventas`, `lista_espera`, `reservas`, `cliente_notas`/`cliente_wallet_mov`/`cliente_resenas` — **solo** filas cuyo `cliente_ref` esté en `(select id from clientes where origen='demo')`.
   - luego `delete from clientes where origen='demo'`.
   - **Nunca** un `truncate` ni borrado sin filtro. Si por seguridad conviene, `delete from reservas where cliente_ref in (…demo…)` garantiza no tocar reservas reales.
2. **Clientes demo (~30):** nombres colombianos creíbles, teléfonos `+57 3xx…` únicos, algunos con email (para que el aviso de cola tenga a quién mandarle), `origen='demo'`, `fidelizado` variado.
3. **Reservas de hoy** repartidas por sede/barbero en todos los estados, **sin solaparse por barbero** (bloques de la duración del servicio, espaciados). Distribución objetivo por barbero: 1-2 `completada` (mañana), 1 `en_curso` (ahora), 2-3 `confirmada` (tarde), 1 `pendiente`, 1 `cancelada` y 1 `no_show` (para poblar huecos y alimentar la cola). `canal` mezclado (`app`/`walkin`).
4. **Lista de espera:** 2-3 entradas `esperando` en una sede que tenga cancelaciones, para ver la promoción a `notificado` al cancelar.
5. **Ventas históricas** (últimos ~7 días) con `venta_items` (servicio + a veces producto) y `puntos_mov` `ganado` coherente (1 punto por cada $1.000 neto, igual que `completarReserva`). Da saldo de puntos visible en `/cuenta` y datos para el cuadre/inventario.

### Seguridad del seed
- Idempotente y acotado por `origen='demo'`; correrlo dos veces deja el mismo estado.
- No inserta catálogo (reusa sedes/barberos/servicios/productos reales; si falta catálogo, falla ruidosamente en vez de inventarlo).
- Las reservas demo se cuelgan de los barberos reales; como prod no tiene reservas reales, no hay riesgo de choque con el constraint. Si algún día aparecen reservas reales, el seed sigue borrando solo lo demo (nunca lo real).

### Cómo un cliente logueado ve datos demo
El portal `/cuenta` filtra por `auth_id`. Para demostrar el portal con un cliente que tiene citas, el seed deja **una fila cliente demo “enlazable”**: documentar en el README que, tras loguearse con un Gmail de prueba, se puede setear `clientes.auth_id` de esa fila demo al `auth.uid()` de ese login (una línea SQL). Alternativa para la demo en vivo: mostrar el portal con el cliente que quede enlazado. (No se automatiza el OAuth; queda como paso manual documentado.)

---

## Fase 1 — Cancelar y reagendar (portal cliente)

Ambas como server actions nuevas en `src/lib/cliente-actions.ts`, con el patrón existente: `supabaseAdmin()` + verificación de propiedad vía `ensureCliente()`.

### Cancelar
```
cancelarReservaCliente(reservaId: string): Promise<{ ok: boolean; error?: string }>
```
1. `ensureCliente()` → si no es `cliente` o sin `clienteId`, `{ ok:false, error:"No autorizado" }`.
2. Leer la reserva con admin: `select id, cliente_ref, estado, inicio`.
3. **Propiedad:** `cliente_ref === ctx.clienteId`; si no, error genérico "Reserva no encontrada".
4. **Guard de estado:** solo cancelable si `estado in ('pendiente','confirmada')` y `inicio > now`. Si ya está `en_curso/completada/cancelada/no_show` → error claro.
5. `update reservas set estado='cancelada' where id=…`.
6. El trigger `trg_notificar_cola` hace el resto (promueve la cola + n8n email). No hacemos nada más.
7. `revalidatePath('/cuenta')`.

### Reagendar
```
reagendarReservaCliente(reservaId: string, inicioISO: string): Promise<{ ok: boolean; error?: string }>
```
1. Autorización + propiedad igual que cancelar.
2. Guard: `estado in ('pendiente','confirmada')` y (nuevo) `inicio > now`.
3. Leer `servicio_id`; obtener `duracion_min` (default 30) → `fin = inicio + dur`.
4. **Pre-chequeo de solape** contra otras reservas activas del mismo barbero, **excluyendo la propia** (`.not('id','eq',reservaId)`), rango `inicio < fin_nuevo && fin > inicio_nuevo`. Si choca → "Ese horario ya fue tomado, elegí otro".
5. `update reservas set inicio=…, fin=… where id=…`. El constraint EXCLUDE es la red real ante carreras (código `23P01` → mismo mensaje).
6. `revalidatePath('/cuenta')`.

### UI (`/cuenta`, sección "Próximas citas")
- Cada cita `proxima` gana dos botones: **Cancelar** y **Reagendar**. Componente cliente nuevo (p.ej. `src/components/cuenta/CitaAcciones.tsx`) porque `cuenta/page.tsx` es server component.
- **Cancelar:** confirmación **inline** (no `alert()` nativo): el botón se transforma en "¿Seguro? Sí / No". Al confirmar, llama la action, muestra estado de carga y `router.refresh()`.
- **Reagendar:** abre un **modal compacto** que reusa `getDisponibilidad(barberoId, día)` — el mismo strip de 7 días + grid de horarios del wizard, con barbero/servicio/sede fijos de la cita. Bloquea slots ocupados y pasados igual que `BookingWizard` (misma lógica `taken`). Al elegir y confirmar, llama `reagendarReservaCliente`.
- Si la cita no tiene `barbero_id` (reserva “cualquiera”), reagendar se deshabilita con nota (fuera de alcance de este spec).
- Reutilización: la lógica de slots (`OPEN/CLOSE/STEP`, `fmtTime`, cómputo de `taken`) se extrae de `BookingWizard.tsx` a un módulo compartido (`src/lib/slots.ts`) para no duplicar; el wizard pasa a importarlo. Cambio mecánico, sin alterar comportamiento.

> Nota: mientras no exista Fase 4 (horarios reales), el modal de reagendar hereda el mismo hardcode 9:00–20:00/7 días del wizard. Correcto y consistente; Fase 4 lo arregla en un solo lugar (`src/lib/slots.ts` + `getDisponibilidad`).

---

## Archivos

**Nuevos**
- `supabase/seed/demo.sql` — seed idempotente tageado.
- `supabase/seed/README.md` — cómo correr/resetear + paso de enlace de cliente demo.
- `src/components/cuenta/CitaAcciones.tsx` — botones cancelar/reagendar + modal.
- `src/lib/slots.ts` — lógica de slots extraída (compartida wizard/reagendar).

**Modificados**
- `src/lib/cliente-actions.ts` — `cancelarReservaCliente`, `reagendarReservaCliente`.
- `src/lib/data/queries.ts` — `getCuenta()` hoy no devuelve `barbero_id/servicio_id/sede_id/duracion_min` por reserva; extender el `select` y el tipo `CuentaData.proximas` para incluirlos (el modal de reagendar los necesita para pintar slots y llamar `getDisponibilidad`).
- `src/app/cuenta/page.tsx` — render de `CitaAcciones` en cada cita próxima (pasa `reservaId`, `barberoId`, `servicioId`, `sedeId`, `duracionMin`).
- `src/components/BookingWizard.tsx` — importa de `src/lib/slots.ts` en vez de constantes locales.

## Plan de verificación (yo, en Chrome, contra el seed)
1. Correr `demo.sql`; verificar que `/barbero` muestra la agenda de hoy poblada y `/admin` KPIs con datos.
2. Enlazar un cliente demo a un login Gmail de prueba; en `/cuenta` ver próximas/pasadas/puntos/cola.
3. **Cancelar** una cita próxima → desaparece de próximas, aparece en historial como "Cancelada", y una entrada `esperando` de esa sede pasa a `notificado` (verificable en DB / y el email si n8n está activo).
4. **Reagendar** una cita → el slot viejo se libera y el nuevo se ocupa; el barbero lo ve movido en `/barbero`; intentar reagendar a un slot ocupado → error claro, sin romper.
5. Re-correr `demo.sql` → estado limpio y reproducible (idempotencia).

## Fuera de alcance (de este spec)
- Horarios/jornada reales del barbero (Fase 4) — el reagendar usa el hardcode actual.
- Cancelar/reagendar del lado staff, o mover citas por el barbero.
- Reagendar citas sin barbero asignado.
- Tests Playwright (Fase 5).
- Ventana mínima de cancelación (p.ej. "no cancelar faltando <2h"): por ahora se permite cancelar/reagendar en cualquier momento antes del inicio, para maximizar cupos liberados. Si el cliente lo pide luego, es un guard de una línea.

## Riesgos / notas
- El seed corre en el proyecto de producción: el borrado **debe** estar filtrado por `origen='demo'` sí o sí. Revisar ese filtro con lupa antes de ejecutarlo.
- Enlazar el cliente demo al `auth.uid()` es manual (OAuth no automatizable en QA); documentado.
- `getCuenta()` lee vía RLS del cliente; confirmar que tras cancelar/reagendar el `revalidatePath('/cuenta')` refresca (server component ya se re-renderiza en `router.refresh()`).
