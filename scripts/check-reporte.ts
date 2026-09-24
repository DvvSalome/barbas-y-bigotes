// Chequeo ejecutable del reporte del mes (el Excel del dueño, armado por la app).
//
//   node scripts/check-reporte.ts
//
// Es la cuenta con la que el dueño va a comparar su Excel de siempre. Si un día
// se corre o el inventario no cuadra, lo primero que concluye es que la app miente
// y vuelve al Excel. De ahí que la matemática viva suelta y probada.
import assert from "node:assert/strict";
import { armarReporte, mesDelReporte, nombreMes } from "../src/lib/reporte.ts";

// (a) El mes en curso corre hasta HOY: los días que no han llegado no son "días
//     sin ventas", y como filas en cero ensuciarían el promedio y el Excel.
const sep = mesDelReporte(null, "2026-09-24");
assert.equal(sep.mes, "2026-09");
assert.equal(sep.hastaYmd, "2026-09-24", "el mes en curso llega hasta hoy");
assert.equal(sep.dias.length, 24);
assert.equal(sep.enCurso, true);
assert.equal(sep.siguiente, null, "no se navega a un mes que no ha llegado");
assert.equal(sep.anterior, "2026-08");

// (b) Un mes cerrado va completo, con el largo real de cada mes.
assert.equal(mesDelReporte("2026-08", "2026-09-24").hastaYmd, "2026-08-31");
assert.equal(mesDelReporte("2026-02", "2026-09-24").dias.length, 28);
assert.equal(mesDelReporte("2028-02", "2028-09-01").dias.length, 29, "año bisiesto");
assert.equal(mesDelReporte("2026-04", "2026-09-24").hastaYmd, "2026-04-30");
assert.equal(mesDelReporte("2026-08", "2026-09-24").siguiente, "2026-09");

// (c) Cambio de año hacia los dos lados.
assert.equal(mesDelReporte("2026-01", "2026-09-24").anterior, "2025-12");
assert.equal(mesDelReporte("2025-12", "2026-09-24").siguiente, "2026-01");

// (d) Basura o un mes futuro en la URL: el mes actual, nunca un reporte inventado.
for (const malo of ["2026-13", "2026-9", "abc", "", "2026-10", "2027-01"]) {
  assert.equal(mesDelReporte(malo, "2026-09-24").mes, "2026-09", `"${malo}" cae al mes actual`);
}
assert.equal(nombreMes("2026-09"), "septiembre 2026");

// ── La cuenta ─────────────────────────────────────────────────────────────
const ago = mesDelReporte("2026-08", "2026-09-24");
const r = armarReporte(ago, {
  ventas: [
    // Corte de $40.000 al 50 %: al local le quedan $20.000.
    { ymd: "2026-08-03", total: 40000, comision: 20000, deArriendo: false },
    // Producto sin comisión, vendido por el local.
    { ymd: "2026-08-03", total: 6000, comision: 0, deArriendo: false },
    // Barbero de arriendo de silla: la venta es suya, al local no le queda nada.
    { ymd: "2026-08-10", total: 35000, comision: 0, deArriendo: true },
    // Fuera del mes: no entra.
    { ymd: "2026-09-01", total: 99999, comision: 0, deArriendo: false },
  ],
  gastos: [
    { ymd: "2026-08-03", categoria: "Arriendo", monto: 2773000 },
    { ymd: "2026-08-03", categoria: "Aseo", monto: 5000 },
    { ymd: "2026-08-03", categoria: "Aseo", monto: 3000 },
    { ymd: "2026-08-20", categoria: "  ", monto: 1000 },
  ],
  movimientos: [
    // Agua (costo 1.000): entraron 10 el 2, se vendieron 3, el equipo se tomó 1.
    { productoId: "agua", ymd: "2026-08-02", cantidad: 10, motivo: "entrada" },
    { productoId: "agua", ymd: "2026-08-05", cantidad: -3, motivo: "venta" },
    { productoId: "agua", ymd: "2026-08-06", cantidad: -1, motivo: "consumo" },
    // Y en septiembre entraron 4 más: el cierre de agosto tiene que descontarlos.
    { productoId: "agua", ymd: "2026-09-02", cantidad: 4, motivo: "entrada" },
    // Cera (sin costo): una venta que se anuló devuelve la unidad como ajuste.
    { productoId: "cera", ymd: "2026-08-07", cantidad: -1, motivo: "venta" },
    { productoId: "cera", ymd: "2026-08-07", cantidad: 1, motivo: "ajuste" },
    { productoId: "cera", ymd: "2026-08-08", cantidad: 2, motivo: "entrada" },
  ],
  vendidos: [
    { productoId: "agua", ymd: "2026-08-05", cantidad: 3, precioUnitario: 2000 },
    // La venta anulada de la cera NO llega acá (se filtra en la lectura).
  ],
  productos: [
    { id: "agua", nombre: "Agua", sedeId: "plaza", precio: 2000, stock: 15, activo: true, fotoUrl: null },
    { id: "cera", nombre: "Cera", sedeId: "plaza", precio: 25000, stock: 6, activo: true, fotoUrl: null },
    // Retirado y sin nada en el mes: no es parte del inventario.
    { id: "viejo", nombre: "Viejo", sedeId: "plaza", precio: 1000, stock: 0, activo: false, fotoUrl: null },
  ],
  costos: { agua: 1000 },
});

const d3 = r.dias.find((d) => d.ymd === "2026-08-03")!;
assert.equal(d3.cobros, 2);
assert.equal(d3.ingresos, 46000);
assert.equal(d3.local, 20000 + 6000, "al local le queda el total menos la comisión de cada venta");
assert.equal(d3.gastos, 2781000);
assert.deepEqual(
  d3.conceptos,
  [
    { categoria: "Arriendo", monto: 2773000 },
    { categoria: "Aseo", monto: 8000 },
  ],
  "los gastos del día se juntan por concepto, el más grande primero",
);
assert.equal(d3.queda, 26000 - 2781000);
assert.equal(r.dias.find((d) => d.ymd === "2026-08-10")!.local, 0, "arriendo de silla: nada para el local");
assert.equal(r.dias.find((d) => d.ymd === "2026-08-20")!.conceptos[0].categoria, "Otro", "concepto vacío = Otro");
assert.equal(r.dias.length, 31, "un mes cerrado trae sus 31 días, con o sin ventas");
assert.equal(r.diasConCobros, 2);
assert.deepEqual(r.totales, {
  cobros: 3,
  ingresos: 81000,
  local: 26000,
  gastos: 2782000,
  pedido: 10 * 1000,
  queda: 26000 - 2782000,
});
assert.equal(r.pedidoSinCosto, 2, "las 2 ceras que entraron no se pueden valorar sin costo");
assert.deepEqual(r.gastosPorConcepto[0], { categoria: "Arriendo", total: 2773000, veces: 1 });

const agua = r.inventario.find((f) => f.productoId === "agua")!;
// Hoy hay 15. Desde el 1° de agosto se movieron +10 −3 −1 +4 = +10 → arrancó con 5.
assert.equal(agua.inicial, 5, "el stock al empezar se reconstruye hacia atrás con el kardex");
// Al cerrar agosto: 15 menos lo que entró en septiembre (4) = 11 = 5 + 10 − 3 − 1.
assert.equal(agua.quedan, 11, "el cierre de un mes pasado descuenta lo que se movió después");
assert.equal(agua.entro, 10);
assert.equal(agua.vendidas, 3);
assert.equal(agua.otras, 1, "la que se tomó el equipo cuadra el inventario");
assert.equal(agua.inicial + agua.entro - agua.vendidas - agua.otras, agua.quedan, "inicial + entró − vendidas − otras = quedan");
assert.equal(agua.vendido, 6000);
assert.equal(agua.ganancia, 6000 - 3 * 1000);
assert.equal(agua.invertida, 11 * 1000);

const cera = r.inventario.find((f) => f.productoId === "cera")!;
assert.equal(cera.vendidas, 0, "una venta anulada no es una venta");
assert.equal(cera.otras, 0, "y su devolución no se cuenta como merma");
assert.equal(cera.inicial, 4);
assert.equal(cera.quedan, 6);
assert.equal(cera.ganancia, null, "sin costo no hay ganancia inventada");
assert.equal(cera.invertida, null);
assert.equal(r.sinCosto, 1);
assert.ok(!r.inventario.some((f) => f.productoId === "viejo"), "un producto retirado y quieto no sale");
assert.deepEqual(r.inventarioTotales, { vendidas: 3, vendido: 6000, ganancia: 3000, invertida: 11000 });

// (e) El mes en curso: el cierre es el stock de hoy.
const hoy = armarReporte(sep, {
  ventas: [],
  gastos: [],
  movimientos: [{ productoId: "agua", ymd: "2026-09-02", cantidad: 4, motivo: "entrada" }],
  vendidos: [],
  productos: [{ id: "agua", nombre: "Agua", sedeId: "plaza", precio: 2000, stock: 15, activo: true, fotoUrl: null }],
  costos: {},
});
assert.equal(hoy.inventario[0].quedan, 15);
assert.equal(hoy.inventario[0].inicial, 11);
assert.equal(hoy.dias.length, 24);

console.log("check-reporte OK — meses, consolidado, comisión, gastos por concepto e inventario cuadran");
