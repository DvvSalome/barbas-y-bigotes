import type { Metadata } from "next";
import { getBarberos, getSedes } from "@/lib/data/queries";

export const metadata: Metadata = { title: "Comisiones · Admin" };

export default async function ComisionesPage() {
  const [barberos, sedes] = await Promise.all([getBarberos(), getSedes()]);
  const sedeNombre = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  return (
    <div className="max-w-4xl">
      <h1 className="font-display text-4xl font-semibold">Comisiones y contratos</h1>
      <p className="mt-2 text-sm text-muted">
        Definí qué barbero trabaja por <span className="text-ink">porcentaje</span> y cuál por{" "}
        <span className="text-ink">arriendo de silla</span>.
        <span className="text-muted/70"> (Guardar: próxima fase.)</span>
      </p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-line">
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
              <tr key={b.id} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
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
