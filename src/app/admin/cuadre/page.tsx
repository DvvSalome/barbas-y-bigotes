import type { Metadata } from "next";
import {
  getCuadre,
  getSedes,
  getBarberos,
  getCajaSesiones,
  getReservasPendientesCobro,
  getCuadresAnteriores,
} from "@/lib/data/queries";
import { CuadreForms } from "@/components/admin/CuadreForms";
import { CajaSesiones } from "@/components/admin/CajaSesiones";
import { cop } from "@/lib/format";

export const metadata: Metadata = { title: "Cuadre de caja · Admin" };

function horaCorta(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "am" : "pm";
  h = ((h + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export default async function CuadrePage() {
  const [cuadre, sedes, barberos, cajas, pendientes, anteriores] = await Promise.all([
    getCuadre(),
    getSedes(),
    getBarberos(),
    getCajaSesiones(),
    getReservasPendientesCobro(),
    getCuadresAnteriores(),
  ]);
  const fecha = new Date().toLocaleDateString("es-CO", { weekday: "long", day: "numeric", month: "long" });
  const totalPendiente = pendientes.reduce((a, p) => a + p.monto, 0);

  return (
    <div className="max-w-5xl">
      <h1 className="font-display text-4xl font-semibold">Cuadre de caja</h1>
      <p className="mt-2 text-sm capitalize text-muted">{fecha}</p>

      <div className="mt-8">
        <CajaSesiones cajas={cajas} />
      </div>

      {pendientes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl italic">Pendientes por cobrar</h2>
            <span className="text-sm text-muted">
              {pendientes.length} reservas · <b className="text-accent-soft">{cop(totalPendiente)}</b> proyectado
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Citas de hoy aún sin registrar en caja. Se cobran al completar la atención en la app del barbero.</p>
          <div className="mt-4 space-y-2">
            {pendientes.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border border-line bg-bg px-4 py-2.5 text-sm">
                <div>
                  <span className="font-semibold">{p.cliente}</span>
                  <span className="text-muted"> · {p.servicio} · {p.barbero}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted">{horaCorta(p.inicio)}</span>
                  <span className="text-accent-soft">{cop(p.monto)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

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

      {anteriores.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 font-display text-2xl italic">Cuadres anteriores</h2>
          <div className="overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-sm">
              <thead className="bg-elevated text-xs uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-3 text-left font-medium">Cierre</th>
                  <th className="px-4 py-3 text-left font-medium">Sede</th>
                  <th className="px-4 py-3 text-right font-medium">Meta</th>
                  <th className="px-4 py-3 text-right font-medium">Ingresos</th>
                  <th className="px-4 py-3 text-right font-medium">Gastos</th>
                  <th className="px-4 py-3 text-right font-medium">Dif. efectivo</th>
                  <th className="px-4 py-3 text-right font-medium">Citas</th>
                </tr>
              </thead>
              <tbody>
                {anteriores.map((c, i) => (
                  <tr key={c.id} className={i % 2 ? "bg-panel" : "bg-panel/40"}>
                    <td className="px-4 py-3 text-muted">
                      {new Date(c.fecha).toLocaleDateString("es-CO", { day: "numeric", month: "short" })} · {horaCorta(c.fecha)}
                    </td>
                    <td className="px-4 py-3">{c.sede}</td>
                    <td className="px-4 py-3 text-right text-muted">{c.metaDia ? cop(c.metaDia) : "—"}</td>
                    <td className="px-4 py-3 text-right text-accent-soft">{cop(c.ingresos)}</td>
                    <td className="px-4 py-3 text-right text-muted">−{cop(c.gastos)}</td>
                    <td className={`px-4 py-3 text-right ${c.diferencia && c.diferencia !== 0 ? "text-amber-400" : "text-muted"}`}>
                      {c.diferencia === null ? "—" : `${c.diferencia > 0 ? "+" : ""}${cop(c.diferencia)}`}
                    </td>
                    <td className="px-4 py-3 text-right text-muted">{c.citas}</td>
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
