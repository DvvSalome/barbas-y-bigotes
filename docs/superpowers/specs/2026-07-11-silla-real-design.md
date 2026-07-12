# Disponibilidad guiada por la silla real — diseño

Fecha: 2026-07-11 · Estado: aprobado (el dueño delegó: "vamos con lo mejor").

## Contexto / problema

Hoy la disponibilidad reserva exactamente la **duración estimada** de cada
servicio. Si una atención se alarga, el calendario dice que el barbero se libera
al `fin` estimado aunque siga cortando, así que una reserva online (o un walk-in)
podría caer en la ventana en la que el barbero todavía está ocupado.

Ya existe el estado real de la silla: el barbero marca **"Llegó"** (`en_curso`) y
**"Completar"** (que abre el cobro → `completada`). Y ya hay **realtime** sobre
`reservas` (el wizard re-consulta al cambiar una reserva).

## Objetivo

Que la disponibilidad online y el estado en vivo ("En silla / Libre") reflejen la
**silla real**: una cita `en_curso` mantiene ocupado al barbero hasta que la cierra,
no solo hasta el fin estimado.

## Regla (decidida)

Bloquear hasta que el barbero marque "Completar", **con red de seguridad** por si se
olvida (marcar "Completar" es cuando cobra, así que rara vez lo olvida, pero el
backstop evita congelarle la agenda).

**Fin efectivo** de una reserva para disponibilidad:
- `estado != en_curso` → el `fin` guardado (sin cambios).
- `en_curso` y `ahora <= fin` → el `fin` guardado (aún dentro del estimado).
- `en_curso` y `ahora > fin` → `min(ahora, fin + GRACIA)` — rueda con el tiempo real
  mientras la silla siga ocupada, con tope `fin + GRACIA` como red de olvido.

`GRACIA = EN_CURSO_GRACIA_MIN = 60` minutos (constante de negocio, tuneable).

## Diseño

Un solo punto de cambio: **`getDisponibilidad`** (`src/lib/actions.ts`), que
alimenta a TODOS los consumidores:
- `components/BookingWizard.tsx` — slots del wizard + estado en vivo "En silla / Libre".
- `components/cuenta/CitaAcciones.tsx` — reagendar del portal.

`getDisponibilidad` ya devuelve `{inicio, fin}[]`. Se agrega `estado` al `select` y
se mapea el `fin` por el fin efectivo. Como todos consumen esos rangos, el arreglo
se propaga solo (slots ocupados + "sale HH:MM").

**Helper puro** en `src/lib/slots.ts` (testeable, sin I/O ni TZ del proceso — usa
instantes absolutos, no minutos-del-día):

```ts
export const EN_CURSO_GRACIA_MIN = 60;

export function finEfectivo(estado: string, finISO: string, ahoraMs: number): string {
  const fin = new Date(finISO).getTime();
  if (estado === "en_curso" && ahoraMs > fin) {
    return new Date(Math.min(ahoraMs, fin + EN_CURSO_GRACIA_MIN * 60000)).toISOString();
  }
  return finISO;
}
```

`getDisponibilidad`:
- `select("inicio,fin,estado")` (agrega `estado`).
- `map((r) => ({ inicio: r.inicio, fin: finEfectivo(r.estado, r.fin, Date.now()) }))`.

## Lo que NO cambia (a propósito)

- El candado duro `reservas_no_overlap` (EXCLUDE/GiST) sigue sobre los **rangos
  guardados** (no tocamos el `fin` en la DB). Esto es una capa de **lectura** que
  hace la disponibilidad online más honesta; el candado sigue previniendo el
  doble-booking físico.
- El barbero puede tomar un walk-in mid-atención si quiere (es el humano al mando);
  el walk-in va contra los rangos guardados + la lista de espera, como hoy.
- La TZ del `computeTaken` client-side (bug conocido, diferido) no se toca acá: los
  instantes que devuelve `finEfectivo` son absolutos; el usuario objetivo está en
  Colombia (UTC-5), donde ya es correcto.

## Realtime

El barbero marca "Completar" → la reserva pasa a `completada` → evento realtime →
el wizard re-consulta `getDisponibilidad` → la silla se libera al instante. Ya
cableado (RealtimeRefresh + poll de respaldo).

## Detalle de UI (menor)

Para una `en_curso` que se pasó del estimado, el "sale HH:MM" del estado en vivo
mostrará ≈ ahora. Es aceptable ("En silla, terminando"). Si molesta, se puede
mostrar "En silla" a secas cuando el fin efectivo == ahora. Fuera del alcance de v1.

## Validación

1. Self-check puro `scripts/check-slots.ts`:
   - `estado != en_curso` (pendiente/confirmada), aunque `ahora > fin` → devuelve `fin` sin cambios.
   - `en_curso`, `ahora < fin` → `fin` sin cambios.
   - `en_curso`, `fin < ahora < fin+GRACIA` → devuelve `ahora`.
   - `en_curso`, `ahora > fin+GRACIA` → devuelve `fin+GRACIA` (tope).
2. `tsc --noEmit` + `npm run build` limpios.
3. Smoke: `/reservar` 200; y (manual) con una cita marcada "Llegó" que se pase del
   estimado, el barbero queda ocupado en el wizard hasta que se marca "Completar".

## Archivos

- `src/lib/slots.ts` — `EN_CURSO_GRACIA_MIN` + `finEfectivo` (puro).
- `src/lib/actions.ts` — `getDisponibilidad` usa `finEfectivo`.
- `scripts/check-slots.ts` (nuevo) — self-check.
