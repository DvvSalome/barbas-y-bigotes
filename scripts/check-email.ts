// Chequeo ejecutable de qué direcciones aceptamos guardar.
//
//   node scripts/check-email.ts
//
// Esto no es cosmética: mandar a direcciones muertas fue lo que hizo que el relay
// de Hostinger (MailChannels) bloqueara al remitente con "[ESA] Extensive Sender
// Abuse" y que el buzón quedara suspendido tres veces en cuatro días. Cada caso de
// acá es una dirección que YA rebotó de verdad.
import assert from "node:assert/strict";
import { esEmailEnviable, emailGuardable } from "../src/lib/email.ts";

// --- Los tres que causaron el bloqueo, con nombre y apellido ---
assert.equal(esEmailEnviable("demo-agenda@qa.local"), false, "qa.local no existe: rebotó el 13-ago");
assert.equal(esEmailEnviable("jhon@barbasybigotes.com"), false, "buzón inexistente del propio dominio: rebotó el 21-jul");
assert.equal(esEmailEnviable("admin@barbasybigotes.com"), false, "tampoco existe: rebotó el 21-ago");

// --- Lo que sí tiene que pasar ---
assert.ok(esEmailEnviable("adriangar713@gmail.com"), "un Gmail real pasa");
assert.ok(esEmailEnviable("davidochoa.o@hotmail.com"), "un Hotmail real pasa");
assert.ok(esEmailEnviable("Cliente.Nuevo+cita@Outlook.COM"), "mayúsculas y + son válidos");
assert.ok(esEmailEnviable("reservas@barbasybigotes.com"), "el buzón que SÍ existe del dominio propio");

// --- Basura que nunca debe llegar al relay ---
for (const malo of [
  "",
  "   ",
  "sinarroba.com",
  "dos@@arrobas.com",
  "sin@tld",
  "con espacio@gmail.com",
  "coma,otra@gmail.com",
  "demo@example.com",
  "algo@mi.localhost",
  "prueba@cosa.invalid",
  "x@y.test",
]) {
  assert.equal(esEmailEnviable(malo), false, `no se guarda: ${JSON.stringify(malo)}`);
}
assert.equal(esEmailEnviable(null), false, "null no es un correo");
assert.equal(esEmailEnviable(undefined), false, "undefined tampoco");

// --- emailGuardable: lo que termina en la base ---
assert.equal(emailGuardable("  Juan@Gmail.com  "), "Juan@Gmail.com", "se guarda como lo escribieron, sin espacios");
assert.equal(emailGuardable("jhon@barbasybigotes.com"), "", "lo que rebotaría se guarda VACÍO");
assert.equal(emailGuardable(null), "", "sin correo, cadena vacía (es lo que esperan las colas)");

console.log("check-email OK — no se guarda ninguna dirección que vaya a rebotar");
