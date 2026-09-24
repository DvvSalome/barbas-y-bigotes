import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getReporteMes, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { nombreMes } from "@/lib/reporte";
import { DOW, dowDeFecha } from "@/lib/slots";
import { libroBarbas, cabecerasXlsx, type Columna } from "@/lib/excel";
import { cop } from "@/lib/format";

// El reporte del mes en el formato del Excel del dueño: la hoja CONSOLIDADO (un
// renglón por día, del 1 al último) y la de INVENTARIO, con los mismos datos que
// la pantalla /admin/reportes. Un GET con Content-Disposition, como los demás.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  // Plata del local, comisiones y costos: mismo candado que la pantalla.
  if (denied) return new Response(denied, { status: 403 });

  const url = new URL(req.url);
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === url.searchParams.get("sede"))?.id as SedeId | undefined) ?? null;
  const pedido = url.searchParams.get("mes");
  const datos = await getReporteMes(pedido, sede);
  if (!datos) return new Response("Solo el administrador puede bajar este reporte.", { status: 403 });
  const { mes, reporte: r } = datos;
  // Un mes que no sirve (o que no ha llegado) NO baja el mes actual en su lugar:
  // un archivo con otro mes del que se pidió se le pasa al contador sin mirarlo.
  if (pedido && pedido !== mes.mes) {
    return new Response("Ese mes no existe o todavía no ha llegado.", { status: 400 });
  }

  const donde = sede ? (sedes.find((s) => s.id === sede)?.nombre ?? sede) : "Ambas sedes";
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;
  const mesTexto = nombreMes(mes.mes);
  const Mes = mesTexto.charAt(0).toUpperCase() + mesTexto.slice(1);
  const generado = new Date().toLocaleString("es-CO", { timeZone: "America/Bogota", dateStyle: "medium", timeStyle: "short" });
  const tramo = mes.enCurso ? `Del 1 al ${Number(mes.hastaYmd.slice(8))} (va en curso)` : "Mes completo";
  const nulo = (n: number) => n || null; // un día sin nada va en blanco, como en el Excel de siempre

  // ── Hoja 1: CONSOLIDADO ────────────────────────────────────────────────
  const consolidado: Columna[] = [
    { k: "dia", t: "Día", ancho: 12 },
    { k: "cobros", t: "Cobros", tipo: "entero", total: true, ancho: 9 },
    { k: "local", t: "Para el local", tipo: "plata", total: true },
    { k: "ingresos", t: "Ingresos", tipo: "plata", total: true },
    { k: "gastos", t: "Gastos", tipo: "plata", total: true },
    { k: "concepto", t: "Concepto del gasto", ancho: 34, envolver: true },
    { k: "pedido", t: "Pedido de productos", tipo: "plata", total: true, ancho: 17 },
    { k: "queda", t: "Queda", tipo: "plata", total: true },
  ];
  const filasConsolidado = r.dias.map((d) => ({
    dia: `${DOW[dowDeFecha(d.ymd)]} ${d.ymd.slice(8)}/${d.ymd.slice(5, 7)}`,
    cobros: nulo(d.cobros),
    local: nulo(d.local),
    ingresos: nulo(d.ingresos),
    gastos: nulo(d.gastos),
    concepto: d.conceptos.map((c) => (d.conceptos.length > 1 ? `${c.categoria} ${cop(c.monto)}` : c.categoria)).join(" · "),
    pedido: nulo(d.pedido),
    queda: d.cobros || d.gastos ? d.queda : null,
  }));

  // ── Hoja 2: INVENTARIO ─────────────────────────────────────────────────
  const hayCostos = r.sinCosto < r.inventario.length;
  const inventario: Columna[] = [
    { k: "producto", t: "Producto", ancho: 28 },
    ...(sede ? [] : [{ k: "sede", t: "Sede", ancho: 18 } as Columna]),
    { k: "inicial", t: "Cantidad inicial", tipo: "entero", ancho: 10 },
    { k: "entro", t: "Entró", tipo: "entero", total: true, ancho: 9 },
    { k: "vendidas", t: "Vendidas", tipo: "entero", total: true, ancho: 10 },
    { k: "otras", t: "Otras salidas", tipo: "entero", total: true, ancho: 10 },
    { k: "quedan", t: "Stock", tipo: "entero", ancho: 9 },
    { k: "costo", t: "Le cuesta", tipo: "plata", ancho: 13 },
    { k: "precio", t: "Se vende a", tipo: "plata", ancho: 13 },
    { k: "vendido", t: "Vendido", tipo: "plata", total: true },
    // Sin ningún costo cargado, un TOTAL de "$ 0" diría que no se ganó nada; en
    // blanco dice lo cierto: que no se sabe.
    { k: "ganancia", t: "Ganancia", tipo: "plata", total: hayCostos },
    { k: "invertida", t: "Plata invertida", tipo: "plata", total: hayCostos },
  ];
  const filasInventario = r.inventario.map((f) => ({
    producto: f.nombre,
    sede: nombreSede(f.sedeId),
    inicial: f.inicial,
    entro: nulo(f.entro),
    vendidas: nulo(f.vendidas),
    otras: nulo(f.otras),
    quedan: f.quedan,
    costo: f.costo,
    precio: f.precio,
    vendido: nulo(f.vendido),
    ganancia: f.ganancia,
    invertida: f.invertida,
  }));

  const avisos = [
    `Solo entra lo registrado en la app: ${r.diasConCobros} de ${mes.dias.length} días con cobros.`,
    r.pedidoSinCosto
      ? `${r.pedidoSinCosto} ${r.pedidoSinCosto === 1 ? "unidad que entró no tiene" : "unidades que entraron no tienen"} costo cargado y no suman al pedido.`
      : "",
  ].filter(Boolean);

  const buf = await libroBarbas([
    {
      nombre: `Consolidado ${mesTexto}`,
      titulo: "Consolidado del mes",
      subtitulo: `${Mes} · ${donde}`,
      meta: `${tramo} · ${r.totales.cobros} ${r.totales.cobros === 1 ? "cobro" : "cobros"} · generado el ${generado}`,
      columnas: consolidado,
      filas: filasConsolidado,
      nota: [
        "Para el local = ingresos menos la comisión de cada barbero (la misma cuenta de la liquidación). Queda = para el local menos gastos.",
        "El pedido de productos se valora con el costo que cada producto tiene cargado hoy.",
        ...avisos,
      ].join(" "),
    },
    {
      nombre: `Inventario ${mesTexto}`,
      titulo: "Inventario del mes",
      subtitulo: `${Mes} · ${donde}`,
      meta: `${r.inventario.length} productos · ${r.sinCosto ? `${r.sinCosto} sin costo cargado · ` : ""}generado el ${generado}`,
      columnas: inventario,
      filas: filasInventario,
      nota:
        "Cantidad inicial + entró − vendidas − otras salidas = stock. Otras salidas = lo que tomó el equipo, merma y ajustes. Ganancia = vendido − vendidas × lo que le cuesta; plata invertida = stock × lo que le cuesta, con el costo cargado hoy." +
        (r.sinCosto ? ` Los ${r.sinCosto} productos sin costo quedan en blanco en esas columnas: se cargan en Productos y stock.` : ""),
    },
  ]);

  const archivo = `Barbas y Bigotes - Reporte ${mesTexto} - ${donde}.xlsx`;
  return new Response(new Uint8Array(buf), { headers: cabecerasXlsx(archivo) });
}
