// Self-check de los avisos por WhatsApp: normalización del teléfono (lo que
// evita abrir un chat con un número inventado) y armado del mensaje.
//   node scripts/check-whatsapp.ts
import assert from "node:assert/strict";
import { telefonoWhatsApp, linkWhatsApp, mensajeCitaMovida, mensajeCitaCancelada } from "../src/lib/whatsapp.ts";

// — Teléfonos que SÍ se pueden marcar —
assert.equal(telefonoWhatsApp("3006734799"), "573006734799", "celular suelto lleva indicativo");
assert.equal(telefonoWhatsApp("+57 300 673 4799"), "573006734799", "el + y los espacios se caen");
assert.equal(telefonoWhatsApp("57 300-673-4799"), "573006734799", "ya con indicativo, no se duplica");
assert.equal(telefonoWhatsApp("0057 3006734799"), "573006734799", "prefijo 00 internacional");
assert.equal(telefonoWhatsApp("(605) 385 1234"), "576053851234", "fijo de Barranquilla también");

// — Los que NO: mejor sin botón que con un chat a la nada —
for (const malo of [null, undefined, "", "   ", "no tiene", "123", "3006734799123456"]) {
  assert.equal(telefonoWhatsApp(malo), null, `no debería aceptar ${JSON.stringify(malo)}`);
  assert.equal(linkWhatsApp(malo, "hola"), null, "sin teléfono válido no hay link");
}

// — El link lleva el texto escapado —
const link = linkWhatsApp("3006734799", "Hola & chao ✂️");
assert.ok(link, "con teléfono válido tiene que haber link");
assert.ok(link.startsWith("https://wa.me/573006734799?text="), "wa.me con el número normalizado");
assert.ok(link.includes("%26"), "el & va escapado o corta el mensaje");
assert.ok(!link.includes(" "), "sin espacios crudos en la URL");

// — Mensajes —
const movida = mensajeCitaMovida({
  cliente: "Juan Carlos Pérez",
  cuando: "sáb 16 de ago a las 3:30 pm",
  barbero: "Meyer",
  sede: "Parque Venezuela",
});
assert.ok(movida.startsWith("Hola Juan!"), "saluda por el primer nombre, no por los cuatro");
assert.ok(movida.includes("sáb 16 de ago a las 3:30 pm") && movida.includes("Meyer"), "dice cuándo y con quién");
assert.ok(movida.includes("respondé"), "deja la puerta abierta a que conteste");

assert.ok(
  mensajeCitaMovida({ cliente: null, cuando: "hoy", barbero: "Jhon", sede: "Plaza" }).startsWith("¡Hola!"),
  "sin nombre saluda igual, no dice 'Hola undefined'",
);
assert.ok(
  mensajeCitaCancelada({ cliente: "  ", cuando: "vie 15", sede: "Plaza" }).includes("/reservar"),
  "la cancelación invita a reservar de nuevo",
);

console.log("check-whatsapp: ok");
