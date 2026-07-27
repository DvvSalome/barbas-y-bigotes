import type { Metadata } from "next";
import { cop } from "@/lib/format";
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

      />

      {/* Igual que en Precios: los controles se veían editables y descartaban todo.
          El aviso va arriba y los valores pasan a texto. */}
      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-warn/40 bg-warn/10 px-4 py-3">
        <span aria-hidden className="text-lg leading-none">⚠️</span>
        <p className="text-[13px] leading-relaxed text-warn">
          <b>Los contratos todavía no se editan desde acá.</b> Esta pantalla muestra con qué trabaja hoy
          cada barbero, que es lo que usa el cobro para repartir la comisión. Para cambiar uno, pedímelo.
        </p>
      </div>

      {/* Mobile: cards */}
      <div className="mt-8 space-y-3 sm:hidden">
        {barberos.map((b) => (
          <div key={b.id} className="rounded-2xl border border-line bg-panel p-4">
            <div className="flex items-baseline justify-between gap-2">
              <span className="font-display text-lg">{b.nombre}</span>
              <span className="shrink-0 text-xs text-muted">{sedeNombre(b.sede)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted">Contrato</span>
                <div className="mt-1 rounded-lg border border-line bg-elevated px-3 py-1.5 text-ink">
                  {b.tipoContrato === "arriendo" ? "Arriendo de silla" : "Porcentaje"}
                </div>
              </div>
              <div className="block">
                <span className="text-[10px] uppercase tracking-wide text-muted">Comisión</span>
                <div className="mt-1 rounded-lg border border-line bg-elevated px-3 py-1.5 tabular-nums text-ink">
                  {b.tipoContrato === "arriendo" ? cop(b.comisionPct ?? 0) : `${b.comisionPct ?? 50}%`}
                </div>
              </div>
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
                <td className="px-4 py-3 text-ink">
                  {b.tipoContrato === "arriendo" ? "Arriendo de silla" : "Porcentaje"}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-ink">
                  {b.tipoContrato === "arriendo" ? cop(b.comisionPct ?? 0) : `${b.comisionPct ?? 50}%`}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
