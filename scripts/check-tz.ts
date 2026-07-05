// Chequeo ejecutable del cálculo de día civil en Bogotá (T1 hardening).
// Simula el entorno de Vercel (UTC) para verificar que las ventanas de día
// NO dependen del TZ del proceso:
//
//   TZ=UTC node scripts/check-tz.ts
//
// (Node ≥23.6 corre TypeScript directo con type stripping; no requiere build.)
import assert from "node:assert/strict";
import { bogotaDayRange, bogotaDayRangeDeFecha, bogotaYmd } from "../src/lib/slots.ts";

// (a) Instante conocido: 2026-07-05T03:00Z son las 22:00 del 4 de julio en Bogotá.
//     El día civil correcto es el 4, no el 5 (con setHours en UTC salía el 5).
const instante = new Date("2026-07-05T03:00:00Z");
assert.equal(bogotaYmd(instante), "2026-07-04", "día civil en Bogotá del instante");
const r = bogotaDayRange(instante);
assert.equal(r.desde.toISOString(), "2026-07-04T05:00:00.000Z", "00:00 Bogotá = 05:00Z");
assert.equal(r.hasta.toISOString(), "2026-07-05T05:00:00.000Z", "24:00 Bogotá = 05:00Z del día siguiente");
assert.ok(
  r.desde.getTime() <= instante.getTime() && instante.getTime() < r.hasta.getTime(),
  "el instante cae dentro de su propio rango",
);

// (b) El rango de un YYYY-MM-DD explícito arranca a las 00:00 Bogotá y cubre 24h exactas.
const f = bogotaDayRangeDeFecha("2026-12-31");
assert.equal(f.desde.toISOString(), "2026-12-31T05:00:00.000Z", "inicio del día elegido");
assert.equal(f.hasta.getTime() - f.desde.getTime(), 86_400_000, "el rango cubre 24h exactas");

// (c) Un mediodía en Bogotá no cambia de día civil.
assert.equal(bogotaYmd(new Date("2026-07-05T17:00:00Z")), "2026-07-05");

console.log(`check-tz OK — rangos de día en Bogotá correctos (TZ del proceso: ${process.env.TZ ?? "(sistema)"})`);
