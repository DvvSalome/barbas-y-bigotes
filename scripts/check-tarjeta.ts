// scripts/check-tarjeta.ts — self-check de la matemática de la tarjeta de cortes.
//   node scripts/check-tarjeta.ts
//
// Regla vigente: 5º corte = REGALO (sin descuento), 10º corte = 50%.
// El caso que más importa acá es que el regalo NO toque la plata: si alguien lo
// tratara como descuento, la barbería regalaría medio corte cada 5 visitas sin
// que nadie se entere hasta el cuadre.
import assert from "node:assert/strict";
import {
  beneficioProximoCorte,
  estadoTarjeta,
  TARJETA_SIZE,
  HITO_REGALO,
  HITO_50,
} from "../src/lib/tarjeta.ts";

const BASE = 30000;

// --- Posiciones sin premio ---
for (const prev of [0, 1, 2, 3]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null, `${prev} previos: sin premio`);
for (const prev of [5, 6, 7, 8]) assert.equal(beneficioProximoCorte(prev, BASE).tipo, null, `${prev} previos: sin premio`);

// --- 5º corte: REGALO y CERO descuento ---
// El cliente paga el corte completo; el barbero le entrega algo.
assert.deepEqual(beneficioProximoCorte(4, BASE), { tipo: "regalo", descuento: 0, posicion: 5 });
assert.equal(beneficioProximoCorte(4, 999999).descuento, 0, "el regalo NUNCA descuenta, sea cual sea el precio");

// --- 10º corte: 50% sobre el corte base ---
assert.deepEqual(beneficioProximoCorte(9, BASE), { tipo: "50%", descuento: 15000, posicion: 10 });
// floor: un precio impar no puede dejar centavos (el negocio cobra en pesos enteros).
assert.equal(beneficioProximoCorte(9, 25001).descuento, 12500, "el 50% redondea hacia abajo");

// --- El ciclo se reinicia a los 10 ---
assert.equal(beneficioProximoCorte(10, BASE).tipo, null, "el 11º arranca ciclo nuevo, sin premio");
assert.equal(beneficioProximoCorte(14, BASE).tipo, "regalo", "el 15º es el 5º del 2º ciclo: regalo");
assert.equal(beneficioProximoCorte(19, BASE).tipo, "50%", "el 20º es el 10º del 2º ciclo: 50%");
assert.equal(beneficioProximoCorte(24, BASE).posicion, HITO_REGALO);
assert.equal(beneficioProximoCorte(29, BASE).posicion, HITO_50);

// --- Cuánta plata resigna la barbería por tarjeta completa ---
// Solo el 10º descuenta. Si este número sube, alguien convirtió el regalo en dinero.
const resignado = Array.from({ length: TARJETA_SIZE }, (_, i) => beneficioProximoCorte(i, BASE).descuento).reduce(
  (a, b) => a + b,
  0,
);
assert.equal(resignado, 15000, "por cada 10 cortes se resigna medio corte, ni uno entero");

// --- estadoTarjeta: sellos y próximo premio ---
assert.deepEqual(estadoTarjeta(0), { sellos: 0, cortesTotales: 0, proximo: { tipo: "regalo", faltan: 5 } });
assert.deepEqual(estadoTarjeta(3), { sellos: 3, cortesTotales: 3, proximo: { tipo: "regalo", faltan: 2 } });
assert.deepEqual(estadoTarjeta(4), { sellos: 4, cortesTotales: 4, proximo: { tipo: "regalo", faltan: 1 } });
assert.deepEqual(estadoTarjeta(5), { sellos: 5, cortesTotales: 5, proximo: { tipo: "50%", faltan: 5 } });
assert.deepEqual(estadoTarjeta(9), { sellos: 9, cortesTotales: 9, proximo: { tipo: "50%", faltan: 1 } });
assert.deepEqual(estadoTarjeta(10), { sellos: 0, cortesTotales: 10, proximo: { tipo: "regalo", faltan: 5 } });

// `faltan` nunca puede ser 0 ni negativo: sería "te falta 0 cortes" en la UI.
for (let c = 0; c < 40; c++) {
  const e = estadoTarjeta(c);
  assert.ok(e.proximo.faltan >= 1, `faltan >= 1 con ${c} cortes (dio ${e.proximo.faltan})`);
  assert.ok(e.sellos >= 0 && e.sellos < TARJETA_SIZE, `sellos en rango con ${c} cortes`);
}

// --- Coherencia entre lo que se anuncia y lo que se aplica ---
// Lo que la tarjeta ANUNCIA como próximo premio tiene que ser lo que el cobro
// APLICA cuando el cliente llegue. Si divergen, el cliente reclama con razón.
for (let c = 0; c < 40; c++) {
  const anunciado = estadoTarjeta(c).proximo;
  const alLlegar = beneficioProximoCorte(c + anunciado.faltan - 1, BASE);
  assert.equal(
    alLlegar.tipo,
    anunciado.tipo,
    `con ${c} cortes se anuncia ${anunciado.tipo} y se aplicaría ${alLlegar.tipo}`,
  );
}

assert.equal(TARJETA_SIZE, 10);
assert.equal(HITO_REGALO, 5);
assert.equal(HITO_50, 10);

console.log("check-tarjeta OK — 5º regalo (sin descuento), 10º 50%");
