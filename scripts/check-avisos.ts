// Chequeo ejecutable de las reglas de los avisos del dueño y del push con varios
// dueños por aparato (src/lib/avisos-reglas.ts, migraciones 0084 y 0085).
//
//   node scripts/check-avisos.ts
//
// Tres cosas que salen caras si se rompen:
//   · el correo del dueño: una dirección inventada rebota, y los rebotes ya
//     suspendieron el buzón de reservas@ tres veces;
//   · reconocer "0085 todavía no está" sin confundirlo con un error de datos: si
//     el CHECK push_sub_dueno_unico se tomara por migración pendiente, se
//     reintentaría el upsert viejo y le quitaría el aparato a otro;
//   · decir a quién más le avisa un aparato sin escribir "a el mostrador".
import assert from "node:assert/strict";
import { sinVariosDuenos, faltaTabla, correoDelDueno, correoCorregido, conteo, aQuien } from "../src/lib/avisos-reglas.ts";

// (1) 0085 pendiente vs errores de verdad.
assert.equal(sinVariosDuenos({ code: "42P10", message: "there is no unique or exclusion constraint matching the ON CONFLICT specification" }), true);
assert.equal(sinVariosDuenos({ code: "42703", message: 'column "dueno" does not exist' }), true);
assert.equal(sinVariosDuenos({ code: "PGRST204", message: "Could not find the 'dueno' column of 'push_subscriptions' in the schema cache" }), true);
assert.equal(sinVariosDuenos({ code: "PGRST100", message: 'failed to parse on_conflict "dueno"' }), true, "otro rechazo que nombra la columna");
assert.equal(
  sinVariosDuenos({ code: "23514", message: 'new row violates check constraint "push_sub_dueno_unico"' }),
  false,
  "el CHECK de un dueño por fila es un error de datos, no una migración pendiente",
);
assert.equal(sinVariosDuenos({ code: "23505", message: 'duplicate key value violates unique constraint "push_sub_endpoint_cliente"' }), false);
assert.equal(sinVariosDuenos({ code: "08006", message: "connection failure" }), false, "la red caída no es la migración");
assert.equal(sinVariosDuenos(null), false);
assert.equal(sinVariosDuenos(undefined), false);

// (2) Tabla sin crear (deploy antes de la migración).
assert.equal(faltaTabla({ code: "42P01" }), true);
assert.equal(faltaTabla({ code: "PGRST205" }), true);
assert.equal(faltaTabla({ code: "42501" }), false, "sin permiso no es lo mismo que sin tabla");
assert.equal(faltaTabla(null), false);

// (3) El correo del dueño.
assert.deepEqual(correoDelDueno("  Dueno.Real@Gmail.COM "), { ok: true, email: "dueno.real@gmail.com" }, "se guarda en minúsculas y sin espacios (el CHECK de 0084 lo exige)");
assert.deepEqual(correoDelDueno("reservas@barbasybigotes.com"), { ok: true, email: "reservas@barbasybigotes.com" }, "el buzón que sí existe");
for (const [malo, motivo] of [
  ["", /Escribe el correo/],
  ["   ", /Escribe el correo/],
  [null, /Escribe el correo/],
  ["admin@barbasybigotes.com", /no existe en barbasybigotes\.com/],
  ["dueno@barbasybigotes.com", /no existe en barbasybigotes\.com/],
  ["dueno@gmail", /no parece real/],
  ["prueba@example.com", /no parece real/],
  ["demo@qa.local", /no parece real/],
  ["dos@@arrobas.com", /no parece real/],
] as const) {
  const r = correoDelDueno(malo);
  assert.equal(r.ok, false, `${JSON.stringify(malo)} no se guarda`);
  if (!r.ok) assert.match(r.error, motivo, `${JSON.stringify(malo)}: el motivo que lee el dueño`);
}
// Tuteo en lo que lee el dueño.
for (const malo of ["", "admin@barbasybigotes.com", "x@example.com"]) {
  const r = correoDelDueno(malo);
  if (!r.ok) assert.doesNotMatch(r.error, /\b(escribí|revisá|usá|podés)\b/i, "tuteo");
}

// (3b) Tecleos del dominio: tienen forma de correo pero rebotan, y el correo del
//      dueño recibe cada cita, cada cierre y cada alerta (varios rebotes al día).
for (const [malo, sugerido] of [
  ["carlos@gmail.con", "carlos@gmail.com"],
  ["carlos@gmial.com", "carlos@gmail.com"],
  ["carlos@gmail.co", "carlos@gmail.com"],
  ["carlos@hotmial.com", "carlos@hotmail.com"],
  ["carlos@hotmail.con", "carlos@hotmail.com"],
  ["carlos@outlok.com", "carlos@outlook.com"],
  ["carlos@yaho.com", "carlos@yahoo.com"],
  ["carlos@empresa.cmo", "carlos@empresa.com"],
  ["Carlos@GMIAL.CON", "carlos@gmail.com"],
] as const) {
  assert.equal(correoCorregido(malo), sugerido, `${malo} → ${sugerido}`);
  const r = correoDelDueno(malo);
  assert.equal(r.ok, false, `${malo} no se guarda`);
  if (!r.ok) assert.ok(r.error.includes(`¿Quisiste decir ${sugerido}?`), `${malo}: sugiere ${sugerido}`);
}
for (const bueno of ["carlos@gmail.com", "carlos@hotmail.es", "carlos@outlook.com", "carlos@yahoo.com.co", "carlos@empresa.co", "carlos@une.net.co", "carlos@icloud.com"]) {
  assert.equal(correoCorregido(bueno), null, `${bueno} está bien escrito`);
  assert.equal(correoDelDueno(bueno).ok, true, `${bueno} se guarda`);
}

// (3c) El count de un HEAD: la tabla sin crear NO trae error, trae count null
//      (medido contra producción con 0084 sin aplicar). Eso es "no se sabe", no 0.
assert.equal(conteo({ error: null, count: null }), null, "404 sin cuerpo: no se sabe");
assert.equal(conteo({ error: null, count: undefined }), null);
assert.equal(conteo({ error: { code: "42501" }, count: null }), null);
assert.equal(conteo({ error: { code: "XX" }, count: 3 }), null, "con error, el número no vale");
assert.equal(conteo({ error: null, count: 0 }), 0, "cero de verdad");
assert.equal(conteo({ error: null, count: 2 }), 2);

// (4) A quién más le avisa un aparato.
assert.equal(aQuien([]), "");
assert.equal(aQuien(["el mostrador de Plaza de la Paz"]), "al mostrador de Plaza de la Paz", "a + el = al");
assert.equal(aQuien(["Carlos Pérez"]), "a Carlos Pérez");
assert.equal(aQuien(["el mostrador de Plaza de la Paz", "Carlos"]), "al mostrador de Plaza de la Paz y a Carlos");
assert.equal(aQuien(["el mostrador de Parque Venezuela", "otro administrador", "un cliente"]), "al mostrador de Parque Venezuela, a otro administrador y a un cliente");

console.log("check-avisos OK — correo del dueño (y sus tecleos), conteo de un HEAD, 0085 pendiente vs error real y «al mostrador»");
