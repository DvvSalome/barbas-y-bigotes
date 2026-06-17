import type { Metadata } from "next";
import { getServicios, getSedes } from "@/lib/data/queries";
import { categorias } from "@/lib/data/seed";
import type { Categoria } from "@/lib/data/types";

export const metadata: Metadata = { title: "Precios por sede · Admin" };

export default async function PreciosPage() {
  const [servicios, sedes] = await Promise.all([getServicios(), getSedes()]);
  const cats = Object.keys(categorias) as Categoria[];

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-4xl font-semibold">Precios por sede</h1>
      <p className="mt-2 text-sm text-muted">
        Editá el precio de cada servicio en ambas sedes desde un solo lugar.
        <span className="text-muted/70"> (Guardar conecta con Supabase en la próxima fase.)</span>
      </p>

      {cats.map((cat) => {
        const list = servicios.filter((s) => s.categoria === cat);
        if (!list.length) return null;
        return (
          <section key={cat} className="mt-10">
            <h2 className="mb-4 font-display text-2xl italic">{categorias[cat]}</h2>
            <div className="overflow-hidden rounded-2xl border border-line">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Servicio</th>
                    <th className="w-20 px-4 py-3 text-left font-medium">Dur.</th>
                    {sedes.map((s) => (
                      <th key={s.id} className="w-48 px-4 py-3 text-right font-medium">
                        {s.nombre}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => (
                    <tr key={s.id} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
                      <td className="px-4 py-3">
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
