// Self-check de finEfectivo (disponibilidad guiada por la silla real).
//   node scripts/check-slots.ts
import assert from "node:assert/strict";
import { finEfectivo, EN_CURSO_GRACIA_MIN, faltaParaLlegar, MARGEN_LLEGADA_HORAS } from "../src/lib/slots.ts";

const MIN = 60000;
// Fin estimado de una cita: 10:00:00Z. (Instantes absolutos; la TZ no importa.)
const fin = Date.parse("2026-07-11T10:00:00.000Z");
const finISO = new Date(fin).toISOString();
const gracia = EN_CURSO_GRACIA_MIN * MIN;

// 1) No en curso (pendiente/confirmada): nunca se extiende, aunque ya haya pasado.
assert.equal(finEfectivo("confirmada", finISO, fin + 30 * MIN), finISO);
assert.equal(finEfectivo("pendiente", finISO, fin + 999 * MIN), finISO);
assert.equal(finEfectivo("completada", finISO, fin + 30 * MIN), finISO);

// 2) En curso, todavía dentro del estimado (ahora <= fin): sin cambios.
assert.equal(finEfectivo("en_curso", finISO, fin - 5 * MIN), finISO);
assert.equal(finEfectivo("en_curso", finISO, fin), finISO);

// 3) En curso, pasado el estimado pero dentro de la gracia: rueda hasta AHORA.
const ahora1 = fin + 20 * MIN;
assert.equal(finEfectivo("en_curso", finISO, ahora1), new Date(ahora1).toISOString());

// 4) En curso, más allá de estimado + gracia: tope en fin + gracia (red de olvido).
const ahora2 = fin + (EN_CURSO_GRACIA_MIN + 40) * MIN;
assert.equal(finEfectivo("en_curso", finISO, ahora2), new Date(fin + gracia).toISOString());

// 5) Borde exacto: ahora == fin + gracia → tope.
assert.equal(finEfectivo("en_curso", finISO, fin + gracia), new Date(fin + gracia).toISOString());

// ---- Guard de "Llegó": no pasar a la silla una cita que arranca muy después ----
// El caso real que lo motivó: a la 1:45am se marcó "Llegó" en la cita de las 9:30am
// y quedó cobrada como venta de esa madrugada.
const cita = Date.parse("2026-07-20T14:30:00.000Z"); // 9:30 am Bogotá
const citaISO = new Date(cita).toISOString();
const margen = MARGEN_LLEGADA_HORAS * 3600_000;

// 1) Muy temprano (8h antes): bloquea y dice cuánto falta.
assert.equal(faltaParaLlegar(citaISO, cita - 8 * 3600_000), "faltan 8h");

// 2) Justo en el borde del margen: ya se puede marcar (<=, no <).
assert.equal(faltaParaLlegar(citaISO, cita - margen), null);

// 3) Un minuto antes del borde: todavía bloqueado.
assert.equal(faltaParaLlegar(citaISO, cita - margen - 60000), "faltan 2h");

// 4) El que llega temprano (30 min antes) SÍ pasa: es el caso legítimo que no
//    se puede romper por cazar el clic equivocado.
assert.equal(faltaParaLlegar(citaISO, cita - 30 * 60000), null);

// 5) A la hora y tarde: siempre habilitado (el cliente llegó tarde, se atiende).
assert.equal(faltaParaLlegar(citaISO, cita), null);
assert.equal(faltaParaLlegar(citaISO, cita + 45 * 60000), null);

// 6) Entre 2h y 2h59 se muestra en minutos redondeados a horas; más de 2h → "Xh".
assert.equal(faltaParaLlegar(citaISO, cita - 3 * 3600_000), "faltan 3h");

console.log("check-slots OK");
