import type { Metadata } from "next";
import { getServiciosCatalogoAdmin, getSedes } from "@/lib/data/queries";
import { categorias } from "@/lib/data/seed";
import type { Categoria, SedeId } from "@/lib/data/types";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { ComboBuilder } from "@/components/admin/ComboBuilder";
import { ServicioActivoToggle } from "@/components/admin/ServicioActivoToggle";

export const metadata: Metadata = { title: "Precios por sede · Admin" };

export default async function PreciosPage({
  searchParams,
}: {
  searchParams: Promise<{ sede?: string }>;
}) {
  const [servicios, sedes] = await Promise.all([getServiciosCatalogoAdmin(), getSedes()]);
  const cats = Object.keys(categorias) as Categoria[];

  // Sede activa desde el selector existente (?sede=). Sin param = "Ambas sedes":
  // el armador de combos necesita UNA sede (el combo se crea en la sede activa).
  const sp = await searchParams;
  const sedeParam = typeof sp.sede === "string" ? sp.sede : undefined;
  const sedeActiva = (sedes.find((s) => s.id === sedeParam)?.id ?? null) as SedeId | null;
  const sedeNombre = sedes.find((s) => s.id === sedeActiva)?.nombre ?? "";

  // Partes elegibles: servicios NO combo, activos y priceados en la sede activa.
  const partesDisponibles = sedeActiva
    ? servicios.filter((s) => !s.esCombo && s.activo !== false && s.precios[sedeActiva] != null)
    : [];

  return (
    <div className="max-w-5xl">
      <SectionHeader
        eyebrow="Catálogo"
        title="Precios por sede"
        description="Editá el precio de cada servicio en ambas sedes y armá combos por sede desde acá."
      />

      {/* Armador de combos (proto §7.1) — atado a la sede activa del selector. */}
      <section className="mt-6">
        <h2 className="mb-3 inline-flex items-center rounded-full border border-accent/30 bg-accent/5 px-4 py-1.5 font-display text-lg">
          Armador de combos
        </h2>
        {sedeActiva ? (
          <ComboBuilder partesDisponibles={partesDisponibles} sedeActiva={sedeActiva} sedeNombre={sedeNombre} />
        ) : (
          <div className="rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3 text-sm text-warn">
            Elegí una sede arriba (Parque Venezuela o Plaza de la Paz) para armar un combo. El combo queda disponible
            solo en esa sede.
          </div>
        )}
      </section>

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
              {list.map((s) => {
                const inactivo = s.activo === false;
                return (
                  <div
                    key={s.id}
                    className={`rounded-2xl border border-line bg-panel p-4 ${inactivo ? "opacity-60" : ""}`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium">
                        {s.nombre}
                        {s.desde && <span className="text-xs text-muted"> (desde)</span>}
                        {inactivo && (
                          <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                            Inactivo
                          </span>
                        )}
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
                    <div className="mt-3 flex justify-end">
                      <ServicioActivoToggle id={s.id} activo={!inactivo} />
                    </div>
                  </div>
                );
              })}
            </div>

            {/* sm+: tabla */}
            <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
              <table className="w-full text-sm">
                <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">Servicio</th>
                    <th className="w-16 px-4 py-3 text-left font-medium">Dur.</th>
                    {sedes.map((s) => (
                      <th key={s.id} className="w-44 px-4 py-3 text-right font-medium">
                        {s.nombre}
                      </th>
                    ))}
                    <th className="w-32 px-4 py-3 text-right font-medium">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((s, i) => {
                    const inactivo = s.activo === false;
                    return (
                      <tr
                        key={s.id}
                        className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"} ${
                          inactivo ? "opacity-60" : ""
                        }`}
                      >
                        <td className="px-4 py-3 whitespace-nowrap">
                          {s.nombre}
                          {s.desde && <span className="text-xs text-muted"> (desde)</span>}
                          {inactivo && (
                            <span className="ml-2 rounded-full border border-line px-2 py-0.5 text-[10px] uppercase tracking-wide text-muted">
                              Inactivo
                            </span>
                          )}
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
                        <td className="px-4 py-3 text-right">
                          <ServicioActivoToggle id={s.id} activo={!inactivo} />
                        </td>
                      </tr>
                    );
                  })}
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
        <span className="text-xs text-muted">Persistencia de edición de precios: próxima fase.</span>
      </div>
    </div>
  );
}
