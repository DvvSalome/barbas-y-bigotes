// El reporte del mes (pedido del dueño, 24-sep): lo que hoy se lleva a mano en el
// Excel "…PZ 2026", una pestaña por mes, armado con lo que registra la app.
//
// Las dos partes del Excel, con sus mismas columnas:
//  · CONSOLIDADO: una fila por día — lo que entró, lo que queda para el local
//    después de las comisiones, los gastos con su concepto, el pedido de
//    productos y lo que queda.
//  · INVENTARIO: por producto — con cuánto arrancó el mes, cuánto entró, cuánto
//    se vendió, cuánto queda, a cuánto se compra y se vende, la ganancia y la
//    plata quieta en la estantería.
//
// Módulo puro y sin imports: recibe las filas ya leídas (queries.ts las trae) y
// se verifica sin levantar Supabase — scripts/check-reporte.ts. Es plata: si la
// cuenta se rompe nadie ve un error, ve un número distinto.

export type MesReporte = {
  /** "2026-09" */
  mes: string;
  desdeYmd: string;
  /** Último día que entra: fin de mes, o HOY si es el mes en curso (los días que
   *  no han llegado serían filas en cero que parecen días sin ventas). */
  hastaYmd: string;
  dias: string[];
  anterior: string;
  /** null cuando el siguiente todavía no ha llegado. */
  siguiente: string | null;
  enCurso: boolean;
};

const dos = (n: number) => String(n).padStart(2, "0");
const mesDe = (y: number, m: number) => {
  const f = new Date(Date.UTC(y, m - 1, 1));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}`;
};

/** El mes pedido por la URL (?mes=2026-09), o el actual si no sirve o todavía no llega. */
export function mesDelReporte(param: string | null | undefined, hoyYmd: string): MesReporte {
  const actual = hoyYmd.slice(0, 7);
  const mes = param && /^\d{4}-(0[1-9]|1[0-2])$/.test(param) && param <= actual ? param : actual;
  const [y, m] = mes.split("-").map(Number);
  // El día 0 del mes siguiente es el último de este: 28, 29, 30 o 31 sin tabla.
  const finYmd = `${mes}-${dos(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
  const enCurso = mes === actual;
  const hastaYmd = enCurso ? hoyYmd : finYmd;
  const dias: string[] = [];
  for (let d = 1; `${mes}-${dos(d)}` <= hastaYmd; d++) dias.push(`${mes}-${dos(d)}`);
  const siguiente = mesDe(y, m + 1);
  return {
    mes,
    desdeYmd: `${mes}-01`,
    hastaYmd,
    dias,
    anterior: mesDe(y, m - 1),
    siguiente: siguiente <= actual ? siguiente : null,
    enCurso,
  };
}

const MESES = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
/** "2026-09" → "septiembre 2026" */
export const nombreMes = (mes: string) => {
  const [y, m] = mes.split("-").map(Number);
  return `${MESES[m - 1]} ${y}`;
};

// ── Lo que entra (ya leído y pasado a día de Bogotá por queries.ts) ────────

export type VentaReporte = {
  ymd: string;
  /** Lo cobrado, sin propina (la propina es del barbero). */
  total: number;
  /** La comisión del barbero: la MISMA cuenta de la liquidación (comisionDeItems). */
  comision: number;
  /** Barbero de arriendo de silla: la venta es toda suya, al local no le queda nada. */
  deArriendo: boolean;
};
export type GastoReporte = { ymd: string; categoria: string; monto: number };
/** Una fila del kardex (stock_movimientos). Positivo entra, negativo sale. */
export type MovimientoReporte = { productoId: string; ymd: string; cantidad: number; motivo: string };
/** Un producto vendido en una venta NO anulada (venta_items). */
export type VendidoReporte = { productoId: string; ymd: string; cantidad: number; precioUnitario: number };
export type ProductoReporte = {
  id: string;
  nombre: string;
  sedeId: string;
  precio: number;
  /** El stock de HOY: el del mes se saca hacia atrás con el kardex. */
  stock: number;
  activo: boolean;
  fotoUrl: string | null;
};

// ── Lo que sale ────────────────────────────────────────────────────────────

export type DiaReporte = {
  ymd: string;
  cobros: number;
  ingresos: number;
  /** Lo del local: ingresos menos la comisión de cada barbero (el "VALOR" del Excel). */
  local: number;
  gastos: number;
  /** En qué se gastó ese día, sumado por concepto. */
  conceptos: { categoria: string; monto: number }[];
  /** Lo que costó la mercancía que entró ese día (entradas × costo). */
  pedido: number;
  /** local − gastos. */
  queda: number;
};

export type FilaInventario = {
  productoId: string;
  nombre: string;
  sedeId: string;
  fotoUrl: string | null;
  /** Con cuánto arrancó el mes. */
  inicial: number;
  entro: number;
  vendidas: number;
  /** Consumo del equipo, merma y ajustes: lo que hace que inicial + entró − vendidas
   *  llegue a lo que queda. Negativo si los ajustes sumaron. */
  otras: number;
  /** Lo que quedó al cerrar el mes (o hoy, si el mes va en curso). */
  quedan: number;
  costo: number | null;
  precio: number;
  /** Plata que entró por lo vendido (al precio al que se cobró de verdad). */
  vendido: number;
  ganancia: number | null;
  invertida: number | null;
};

export type Reporte = {
  dias: DiaReporte[];
  totales: { cobros: number; ingresos: number; local: number; gastos: number; pedido: number; queda: number };
  diasConCobros: number;
  gastosPorConcepto: { categoria: string; total: number; veces: number }[];
  inventario: FilaInventario[];
  inventarioTotales: { vendidas: number; vendido: number; ganancia: number; invertida: number };
  /** Productos del inventario sin costo cargado: sin eso no hay ganancia ni plata invertida. */
  sinCosto: number;
  /** Unidades que entraron de productos sin costo: el pedido no las pudo valorar. */
  pedidoSinCosto: number;
};

export function armarReporte(
  m: MesReporte,
  e: {
    ventas: VentaReporte[];
    gastos: GastoReporte[];
    movimientos: MovimientoReporte[];
    vendidos: VendidoReporte[];
    productos: ProductoReporte[];
    costos: Record<string, number>;
  },
): Reporte {
  const enMes = (ymd: string) => ymd >= m.desdeYmd && ymd <= m.hastaYmd;
  const dias = new Map<string, DiaReporte & { porConcepto: Map<string, number> }>(
    m.dias.map((ymd) => [
      ymd,
      { ymd, cobros: 0, ingresos: 0, local: 0, gastos: 0, conceptos: [], pedido: 0, queda: 0, porConcepto: new Map() },
    ]),
  );

  for (const v of e.ventas) {
    const d = dias.get(v.ymd);
    if (!d) continue;
    d.cobros += 1;
    d.ingresos += v.total;
    d.local += v.deArriendo ? 0 : v.total - v.comision;
  }

  const porConcepto = new Map<string, { total: number; veces: number }>();
  for (const g of e.gastos) {
    const d = dias.get(g.ymd);
    if (!d) continue;
    const categoria = g.categoria.trim() || "Otro";
    d.gastos += g.monto;
    d.porConcepto.set(categoria, (d.porConcepto.get(categoria) ?? 0) + g.monto);
    const c = porConcepto.get(categoria) ?? { total: 0, veces: 0 };
    c.total += g.monto;
    c.veces += 1;
    porConcepto.set(categoria, c);
  }

  let pedidoSinCosto = 0;
  for (const mv of e.movimientos) {
    if (mv.motivo !== "entrada" || mv.cantidad <= 0) continue;
    const d = dias.get(mv.ymd);
    if (!d) continue;
    const costo = e.costos[mv.productoId];
    if (costo === undefined) pedidoSinCosto += mv.cantidad;
    else d.pedido += mv.cantidad * costo;
  }

  const listaDias: DiaReporte[] = [...dias.values()].map(({ porConcepto: pc, ...d }) => ({
    ...d,
    conceptos: [...pc].map(([categoria, monto]) => ({ categoria, monto })).sort((a, b) => b.monto - a.monto),
    queda: d.local - d.gastos,
  }));

  // ── Inventario: el mes se reconstruye hacia atrás desde el stock de hoy ──
  // stock al empezar = hoy − todo lo que se movió desde el día 1;
  // stock al cerrar  = hoy − todo lo que se movió DESPUÉS del último día.
  const inventario: FilaInventario[] = [];
  for (const p of e.productos) {
    const movs = e.movimientos.filter((x) => x.productoId === p.id);
    const desdeInicio = movs.filter((x) => x.ymd >= m.desdeYmd).reduce((a, x) => a + x.cantidad, 0);
    const despues = movs.filter((x) => x.ymd > m.hastaYmd).reduce((a, x) => a + x.cantidad, 0);
    const entro = movs
      .filter((x) => x.motivo === "entrada" && x.cantidad > 0 && enMes(x.ymd))
      .reduce((a, x) => a + x.cantidad, 0);
    const ventas = e.vendidos.filter((x) => x.productoId === p.id && enMes(x.ymd));
    const vendidas = ventas.reduce((a, x) => a + x.cantidad, 0);
    const vendido = ventas.reduce((a, x) => a + x.cantidad * x.precioUnitario, 0);
    const inicial = p.stock - desdeInicio;
    const quedan = p.stock - despues;
    const huboAlgo = vendidas > 0 || movs.some((x) => enMes(x.ymd));
    // Un producto retirado y sin nada en el mes no es parte de este inventario.
    if (!p.activo && !huboAlgo && quedan <= 0) continue;
    const costo = e.costos[p.id] ?? null;
    inventario.push({
      productoId: p.id,
      nombre: p.nombre,
      sedeId: p.sedeId,
      fotoUrl: p.fotoUrl,
      inicial,
      entro,
      vendidas,
      otras: inicial + entro - vendidas - quedan,
      quedan,
      costo,
      precio: p.precio,
      vendido,
      ganancia: costo === null ? null : vendido - vendidas * costo,
      // Lo que hay en la estantería, a lo que costó. Un stock negativo (se vendió
      // lo que el sistema no tenía) no es plata invertida.
      invertida: costo === null ? null : Math.max(quedan, 0) * costo,
    });
  }
  inventario.sort((a, b) => a.sedeId.localeCompare(b.sedeId) || a.nombre.localeCompare(b.nombre, "es"));

  const suma = (xs: number[]) => xs.reduce((a, x) => a + x, 0);
  const totales = {
    cobros: suma(listaDias.map((d) => d.cobros)),
    ingresos: suma(listaDias.map((d) => d.ingresos)),
    local: suma(listaDias.map((d) => d.local)),
    gastos: suma(listaDias.map((d) => d.gastos)),
    pedido: suma(listaDias.map((d) => d.pedido)),
    queda: 0,
  };
  totales.queda = totales.local - totales.gastos;

  return {
    dias: listaDias,
    totales,
    diasConCobros: listaDias.filter((d) => d.cobros > 0).length,
    gastosPorConcepto: [...porConcepto]
      .map(([categoria, c]) => ({ categoria, ...c }))
      .sort((a, b) => b.total - a.total),
    inventario,
    inventarioTotales: {
      vendidas: suma(inventario.map((f) => f.vendidas)),
      vendido: suma(inventario.map((f) => f.vendido)),
      ganancia: suma(inventario.map((f) => f.ganancia ?? 0)),
      invertida: suma(inventario.map((f) => f.invertida ?? 0)),
    },
    sinCosto: inventario.filter((f) => f.costo === null).length,
    pedidoSinCosto,
  };
}
