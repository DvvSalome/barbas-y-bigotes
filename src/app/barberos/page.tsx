import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { BarberCard } from "@/components/BarberCard";
import { getSedes, getBarberos } from "@/lib/data/queries";

export const metadata: Metadata = {
  title: "Barberos · Barbas & Bigotes",
};

export default async function BarberosPage() {
  const [sedes, barberos] = await Promise.all([getSedes(), getBarberos()]);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-16">
        <h1 className="text-center font-display text-5xl font-semibold uppercase">Elegí tu barbero</h1>
        <p className="mt-3 text-center text-muted">
          La foto real reemplaza el marcador de cada carta.
        </p>

        {sedes.map((s) => {
          const list = barberos.filter((b) => b.sede === s.id);
          if (!list.length) return null;
          return (
            <section key={s.id} className="mt-14">
              <h2 className="mb-6 flex items-center gap-4 font-display text-2xl italic">
                <span className="rounded-full border border-accent/40 px-3 py-1.5 font-sans text-[11px] not-italic uppercase tracking-[0.3em] text-accent">
                  Sede
                </span>
                {s.nombre}
              </h2>
              <div className="grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => (
                  <BarberCard key={b.id} barbero={b} />
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
