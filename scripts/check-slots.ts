// Self-check de slots: finEfectivo (disponibilidad guiada por la silla real),
// buildSlots/computeTaken (grilla y ocupación anclada a Bogotá) y faltaParaLlegar.
//   node scripts/check-slots.ts
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import {
  finEfectivo,
  EN_CURSO_GRACIA_MIN,
  faltaParaLlegar,
  MARGEN_LLEGADA_HORAS,
  buildSlots,
  computeTaken,
  OPEN,
  CLOSE,
  STEP,
} from "../src/lib/slots.ts";

// ---- buildSlots: grilla de inicios válidos, respeta el cierre (AUD-D-007) ----
function checkBuildSlots() {
  const s30 = buildSlots(30);
  assert.equal(s30[0], OPEN, "buildSlots(30) arranca en OPEN (9:00)");
  assert.equal(s30[s30.length - 1], CLOSE - 30, "buildSlots(30) termina 19:30");
  assert.ok(!s30.includes(CLOSE), "buildSlots nunca ofrece un inicio en/después de CLOSE");
  // Paso constante = STEP.
  for (let i = 1; i < s30.length; i++) assert.equal(s30[i] - s30[i - 1], STEP);
  // Duraciones más largas respetan el cierre (el último inicio + dur <= CLOSE).
  for (const dur of [45, 60, 90]) {
    const s = buildSlots(dur);
    assert.ok(s[s.length - 1] + dur <= CLOSE, `buildSlots(${dur}) respeta CLOSE`);
    assert.ok(s[0] === OPEN);
  }
}

// ---- computeTaken: ocupación anclada a Bogotá (AUD-D-001 + AUD-D-007) ----
// Estos casos usan instantes ABSOLUTOS (…Z) y esperan minutos-de-Bogotá (UTC-5).
// Si computeTaken volviera a usar la hora del dispositivo (getHours), fallan bajo
// cualquier TZ != Bogotá — por eso además se re-corren en un hijo con otra TZ.
function checkComputeTakenBogota() {
  const slots = buildSlots(30);
  // `day` deliberadamente NO es hoy, para que la rama "slots pasados de hoy" no
  // entre y los casos queden deterministas (solo prueba el solape).
  const day = new Date(2020, 0, 15); // 15-ene-2020, local

  // 14:30Z–15:00Z = 09:30–10:00 en Bogotá → 570..600. Borde exacto: el slot 9:00
  // (termina 9:30 == inicio ocupado) NO se tacha; solo se tacha 9:30.
  const t1 = computeTaken({
    slots,
    ocupados: [{ inicio: "2026-07-11T14:30:00Z", fin: "2026-07-11T15:00:00Z" }],
    day,
    duracionMin: 30,
  });
  assert.ok(!t1.has(9 * 60), "9:00 libre: fin del slot == inicio ocupado, no solapa");
  assert.ok(t1.has(9 * 60 + 30), "9:30 ocupado");
  assert.ok(!t1.has(10 * 60), "10:00 libre: inicio del slot == fin ocupado");

  // Solape PARCIAL: 14:15Z–14:45Z = 09:15–09:45 Bogotá → tacha 9:00 y 9:30.
  const t2 = computeTaken({
    slots,
    ocupados: [{ inicio: "2026-07-11T14:15:00Z", fin: "2026-07-11T14:45:00Z" }],
    day,
    duracionMin: 30,
  });
  assert.ok(t2.has(9 * 60), "9:00 ocupado por solape parcial");
  assert.ok(t2.has(9 * 60 + 30), "9:30 ocupado por solape parcial");
  assert.ok(!t2.has(10 * 60), "10:00 libre");

  // Sin ocupados y día que no es hoy: nada tachado.
  const t3 = computeTaken({ slots, ocupados: [], day, duracionMin: 30 });
  assert.equal(t3.size, 0, "sin ocupados y no-hoy: grilla libre");
}


// Hijo re-lanzado con TZ forzada: corre SOLO la matemática sensible a huso y sale.
// Si computeTaken usara la TZ del dispositivo, acá (TZ != Bogotá) reventaría.
if (process.env.SLOTS_TZ_CHILD) {
  checkBuildSlots();
  checkComputeTakenBogota();
  process.exit(0);
}

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

// Grilla + ocupación anclada a Bogotá, en la TZ actual del proceso.
checkBuildSlots();
checkComputeTakenBogota();

// Y lo mismo re-corrido en un proceso hijo con una TZ bien distinta a Bogotá:
// caza cualquier regresión a la hora del dispositivo aunque la máquina de dev
// esté configurada en Colombia.
for (const tz of ["America/New_York", "Asia/Tokyo", "UTC"]) {
  const r = spawnSync(process.execPath, [fileURLToPath(import.meta.url)], {
    env: { ...process.env, TZ: tz, SLOTS_TZ_CHILD: "1" },
    encoding: "utf8",
  });
  assert.equal(r.status, 0, `computeTaken debe dar lo mismo bajo TZ=${tz}\n${r.stderr ?? ""}`);
}

console.log("check-slots OK");
