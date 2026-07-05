// Chequeo ejecutable de la matemática del cobro (checkout v2).
// Verifica la función pura calcularCobro (la misma que usa completarReserva):
// total, descuento (cupón), propina y puntos de fidelidad.
//
//   node scripts/check-cobro.ts
//
// (Node ≥23.6 corre TypeScript directo con type stripping; no requiere build.)
import assert from "node:assert/strict";
import { calcularCobro, PUNTOS_POR_COP } from "../src/lib/cobro.ts";

// (a) Cobro simple: servicio $25.000 + 2 gaseosas de $5.000, sin cupón ni propina.
{
  const c = calcularCobro({ items: [{ precio: 25_000, cantidad: 1 }, { precio: 5_000, cantidad: 2 }] });
  assert.equal(c.bruto, 35_000, "bruto = servicios + productos");
  assert.equal(c.descuento, 0, "sin cupón no hay descuento");
  assert.equal(c.total, 35_000, "total = bruto sin descuento");
  assert.equal(c.propina, 0, "sin propina");
  assert.equal(c.aCobrar, 35_000, "a cobrar = total");
  assert.equal(c.puntos, 35, "1 punto por cada $1.000 netos");
}

// (b) La propina NO entra al total ni suma puntos; sí entra en aCobrar.
{
  const c = calcularCobro({ items: [{ precio: 25_000, cantidad: 1 }], propina: 5_000 });
  assert.equal(c.total, 25_000, "la propina no infla el total");
  assert.equal(c.propina, 5_000, "propina registrada aparte");
  assert.equal(c.aCobrar, 30_000, "a cobrar = total + propina");
  assert.equal(c.puntos, 25, "los puntos son sobre el neto SIN propina");
}

// (c) Cupón porcentaje: 10% sobre servicios + productos (redondeado).
{
  const c = calcularCobro({
    items: [{ precio: 25_000, cantidad: 1 }, { precio: 4_500, cantidad: 1 }],
    cupon: { tipo: "porcentaje", valor: 10 },
    propina: 2_000,
  });
  assert.equal(c.descuento, 2_950, "10% de $29.500, redondeado");
  assert.equal(c.total, 26_550, "total = bruto − descuento");
  assert.equal(c.aCobrar, 28_550, "a cobrar = total + propina");
  assert.equal(c.puntos, 26, "floor(26.550 / 1.000)");
}

// (d) Cupón de monto con tope: nunca descuenta más que el bruto (total ≥ 0).
{
  const c = calcularCobro({
    items: [{ precio: 10_000, cantidad: 1 }],
    cupon: { tipo: "monto", valor: 50_000 },
    propina: 3_000,
  });
  assert.equal(c.descuento, 10_000, "el descuento se recorta al bruto");
  assert.equal(c.total, 0, "el total nunca queda negativo");
  assert.equal(c.aCobrar, 3_000, "aun con total 0 la propina se cobra");
  assert.equal(c.puntos, 0, "sin neto no hay puntos");
}

// (e) Propina inválida se sanea: negativos, decimales y NaN no rompen la venta.
{
  assert.equal(calcularCobro({ items: [{ precio: 20_000, cantidad: 1 }], propina: -5_000 }).propina, 0, "propina negativa → 0");
  assert.equal(calcularCobro({ items: [{ precio: 20_000, cantidad: 1 }], propina: 2_500.9 }).propina, 2_500, "propina con decimales → entero");
  assert.equal(calcularCobro({ items: [{ precio: 20_000, cantidad: 1 }], propina: Number.NaN }).propina, 0, "NaN → 0");
}

// (f) Cupón de monto negativo no infla el total (descuento con piso 0).
{
  const c = calcularCobro({ items: [{ precio: 20_000, cantidad: 1 }], cupon: { tipo: "monto", valor: -9_999 } });
  assert.equal(c.descuento, 0, "descuento negativo → 0");
  assert.equal(c.total, 20_000, "el total no cambia");
}

// (g) Venta rápida típica: 2 servicios sueltos + producto, cupón 100%.
{
  const c = calcularCobro({
    items: [
      { precio: 18_000, cantidad: 1 },
      { precio: 12_000, cantidad: 1 },
      { precio: 6_000, cantidad: 3 },
    ],
    cupon: { tipo: "porcentaje", valor: 100 },
    propina: 10_000,
  });
  assert.equal(c.bruto, 48_000);
  assert.equal(c.descuento, 48_000, "100% descuenta todo el bruto");
  assert.equal(c.total, 0);
  assert.equal(c.aCobrar, 10_000, "solo queda la propina");
  assert.equal(c.puntos, 0);
}

assert.equal(PUNTOS_POR_COP, 1000, "regla de fidelidad: 1 punto por $1.000");

console.log("check-cobro OK — total/descuento/propina/puntos correctos (calcularCobro)");
