import type { Metadata } from "next";
import { getCuadre, getSedes, getBarberos } from "@/lib/data/queries";
import { CuadreForms } from "@/components/admin/CuadreForms";
import { cop } from "@/lib/format";

export const metadata: Metadata = { title: "Cuadre de caja · Admin" };

export default async function CuadrePage() {
  const [cuadre, sedes, barberos] = await Promise.all([getCuadre(), getSedes(), getBarberos()]);
  const fecha = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-4xl font-semibold">Cuadre de caja</h1>
      <p className="mt-2 text-sm capitalize text-muted">{fecha}</p>

      <div className="mt-8 overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Sede</th>
              <th className="px-4 py-3 text-right font-medium">Efectivo</th>
              <th className="px-4 py-3 text-right font-medium">Datáfono</th>
              <th className="px-4 py-3 text-right font-medium">Ingresos</th>
              <th className="px-4 py-3 text-right font-medium">Gastos</th>
              <th className="px-4 py-3 text-right font-medium">Neto</th>
              <th className="px-4 py-3 text-right font-medium">Citas</th>
            </tr>
          </thead>
          <tbody>
            {cuadre.porSede.map((s, i) => (
              <tr key={s.sede} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
                <td className="px-4 py-3 font-display text-lg">{s.nombre}</td>
                <td className="px-4 py-3 text-right">{cop(s.efectivo)}</td>
                <td className="px-4 py-3 text-right">{cop(s.datafono)}</td>
                <td className="px-4 py-3 text-right">{cop(s.ingresos)}</td>
                <td className="px-4 py-3 text-right text-muted">−{cop(s.gastos)}</td>
                <td className="px-4 py-3 text-right font-semibold text-accent-soft">{cop(s.neto)}</td>
                <td className="px-4 py-3 text-right text-muted">{s.citas}</td>
              </tr>
            ))}
            <tr className="border-t border-line bg-elevated/60">
              <td className="px-4 py-3 font-display text-lg">Total</td>
              <td className="px-4 py-3 text-right">{cop(cuadre.total.efectivo)}</td>
              <td className="px-4 py-3 text-right">{cop(cuadre.total.datafono)}</td>
              <td className="px-4 py-3 text-right">{cop(cuadre.total.ingresos)}</td>
              <td className="px-4 py-3 text-right text-muted">−{cop(cuadre.total.gastos)}</td>
              <td className="px-4 py-3 text-right font-semibold text-accent-soft">{cop(cuadre.total.neto)}</td>
              <td className="px-4 py-3 text-right text-muted">{cuadre.total.citas}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-8">
        <CuadreForms sedes={sedes} barberos={barberos} />
      </div>

      {cuadre.gastosHoy.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 font-display text-2xl italic">Gastos de hoy</h2>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <tbody>
                {cuadre.gastosHoy.map((g, i) => (
                  <tr key={g.id} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
                    <td className="px-4 py-3">{g.categoria}</td>
                    <td className="px-4 py-3 text-muted">{g.descripcion ?? "—"}</td>
                    <td className="px-4 py-3 text-right">−{cop(g.monto)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
