import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { MobileStickyCta } from "@/components/MobileStickyCta";
import { AmbientSmoke } from "@/components/motion/AmbientSmoke";
import { HeroVideo } from "@/components/home/HeroVideo";
import { StatsBand } from "@/components/home/StatsBand";
import { Reveal } from "@/components/motion/Reveal";
import { WhyUs } from "@/components/home/WhyUs";
import { Historia } from "@/components/home/Historia";
import { Servicios } from "@/components/home/Servicios";
import { Testimonios } from "@/components/home/Testimonios";
import { Ubicacion } from "@/components/home/Ubicacion";
import { SedesShowcase } from "@/components/home/SedesShowcase";
import { sedes } from "@/lib/data/seed";

import { CardTilt } from "@/components/ui/CardTilt";

// Composición con tamaños mixtos: corte-1 (panorámica) y corte-5 (feature vertical)
// rompen la grilla uniforme. Spans pensados para una grilla de 6 columnas en sm+.
const cortes = [
  { n: 1, span: "sm:col-span-4 sm:row-span-2" },
  { n: 2, span: "sm:col-span-2" },
  { n: 3, span: "sm:col-span-2" },
  { n: 4, span: "sm:col-span-2" },
  { n: 5, span: "sm:col-span-2 sm:row-span-2" },
  { n: 6, span: "sm:col-span-2" },
  { n: 7, span: "sm:col-span-2" },
];

export default function Home() {
  return (
    <>
      <AmbientSmoke />
      <SiteHeader />
      <MobileStickyCta />
      <main>
        <HeroVideo />
        <Reveal>
          <StatsBand />
        </Reveal>

        <Reveal>
          <WhyUs />
        </Reveal>

        <Historia />

        <SedesShowcase sedes={sedes} />

        <Servicios />

        {/* nuestros trabajos */}
        <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
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
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-6 sm:[grid-auto-rows:11rem] lg:[grid-auto-rows:13rem]">
            {cortes.map(({ n, span }, i) => (
              <Reveal key={n} delay={(i % 3) * 0.07} y={36} className={span}>
                <CardTilt maxTilt={8} scale={1.04} className="group relative aspect-[3/4] h-full w-full overflow-hidden rounded-xl border border-line sm:aspect-auto">
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
                </CardTilt>
              </Reveal>
            ))}
            <Reveal delay={0.07} y={36} className="sm:col-span-2">
              <CardTilt maxTilt={8} scale={1.04} className="h-full w-full">
                <Link
                  href="/reservar"
                  className="flex aspect-[3/4] h-full flex-col items-center justify-center gap-2 rounded-xl border border-accent/40 bg-accent/5 text-center transition hover:bg-accent/10 sm:aspect-auto"
                >
                  <span className="font-display text-3xl uppercase text-accent-soft">Tu turno</span>
                  <span className="text-xs text-muted">Reservar cita →</span>
                </Link>
              </CardTilt>
            </Reveal>
          </div>
        </section>

        <Testimonios />

        <Ubicacion />
      </main>
      <SiteFooter />
    </>
  );
}
