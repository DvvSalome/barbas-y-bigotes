// Chequeo ejecutable de la tarjeta de cortes.
//
//   node scripts/check-tarjeta.ts
//
// Esto decide qué se le regala a un cliente y cuánto se le descuenta. Un error acá
// no tira ninguna pantalla: se traduce en premios que no se entregan o en plata
// regalada, y se descubre con el cliente adelante.
//
// Desde 0064 la regla la configura el dueño (tamaño y hitos), así que los checks
// corren sobre configs distintas y no sobre los números que antes estaban quemados.
import assert from "node:assert/strict";
import {
  beneficioProximoCorte,
  estadoTarjeta,
  sanearConfigTarjeta,
  etiquetaHito,
  TARJETA_DEFECTO,
  type ConfigTarjeta,
} from "../src/lib/tarjeta.ts";

const PRECIO = 30000;

// ---------------------------------------------------------------------------
// (1) La regla de siempre (la que quedó como defecto): 10 cortes, regalo al 5º,
//     50% al 10º. Aplicar 0064 no puede cambiar el comportamiento.
// ---------------------------------------------------------------------------
for (const prev of [0, 1, 2, 3]) assert.equal(beneficioProximoCorte(prev, PRECIO).tipo, null, `${prev} previos: sin premio`);
for (const prev of [5, 6, 7, 8]) assert.equal(beneficioProximoCorte(prev, PRECIO).tipo, null, `${prev} previos: sin premio`);

// El 5º corte es REGALO y no descuenta plata: el cliente paga completo y se lleva
// algo. Quien lea "hay beneficio" no puede asumir "hay descuento".
assert.deepEqual(beneficioProximoCorte(4, PRECIO), { tipo: "regalo", descuento: 0, posicion: 5 });
assert.equal(beneficioProximoCorte(4, 999999).descuento, 0, "el regalo NUNCA descuenta, sea cual sea el precio");

// El 10º va al 50% del servicio que se hizo.
assert.deepEqual(beneficioProximoCorte(9, PRECIO), { tipo: "50%", descuento: 15000, posicion: 10 });
assert.equal(beneficioProximoCorte(9, 25001).descuento, 12500, "el 50% redondea hacia abajo");

// Los ciclos se repiten sin correrse.
assert.equal(beneficioProximoCorte(10, PRECIO).tipo, null, "el 11º arranca ciclo nuevo, sin premio");
assert.equal(beneficioProximoCorte(14, PRECIO).tipo, "regalo", "el 15º es el 5º del 2º ciclo");
assert.equal(beneficioProximoCorte(19, PRECIO).tipo, "50%", "el 20º es el 10º del 2º ciclo");

// ---------------------------------------------------------------------------
// (2) El porcentaje va sobre el SERVICIO COBRADO, no sobre un corte base.
//     Este es el cambio que pidió el dueño: al que se hacía un combo de $60.000
//     se le descontaba la mitad de $25.000 (el corte base de la sede).
// ---------------------------------------------------------------------------
assert.equal(beneficioProximoCorte(9, 60000).descuento, 30000, "combo de $60.000 → descuenta $30.000");
assert.equal(beneficioProximoCorte(9, 20000).descuento, 10000, "servicio barato → descuenta menos");

// Precio inválido: descuento 0 explícito, nunca NaN colándose al total.
assert.equal(beneficioProximoCorte(9, 0).descuento, 0, "precio 0 → sin descuento, no plata regalada");
assert.equal(beneficioProximoCorte(9, NaN).descuento, 0, "precio NaN → 0, no Math.floor(NaN)");
assert.equal(beneficioProximoCorte(9, -5000).descuento, 0, "precio negativo → 0");

// Un 100% no puede descontar más de lo que costó (total negativo).
const todo: ConfigTarjeta = { tamano: 4, hitos: [{ posicion: 4, tipo: "porcentaje", valor: 100 }] };
assert.equal(beneficioProximoCorte(3, 40000, todo).descuento, 40000, "el 100% descuenta el servicio entero, ni un peso más");

// ---------------------------------------------------------------------------
// (3) Configs a medida: el dueño mueve tamaño y premios.
// ---------------------------------------------------------------------------
const corta: ConfigTarjeta = {
  tamano: 5,
  hitos: [
    { posicion: 3, tipo: "porcentaje", valor: 30 },
    { posicion: 5, tipo: "regalo", valor: 0 },
  ],
};
assert.equal(beneficioProximoCorte(2, PRECIO, corta).tipo, "30%", "3º corte: 30%");
assert.equal(beneficioProximoCorte(2, PRECIO, corta).descuento, 9000, "30% de $30.000");
assert.equal(beneficioProximoCorte(4, PRECIO, corta).tipo, "regalo", "5º corte: regalo");
assert.equal(beneficioProximoCorte(5, PRECIO, corta).tipo, null, "6º: arranca ciclo nuevo");
assert.equal(beneficioProximoCorte(7, PRECIO, corta).tipo, "30%", "8º = 3º del 2º ciclo");

// ---------------------------------------------------------------------------
// (4) estadoTarjeta: lo que se le promete al cliente en el portal tiene que ser
//     lo que le va a tocar. Si el anuncio y el cobro se separan, el cliente llega
//     esperando un premio que no existe.
// ---------------------------------------------------------------------------
for (const cfg of [TARJETA_DEFECTO, corta, todo]) {
  for (let c = 0; c < cfg.tamano * 3; c++) {
    const e = estadoTarjeta(c, cfg);
    assert.ok(e.sellos >= 0 && e.sellos < cfg.tamano, `sellos en rango con ${c} cortes`);
    assert.ok(e.proximo, "siempre hay un próximo premio mientras la config tenga hitos");
    assert.ok(e.proximo!.faltan >= 1, "faltan nunca es 0 ni negativo");
    // Al llegar al corte anunciado, el beneficio que se aplica es EL MISMO.
    const alLlegar = beneficioProximoCorte(c + e.proximo!.faltan - 1, PRECIO, cfg);
    assert.equal(alLlegar.tipo, e.proximo!.tipo, `lo prometido con ${c} cortes es lo que se aplica`);
  }
}
assert.equal(estadoTarjeta(0).proximo?.faltan, 5, "recién empezado: faltan 5 para el regalo");
assert.equal(estadoTarjeta(4).proximo?.faltan, 1, "con 4 cortes, el próximo es el premio");
assert.equal(estadoTarjeta(5).proximo?.tipo, "50%", "pasado el regalo, lo que viene es el 50%");
assert.equal(estadoTarjeta(10).sellos, 0, "completada la tarjeta, arranca vacía");

// ---------------------------------------------------------------------------
// (5) El saneo: la config viene de un jsonb (cualquier forma) y de un formulario.
//     Guardar una tarjeta rota = premios que no se entregan.
// ---------------------------------------------------------------------------
assert.deepEqual(sanearConfigTarjeta({ tamano: 10, hitos: TARJETA_DEFECTO.hitos }), TARJETA_DEFECTO);
assert.equal(sanearConfigTarjeta(null), null, "null no es una config");
assert.equal(sanearConfigTarjeta({ tamano: 10 }), null, "sin hitos no vale");
assert.equal(sanearConfigTarjeta({ tamano: 10, hitos: [] }), null, "una tarjeta sin premios no es una tarjeta");
assert.equal(sanearConfigTarjeta({ tamano: 2, hitos: [{ posicion: 1, tipo: "regalo" }] }), null, "tamaño por debajo del mínimo");
assert.equal(sanearConfigTarjeta({ tamano: 99, hitos: [{ posicion: 1, tipo: "regalo" }] }), null, "tamaño por encima del máximo");
assert.equal(
  sanearConfigTarjeta({ tamano: 5, hitos: [{ posicion: 9, tipo: "regalo" }] }),
  null,
  "un premio fuera de la tarjeta no se puede alcanzar nunca",
);
assert.equal(
  sanearConfigTarjeta({ tamano: 5, hitos: [{ posicion: 2, tipo: "regalo" }, { posicion: 2, tipo: "porcentaje", valor: 50 }] }),
  null,
  "dos premios en la misma casilla: decidiría el orden del array",
);
assert.equal(
  sanearConfigTarjeta({ tamano: 5, hitos: [{ posicion: 2, tipo: "porcentaje", valor: 0 }] }),
  null,
  "un 0% no es un premio",
);
assert.equal(
  sanearConfigTarjeta({ tamano: 5, hitos: [{ posicion: 2, tipo: "porcentaje", valor: 120 }] }),
  null,
  "más del 100% sería pagarle al cliente por venir",
);
assert.equal(sanearConfigTarjeta({ tamano: 5, hitos: [{ posicion: 2, tipo: "otro" }] }), null, "tipo desconocido");
// Los hitos salen ORDENADOS aunque entren al revés: estadoTarjeta busca "el
// primero por delante" y con el array desordenado anunciaría el premio equivocado.
const desordenada = sanearConfigTarjeta({
  tamano: 8,
  hitos: [
    { posicion: 8, tipo: "porcentaje", valor: 40 },
    { posicion: 3, tipo: "regalo", valor: 0 },
  ],
});
assert.deepEqual(desordenada?.hitos.map((h) => h.posicion), [3, 8], "los hitos quedan en orden");
assert.equal(estadoTarjeta(0, desordenada!).proximo?.posicion, 3, "el próximo es el más cercano, no el primero del array");

// (6) Etiquetas: es lo que se guarda en ventas.beneficio_tarjeta y lo que se lee.
assert.equal(etiquetaHito({ posicion: 1, tipo: "regalo", valor: 0 }), "regalo");
assert.equal(etiquetaHito({ posicion: 1, tipo: "porcentaje", valor: 50 }), "50%", "compatible con las ventas viejas");
assert.equal(etiquetaHito({ posicion: 1, tipo: "porcentaje", valor: 30 }), "30%");

console.log("check-tarjeta OK — hitos configurables, % sobre el servicio cobrado y saneo de la config");
