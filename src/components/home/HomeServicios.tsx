import Link from "next/link";
import type { Servicio } from "@/lib/data/types";

/*
  "Lo que más piden" (spec §1.4 móvil: card lista de 5 filas / §2.5 desktop:
  grid de 3 + celda CTA). Los precios salen de la DB (precio Parque Venezuela =
  pv del prototipo) — el admin los edita en /admin/precios. Server component.
*/

function formatCOP(n: number) {
  return n.toLocaleString("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0,
  });
}

export function HomeServicios({ servicios }: { servicios: Servicio[] }) {
  const filas = servicios.map((s) => ({
    id: s.id,
    nombre: s.nombre,
    dur: s.duracionMin,
    // Precio de Parque Venezuela (pv en el prototipo).
    precio: s.precios["parque-venezuela"],
  }));

  return (
    <>
      {/* ---------------- MÓVIL (spec §1.4) ---------------- */}
      <section className="px-[18px] pb-2 pt-[26px] md:hidden">
        <div data-reveal>
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Servicios</p>
          <h2 className="font-display text-[28px] font-bold uppercase">Lo que más piden</h2>
        </div>
        <div className="mt-4 overflow-hidden rounded-2xl border border-[rgba(242,237,228,0.1)] bg-panel">
          {filas.map((f, i) => (
            <div
              data-reveal
              style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              key={f.id}
              className="flex items-center justify-between gap-3 border-b border-[rgba(242,237,228,0.07)] px-4 py-[13px]"
            >
              <div>
                <div className="text-sm font-semibold text-ink">{f.nombre}</div>
                <div className="text-xs text-muted">{f.dur} min</div>
              </div>
              <div className="whitespace-nowrap font-display text-[19px] font-bold tabular-nums text-accent-soft">
                {f.precio != null ? formatCOP(f.precio) : "—"}
              </div>
            </div>
          ))}
          <Link
            href="/reservar"
            className="block bg-[rgba(210,63,52,0.06)] py-[13px] text-center text-[13px] font-semibold text-accent-soft"
          >
            Ver todos y reservar →
          </Link>
        </div>
      </section>

      {/* ---------------- DESKTOP (spec §2.5) ---------------- */}
      <section className="mx-auto hidden max-w-[1180px] px-16 pt-[52px] md:block">
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Servicios</p>
        <h2 className="font-display text-[38px] font-bold uppercase">Lo que más piden</h2>
        <div className="mt-8 grid grid-cols-3 gap-3">
          {filas.map((f) => (
            <div
              key={f.id}
              className="rounded-2xl border border-[rgba(242,237,228,0.1)] bg-panel p-[18px]"
            >
              <div className="text-[14.5px] font-bold text-ink">{f.nombre}</div>
              <div className="mt-1 flex items-baseline justify-between">
                <span className="text-xs text-muted">{f.dur} min</span>
                <span className="font-display text-2xl font-extrabold tabular-nums text-accent-soft">
                  {f.precio != null ? formatCOP(f.precio) : "—"}
                </span>
              </div>
            </div>
          ))}
          <Link
            href="/reservar"
            className="flex flex-col items-center justify-center gap-1 rounded-2xl border border-accent/40 bg-accent/5 p-[18px] text-center transition hover:bg-accent/10"
          >
            <span className="font-display text-[22px] font-bold uppercase text-accent-soft">
              Ver todos
            </span>
            <span className="text-xs text-muted">y reservar →</span>
          </Link>
        </div>
      </section>
    </>
  );
}
