import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getClientes, getSedes } from "@/lib/data/queries";
import { libroBarbas, cabecerasXlsx, type Columna } from "@/lib/excel";

// La base de clientes en Excel (mismo patrón que el de métricas): GET con
// Content-Disposition para que el botón sea un <a> sin JS.
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const sb = await supabaseServerAuth();
  const denied = await requireAdmin(sb);
  // Nombres, teléfonos y correos: mismo candado que la pantalla.
  if (denied) return new Response(denied, { status: 403 });

  const [clientes, sedes] = await Promise.all([getClientes(), getSedes()]);
  // ?sede= baja SOLO los de ese local, igual que lo que se está viendo en
  // pantalla: bajar la base entera cuando la lista mostraba una sede era
  // entregar un archivo que no se parece a lo que el dueño acababa de mirar.
  const sede = sedes.find((s) => s.id === new URL(req.url).searchParams.get("sede"))?.id ?? null;
  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;
  const filtrados = sede ? clientes.filter((c) => c.sedes.includes(sede)) : clientes;

  const columnas: Columna[] = [
    { k: "nombre", t: "Nombre", ancho: 26 },
    { k: "telefono", t: "Teléfono", ancho: 15 },
    { k: "email", t: "Correo", ancho: 30 },
    { k: "sede", t: "Sede", ancho: 26 },
    { k: "visitas", t: "Visitas", tipo: "entero", total: true },
    { k: "facturado", t: "Facturado", tipo: "plata", total: true },
    { k: "ticket", t: "Ticket promedio", tipo: "plata", ancho: 16 },
    { k: "ultima", t: "Última visita", ancho: 14 },
  ];

  const filas = filtrados.map((c) => ({
    nombre: c.nombre,
    // Como TEXTO a propósito: un celular colombiano empieza en 3 y Excel lo
    // convertiría en número, borrando el formato y cualquier cero a la izquierda.
    telefono: c.telefono || "",
    email: c.email || "",
    // Las dos cuando va a las dos: es un dato del cliente, no una casilla.
    sede: c.sedes.map(nombreSede).join(" + "),
    visitas: c.visitas || null,
    facturado: c.facturado || null,
    ticket: c.visitas > 0 ? Math.round(c.facturado / c.visitas) : null,
    ultima: c.ultima
      ? new Date(c.ultima).toLocaleDateString("es-CO", {
          timeZone: "America/Bogota",
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        })
      : "",
  }));

  const donde = sede ? nombreSede(sede) : "Las dos sedes";
  const generado = new Date().toLocaleString("es-CO", {
    timeZone: "America/Bogota",
    dateStyle: "medium",
    timeStyle: "short",
  });

  const buf = await libroBarbas([
    {
      nombre: "Clientes",
      titulo: "Base de clientes",
      subtitulo: donde,
      meta: `${filas.length} ${filas.length === 1 ? "cliente" : "clientes"} · generado el ${generado}`,
      columnas,
      filas,
      nota: "Datos personales: este archivo no se comparte ni se sube a ningún lado sin permiso del dueño.",
    },
  ]);

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new Response(new Uint8Array(buf), {
    headers: cabecerasXlsx(`Barbas y Bigotes - Clientes${sede ? ` - ${sede}` : ""} ${hoy}.xlsx`),
  });
}
