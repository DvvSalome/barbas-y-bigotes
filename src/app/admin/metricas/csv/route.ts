import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getVentasParaCsv, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { esPeriodo, type Periodo } from "@/lib/slots";
import { celdaCsv as celda } from "@/lib/format";
import { repartoDeVenta } from "@/lib/cobro";

// Descarga del detalle de cobros para el contador. Es un GET con
// Content-Disposition en vez de una server action + Blob en el cliente: así el
// botón es un <a> y la página de métricas sigue sin necesitar JS.
export const dynamic = "force-dynamic";

// Excel en español interpreta la coma como separador DECIMAL. Con "," las
// columnas se apilan en una sola celda, que es como se rompen el 90% de los CSV
// que llegan a un contador en Colombia.
const SEP = ";";

const enBogota = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", ...opts });

export async function GET(req: Request) {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  // El CSV lleva nombres de clientes y plata: mismo candado que la pantalla.
  if (denied) return new Response(denied, { status: 403 });

  const url = new URL(req.url);
  // Validación contra la lista compartida: la copia local se quedó desactualizada
  // al agregar Semana y Año, y el Excel salía con OTRO período que el de pantalla.
  const pParam = url.searchParams.get("p");
  const p: Periodo = esPeriodo(pParam) ? pParam : "mes";
  const sedes = await getSedes();
  const sede = (sedes.find((s) => s.id === url.searchParams.get("sede"))?.id as SedeId | undefined) ?? null;

  const ventas = await getVentasParaCsv(p, sede);
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  const cabecera = [
    "Fecha", "Hora", "Sede", "Barbero", "Cliente", "Servicios", "Productos",
    "Medio de pago", "Reparto del pago", "Descuento", "Cupón", "Propina", "Total",
  ];

  const filas = ventas.map((v) => {
    const items = (v.venta_items ?? []) as Record<string, unknown>[];
    const detalle = (tipo: string) =>
      items
        .filter((i) => i.tipo === tipo)
        .map((i) => {
          const c = (i.cantidad as number) ?? 1;
          return c > 1 ? `${c}× ${i.descripcion}` : String(i.descripcion);
        })
        .join(" + ");
    const iso = v.creado_en as string;
    return [
      enBogota(iso, { day: "2-digit", month: "2-digit", year: "numeric" }),
      enBogota(iso, { hour: "2-digit", minute: "2-digit", hour12: false }),
      nombreSede(v.sede_id as string),
      (v.barberos as { nombre?: string } | null)?.nombre ?? "",
      (v.clientes as { nombre?: string } | null)?.nombre ?? (v.cliente_nombre as string) ?? "",
      detalle("servicio"),
      detalle("producto"),
      v.medio ?? "",
      // Con cobros mixtos (0060) el medio principal solo no alcanza: una venta
      // marcada "efectivo" pudo entrar mitad por Nequi. Vacío cuando fue un solo
      // medio, para no llenar la hoja de ruido en el 99% de las filas.
      (() => {
        const partes = repartoDeVenta({ medio: String(v.medio ?? ""), total: (v.total as number) || 0, pagos: v.pagos });
        return partes.length > 1 ? partes.map((x) => `${x.medio} ${x.monto}`).join(" + ") : "";
      })(),
      (v.descuento as number) || 0,
      v.cupon_codigo ?? "",
      (v.propina as number) || 0,
      (v.total as number) || 0,
    ].map(celda).join(SEP);
  });

  // Fila de totales: es lo primero que busca quien abre esto en Excel.
  const suma = (k: string) => ventas.reduce((a, v) => a + (((v[k] as number) ?? 0) || 0), 0);
  const total = ["TOTAL", "", "", "", "", "", "", "", suma("descuento"), "", suma("propina"), suma("total")]
    .map(celda)
    .join(SEP);

  const cuerpo = [cabecera.join(SEP), ...filas, ...(ventas.length ? [total] : [])].join("\r\n");
  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }); // YYYY-MM-DD
  const archivo = `barbas-cobros-${p}${sede ? `-${sede}` : ""}-${hoy}.csv`;

  // BOM: sin él, Excel abre el archivo en ANSI y las tildes salen como Ã±.
  return new Response("﻿" + cuerpo, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${archivo}"`,
      "Cache-Control": "no-store",
    },
  });
}
