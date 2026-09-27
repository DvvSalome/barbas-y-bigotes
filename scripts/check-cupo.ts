// Chequeo ejecutable del "próximo cupo online" (chips de la home).
//
//   node scripts/check-cupo.ts
//
// El chip promete una hora y el enlace lleva al wizard con esa hora marcada: si
// la cuenta se corre, el cliente llega a una hora tomada y la promesa se rompe.
import assert from "node:assert/strict";
import { primerCupoDelDia, proximoCupo, textoCupo, horaParam, leerFechaHora, leerOrigenWeb, sumarDias, MARGEN_CUPO_MIN } from "../src/lib/cupo.ts";
import { instanteBogota } from "../src/lib/slots.ts";

const ymd = "2026-09-28"; // lunes
const ventana = { abierta: true, abreMin: 9 * 60, cierraMin: 20 * 60 };
const iso = (min: number) => instanteBogota(ymd, min).toISOString();

// (a) Día abierto y vacío, mirado desde la víspera: el primer turno es la apertura.
const vispera = instanteBogota(ymd, 0).getTime() - 3600_000;
assert.equal(primerCupoDelDia(ymd, ventana, [], 30, vispera), 9 * 60);

// (b) Hoy a las 2:31 pm: 2:30 ya pasó y 2:45 no respeta el margen; el chip dice 3:00.
const ahora = instanteBogota(ymd, 14 * 60 + 31).getTime();
assert.equal(MARGEN_CUPO_MIN, 15);
assert.equal(primerCupoDelDia(ymd, ventana, [], 30, ahora), 15 * 60);

// (c) Con una cita de 3:00 a 3:20, el siguiente hueco es 3:20 (encadenado al fin,
//     igual que el wizard), no 3:30.
assert.equal(primerCupoDelDia(ymd, ventana, [{ inicio: iso(15 * 60), fin: iso(15 * 60 + 20) }], 30, ahora), 15 * 60 + 20);

// (d) Un servicio de 30 min no cabe en un hueco de 20 entre dos citas.
const dos = [
  { inicio: iso(15 * 60), fin: iso(15 * 60 + 20) },
  { inicio: iso(15 * 60 + 40), fin: iso(16 * 60 + 10) },
];
assert.equal(primerCupoDelDia(ymd, ventana, dos, 30, ahora), 16 * 60 + 10);

// (e) Cerrado o lleno → null.
assert.equal(primerCupoDelDia(ymd, { abierta: false, abreMin: 0, cierraMin: 0 }, [], 30, vispera), null);
assert.equal(primerCupoDelDia(ymd, ventana, [{ inicio: iso(9 * 60), fin: iso(20 * 60) }], 30, vispera), null);

// (f) proximoCupo salta el domingo cerrado y la ausencia entera del lunes: cae al martes.
const semanal = [0, 1, 2, 3, 4, 5, 6].map((dow) => ({ dow, abierta: dow !== 0, abreMin: 9 * 60, cierraMin: 20 * 60 }));
const domingo = "2026-09-27";
const cupo = proximoCupo({
  hoy: domingo,
  ahoraMs: instanteBogota(domingo, 10 * 60).getTime(),
  duracionMin: 30,
  semanal,
  especiales: [],
  ocupadosDe: (d) => (d === "2026-09-28" ? null : []),
});
assert.deepEqual(cupo, { fecha: "2026-09-29", minuto: 9 * 60 });

// (g) Una excepción que abre el domingo manda sobre la semana.
const abierto = proximoCupo({
  hoy: domingo,
  ahoraMs: instanteBogota(domingo, 10 * 60).getTime(),
  duracionMin: 30,
  semanal,
  especiales: [{ fecha: domingo, abierta: true, abreMin: 10 * 60, cierraMin: 16 * 60 }],
  ocupadosDe: () => [],
});
assert.deepEqual(abierto, { fecha: domingo, minuto: 10 * 60 + 15 });

// (h) Sin nada en 14 días → null (no revienta ni se cuelga).
assert.equal(proximoCupo({ hoy: domingo, ahoraMs: 0, duracionMin: 30, semanal, especiales: [], ocupadosDe: () => null }), null);

// (i) Textos, tal cual los lee el cliente.
assert.equal(textoCupo({ fecha: "2026-09-28", minuto: 15 * 60 + 30 }, "2026-09-28"), "hoy 3:30 pm");
assert.equal(textoCupo({ fecha: "2026-09-29", minuto: 9 * 60 }, "2026-09-28"), "mañana 9:00 am");
assert.equal(textoCupo({ fecha: "2026-10-01", minuto: 9 * 60 }, "2026-09-28"), "el jueves 9:00 am");
assert.equal(textoCupo({ fecha: "2026-10-09", minuto: 9 * 60 }, "2026-09-28"), "el 9 oct 9:00 am");
assert.equal(horaParam(15 * 60 + 5), "15:05");
assert.equal(sumarDias("2026-09-30", 1), "2026-10-01");

// (j) Lo que entra por la URL: solo fechas dentro de la ventana y horas del grano.
assert.deepEqual(leerFechaHora("2026-09-29", "15:30", "2026-09-28"), { fecha: "2026-09-29", minuto: 15 * 60 + 30 });
assert.equal(leerFechaHora("2026-09-27", "15:30", "2026-09-28"), null); // ayer
assert.equal(leerFechaHora("2026-11-28", "15:30", "2026-09-28"), null); // muy lejos
assert.equal(leerFechaHora("2026-09-29", "15:33", "2026-09-28"), null); // fuera del grano
assert.equal(leerFechaHora("29/09/2026", "15:30", "2026-09-28"), null);
assert.equal(leerOrigenWeb("hero-cupo"), "hero-cupo");
assert.equal(leerOrigenWeb("<script>"), undefined);
assert.equal(leerOrigenWeb(""), undefined);

console.log("check-cupo: ok");
