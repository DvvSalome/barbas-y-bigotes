// Chequeo ejecutable de la matemática de la CAJA (cierre manos-libres).
// Verifica las funciones puras snapshotDinero / diferenciaCaja (las mismas que
// usan snapshotCaja → cerrarCaja/cerrarCajaSede y los paneles de estado):
//   esperadoEfectivo = monto_apertura + efectivo + propina EN EFECTIVO − gastos
//   diferencia       = efectivo contado − esperado   (+ sobra / − falta)
//
//   node scripts/check-caja.ts
//
// (Node ≥23.6 corre TypeScript directo con type stripping; no requiere build.)
import assert from "node:assert/strict";
import { snapshotDinero, diferenciaCaja } from "../src/lib/cobro.ts";

// (a) Caja mixta: el esperado en el cajón es SOLO efectivo + propina en efectivo.
{
  const s = snapshotDinero([
    { medio: "efectivo", total: 20_000, propina: 2_000 },
    { medio: "efectivo", total: 15_000, propina: 0 },
    { medio: "nequi", total: 30_000, propina: 5_000 },
    { medio: "datafono", total: 10_000, propina: null },
  ]);
  assert.equal(s.efectivo, 35_000, "efectivo agrupa sus ventas");
  assert.equal(s.datafono, 10_000, "datáfono agrupado");
  assert.equal(s.ingresos, 75_000, "ingresos = TODOS los medios");
  // La propina de $5.000 es de Nequi: NO va al cajón. Solo la de efectivo ($2.000).
  assert.equal(s.esperadoEfectivo, 37_000, "esperado = efectivo + propina EN EFECTIVO");
}

// (b) Cuadre exacto: contado == esperado → diferencia 0.
{
  const s = snapshotDinero([{ medio: "efectivo", total: 50_000, propina: 3_000 }]);
  assert.equal(s.esperadoEfectivo, 53_000, "esperado incluye la propina en efectivo");
  assert.equal(diferenciaCaja(53_000, s.esperadoEfectivo), 0, "contado = esperado → cuadra");
}

// (c) Sobra en el cajón: contado > esperado → diferencia positiva.
{
  const s = snapshotDinero([{ medio: "efectivo", total: 40_000, propina: 0 }]);
  assert.equal(diferenciaCaja(45_000, s.esperadoEfectivo), 5_000, "sobra $5.000 (positiva)");
}

// (d) Falta en el cajón: contado < esperado → diferencia negativa.
{
  const s = snapshotDinero([{ medio: "efectivo", total: 40_000, propina: 1_000 }]);
  assert.equal(s.esperadoEfectivo, 41_000, "esperado = 40.000 + 1.000 propina");
  assert.equal(diferenciaCaja(38_000, s.esperadoEfectivo), -3_000, "falta $3.000 (negativa)");
}

// (e) Sin ventas en efectivo: el cajón espera 0 aunque haya cobros por otros medios.
{
  const s = snapshotDinero([
    { medio: "nequi", total: 30_000, propina: 4_000 },
    { medio: "datafono", total: 20_000, propina: 0 },
  ]);
  assert.equal(s.efectivo, 0, "sin efectivo el total efectivo es 0");
  assert.equal(s.esperadoEfectivo, 0, "el cajón no espera nada de Nequi/datáfono");
  assert.equal(s.ingresos, 50_000, "los ingresos igual cuentan todos los medios");
  assert.equal(diferenciaCaja(0, s.esperadoEfectivo), 0, "cajón vacío cuadra en 0");
}

// (f) Caja vacía (día sin ventas): todo en 0, sin NaN.
{
  const s = snapshotDinero([]);
  assert.deepEqual(
    { ef: s.efectivo, esp: s.esperadoEfectivo, ing: s.ingresos },
    { ef: 0, esp: 0, ing: 0 },
    "caja sin ventas: todo 0",
  );
}

// (g) propina null (ventas viejas) cuenta como 0 en el esperado.
{
  const s = snapshotDinero([{ medio: "efectivo", total: 25_000, propina: null }]);
  assert.equal(s.esperadoEfectivo, 25_000, "propina null → 0, esperado = solo el efectivo");
}

// (h) Fondo de apertura no-cero: el cajón arranca con plata (cierre admin manual).
{
  const s = snapshotDinero(
    [{ medio: "efectivo", total: 40_000, propina: 2_000 }],
    { montoApertura: 100_000 },
  );
  // 100.000 fondo + 40.000 efectivo + 2.000 propina en efectivo.
  assert.equal(s.esperadoEfectivo, 142_000, "esperado incluye el fondo de apertura");
  assert.equal(diferenciaCaja(142_000, s.esperadoEfectivo), 0, "contado = fondo+ventas → cuadra");
  assert.equal(s.ingresos, 40_000, "el fondo NO cuenta como ingreso del día");
}

// (i) Gastos en efectivo: salen del cajón y bajan el esperado (sin fondo).
{
  const s = snapshotDinero(
    [{ medio: "efectivo", total: 50_000, propina: 3_000 }],
    { totalGastos: 20_000 },
  );
  // 50.000 efectivo + 3.000 propina − 20.000 gastos.
  assert.equal(s.esperadoEfectivo, 33_000, "esperado descuenta los gastos del cajón");
  assert.equal(diferenciaCaja(33_000, s.esperadoEfectivo), 0, "contado tras gastos → cuadra");
}

// (j) Fondo de apertura Y gastos juntos: el caso completo del cierre admin.
{
  const s = snapshotDinero(
    [
      { medio: "efectivo", total: 60_000, propina: 4_000 },
      { medio: "nequi", total: 30_000, propina: 5_000 },
    ],
    { montoApertura: 50_000, totalGastos: 15_000 },
  );
  // 50.000 fondo + 60.000 efectivo + 4.000 propina efectivo − 15.000 gastos.
  // La propina de Nequi ($5.000) NO va al cajón.
  assert.equal(s.esperadoEfectivo, 99_000, "esperado = fondo + efectivo + propina efectivo − gastos");
  assert.equal(s.ingresos, 90_000, "ingresos = todos los medios (sin fondo, sin descontar gastos)");
  assert.equal(diferenciaCaja(95_000, s.esperadoEfectivo), -4_000, "faltan $4.000 en el cajón");
}

// (k) Propina en EFECTIVO sobre una venta DIGITAL (0053, #16): entra al cajón aunque
//     el servicio se pagó por Nequi. Sin propina_medio (casos a/j) seguía el medio de
//     la venta y generaba un sobrante; marcada 'efectivo' va al cajón.
{
  const s = snapshotDinero([
    { medio: "nequi", total: 30_000, propina: 5_000, propinaMedio: "efectivo" },
    { medio: "efectivo", total: 20_000, propina: 2_000 },
  ]);
  assert.equal(s.efectivo, 20_000, "el TOTAL de ventas en efectivo no cambia (la propina va aparte)");
  // Cajón = 20.000 efectivo + 2.000 propina efectivo + 5.000 propina en efectivo de la venta Nequi.
  assert.equal(s.esperadoEfectivo, 27_000, "la propina en efectivo de una venta Nequi SÍ va al cajón");
  assert.equal(s.ingresos, 50_000, "ingresos = todos los medios");
}

console.log(
  "check-caja OK — esperado = fondo + efectivo + propina efectivo − gastos; diferencia = contado − esperado",
);
