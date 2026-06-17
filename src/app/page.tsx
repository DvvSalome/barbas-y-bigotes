import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { WhyUs } from "@/components/home/WhyUs";
import { Testimonios } from "@/components/home/Testimonios";
import { Ubicacion } from "@/components/home/Ubicacion";
import { sedes } from "@/lib/data/seed";

const sedeFoto: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

const cortes = [1, 2, 3, 4, 5, 6, 7];

const stats = [
  ["2", "Sedes en Barranquilla"],
  ["6", "Barberos expertos"],
  ["26", "Servicios y combos"],
];

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* hero — atmósfera graduada (sin video) */}
        <section className="relative flex min-h-screen flex-col overflow-hidden">
          <Image
            src="/sedes/parque-venezuela-interior.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="scale-105 object-cover brightness-[0.4] contrast-[1.08] saturate-[0.85]"
          />
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_28%,rgba(12,11,10,0.3)_0%,rgba(8,7,6,0.9)_62%,rgba(4,3,3,1)_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,6,0.85)_0%,transparent_24%,transparent_58%,rgba(4,3,3,0.99)_100%)]" />

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-28 text-center">
            <p className="mb-9 flex items-center gap-3 text-[11px] uppercase tracking-[0.45em] text-accent">
              <span className="h-px w-8 bg-accent/50" /> Barbería · Barranquilla{" "}
              <span className="h-px w-8 bg-accent/50" />
            </p>
            <h1 className="sr-only">Barbas &amp; Bigotes Barbershop</h1>
            <Image
              src="/brand/logo.png"
              alt="Barbas & Bigotes Barbershop"
              width={1024}
              height={1024}
              priority
              className="mx-auto h-auto w-full max-w-lg drop-shadow-[0_12px_60px_rgba(0,0,0,0.75)]"
            />
            <p className="mx-auto mt-7 max-w-md text-balance text-lg text-ink/80">
              Estilo clásico, manos expertas. Tu mejor versión en cualquiera de nuestras dos
              sedes.
            </p>
            <div className="mt-10 flex flex-wrap justify-center gap-4">
              <Link
                href="/reservar"
                className="rounded-full bg-accent px-9 py-4 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_18px_50px_-14px_rgba(210,63,52,0.8)] transition hover:bg-accent-soft"
              >
                Reservar cita
              </Link>
              <Link
                href="/barberos"
                className="rounded-full border border-ink/30 bg-black/30 px-9 py-4 text-sm backdrop-blur transition hover:border-accent/60"
              >
                Conocé a los barberos
              </Link>
            </div>
          </div>

          <div className="relative z-10 flex flex-col items-center gap-2 pb-9">
            <span className="text-[10px] uppercase tracking-[0.35em] text-ink/45">Desliza</span>
            <span className="h-9 w-px bg-gradient-to-b from-accent to-transparent" />
          </div>
        </section>

        {/* stats */}
        <section className="border-y border-line bg-panel/40">
          <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-line px-6">
            {stats.map(([n, l]) => (
              <div key={l} className="px-3 py-8 text-center">
                <div className="font-display text-5xl font-semibold text-accent-soft">{n}</div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">{l}</div>
              </div>
            ))}
          </div>
        </section>

        <WhyUs />

        {/* sedes */}
        <section className="mx-auto max-w-6xl px-6 pt-20">
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Dónde estamos</p>
          <h2 className="mb-7 font-display text-4xl font-semibold uppercase">Nuestras sedes</h2>
          <div className="grid gap-5 sm:grid-cols-2">
            {sedes.map((s) => (
              <Link
                key={s.id}
                href="/barberos"
                className="group relative aspect-[4/5] overflow-hidden rounded-2xl border border-line sm:aspect-[16/11]"
              >
                <Image
                  src={sedeFoto[s.id]}
                  alt={`Sede ${s.nombre}`}
                  fill
                  sizes="(max-width:640px) 100vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
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
            ))}
          </div>
        </section>

        {/* nuestros trabajos */}
        <section className="mx-auto max-w-6xl px-6 pt-24">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {cortes.map((n) => (
              <div
                key={n}
                className="group relative aspect-[3/4] overflow-hidden rounded-xl border border-line"
              >
                <Image
                  src={`/cortes/corte-${n}.jpg`}
                  alt={`Trabajo ${n} — Barbas & Bigotes`}
                  fill
                  sizes="(max-width:640px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition duration-300 group-hover:opacity-100" />
                <div className="absolute bottom-3 left-4 right-4 translate-y-2 text-sm font-semibold uppercase tracking-wide text-on-accent opacity-0 transition duration-300 group-hover:translate-y-0 group-hover:opacity-100">
                  Barbas &amp; Bigotes
                </div>
              </div>
            ))}
            <Link
              href="/reservar"
              className="flex aspect-[3/4] flex-col items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/5 text-center transition hover:bg-accent/10"
            >
              <span className="font-display text-3xl uppercase text-accent-soft">Tu turno</span>
              <span className="text-xs text-muted">Reservar cita →</span>
            </Link>
          </div>
        </section>

        <Testimonios />

        {/* el espacio */}
        <section className="mx-auto mt-24 grid max-w-6xl items-center gap-10 px-6 md:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl border border-line">
            <Image
              src="/sedes/plaza-de-la-paz-interior.jpg"
              alt="Interior de la barbería Barbas & Bigotes"
              fill
              sizes="(max-width:768px) 100vw, 50vw"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">La experiencia</p>
            <h2 className="font-display text-4xl font-semibold uppercase">El espacio</h2>
            <p className="mt-4 text-muted">
              Ambiente moderno, sillas premium y atención de primera. Cortes, barba, faciales
              y color — todo en un solo lugar, en nuestras dos sedes de Barranquilla.
            </p>
            <Link
              href="/reservar"
              className="mt-7 inline-block rounded-full bg-accent px-7 py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
            >
              Reservar cita
            </Link>
          </div>
        </section>

        <Ubicacion />
      </main>
      <SiteFooter />
    </>
  );
}
