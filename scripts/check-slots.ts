// Self-check de finEfectivo (disponibilidad guiada por la silla real).
//   node scripts/check-slots.ts
import assert from "node:assert/strict";
import { finEfectivo, EN_CURSO_GRACIA_MIN } from "../src/lib/slots.ts";

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

console.log("check-slots OK");
