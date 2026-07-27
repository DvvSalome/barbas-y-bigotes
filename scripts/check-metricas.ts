// Chequeo ejecutable de los rangos de período de /admin/metricas.
//
//   TZ=UTC node scripts/check-metricas.ts
//
// El bug que este check existe para atrapar: comparar un mes A MEDIAS contra el
// mes anterior COMPLETO. Eso haría que el panel diga "vas peor" todos los meses
// hasta el día 30, y el dueño tomaría decisiones con un número que miente.
import assert from "node:assert/strict";
import { rangoPeriodo, bogotaYmd } from "../src/lib/slots.ts";

const dia = 86_400_000;

// (a) "Este mes" el día 12: el rango va del 1° a hoy, y el comparativo tiene que
//     medir EXACTAMENTE los mismos 11 días y pico del mes anterior.
const doce = new Date("2026-07-12T15:00:00Z"); // 10:00 en Bogotá
const mes = rangoPeriodo("mes", doce);
assert.equal(bogotaYmd(mes.desde), "2026-07-01", "el mes arranca el 1° en Bogotá");
assert.equal(mes.hasta.getTime(), doce.getTime(), "el mes corre hasta ahora, no hasta fin de mes");
const largoMes = mes.hasta.getTime() - mes.desde.getTime();
assert.equal(
  mes.desde.getTime() - mes.prevDesde.getTime(),
  largoMes,
  "el período anterior mide lo mismo que el actual (peras con peras)",
);
assert.ok(mes.prevDesde < mes.desde, "el comparativo va antes del período");
// 1-jul 00:00 Bogotá menos 11 días y 10 horas = 19-jun 14:00 Bogotá.
assert.equal(bogotaYmd(mes.prevDesde), "2026-06-19", "el comparativo arranca 11d 10h antes del 1-jul");

// (b) El 1° del mes a primera hora el rango es casi cero, pero nunca negativo:
//     con un rango negativo la serie de días se generaría al revés.
const primero = new Date("2026-07-01T05:30:00Z"); // 00:30 en Bogotá
const arranque = rangoPeriodo("mes", primero);
assert.ok(arranque.hasta.getTime() >= arranque.desde.getTime(), "rango no negativo el día 1");
assert.equal(bogotaYmd(arranque.desde), "2026-07-01");

// (c) Ventanas móviles: 30d y 90d miden justo eso, y su comparativo también.
for (const [p, n] of [["30d", 30], ["90d", 90]] as const) {
  const r = rangoPeriodo(p, doce);
  assert.equal(r.hasta.getTime() - r.desde.getTime(), n * dia, `${p} cubre ${n} días`);
  assert.equal(r.desde.getTime() - r.prevDesde.getTime(), n * dia, `el comparativo de ${p} también`);
}

// (d) No depende del huso del proceso: el 1° de mes se calcula en Bogotá, no en UTC.
//     A las 02:00Z del 1-ago en Bogotá todavía es 31 de JULIO, así que el mes en
//     curso es julio (si se calculara en UTC daría agosto y el panel se vaciaría).
const madrugada = new Date("2026-08-01T02:00:00Z");
assert.equal(bogotaYmd(madrugada), "2026-07-31", "en Bogotá todavía es julio");
assert.equal(bogotaYmd(rangoPeriodo("mes", madrugada).desde), "2026-07-01", "el mes en curso sigue siendo julio");

console.log(`check-metricas OK — rangos y comparativos por período correctos (TZ: ${process.env.TZ ?? "(sistema)"})`);
