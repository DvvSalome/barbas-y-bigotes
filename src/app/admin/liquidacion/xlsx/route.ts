import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getLiquidacion, getSedes } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { libroBarbas, cabecerasXlsx, type Columna } from "@/lib/excel";
import { bogotaYmd, bogotaDayRangeDeFecha, semanaDeFecha } from "@/lib/slots";

// La liquidación de la semana, en Excel de verdad (antes era un CSV con punto y
// coma). Sigue siendo un GET con Content-Disposition para que el botón sea un
// <a> y la página no necesite JS.
export const dynamic = "force-dynamic";

const fechaLarga = (ymd: string) =>
  new Date(`${ymd}T12:00:00-05:00`).toLocaleDateString("es-CO", {
    timeZone: "America/Bogota",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

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
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;
  const filas = await getLiquidacion(
    bogotaDayRangeDeFecha(desdeYmd).desde,
    bogotaDayRangeDeFecha(hastaYmd).hasta,
    sede,
  );

  const columnas: Columna[] = [
    { k: "barbero", t: "Barbero", ancho: 24 },
    { k: "sede", t: "Sede", ancho: 20 },
    { k: "contrato", t: "Contrato", ancho: 17 },
    { k: "cobros", t: "Cobros", tipo: "entero", total: true },
    { k: "facturado", t: "Facturó", tipo: "plata", total: true },
    { k: "comision", t: "Su parte", tipo: "plata", total: true },
    { k: "adelantos", t: "Adelantos", tipo: "plata", total: true },
    { k: "consumos", t: "Consumos", tipo: "plata", total: true },
    { k: "ajustes", t: "Ajustes", tipo: "plata", total: true },
    { k: "neto", t: "A PAGAR", tipo: "plata", ancho: 17, total: true },
    { k: "propinas", t: "Propinas (aparte)", tipo: "plata", ancho: 17, total: true },
  ];

  // Adelantos y consumos van en NEGATIVO, no en positivo con un "−" dibujado:
  // así la columna suma sola y el que abra el archivo puede rehacer la cuenta.
  const cuerpo = filas.map((f) => {
    const arriendo = f.tipoContrato === "arriendo";
    return {
      barbero: f.nombre,
      sede: nombreSede(f.sedeId),
      contrato: arriendo ? "Arriendo de silla" : "Comisión",
      cobros: f.cobros,
      facturado: f.facturado,
      // Con arriendo no hay comisión que pagar: la plata es del barbero y el
      // local cobra el arriendo aparte, así que la celda va vacía y no en 0.
      comision: arriendo ? null : f.comision,
      adelantos: f.adelantos ? -f.adelantos : null,
      consumos: f.consumos ? -f.consumos : null,
      ajustes: f.ajustes || null,
      neto: arriendo ? null : f.neto,
      propinas: f.propinas || null,
    };
  });

  // Hoja 2: el detalle de lo consumido. Es la pregunta que sigue a "¿por qué me
  // descontaron $3.000?" y antes vivía apretujada en una celda con " + ".
  const consumos = filas.flatMap((f) =>
    f.detalleConsumos.map((c) => ({
      barbero: f.nombre,
      sede: nombreSede(f.sedeId),
      fecha: c.fecha,
      producto: c.producto,
      cantidad: c.cantidad,
      total: c.total,
    })),
  );

  // Hoja 3: los ajustes a mano, con su motivo (0075).
  const ajustes = filas.flatMap((f) =>
    f.detalleAjustes.map((a) => ({
      barbero: f.nombre,
      sede: nombreSede(f.sedeId),
      fecha: a.fecha,
      monto: a.monto,
      nota: a.nota,
    })),
  );

  const periodo = `Semana del ${fechaLarga(desdeYmd)} al ${fechaLarga(hastaYmd)}`;
  const donde = sede ? nombreSede(sede) : "Las dos sedes";
  const generado = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const buf = await libroBarbas([
    {
      nombre: "Liquidación",
      titulo: "Liquidación semanal",
      subtitulo: `${periodo} · ${donde}`,
      meta: `Generado el ${generado}`,
      columnas,
      filas: cuerpo,
      nota:
        "Las propinas NO entran en «A pagar»: son del barbero desde el momento en que se las dieron. " +
        "A los barberos con arriendo de silla no se les liquida comisión; el arriendo se cobra aparte.",
    },
    {
      nombre: "Consumos",
      titulo: "Consumos del barbero",
      subtitulo: `${periodo} · ${donde}`,
      meta: "Bebidas y mecatos que se descuentan de la liquidación",
      columnas: [
        { k: "barbero", t: "Barbero", ancho: 24 },
        { k: "sede", t: "Sede", ancho: 20 },
        { k: "fecha", t: "Fecha", ancho: 12 },
        { k: "producto", t: "Producto", ancho: 28, envolver: true },
        { k: "cantidad", t: "Cantidad", tipo: "entero", total: true },
        { k: "total", t: "Total", tipo: "plata", total: true },
      ],
      filas: consumos,
    },
    {
      nombre: "Ajustes",
      titulo: "Ajustes a mano",
      subtitulo: `${periodo} · ${donde}`,
      meta: "Sumas y restas puestas por el administrador, con su motivo",
      columnas: [
        { k: "barbero", t: "Barbero", ancho: 24 },
        { k: "sede", t: "Sede", ancho: 20 },
        { k: "fecha", t: "Fecha", ancho: 12 },
        { k: "monto", t: "Monto", tipo: "plata", total: true },
        { k: "nota", t: "Motivo", ancho: 52 },
      ],
      filas: ajustes,
    },
  ]);

  return new Response(new Uint8Array(buf), {
    headers: cabecerasXlsx(
      `Barbas y Bigotes - Liquidacion ${desdeYmd} a ${hastaYmd}${sede ? ` - ${sede}` : ""}.xlsx`,
    ),
  });
}
