// Chequeo ejecutable del estado en vivo de los barberos (lo que ve el público).
//
//   node scripts/check-estado.ts
//
// Si dice "En silla" cuando el barbero está libre (o al revés), el cliente se va
// a otra barbería o llega a esperar. Por eso la regla vive suelta y probada.
import assert from "node:assert/strict";
import { estadoDeBarbero, textoEstado, textoHechos, minutoBogota } from "../src/lib/estado-barbero.ts";
import { instanteBogota, fmtTime } from "../src/lib/slots.ts";

const ymd = "2026-10-09";
const en = (min: number) => instanteBogota(ymd, min).toISOString();
const ventana = { abierta: true, abreMin: 9 * 60, cierraMin: 20 * 60 };
const a15 = instanteBogota(ymd, 15 * 60).getTime(); // 3:00 pm
const base = { id: "kevin", sede: "plaza", ventana, ausencias: [], ahoraMs: a15 };

assert.equal(minutoBogota(a15), 15 * 60);

// (a) Sin nada: libre.
let e = estadoDeBarbero({ ...base, reservas: [] });
assert.equal(e.estado, "libre");
assert.equal(textoEstado(e, fmtTime), "Libre ahora");

// (b) Una cita confirmada que cubre ahora pero el cliente NO ha llegado: no es
//     "En silla", es "Con cita hasta 3:30 pm".
e = estadoDeBarbero({ ...base, reservas: [{ barberoId: "kevin", inicio: en(14 * 60 + 50), fin: en(15 * 60 + 30), estado: "confirmada" }] });
assert.equal(e.estado, "con_cita");
assert.equal(textoEstado(e, fmtTime), "Con cita hasta 3:30 pm");
assert.equal(e.porAtender, 1);

// (c) En curso que llegó ANTES de su hora (la cita era 3:30): igual está en silla.
e = estadoDeBarbero({ ...base, reservas: [{ barberoId: "kevin", inicio: en(15 * 60 + 30), fin: en(16 * 60), estado: "en_curso" }] });
assert.equal(e.estado, "en_silla");
assert.equal(textoEstado(e, fmtTime), "En silla · sale 4:00 pm");

// (d) En curso pasándose de la hora: sigue en silla, sin hora de salida inventada.
e = estadoDeBarbero({ ...base, reservas: [{ barberoId: "kevin", inicio: en(14 * 60), fin: en(14 * 60 + 30), estado: "en_curso" }] });
assert.equal(e.estado, "en_silla");
assert.equal(textoEstado(e, fmtTime), "En silla ahora");

// (e) Cobrado temprano: ya NO está en silla, y cuenta como hecho.
e = estadoDeBarbero({ ...base, reservas: [{ barberoId: "kevin", inicio: en(14 * 60 + 45), fin: en(15 * 60 + 15), estado: "completada" }] });
assert.equal(e.estado, "libre");
assert.equal(e.hechos, 1);
assert.equal(textoHechos(e.hechos), "1 corte hoy");
assert.equal(textoHechos(3), "3 cortes hoy");
assert.equal(textoHechos(0), null);

// (f) No llegó / cancelada: ni ocupan ni cuentan.
e = estadoDeBarbero({
  ...base,
  reservas: [
    { barberoId: "kevin", inicio: en(14 * 60 + 50), fin: en(15 * 60 + 30), estado: "no_show" },
    { barberoId: "kevin", inicio: en(15 * 60), fin: en(15 * 60 + 30), estado: "cancelada" },
  ],
});
assert.equal(e.estado, "libre");
assert.equal(e.hechos + e.porAtender, 0);

// (g) Citas de OTRO barbero no le cambian el estado.
e = estadoDeBarbero({ ...base, reservas: [{ barberoId: "abel", inicio: en(15 * 60), fin: en(16 * 60), estado: "en_curso" }] });
assert.equal(e.estado, "libre");

// (h) Ausencia de día entero manda sobre todo; una pausa parcial dice cuándo vuelve.
e = estadoDeBarbero({ ...base, reservas: [], ausencias: [{ barberoId: "kevin", desdeMin: null, hastaMin: null }] });
assert.equal(textoEstado(e, fmtTime), "No atiende hoy");
e = estadoDeBarbero({ ...base, reservas: [], ausencias: [{ barberoId: "kevin", desdeMin: 14 * 60 + 30, hastaMin: 15 * 60 + 30 }] });
assert.equal(textoEstado(e, fmtTime), "En pausa · vuelve 3:30 pm");

// (i) Fuera del horario: neutro, nunca "Libre ahora".
e = estadoDeBarbero({ ...base, reservas: [], ahoraMs: instanteBogota(ymd, 21 * 60).getTime() });
assert.equal(textoEstado(e, fmtTime), "Puedes reservar");
e = estadoDeBarbero({ ...base, ventana: { abierta: false, abreMin: 0, cierraMin: 0 }, reservas: [] });
assert.equal(e.estado, "cerrado");

// (j) Pero si está cortando después de la hora de cierre, se ve en silla.
e = estadoDeBarbero({
  ...base,
  ahoraMs: instanteBogota(ymd, 20 * 60 + 10).getTime(),
  reservas: [{ barberoId: "kevin", inicio: en(19 * 60 + 50), fin: en(20 * 60 + 20), estado: "en_curso" }],
});
assert.equal(e.estado, "en_silla");

// (k) Cubre hoy en la otra sede: acá no se le encuentra... salvo que esté cortando.
e = estadoDeBarbero({ ...base, reservas: [], cubreOtraSede: true });
assert.equal(textoEstado(e, fmtTime), "Hoy atiende en la otra sede");
e = estadoDeBarbero({ ...base, cubreOtraSede: true, reservas: [{ barberoId: "kevin", inicio: en(15 * 60), fin: en(15 * 60 + 30), estado: "en_curso" }] });
assert.equal(e.estado, "en_silla");

console.log("check-estado: ok");
