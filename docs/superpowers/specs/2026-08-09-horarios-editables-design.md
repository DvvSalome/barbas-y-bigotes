# Horarios editables por sede — diseño

**Fecha:** 2026-08-09
**Estado:** aprobado, en implementación

## Problema
El horario (9:00-20:00, lun-sáb, domingo cerrado) está **quemado en el código** (`slots.ts`). El dueño cambia horarios seguido (ej. "este sábado 1:00-4:30"), pero:
- No hay forma de cambiar el horario base sin editar código.
- El módulo "Días especiales" (0034) solo abre/cierra el día **completo** con el 9-8 fijo.
- La tabla `sede_dias_especiales` **ya tiene** `abre_min`/`cierra_min` y `getDiasEspeciales` las lee, pero **NADIE las usa**: ni el admin las guarda, ni `buildSlots` las respeta, ni el servidor valida contra ellas.

## Decisiones (confirmadas con el dueño)
- Ambos: **horario base semanal editable** + **excepciones por fecha** con horas.
- Nivel **SEDE** (quién trabaja se sigue resolviendo con `barbero_ausencias`).
- El cliente lo ve **al reservar** (turnos reales) **y** en un bloque **"Horarios de atención"** público.
- **Una sola franja continua** por día (no cierre al mediodía). v2 si hace falta.

## Arquitectura — una sola fuente de verdad
Función pura `horarioEfectivo(fecha, semanal, especiales) → { abierta, abreMin, cierraMin }` en `slots.ts`, usada por **cliente Y servidor** para no desincronizar.
Cascada: **excepción del día** (por fecha) → **base semanal** (por día de semana) → **respaldo** (OPEN/CLOSE actuales, domingo cerrado).

## Datos
- **Nueva** `sede_horario_semanal(sede_id, dow 0..6, abierta, abre_min, cierra_min)`, PK `(sede_id, dow)`. RLS: lectura pública, escritura admin. **Seed** con lo actual (lun-sáb 9-20 abierto, dom cerrado) para que el deploy no cambie nada.
- `sede_dias_especiales`: ya tiene las columnas. Solo cablear.

## Build (orden)
1. **Migración `0048_horario_semanal.sql`**: tabla + RLS + seed ambas sedes. (La aplica el dueño.)
2. **`slots.ts`**: `horarioEfectivo(...)` pura; `buildSlots(duracionMin, abreMin?, cierraMin?)` parametrizada (default OPEN/CLOSE).
3. **`queries.ts`**: `getHorarioSemanal()` + tipo `HorarioSemanal`. (`getDiasEspeciales` ya trae horas.)
4. **`actions.ts`**: `actualizarHorarioSemanal(...)` (admin, con `.select()`); `marcarDiaEspecial` acepta/guarda `abreMin/cierraMin` con validación (abre<cierra, STEP-alineado). `createReserva`/`proponerAdelanto` validan contra la ventana efectiva, no OPEN/CLOSE fijo.
5. **Admin**: pantalla **`/admin/horarios`** con `HorarioSemanalAdmin` (7 días) + `DiasEspecialesAdmin` con campos de hora. Nav actualizada (mover Días especiales acá).
6. **Cliente**: `BookingWizard` y `CitaAcciones` generan turnos con la ventana efectiva del día seleccionado. El servidor ya valida igual (misma función).
7. **Público**: bloque **"Horarios de atención"** (footer) con la semana + excepciones próximas.

## Verificación
- `tsc` + `lint` + `npm test` + build.
- Self-check nuevo en `check-slots` (o `check-horarios`): `horarioEfectivo` resuelve excepción > semanal > respaldo, y `buildSlots` respeta la ventana.
- E2E: cambiar el sábado a 1-4:30 en admin → el wizard solo ofrece esas horas → reservar fuera de rango lo rechaza el servidor.
- Datos de prueba limpiados; valores reales restaurados.

## Riesgos
- **Doble fuente de verdad** cliente/servidor: mitigado con `horarioEfectivo` único.
- El seed debe reflejar EXACTO el comportamiento actual, o el deploy cambia horarios sin querer.
- Vercel bloqueado (ver `vercel-deploy-bloqueado-ago2026`): esto no llega a prod hasta destrabar el deploy.
