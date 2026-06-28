import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";
import { SectionHeader } from "@/components/admin/SectionHeader";

export const metadata: Metadata = { title: "Comisiones · Admin" };

export default async function ComisionesPage() {
  const [barberos, sedes] = await Promise.all([getBarberos(), getSedes()]);
  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  return (
    <div className="max-w-4xl">
      <SectionHeader
        eyebrow="Equipo"
        title="Comisiones y contratos"
        description={
          <>
            Definí qué barbero trabaja por <span className="text-ink">porcentaje</span> y cuál por{" "}
            <span className="text-ink">arriendo de silla</span>.
          </>
        }
        action={
          <span className="rounded-full border border-line bg-elevated px-3 py-1.5 text-xs text-muted">
            Guardar: próxima fase
          </span>
        }
      />

      {/* Mobile: cards */}
      <div className="mt-8 space-y-3 sm:hidden">
        {barberos.map((b) => (
          <div key={b.id} className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg">{b.nombre}</span>
              <span className="shrink-0 text-xs text-muted">{sedeNombre(b.sede)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted">Contrato</span>
                <select
                  defaultValue={b.tipoContrato}
                  className="mt-1 w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-ink focus:border-accent focus:outline-none"
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="arriendo">Arriendo de silla</option>
                </select>
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted">Comisión % / Arriendo</span>
                <div className="mt-1 flex items-center gap-1.5 rounded-lg border border-line bg-bg px-3 py-1.5">
                  <input
                    type="number"
                    defaultValue={b.comisionPct ?? 50}
                    className="w-full bg-transparent text-ink focus:outline-none"
                  />
                  <span className="shrink-0 text-xs text-muted">% / $</span>
                </div>
              </label>
            </div>
          </div>
        ))}
      </div>

      {/* sm+: tabla */}
      <div className="mt-8 hidden overflow-x-auto rounded-2xl border border-line sm:block">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Barbero</th>
              <th className="px-4 py-3 text-left font-medium">Sede</th>
              <th className="px-4 py-3 text-left font-medium">Contrato</th>
              <th className="px-4 py-3 text-right font-medium">Comisión % / Arriendo</th>
            </tr>
          </thead>
          <tbody>
            {barberos.map((b, i) => (
              <tr key={b.id} className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                <td className="px-4 py-3">{b.nombre}</td>
                <td className="px-4 py-3 text-muted">{sedeNombre(b.sede)}</td>
                <td className="px-4 py-3">
                  <select
                    defaultValue={b.tipoContrato}
                    className="rounded-lg border border-line bg-bg px-3 py-1.5 text-ink focus:border-accent focus:outline-none"
                  >
                    <option value="porcentaje">Porcentaje</option>
                    <option value="arriendo">Arriendo de silla</option>
                  </select>
                </td>
                <td className="px-4 py-2 text-right">
                  <input
                    type="number"
                    defaultValue={b.comisionPct ?? 50}
                    className="w-24 rounded-lg border border-line bg-bg px-3 py-1.5 text-right text-ink focus:border-accent focus:outline-none"
                  />
                  <span className="ml-1.5 text-xs text-muted">% / $</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
