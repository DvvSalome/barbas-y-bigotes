// Chequeo ejecutable del limitador del formulario público de reservas.
//
//   node scripts/check-rate-limit.ts
//
// Por qué existe: reservar dispara un correo desde reservas@ hacia la dirección
// que escriba quien reserva. Sin freno, el sitio sirve de relé para mandarle
// correo a desconocidos con nuestro dominio — el camino corto a la lista negra
// (y al buzón suspendido, 18-ago-2026). Si este limitador se rompe, no se cae
// nada: simplemente deja de proteger, en silencio. De ahí el check.
import assert from "node:assert/strict";
import { permitir } from "../src/lib/rate-limit.ts";

// (a) Deja pasar hasta el tope por minuto y corta el siguiente. Un cliente real
//     reserva una vez; tres seguidas ya es alguien probando.
const ip = "ip-de-prueba";
for (let i = 0; i < 3; i++) assert.ok(permitir(ip, { porMinuto: 3, porHora: 10 }), `el intento ${i + 1} debe pasar`);
assert.equal(permitir(ip, { porMinuto: 3, porHora: 10 }), false, "el 4º en el mismo minuto se corta");

// (b) El rechazado NO cuenta: si cada intento bloqueado sumara, un bot dejaría
//     al cliente castigado para siempre con solo seguir golpeando.
for (let i = 0; i < 20; i++) permitir(ip, { porMinuto: 3, porHora: 10 });
// Quedaron guardadas SOLO las 3 aceptadas: con tope horario de 4 todavía cabe una.
assert.ok(permitir(ip, { porMinuto: 100, porHora: 4 }), "los 20 rechazos no se acumularon en el contador de la hora");
assert.equal(permitir(ip, { porMinuto: 100, porHora: 4 }), false, "y ahí sí se llegó al tope de la hora");

// (c) Las claves son independientes: un abusador no puede bloquear a los demás.
assert.ok(permitir("otra-ip", { porMinuto: 1, porHora: 1 }), "otra IP arranca con su propio cupo");
assert.equal(permitir("otra-ip", { porMinuto: 1, porHora: 1 }), false, "y con su propio tope");

console.log("check-rate-limit OK — tope por minuto, sin castigo acumulado, claves independientes");
