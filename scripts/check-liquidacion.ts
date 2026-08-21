// Chequeo ejecutable de la liquidación semanal del barbero.
//
//   node scripts/check-liquidacion.ts
//
// Esto es plata que se le paga a una persona todas las semanas. Si la cuenta se
// rompe nadie ve un error: sale un número distinto y alguien cobra de menos (o de
// más) hasta que reclama. De ahí que la matemática viva suelta y testeada.
import assert from "node:assert/strict";
import { comisionDeItems, netoLiquidacion } from "../src/lib/cobro.ts";

// (a) Cada ítem con SU porcentaje. El bug que evita: liquidar el 50% sobre el
//     total de la venta. Acá el corte va al 50% y el producto al 10%; con el
//     atajo se le pagarían $17.500 en vez de $14.500 — $3.000 de más por venta.
const venta = [
  { cantidad: 1, precio_unitario: 25000, comision_pct: 50 },
  { cantidad: 2, precio_unitario: 5000, comision_pct: 10 },
];
assert.equal(comisionDeItems(venta), 12500 + 1000, "cada ítem liquida con su propio porcentaje");

// (b) numeric de Postgres llega como STRING en el JSON. Sin Number() explícito el
//     porcentaje se cuela como NaN y la liquidación entera queda en NaN.
assert.equal(
  comisionDeItems([{ cantidad: 1, precio_unitario: 30000, comision_pct: "50" }]),
  15000,
  "un porcentaje que viene como texto se entiende igual",
);

// (c) Faltantes y basura no envenenan el total: valen 0, no NaN.
assert.equal(comisionDeItems([{ cantidad: 1, precio_unitario: 30000, comision_pct: null }]), 0, "sin porcentaje, no hay comisión");
assert.equal(comisionDeItems([{ precio_unitario: 30000, comision_pct: 50 }]), 15000, "sin cantidad se asume 1");
assert.equal(comisionDeItems([{ cantidad: 1, precio_unitario: null, comision_pct: 50 }]), 0, "sin precio no hay nada que repartir");
assert.equal(comisionDeItems([]), 0, "una venta sin ítems liquida 0");

// (d) Redondeo POR ÍTEM, a pesos. Un 33% sobre $10.000 son $3.300 exactos; el
//     redondeo se aplica en cada línea para que la suma no arrastre centavos.
assert.equal(comisionDeItems([{ cantidad: 3, precio_unitario: 3333, comision_pct: 33 }]), 3300, "redondea a pesos");
assert.ok(Number.isInteger(comisionDeItems(venta)), "la comisión siempre es un entero de pesos");

// (e) El neto: lo que se le paga tras descontar adelantos y consumos.
assert.equal(
  netoLiquidacion({ comision: 400000, adelantos: 150000, consumos: 12000 }),
  238000,
  "neto = comisión − adelantos − consumos",
);
// Y si pidió más adelantos de lo que produjo, el número va en NEGATIVO: un cero
// tranquilizador escondería justo el caso que el dueño necesita ver.
assert.equal(netoLiquidacion({ comision: 100000, adelantos: 150000, consumos: 0 }), -50000, "queda debiendo, y se ve");

console.log("check-liquidacion OK — comisión por ítem (no 50% al bulto), redondeo y neto con descuentos");
