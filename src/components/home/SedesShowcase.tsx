"use client";

import Image from "next/image";
import Link from "next/link";
import { Reveal } from "@/components/motion/Reveal";
import { CardTilt } from "@/components/ui/CardTilt";
import { PhotoLightbox } from "@/components/ui/PhotoLightbox";
import type { Sede } from "@/lib/data/types";

const sedeFotoFrente: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-frente.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-frente.jpg",
};

const sedeFotoInterior: Record<string, string> = {
  "parque-venezuela": "/sedes/parque-venezuela-interior.jpg",
  "plaza-de-la-paz": "/sedes/plaza-de-la-paz-interior.jpg",
};

// Al presionar una sede se abre el interior real del local (lightbox); el CTA
// dentro del modal lleva directo a Reservar con esa sede ya preseleccionada.
export function SedesShowcase({ sedes }: { sedes: Sede[] }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 sm:pt-20">
      <Reveal>
        <p className="text-xs uppercase tracking-[0.3em] text-accent">Dónde estamos</p>
        <h2 className="mb-7 font-display text-4xl font-semibold uppercase">Nuestras sedes</h2>
      </Reveal>
      <div className="grid gap-5 sm:grid-cols-2">
        {sedes.map((s, i) => (
          <Reveal key={s.id} delay={i * 0.08}>
            <PhotoLightbox
              src={sedeFotoInterior[s.id]}
              alt={`Interior sede ${s.nombre}`}
              title={s.nombre}
              ctaHref={`/reservar?sede=${s.id}`}
              ctaLabel="Reservar en esta sede →"
            >
              {(open) => (
                <CardTilt maxTilt={6}>
                  <button
                    type="button"
                    onClick={open}
                    className="group relative block aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line text-left sm:aspect-[16/11]"
                  >
                    <Image
                      src={sedeFotoFrente[s.id]}
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
                      <span className="mt-1 inline-block text-sm text-ink/85">Ver el local →</span>
                    </div>
                  </button>
                </CardTilt>
              )}
            </PhotoLightbox>
          </Reveal>
        ))}
      </div>
      <Reveal>
        <Link
          href="/barberos"
          className="mt-6 block text-center text-sm text-accent-soft transition hover:text-accent"
        >
          Ver disponibilidad y reservar →
        </Link>
      </Reveal>
    </section>
  );
}
