import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { Hero } from "@/components/home/Hero";
import { StatsBand } from "@/components/home/StatsBand";
import { Reveal } from "@/components/motion/Reveal";
import { WhyUs } from "@/components/home/WhyUs";
import { Testimonios } from "@/components/home/Testimonios";
import { Ubicacion } from "@/components/home/Ubicacion";
import { sedes } from "@/lib/data/seed";

const sedeFoto: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

const cortes = [1, 2, 3, 4, 5, 6, 7];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <StatsBand />

        <WhyUs />

        {/* sedes */}
        <section className="mx-auto max-w-6xl px-6 pt-20">
          <Reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Dónde estamos</p>
            <h2 className="mb-7 font-display text-4xl font-semibold uppercase">Nuestras sedes</h2>
          </Reveal>
          <div className="grid gap-5 sm:grid-cols-2">
            {sedes.map((s, i) => (
              <Reveal key={s.id} delay={i * 0.08}>
                <Link
                  href="/barberos"
                  className="group relative block aspect-[4/5] overflow-hidden rounded-2xl border border-line sm:aspect-[16/11]"
                >
                  <Image
                    src={sedeFoto[s.id]}
                    alt={`Sede ${s.nombre}`}
                    fill
                    sizes="(max-width:640px) 100vw, 50vw"
                    className="object-cover transition duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(0,0,0,0.9))]" />
                  <div className="absolute inset-x-5 bottom-5">
                    <div className="text-xs uppercase tracking-[0.3em] text-accent-soft">Sede</div>
                    <div className="font-display text-3xl font-semibold uppercase leading-tight">
                      {s.nombre}
                    </div>
                    <span className="mt-1 inline-block text-sm text-ink/85">
                      Ver disponibilidad →
                    </span>
                  </div>
                </Link>
              </Reveal>
            ))}
          </div>
        </section>

        {/* nuestros trabajos */}
        <section className="mx-auto max-w-6xl px-6 pt-24">
          <Reveal>
            <div className="mb-7 flex items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-accent">Galería</p>
                <h2 className="font-display text-4xl font-semibold uppercase">Nuestros trabajos</h2>
              </div>
              <Link
                href="/reservar"
                className="hidden text-sm text-accent-soft transition hover:text-accent sm:block"
              >
                Reservá el tuyo →
              </Link>
            </div>
          </Reveal>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cortes.map((n, i) => (
              <Reveal key={n} delay={(i % 3) * 0.07} y={36}>
                <div className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-line">
                  <Image
                    src={`/cortes/corte-${n}.jpg`}
                    alt={`Trabajo ${n} — Barbas & Bigotes`}
                    fill
                    sizes="(max-width:640px) 50vw, 33vw"
                    className="object-cover transition duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                  <div className="absolute bottom-3 left-4 right-4 translate-y-2 text-sm font-semibold uppercase tracking-wide text-on-accent opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                    Barbas &amp; Bigotes
                  </div>
                </div>
              </Reveal>
            ))}
            <Reveal delay={0.07} y={36}>
              <Link
                href="/reservar"
                className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/5 text-center transition hover:bg-accent/10"
              >
                <span className="font-display text-3xl uppercase text-accent-soft">Tu turno</span>
                <span className="text-xs text-muted">Reservar cita →</span>
              </Link>
            </Reveal>
          </div>
        </section>

        <Testimonios />

        {/* el espacio */}
        <section className="mx-auto mt-24 grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
          <Reveal>
            <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line">
              <Image
                src="/sedes/plaza-de-la-paz-interior.jpg"
                alt="Interior de la barbería Barbas & Bigotes"
                fill
                sizes="(max-width:768px) 100vw, 50vw"
                className="object-cover"
              />
            </div>
          </Reveal>
          <Reveal delay={0.12}>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">La experiencia</p>
            <h2 className="font-display text-4xl font-semibold uppercase">El espacio</h2>
            <p className="mt-4 text-muted">
              Ambiente moderno, sillas premium y atención de primera. Cortes, barba, faciales
              y color. Todo en un solo lugar, en nuestras dos sedes de Barranquilla.
            </p>
            <Link
              href="/reservar"
              className="mt-7 inline-block rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft hover:-translate-y-0.5"
            >
              Reservar cita
            </Link>
          </Reveal>
        </section>

        <Ubicacion />
      </main>
      <SiteFooter />
    </>
  );
}
