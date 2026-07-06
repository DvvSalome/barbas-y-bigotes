import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BarberCard } from "@/components/BarberCard";
import { Reveal } from "@/components/motion/Reveal";
import { getSedes, getBarberos } from "@/lib/data/queries";
import { barberosItemList, jsonLd } from "@/lib/schema-org";

export const metadata: Metadata = {
  title: "Nuestros barberos",
  description:
    "Conocé a los 6 barberos de Barbas & Bigotes en Barranquilla: especialistas en degradados, barba, color y diseño en las sedes Parque Venezuela y Plaza de la Paz.",
};

export default async function BarberosPage() {
  const [sedes, barberos] = await Promise.all([getSedes(), getBarberos()]);

  return (
    <>
      {/* ItemList de Person (equipo real de la DB), server-rendered para IA. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLd(barberosItemList(barberos)) }}
      />
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
                    <BarberCard barbero={b} />
                    {/* Especialidad server-rendered (la card la revela solo con JS). */}
                    {b.especialidades.length > 0 && (
                      <p className="mt-2.5 px-1 text-xs leading-relaxed text-muted">
                        <span className="uppercase tracking-[0.18em] text-accent-soft">
                          Especialista en{" "}
                        </span>
                        {b.especialidades.slice(0, 4).join(", ")}
                      </p>
                    )}
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
