import type { Metadata } from "next";
import { getServicios, getSedes } from "@/lib/data/queries";
import { categorias } from "@/lib/data/seed";
import type { Categoria } from "@/lib/data/types";
import { SectionHeader } from "@/components/admin/SectionHeader";

export const metadata: Metadata = { title: "Precios por sede · Admin" };

export default async function PreciosPage() {
  const [servicios, sedes] = await Promise.all([getServicios(), getSedes()]);
  const cats = Object.keys(categorias) as Categoria[];

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Precios por sede"
        description="Editá el precio de cada servicio en ambas sedes desde un solo lugar."
        action={
          <span className="rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-muted">
            Guardar: próxima fase
          </span>
        }
      />

      {cats.map((cat) => {
        const list = servicios.filter((s) => s.categoria === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="mt-10">
            <h2 className="mb-4 inline-flex items-center rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 font-display text-lg">
              {categorias[cat]}
            </h2>

            {/* Mobile: cards */}
            <div className="space-y-3 sm:hidden">
              {list.map((s) => (
                <div key={s.id} className="rounded-2xl border border-line bg-panel p-4">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">
                      {s.nombre}
                      {s.desde && <span className="text-xs text-muted"> (desde)</span>}
                    </span>
                    <span className="shrink-0 text-xs text-muted">{s.duracionMin}m</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {sedes.map((sd) => (
                      <label key={sd.id} className="block">
                        <span className="text-[10px] uppercase tracking-wide text-muted">{sd.nombre}</span>
                        <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-line bg-bg px-2.5 py-1.5">
                          <span className="text-xs text-muted">$</span>
                          <input
                            type="number"
                            defaultValue={s.precios[sd.id]}
                            className="w-full bg-transparent text-right text-ink focus:outline-none"
                          />
                        </div>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* sm+: tabla */}
            <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Servicio</th>
                    <th className="w-16 px-4 py-3 text-left font-medium">Dur.</th>
                    {sedes.map((s) => (
                      <th key={s.id} className="w-48 px-4 py-3 text-right font-medium">
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => (
                    <tr key={s.id} className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {s.nombre}
                        {s.desde && <span className="text-xs text-muted"> (desde)</span>}
                      </td>
                      <td className="px-4 py-3 text-muted">{s.duracionMin}m</td>
                      {sedes.map((sd) => (
                        <td key={sd.id} className="px-4 py-2 text-right">
                          <span className="mr-1.5 text-xs text-muted">$</span>
                          <input
                            type="number"
                            defaultValue={s.precios[sd.id]}
                            className="w-28 rounded-lg border border-line bg-bg px-3 py-1.5 text-right text-ink focus:border-accent focus:outline-none"
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}

      <div className="mt-8 flex items-center gap-3">
        <button
          disabled
          className="cursor-not-allowed rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent opacity-60"
        >
          Guardar cambios
        </button>
        <span className="text-xs text-muted">Persistencia de edición: próxima fase.</span>
      </div>
    </div>
  );
}
