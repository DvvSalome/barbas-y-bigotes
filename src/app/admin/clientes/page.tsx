import type { Metadata } from "next";
import Link from "next/link";
import { getClientes } from "@/lib/data/queries";
import { cop } from "@/lib/format";

export const metadata: Metadata = { title: "Clientes · Admin" };

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit" });
}

export default async function ClientesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const clientes = await getClientes(q);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-4xl font-semibold">Clientes</h1>
      <p className="mt-2 text-sm text-muted">{clientes.length} clientes · abrí una ficha para ver historial, notas, wallet y reseñas.</p>

      <form className="mt-6" action="/admin/clientes">
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o correo…"
          className="w-full max-w-md rounded-xl border border-line bg-bg px-4 py-2.5 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>

      <div className="mt-6 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Cliente</th>
              <th className="px-4 py-3 text-left font-medium">Contacto</th>
              <th className="px-4 py-3 text-right font-medium">Visitas</th>
              <th className="px-4 py-3 text-right font-medium">Facturado</th>
              <th className="px-4 py-3 text-right font-medium">Última</th>
            </tr>
          </thead>
          <tbody>
            {clientes.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">
                  {q ? "Sin resultados para esa búsqueda." : "Todavía no hay clientes registrados."}
                </td>
              </tr>
            ) : (
              clientes.map((c, i) => (
                <tr key={c.id} className={`transition hover:bg-elevated ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/clientes/${c.id}`} className="font-display text-lg transition hover:text-accent-soft">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {c.telefono || "—"}
                    {c.email ? <span className="block text-xs text-muted/70">{c.email}</span> : null}
                  </td>
                  <td className="px-4 py-3 text-right text-muted">{c.visitas}</td>
                  <td className="px-4 py-3 text-right text-accent-soft">{cop(c.facturado)}</td>
                  <td className="px-4 py-3 text-right text-muted">{fechaCorta(c.ultima)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
