import type { Metadata } from "next";
import {
  getCuadre,
  getSedes,
  getBarberos,
  getCajaSesiones,
  getReservasPendientesCobro,
  getCuadresAnteriores,
  getMediosTodos,
  type MedioPago,
} from "@/lib/data/queries";
import { CuadreForms } from "@/components/admin/CuadreForms";
import { CajaSesiones } from "@/components/admin/CajaSesiones";
import { MediosPago } from "@/components/admin/MediosPago";
import { cop } from "@/lib/format";
import type { TotalesPorMedio } from "@/lib/cobro";
import { SectionHeader } from "@/components/admin/SectionHeader";
import { Stat } from "@/components/admin/Stat";

export const metadata: Metadata = { title: "Cuadre de caja · Admin" };

function horaCorta(iso: string) {
  // Hora civil en Bogotá sin depender del TZ del proceso (server en UTC).
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  const ap = h < 12 ? "am" : "pm";
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${ap}`;
}

// Desglose por medio de un cierre nuevo (con snapshot `totales`), con propinas.
function desgloseCierre(totales: TotalesPorMedio, medios: MedioPago[]) {
  const ordenDe = new Map(medios.map((m) => [m.slug, m.orden]));
  const nombreDe = (slug: string) =>
    medios.find((m) => m.slug === slug)?.nombre ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  return Object.entries(totales)
    .sort(([a], [b]) => (ordenDe.get(a) ?? 999) - (ordenDe.get(b) ?? 999))
    .map(([slug, t]) => `${nombreDe(slug)} ${cop(t.total)}${t.propina > 0 ? ` (+${cop(t.propina)} propina)` : ""}`)
    .join(" · ");
}

export default async function CuadrePage() {
  const [cuadre, sedes, barberos, cajas, pendientes, anteriores, medios] = await Promise.all([
    getCuadre(),
    getSedes(),
    getBarberos(),
    getCajaSesiones(),
    getReservasPendientesCobro(),
    getCuadresAnteriores(),
    getMediosTodos(),
  ]);
  const fecha = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });
  const totalPendiente = pendientes.reduce((a, p) => a + p.monto, 0);

  return (
    <div className="max-w-5xl">
      <SectionHeader eyebrow="Hoy" title="Cuadre de caja" description={<span className="capitalize">{fecha}</span>} />

      <div className="mt-8">
        <CajaSesiones cajas={cajas} medios={medios} />
      </div>

      {pendientes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <span className="h-2 w-2 rounded-full bg-amber-400" /> Pendientes por cobrar
            </h2>
            <span className="text-sm text-muted">
              {pendientes.length} reservas · <b className="text-accent-soft">{cop(totalPendiente)}</b> proyectado
            </span>
          </div>
          <p className="mt-1 text-xs text-muted">Citas de hoy aún sin registrar en caja. Se cobran al completar la atención en la app del barbero.</p>
          <div className="mt-4 space-y-2">
            {pendientes.map((p) => (
              <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-bg px-4 py-2.5 text-sm transition hover:border-accent/30">
                <div className="min-w-0">
                  <span className="font-semibold">{p.cliente}</span>
                  <span className="text-muted"> · {p.servicio} · {p.barbero}</span>
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">{horaCorta(p.inicio)}</span>
                  <span className="text-accent-soft">{cop(p.monto)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <h2 className="mt-10 text-xs uppercase tracking-[0.3em] text-accent">Corte del día</h2>

      {/* Mobile: cards apiladas por sede */}
      <div className="mt-3 space-y-3 sm:hidden">
        {cuadre.porSede.map((s) => (
          <div key={s.sede} className="rounded-2xl border border-line bg-panel p-4">
            <div className="font-display text-lg">{s.nombre}</div>
            <div className="mt-3 grid grid-cols-3 gap-3">
              <Stat label="Efectivo" value={cop(s.efectivo)} />
              <Stat label="Datáfono" value={cop(s.datafono)} />
              <Stat label="Citas" value={s.citas} />
              <Stat label="Ingresos" value={cop(s.ingresos)} />
              <Stat label="Gastos" value={`−${cop(s.gastos)}`} className="text-muted" />
              <Stat label="Neto" value={cop(s.neto)} className="font-semibold text-accent-soft" />
            </div>
          </div>
        ))}
        <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4">
          <div className="font-display text-lg">Total</div>
          <div className="mt-3 grid grid-cols-3 gap-3">
            <Stat label="Efectivo" value={cop(cuadre.total.efectivo)} />
            <Stat label="Datáfono" value={cop(cuadre.total.datafono)} />
            <Stat label="Citas" value={cuadre.total.citas} />
            <Stat label="Ingresos" value={cop(cuadre.total.ingresos)} />
            <Stat label="Gastos" value={`−${cop(cuadre.total.gastos)}`} className="text-muted" />
            <Stat label="Neto" value={cop(cuadre.total.neto)} className="font-semibold text-accent-soft" />
          </div>
        </div>
      </div>

      {/* sm+: tabla */}
      <div className="mt-3 hidden overflow-x-auto rounded-2xl border border-line sm:block">
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
              <tr key={s.sede} className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
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

      <div className="mt-8">
        <MediosPago medios={medios} />
      </div>

      {cuadre.gastosHoy.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Gastos de hoy</h2>

          {/* Mobile: lista de cards */}
          <div className="space-y-2 sm:hidden">
            {cuadre.gastosHoy.map((g) => (
              <div key={g.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium">{g.categoria}</div>
                  {g.descripcion && <div className="text-xs text-muted">{g.descripcion}</div>}
                </div>
                <span className="shrink-0 text-muted">−{cop(g.monto)}</span>
              </div>
            ))}
          </div>

          {/* sm+: tabla */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
            <table className="w-full text-sm">
              <tbody>
                {cuadre.gastosHoy.map((g, i) => (
                  <tr key={g.id} className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
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
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Cuadres anteriores</h2>

          {/* Mobile: cards */}
          <div className="space-y-3 sm:hidden">
            {anteriores.map((c) => (
              <div key={c.id} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm text-muted">
                    {new Date(c.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" })} · {horaCorta(c.fecha)}
                  </div>
                  <span className="rounded-full bg-elevated px-2.5 py-1 text-xs">{c.sede}</span>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-3">
                  <Stat label="Meta" value={c.metaDia ? cop(c.metaDia) : "—"} className="text-muted" />
                  <Stat label="Ingresos" value={cop(c.ingresos)} className="text-accent-soft" />
                  <Stat label="Citas" value={c.citas} />
                  <Stat label="Gastos" value={`−${cop(c.gastos)}`} className="text-muted" />
                  <Stat
                    label="Dif. efectivo"
                    value={c.diferencia === null ? "—" : `${c.diferencia > 0 ? "+" : ""}${cop(c.diferencia)}`}
                    className={c.diferencia && c.diferencia !== 0 ? "text-amber-400" : "text-muted"}
                  />
                </div>
                {c.totales ? (
                  <div className="mt-3 border-t border-line pt-2 text-xs text-muted">{desgloseCierre(c.totales, medios)}</div>
                ) : (
                  <div className="mt-3 border-t border-line pt-2 text-xs text-muted">
                    Efectivo {cop(c.efectivo)} · Datáfono {cop(c.datafono)}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* sm+: tabla */}
          <div className="hidden overflow-x-auto rounded-2xl border border-line sm:block">
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
                  <tr key={c.id} className={`transition hover:bg-elevated/50 ${i % 2 ? "bg-panel" : "bg-panel/40"}`}>
                    <td className="px-4 py-3 text-muted">
                      {new Date(c.fecha).toLocaleDateString("es-CO", { timeZone: "America/Bogota", day: "numeric", month: "short" })} · {horaCorta(c.fecha)}
                    </td>
                    <td className="px-4 py-3">{c.sede}</td>
                    <td className="px-4 py-3 text-right text-muted">{c.metaDia ? cop(c.metaDia) : "—"}</td>
                    <td className="px-4 py-3 text-right text-accent-soft">
                      {cop(c.ingresos)}
                      <div className="text-[10px] font-normal text-muted">
                        {c.totales ? desgloseCierre(c.totales, medios) : `Efectivo ${cop(c.efectivo)} · Datáfono ${cop(c.datafono)}`}
                      </div>
                    </td>
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
