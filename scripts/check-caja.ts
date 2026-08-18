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
import { snapshotDinero, diferenciaCaja, repartoDeVenta, totalDeMedio } from "../src/lib/cobro.ts";

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

// ── Cobro MIXTO (0060) ───────────────────────────────────────────────────────
// El caso que rompía la caja: el cliente paga una parte en efectivo y otra por
// Nequi. Antes había que elegir un solo medio y el cajón nunca cuadraba.
{
  const mixta = {
    medio: "efectivo",
    total: 35000,
    pagos: [
      { medio: "efectivo", monto: 20000 },
      { medio: "nequi", monto: 15000 },
    ],
  };
  const t = snapshotDinero([mixta]).totales;
  assert.equal(t.efectivo.total, 20000, "solo los 20 mil van al cajón");
  assert.equal(t.nequi.total, 15000, "el resto va a nequi");
  assert.equal(snapshotDinero([mixta]).ingresos, 35000, "la venta sigue valiendo 35 mil");
  assert.equal(
    snapshotDinero([mixta], { montoApertura: 50000 }).esperadoEfectivo,
    70000,
    "en el cajón se esperan el fondo + SOLO la parte en efectivo",
  );
  assert.equal(totalDeMedio([mixta], "efectivo"), 20000, "totalDeMedio lee el reparto");
}

// Sin reparto, todo al medio de la venta (el 99% de los cobros).
assert.deepEqual(
  repartoDeVenta({ medio: "datafono", total: 40000 }),
  [{ medio: "datafono", monto: 40000 }],
  "sin pagos, una sola parte",
);

// Un reparto que NO suma el total es dato corrupto: se ignora y manda el medio
// principal. Repartir plata que no existe descuadraría el cajón en silencio.
{
  const rota = {
    medio: "efectivo",
    total: 35000,
    pagos: [
      { medio: "efectivo", monto: 20000 },
      { medio: "nequi", monto: 9999 },
    ],
  };
  assert.deepEqual(repartoDeVenta(rota), [{ medio: "efectivo", monto: 35000 }], "reparto que no cuadra se descarta");
  assert.equal(snapshotDinero([rota]).ingresos, 35000, "la venta nunca vale más ni menos que su total");
}

// Basura en el jsonb (viene de la base, puede ser cualquier cosa): no revienta.
for (const basura of [null, "efectivo", 42, [], [{ medio: "efectivo" }], [{ monto: 1 }, { monto: 2 }]]) {
  const v = { medio: "nequi", total: 10000, pagos: basura };
  assert.deepEqual(repartoDeVenta(v), [{ medio: "nequi", monto: 10000 }], `pagos basura: ${JSON.stringify(basura)}`);
}

// La propina en efectivo sobre una venta MIXTA sigue entrando al cajón.
{
  const v = {
    medio: "nequi",
    total: 30000,
    propina: 5000,
    propinaMedio: "efectivo",
    pagos: [
      { medio: "nequi", monto: 25000 },
      { medio: "efectivo", monto: 5000 },
    ],
  };
  const s2 = snapshotDinero([v]);
  assert.equal(s2.esperadoEfectivo, 10000, "5 mil de la parte en efectivo + 5 mil de propina");
}


console.log(
  "check-caja OK — esperado/diferencia, y el cobro mixto reparte por medio sin inventar plata",
);
