import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getVentasParaCsv, getSedes, getMediosTodos } from "@/lib/data/queries";
import type { SedeId } from "@/lib/data/types";
import { esPeriodo, rangoFechas, type Periodo } from "@/lib/slots";
import { libroBarbas, cabecerasXlsx, type Columna } from "@/lib/excel";
import { repartoDeVenta } from "@/lib/cobro";
import { cop } from "@/lib/format";

// El detalle de cobros para el contador, en Excel de verdad. Es un GET con
// Content-Disposition en vez de una server action + Blob en el cliente: así el
// botón es un <a> y la página de métricas sigue sin necesitar JS.
export const dynamic = "force-dynamic";

const enBogota = (iso: string, opts: Intl.DateTimeFormatOptions) =>
  new Date(iso).toLocaleString("es-CO", { timeZone: "America/Bogota", ...opts });

// Los mismos rótulos que las pestañas de la pantalla (metricas/page.tsx): el
// archivo tiene que decir el período con las palabras con las que se pidió.
const NOMBRE_PERIODO: Record<Periodo, string> = {
  "7d": "Última semana",
  mes: "Este mes",
  "30d": "Últimos 30 días",
  "90d": "Últimos 90 días",
  "365d": "Último año",
};

export async function GET(req: Request) {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  // El archivo lleva nombres de clientes y plata: mismo candado que la pantalla.
  if (denied) return new Response(denied, { status: 403 });

  const url = new URL(req.url);
  // Validación contra la lista compartida: la copia local se quedó desactualizada
  // al agregar Semana y Año, y el Excel salía con OTRO período que el de pantalla.
  const pParam = url.searchParams.get("p");
  const p: Periodo = esPeriodo(pParam) ? pParam : "mes";

  // Export a la medida: ?desde=YYYY-MM-DD&hasta=YYYY-MM-DD manda sobre el
  // período. Si vienen y no sirven se corta con 400 en vez de bajar el mes por
  // defecto: entregar un archivo con OTRAS fechas de las que pidió el dueño es
  // peor que no entregar nada — se lo pasa al contador sin volver a mirarlo.
  const dParam = url.searchParams.get("desde");
  const hParam = url.searchParams.get("hasta");
  const rango = dParam || hParam ? rangoFechas(dParam ?? "", hParam ?? "") : undefined;
  if ((dParam || hParam) && !rango) {
    return new Response("Revisa las fechas: hace falta desde y hasta, y la primera no puede ser posterior.", {
      status: 400,
    });
  }

  const [sedes, medios] = await Promise.all([getSedes(), getMediosTodos()]);
  const sede = (sedes.find((s) => s.id === url.searchParams.get("sede"))?.id as SedeId | undefined) ?? null;
  // El medio se guarda como slug ("nequi"); en el archivo va el nombre que se lee
  // en el mostrador ("Nequi"). Un medio que ya no exista cae con mayúscula inicial.
  const nombreMedio = (slug: string) =>
    medios.find((m) => m.slug === slug)?.nombre ?? (slug ? slug.charAt(0).toUpperCase() + slug.slice(1) : "");

  const ventas = await getVentasParaCsv(p, sede, rango ?? undefined);
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  const columnas: Columna[] = [
    { k: "fecha", t: "Fecha", ancho: 11 },
    { k: "hora", t: "Hora", ancho: 8 },
    { k: "sede", t: "Sede", ancho: 20 },
    { k: "barbero", t: "Barbero", ancho: 20 },
    { k: "cliente", t: "Cliente", ancho: 24 },
    { k: "servicios", t: "Servicios", ancho: 34, envolver: true },
    { k: "productos", t: "Productos", ancho: 26, envolver: true },
    { k: "medio", t: "Medio de pago", ancho: 15 },
    { k: "reparto", t: "Reparto del pago", ancho: 30, envolver: true },
    { k: "descuento", t: "Descuento", tipo: "plata", total: true },
    { k: "cupon", t: "Cupón", ancho: 13 },
    { k: "propina", t: "Propina", tipo: "plata", total: true },
    { k: "total", t: "Total", tipo: "plata", total: true },
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
    // Con cobros mixtos (0060) el medio principal solo no alcanza: una venta
    // marcada "efectivo" pudo entrar mitad por Nequi. Vacío cuando fue un solo
    // medio, para no llenar la hoja de ruido en el 99% de las filas.
    const partes = repartoDeVenta({ medio: String(v.medio ?? ""), total: (v.total as number) || 0, pagos: v.pagos });
    return {
      fecha: enBogota(iso, { day: "2-digit", month: "2-digit", year: "numeric" }),
      hora: enBogota(iso, { hour: "2-digit", minute: "2-digit", hour12: false }),
      sede: nombreSede(v.sede_id as string),
      barbero: (v.barberos as { nombre?: string } | null)?.nombre ?? "El local",
      cliente: (v.clientes as { nombre?: string } | null)?.nombre ?? (v.cliente_nombre as string) ?? "",
      servicios: detalle("servicio"),
      productos: detalle("producto"),
      medio: nombreMedio(String(v.medio ?? "")),
      reparto: partes.length > 1 ? partes.map((x) => `${nombreMedio(x.medio)} ${cop(x.monto)}`).join(" + ") : "",
      descuento: (v.descuento as number) || null,
      cupon: (v.cupon_codigo as string) ?? "",
      propina: (v.propina as number) || null,
      total: (v.total as number) || 0,
    };
  });

  const periodo = rango
    ? `Del ${dParam} al ${hParam}`
    : NOMBRE_PERIODO[p];
  const donde = sede ? nombreSede(sede) : "Las dos sedes";
  const generado = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const buf = await libroBarbas([
    {
      nombre: "Cobros",
      titulo: "Detalle de cobros",
      subtitulo: `${periodo} · ${donde}`,
      meta: `${filas.length} ${filas.length === 1 ? "cobro" : "cobros"} · generado el ${generado}`,
      columnas,
      filas,
      nota: "No incluye las ventas anuladas (0076). El «Reparto del pago» solo aparece cuando el cobro entró por más de un medio.",
    },
  ]);

  const hoy = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Bogota" }); // YYYY-MM-DD
  // El nombre lleva el rango pedido, no la fecha de descarga: con tres cortes a
  // la medida en la carpeta de Descargas, "hoy" no distingue ninguno.
  const archivo = rango
    ? `Barbas y Bigotes - Cobros ${dParam} a ${hParam}${sede ? ` - ${sede}` : ""}.xlsx`
    : `Barbas y Bigotes - Cobros ${p} ${hoy}${sede ? ` - ${sede}` : ""}.xlsx`;

  return new Response(new Uint8Array(buf), { headers: cabecerasXlsx(archivo) });
}
