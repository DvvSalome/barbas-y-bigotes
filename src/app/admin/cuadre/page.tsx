import type { Metadata } from "next";
import {
  getCuadre,
  getSedes,
  getBarberos,
  getCajaSesiones,
  getReservasPendientesCobro,
  getCuadresAnteriores,
  getMediosTodos,
  getAdelantosHoy,
  type MedioPago,
} from "@/lib/data/queries";
import { CuadreForms } from "@/components/admin/CuadreForms";
import { CajaSesiones } from "@/components/admin/CajaSesiones";
import { MediosPago } from "@/components/admin/MediosPago";
import { cop } from "@/lib/format";
import type { TotalesPorMedio } from "@/lib/cobro";
import { SectionHeader } from "@/components/admin/SectionHeader";

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
  const [cuadre, sedes, barberos, cajas, pendientes, anteriores, medios, adelantos] = await Promise.all([
    getCuadre(),
    getSedes(),
    getBarberos(),
    getCajaSesiones(),
    getReservasPendientesCobro(),
    getCuadresAnteriores(),
    getMediosTodos(),
    getAdelantosHoy(),
  ]);
  const fecha = new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota", weekday: "long", day: "numeric", month: "long" });
  const totalPendiente = pendientes.reduce((a, p) => a + p.monto, 0);

  return (
    <div className="max-w-7xl">
      <SectionHeader eyebrow="Hoy" title="Cuadre de caja" description={<span className="capitalize">{fecha}</span>} />

      {/* El pulso de la plata en cuadros, de un vistazo y sin scroll */}
      <div className="mt-5 grid grid-cols-2 gap-3 sm:max-w-2xl sm:grid-cols-4">
        {[
          { n: cop(cuadre.total.ingresos), l: "entró hoy", tono: "text-accent-soft" },
          { n: cop(totalPendiente), l: "pendiente por cobrar", tono: totalPendiente > 0 ? "text-warn" : "text-muted" },
          { n: cop(cuadre.total.gastos), l: "gastos de hoy", tono: "text-ink" },
          { n: cop(cuadre.total.neto), l: "queda neto", tono: "text-ok" },
        ].map((k) => (
          <div key={k.l} className="rounded-2xl border border-line bg-panel px-3.5 py-3">
            <div className={`font-display text-xl font-bold tabular-nums ${k.tono}`}>{k.n}</div>
            <div className="text-[11px] leading-tight text-muted">{k.l}</div>
          </div>
        ))}
      </div>

      {/* DOS PANELES en escritorio: a la izquierda lo que se MIRA (cajas, corte
          del día); a la derecha, FIJO, lo que se HACE (gasto, adelanto, medios).
          En móvil se apila en el mismo orden de siempre. */}
      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-start">
        <section className="min-w-0">
      <div>
        <CajaSesiones cajas={cajas} medios={medios} />
      </div>

      {pendientes.length > 0 && (
        <div className="mt-8 rounded-2xl border border-line bg-panel p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-display text-2xl">
              <span className="h-2 w-2 rounded-full bg-warn" /> Pendientes por cobrar
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

      <h2 className="mt-8 text-xs uppercase tracking-[0.3em] text-accent">Corte del día (solo lo de hoy)</h2>
      {/* La tarjeta de caja de arriba acumula desde la apertura (puede abarcar
          varios días); sin esta aclaración los dos totales parecen contradecirse. */}
      <p className="mt-1 text-xs text-muted">
        La caja de arriba suma todo lo recaudado desde que se abrió; acá se cuenta únicamente lo de hoy.
      </p>

      {/* UNA sola forma para todos los anchos. Antes esto se escribía dos veces
          (tarjetas para móvil + tabla de 8 columnas para escritorio): el mismo
          contenido mantenido en dos lugares, y la tabla leía como planilla
          contable cuando lo que se busca acá es "cuánto entró y cuánto queda". */}
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {cuadre.porSede.map((s) => (
          <CorteSede key={s.sede} nombre={s.nombre} d={s} />
        ))}
        <CorteSede nombre="Las dos sedes" d={cuadre.total} destacado />
      </div>
        </section>

        {/* Panel de ACCIONES, fijo a la derecha con su propio scroll */}
        <aside className="lg:sticky lg:top-28 lg:max-h-[calc(100dvh-8.5rem)] lg:overflow-y-auto">
          <CuadreForms sedes={sedes} barberos={barberos} />
          <div className="mt-6">
            <MediosPago medios={medios} />
          </div>
        </aside>
      </div>

      {/* Las bitácoras del día, a lo ancho y lado a lado */}
      {(cuadre.gastosHoy.length > 0 || adelantos.length > 0) && (
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          {cuadre.gastosHoy.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Gastos de hoy</h2>
              <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
                {cuadre.gastosHoy.map((g) => (
                  <li key={g.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{g.categoria}</span>
                      {g.descripcion && <span className="block text-xs text-muted">{g.descripcion}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">−{cop(g.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Rastro visible del adelanto: sin esta lista, registrar uno no se veía
              en ninguna parte y el dueño dudaba si guardó (o lo metía dos veces). */}
          {adelantos.length > 0 && (
            <div>
              <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Adelantos de hoy</h2>
              <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
                {adelantos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <span className="min-w-0">
                      <span className="block font-medium">{a.barbero}</span>
                      {a.nota && <span className="block text-xs text-muted">{a.nota}</span>}
                    </span>
                    <span className="shrink-0 tabular-nums text-muted">−{cop(a.monto)}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {anteriores.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">Cuadres anteriores</h2>

          {/* Una sola lista (antes: cards en móvil + tabla en escritorio). Lo
              que se mira de un cierre viejo es si CUADRÓ; por eso la diferencia
              de efectivo es lo único que se pinta en alerta. */}
          <ul className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
            {anteriores.map((c) => (
              <li key={c.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
                <span className="min-w-[160px] flex-1">
                  <span className="block text-[13.5px] font-semibold text-ink">
                    {c.sede}
                    <span className="ml-2 font-normal text-muted">
                      {new Date(c.fecha).toLocaleDateString("es-CO", {
                        timeZone: "America/Bogota",
                        day: "numeric",
                        month: "short",
                      })}{" "}
                      · {horaCorta(c.fecha)}
                    </span>
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {c.totales
                      ? desgloseCierre(c.totales, medios)
                      : `Efectivo ${cop(c.efectivo)} · Datáfono ${cop(c.datafono)}`}
                  </span>
                </span>

                <span className="text-right">
                  <span className="block font-display text-[15px] font-bold tabular-nums text-accent-soft">
                    {cop(c.ingresos)}
                  </span>
                  <span className="block text-[11.5px] text-muted">
                    {c.citas} citas
                    {c.gastos > 0 && ` · gastos −${cop(c.gastos)}`}
                    {c.metaDia ? ` · meta ${cop(c.metaDia)}` : ""}
                  </span>
                </span>

                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                    c.diferencia === null
                      ? "bg-ink/10 text-muted"
                      : c.diferencia === 0
                        ? "bg-ok/15 text-ok"
                        : "bg-warn/15 text-warn"
                  }`}
                >
                  {c.diferencia === null
                    ? "sin conteo"
                    : c.diferencia === 0
                      ? "cuadró"
                      : `${c.diferencia > 0 ? "sobró " : "faltó "}${cop(Math.abs(c.diferencia))}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

/**
 * El corte de una sede como recibo, no como fila de planilla: entró tanto, se
 * gastó tanto, queda tanto. Reemplaza a la tabla de 8 columnas + las tarjetas de
 * móvil que decían lo mismo.
 */
function CorteSede({
  nombre,
  d,
  destacado,
}: {
  nombre: string;
  d: { efectivo: number; datafono: number; otros: number; ingresos: number; gastos: number; neto: number; citas: number };
  destacado?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border p-4 ${destacado ? "border-accent/35 bg-accent/[0.05]" : "border-line bg-panel"}`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-display text-[17px] font-bold uppercase leading-tight">{nombre}</span>
        <span className="text-[11.5px] text-muted">{d.citas} citas</span>
      </div>

      <div className="mt-3 font-display text-[26px] font-bold leading-none tabular-nums text-accent-soft">
        {cop(d.ingresos)}
      </div>
      <div className="mt-1 text-[11.5px] text-muted">
        {cop(d.efectivo)} efectivo · {cop(d.datafono)} datáfono
        {d.otros > 0 && ` · ${cop(d.otros)} otros`}
      </div>

      <div className="mt-3 flex items-baseline justify-between border-t border-line/60 pt-2.5 text-[12.5px]">
        <span className="text-muted">Menos gastos {cop(d.gastos)}</span>
        <span className="font-display text-[15px] font-bold tabular-nums text-ink">{cop(d.neto)}</span>
      </div>
    </div>
  );
}
