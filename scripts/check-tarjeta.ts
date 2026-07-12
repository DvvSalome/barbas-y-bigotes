// scripts/check-tarjeta.ts — self-check de la matemática de la tarjeta de cortes.
//   node scripts/check-tarjeta.ts
import assert from "node:assert/strict";
import { beneficioProximoCorte, estadoTarjeta, TARJETA_SIZE } from "../src/lib/tarjeta.ts";

const BASE = 30000;
// 0..3 cortes previos -> el próximo (1º..4º) no tiene beneficio
for (const prev of [0, 1, 2, 3]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null);
// 4 previos -> el próximo es el 5º -> 50%
assert.deepEqual(beneficioProximoCorte(4, BASE), { tipo: "50%", descuento: 15000, posicion: 5 });
// 5..8 previos -> 6º..9º sin beneficio
for (const prev of [5, 6, 7, 8]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null);
// 9 previos -> el próximo es el 10º -> gratis (descuento = base)
assert.deepEqual(beneficioProximoCorte(9, BASE), { tipo: "gratis", descuento: 30000, posicion: 10 });
// 10 previos -> reinicio: el próximo es el 1º del nuevo ciclo, sin beneficio
assert.equal(beneficioProximoCorte(10, BASE).tipo, null);
// 14 previos -> próximo 15º = 5º del 2º ciclo -> 50%
assert.equal(beneficioProximoCorte(14, BASE).tipo, "50%");
// El descuento del 5º usa floor (base impar no deja centavos)
assert.equal(beneficioProximoCorte(4, 25001).descuento, 12500);

// estadoTarjeta: sellos y próximo premio
assert.deepEqual(estadoTarjeta(0), { sellos: 0, cortesTotales: 0, proximo: { tipo: "50%", faltan: 5 } });
assert.deepEqual(estadoTarjeta(3), { sellos: 3, cortesTotales: 3, proximo: { tipo: "50%", faltan: 2 } });
assert.deepEqual(estadoTarjeta(5), { sellos: 5, cortesTotales: 5, proximo: { tipo: "gratis", faltan: 5 } });
assert.deepEqual(estadoTarjeta(9), { sellos: 9, cortesTotales: 9, proximo: { tipo: "gratis", faltan: 1 } });
assert.deepEqual(estadoTarjeta(10), { sellos: 0, cortesTotales: 10, proximo: { tipo: "50%", faltan: 5 } });
assert.equal(TARJETA_SIZE, 10);

console.log("check-tarjeta OK");
