import { supabaseServerAuth } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/actions";
import { getClientes, getSedes } from "@/lib/data/queries";
import { celdaCsv as celda } from "@/lib/format";

// Descarga de la base de clientes (mismo patrón que el CSV de métricas): GET
// con Content-Disposition para que el botón sea un <a> sin JS.
export const dynamic = "force-dynamic";

// Excel en español usa la coma como separador DECIMAL: con "," las columnas se
// apilan en una sola celda. Punto y coma, como el CSV del contador.
const SEP = ";";

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

  const cabecera = ["Nombre", "Teléfono", "Correo", "Sede", "Visitas", "Facturado (COP)", "Última visita"];
  const filas = filtrados.map((c) =>
    [
      celda(c.nombre),
      celda(c.telefono || ""),
      celda(c.email || ""),
      // Las dos cuando va a las dos: es un dato del cliente, no una casilla.
      celda(c.sedes.map(nombreSede).join(" + ")),
      String(c.visitas),
      String(c.facturado),
      c.ultima
        ? new Date(c.ultima).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "2-digit", month: "2-digit", year: "numeric" })
        : "",
    ].join(SEP),
  );
  // BOM: sin él, Excel en Windows muestra "Ãº" en vez de "ú".
  const csv = "﻿" + [cabecera.join(SEP), ...filas].join("\r\n");

  const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="clientes${sede ? `-${sede}` : ""}-${hoy}.csv"`,
    },
  });
}
