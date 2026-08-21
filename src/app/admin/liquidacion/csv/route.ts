import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getLiquidacion, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { celdaCsv as celda } from "@/lib/format";
import { bogotaYmd, bogotaDayRangeDeFecha, semanaDeFecha } from "@/lib/slots";

// La liquidación de la semana en Excel, para imprimirla o mandarla. Mismo patrón
// que el CSV de métricas: GET con Content-Disposition, así el botón es un <a>.
export const dynamic = "force-dynamic";

// Excel en español interpreta la coma como separador DECIMAL.
const SEP = ";";

export async function GET(req: Request) {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  // Sueldos: el mismo candado que la pantalla.
  if (denied) return new Response(denied, { status: 403 });

  const url = new URL(req.url);
  const pedido = /^\d{4}-\d{2}-\d{2}$/.test(url.searchParams.get("semana") ?? "")
    ? (url.searchParams.get("semana") as string)
    : bogotaYmd();
  const { desdeYmd, hastaYmd } = semanaDeFecha(pedido);

  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === url.searchParams.get("sede"))?.id as SedeId | undefined) ?? null;
  const filas = await getLiquidacion(
    bogotaDayRangeDeFecha(desdeYmd).desde,
    bogotaDayRangeDeFecha(hastaYmd).hasta,
    sede,
  );

  const cabecera = [
    "Barbero", "Sede", "Contrato", "Cobros", "Facturado", "Su parte",
    "Adelantos", "Consumos", "A pagar", "Propinas (aparte)", "Detalle de consumos",
  ];
  const cuerpo = filas.map((f) =>
    [
      celda(f.nombre),
      celda(sedes.find((s) => s.id === f.sedeId)?.nombre ?? f.sedeId),
      celda(f.tipoContrato === "arriendo" ? "Arriendo de silla" : "Comisión"),
      String(f.cobros),
      String(f.facturado),
      // Con arriendo no hay comisión que pagar: la plata es del barbero y el local
      // cobra el arriendo aparte, así que la columna iría en 0 y confundiría.
      f.tipoContrato === "arriendo" ? "" : String(f.comision),
      String(f.adelantos),
      String(f.consumos),
      f.tipoContrato === "arriendo" ? "" : String(f.neto),
      String(f.propinas),
      celda(
        f.detalleConsumos
          .map((c) => `${c.fecha} ${c.cantidad > 1 ? `${c.cantidad}x ` : ""}${c.producto} ${c.total}`)
          .join(" + "),
      ),
    ].join(SEP),
  );

  const totales = filas.reduce(
    (a, f) => ({
      cobros: a.cobros + f.cobros,
      facturado: a.facturado + f.facturado,
      comision: a.comision + (f.tipoContrato === "arriendo" ? 0 : f.comision),
      adelantos: a.adelantos + f.adelantos,
      consumos: a.consumos + f.consumos,
      neto: a.neto + (f.tipoContrato === "arriendo" ? 0 : f.neto),
      propinas: a.propinas + f.propinas,
    }),
    { cobros: 0, facturado: 0, comision: 0, adelantos: 0, consumos: 0, neto: 0, propinas: 0 },
  );
  const total = [
    "TOTAL", "", "",
    String(totales.cobros), String(totales.facturado), String(totales.comision),
    String(totales.adelantos), String(totales.consumos), String(totales.neto),
    String(totales.propinas), "",
  ].join(SEP);

  const texto = [
    `Semana del ${desdeYmd} al ${hastaYmd}${sede ? ` · ${sedes.find((s) => s.id === sede)?.nombre}` : ""}`,
    cabecera.join(SEP),
    ...cuerpo,
    ...(filas.length ? [total] : []),
  ].join("\r\n");

  // BOM: sin él, Excel abre en ANSI y las tildes salen como Ã±.
  return new Response("﻿" + texto, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="barbas-liquidacion-${desdeYmd}_a_${hastaYmd}${sede ? `-${sede}` : ""}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
