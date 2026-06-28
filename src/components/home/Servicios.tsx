import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { servicios, categorias } from "@/lib/data/seed";
import type { Servicio } from "@/lib/data/types";

// Selección curada de servicios reales (seed.ts) — no se listan los 38 para
// mantener la sección breve y escaneable; el detalle completo vive en /reservar.
const DESTACADOS_IDS = ["corte", "corte-barba", "ritual-barba", "limpieza-gold", "keratina", "combo-gold"];

function formatCOP(n: number) {
  return n.toLocaleString("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 });
}

function formatDuracion(min: number) {
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const rest = min % 60;
  return rest ? `${h}h ${rest}min` : `${h}h`;
}

function precioDisplay(s: Servicio) {
  const valores = Object.values(s.precios);
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  return { precio: min, desde: Boolean(s.desde) || min !== max };
}

export function Servicios() {
  const destacados = DESTACADOS_IDS.map((id) => servicios.find((s) => s.id === id)).filter(
    (s): s is Servicio => Boolean(s),
  );

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <Reveal>
        <div className="mb-7 flex items-end justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Servicios</p>
            <h2 className="font-display text-4xl font-semibold uppercase">Lo que hacemos</h2>
          </div>
          <Link
            href="/reservar"
            className="hidden text-sm text-accent-soft transition hover:text-accent sm:block"
          >
            Ver todos y precios →
          </Link>
        </div>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {destacados.map((s, i) => {
          const { precio, desde } = precioDisplay(s);
          return (
            <Reveal key={s.id} delay={(i % 3) * 0.07} y={28}>
              <div className="flex h-full flex-col rounded-2xl border border-line bg-panel p-6 transition duration-200 hover:-translate-y-1 hover:border-accent/40">
                <p className="text-[10px] uppercase tracking-[0.2em] text-accent-soft">
                  {categorias[s.categoria]}
                  {s.esCombo ? " · Combo" : ""}
                </p>
                <h3 className="mt-2 font-display text-xl font-semibold uppercase leading-tight">{s.nombre}</h3>
                <div className="mt-4 flex items-baseline justify-between text-sm text-muted">
                  <span>{formatDuracion(s.duracionMin)}</span>
                  <span className="font-display text-2xl font-semibold text-ink tabular-nums">
                    {desde && <span className="text-xs font-normal uppercase text-muted">Desde </span>}
                    {formatCOP(precio)}
                  </span>
                </div>
                <Link
                  href="/reservar"
                  className="mt-5 rounded-xl border border-line py-2.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-ink transition hover:border-accent hover:text-accent-soft"
                >
                  Reservar este servicio
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>
      <Reveal>
        <Link
          href="/reservar"
          className="mt-6 block text-center text-sm text-accent-soft transition hover:text-accent sm:hidden"
        >
          Ver todos los servicios y precios →
        </Link>
      </Reveal>
    </section>
  );
}
