import type { Metadata } from "next";
import Link from "next/link";
import { getClientes } from "@/lib/data/queries";
import { cop } from "@/lib/format";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { SearchIcon } from "@/components/icons";

export const metadata: Metadata = { title: "Clientes · Admin" };

function fechaCorta(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short", year: "2-digit" });
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
      <SectionHeader
        eyebrow="Base de datos"
        title="Clientes"
        description={`${clientes.length} clientes · abrí una ficha para ver historial, notas, wallet y reseñas.`}
      />

      <form className="relative mt-6 max-w-md" action="/admin/clientes">
        <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
        <input
          name="q"
          defaultValue={q}
          placeholder="Buscar por nombre, teléfono o correo…"
          className="w-full rounded-xl border border-line bg-bg px-4 py-2.5 pl-10 text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </form>

      {clientes.length === 0 ? (
        <p className="mt-6 rounded-2xl border border-line bg-panel px-4 py-8 text-center text-sm text-muted">
          {q ? "Sin resultados para esa búsqueda." : "Todavía no hay clientes registrados."}
        </p>
      ) : (
        <>
          {/* Mobile: cards */}
          <div className="mt-6 space-y-2 sm:hidden">
            {clientes.map((c) => (
              <Link
                key={c.id}
                href={`/admin/clientes/${c.id}`}
                className="block rounded-xl border border-line bg-panel p-4 transition active:border-accent/40"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-sm font-bold text-accent-soft">
                    {c.nombre.charAt(0).toUpperCase()}
                  </span>
                  <div className="min-w-0">
                    <div className="font-display text-lg leading-tight">{c.nombre}</div>
                    <div className="truncate text-xs text-muted">{c.telefono || c.email || "Sin contacto"}</div>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 border-t border-line/60 pt-3 text-center">
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Visitas</div>
                    <div className="text-sm">{c.visitas}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Facturado</div>
                    <div className="text-sm text-accent-soft">{cop(c.facturado)}</div>
                  </div>
                  <div>
                    <div className="text-[10px] uppercase tracking-wide text-muted">Última</div>
                    <div className="text-sm text-muted">{fechaCorta(c.ultima)}</div>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* sm+: tabla */}
          <div className="mt-6 hidden overflow-x-auto rounded-2xl border border-line sm:block">
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
                {clientes.map((c, i) => (
                  <tr key={c.id} className={`transition hover:bg-elevated ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                    <td className="px-4 py-3">
                      <Link href={`/admin/clientes/${c.id}`} className="group flex items-center gap-3">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/15 text-xs font-bold text-accent-soft">
                          {c.nombre.charAt(0).toUpperCase()}
                        </span>
                        <span className="font-display text-lg transition group-hover:text-accent-soft">{c.nombre}</span>
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
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
