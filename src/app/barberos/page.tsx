import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BarberCard } from "@/components/BarberCard";
import { Reveal } from "@/components/motion/Reveal";
import { getSedes, getBarberos } from "@/lib/data/queries";
import { getLiveBarberStatuses } from "@/lib/actions";

export const metadata: Metadata = {
  title: "Barberos · Barbas & Bigotes",
};

export default async function BarberosPage() {
  const [sedes, barberos, liveStatusesArray] = await Promise.all([
    getSedes(),
    getBarberos(),
    getLiveBarberStatuses(),
  ]);

  const liveStatuses: Record<string, typeof liveStatusesArray[0]> = {};
  liveStatusesArray.forEach((s) => {
    liveStatuses[s.id] = s;
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <Reveal>
          <p className="text-center text-xs uppercase tracking-[0.4em] text-accent">Nuestro equipo</p>
          <h1 className="mt-3 text-center font-display text-5xl font-semibold uppercase">Elegí tu barbero</h1>
          <p className="mt-3 text-center text-muted">
            Cada uno con su especialidad. Tocá una carta y reservá directo con quien quieras.
          </p>
        </Reveal>

        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          if (!list.length) return null;
          return (
            <section key={s.id} className="mt-14">
              <Reveal>
                <h2 className="mb-6 flex items-center gap-4 font-display text-2xl italic">
                  <span className="rounded-full border border-accent/40 px-3 py-1.5 font-sans text-[11px] not-italic uppercase tracking-[0.3em] text-accent">
                    Sede
                  </span>
                  {s.nombre}
                </h2>
              </Reveal>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b, i) => (
                  <Reveal key={b.id} delay={(i % 3) * 0.08} y={36}>
                    <BarberCard barbero={b} liveStatus={liveStatuses[b.id]} />
                  </Reveal>
                ))}
              </div>
            </section>
          );
        })}
      </main>
      <SiteFooter />
    </>
  );
}
