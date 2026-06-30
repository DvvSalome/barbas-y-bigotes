"use client";

import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";
import { AmbientSmoke } from "@/components/motion/AmbientSmoke";
import { Reveal } from "@/components/motion/Reveal";
import { CardTilt } from "@/components/ui/CardTilt";
import { FaceIcon, ScissorsIcon, UsersIcon, PinIcon } from "@/components/icons";

export default function NosotrosPage() {
  return (
    <>
      <AmbientSmoke />
      <SiteHeader />
      <main className="min-h-screen bg-bg text-white">
        
        {/* Header Hero */}
        <section className="relative overflow-hidden py-20 text-center sm:py-32">
          <div className="mx-auto max-w-3xl px-6">
            <Reveal>
              <p className="text-xs uppercase tracking-[0.4em] text-accent font-semibold">
                Nuestra Esencia
              </p>
              <h1 className="mt-4 font-display text-5xl font-bold uppercase tracking-tight sm:text-6xl text-white">
                Quiénes Somos
              </h1>
              <p className="mt-6 text-lg text-muted/90 leading-relaxed max-w-xl mx-auto">
                Tradición, estilo y cuidado para el caballero moderno. Un espacio diseñado para revivir el ritual clásico de la barbería en Barranquilla.
              </p>
            </Reveal>
          </div>
        </section>

        {/* Historia & Manifiesto */}
        <section className="mx-auto max-w-6xl px-6 pb-20">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-20 items-center">
            
            <Reveal>
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">
                Nuestra Historia
              </p>
              <h2 className="mt-2 mb-6 font-display text-3xl font-semibold uppercase text-white sm:text-4xl">
                El Arte de la Barbería
              </h2>
              
              <div className="space-y-5 text-ink/85 leading-relaxed">
                <p>
                  Nacimos en el corazón de Barranquilla con un propósito claro: rescatar el ritual clásico de la barbería y devolverle al hombre su espacio.
                </p>
                <p>
                  En Barbas & Bigotes combinamos técnicas tradicionales de afeitado con toalla caliente y navaja libre con las últimas tendencias de corte de cabello y cuidado facial.
                </p>
                <p>
                  Más que un simple corte, ofrecemos una experiencia completa de relajación, buena música, café y atención al detalle en un ambiente clásico y profesional.
                </p>
              </div>

              <div className="mt-8 flex flex-wrap gap-4">
                <a
                  href="https://instagram.com/barbasybigotes.baq"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-5 py-2.5 text-xs font-semibold uppercase tracking-wider text-accent-soft hover:bg-accent/15 transition duration-300"
                >
                  Síguenos en Instagram · @barbasybigotes.baq
                </a>
              </div>
            </Reveal>

            <Reveal delay={0.15}>
              <CardTilt maxTilt={5} className="group relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-line shadow-2xl">
                <Image
                  src="/quienes-somos/logo-vapor-v2.jpg"
                  alt="Emblema Barbas & Bigotes entre vapor cálido"
                  fill
                  sizes="(max-width:1024px) 100vw, 50vw"
                  className="object-cover transition duration-700 ease-out group-hover:scale-102"
                  priority
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </CardTilt>
            </Reveal>

          </div>
        </section>

        {/* Filosofía & Valores */}
        <section className="border-t border-line bg-panel/30 py-20">
          <div className="mx-auto max-w-6xl px-6">
            <Reveal className="text-center max-w-2xl mx-auto mb-16">
              <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">
                Nuestra Filosofía
              </p>
              <h2 className="mt-2 font-display text-3xl font-semibold uppercase text-white sm:text-4xl">
                Los Pilares de Barbas & Bigotes
              </h2>
            </Reveal>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              
              {/* Valor 1 */}
              <Reveal delay={0.05}>
                <div className="h-full rounded-2xl border border-line bg-panel/60 p-6 hover:border-accent/40 transition duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <ScissorsIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold uppercase text-white">
                    Tradición
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Técnicas de barbería clásica, afeitado a navaja tradicional y toallas calientes para tu comodidad.
                  </p>
                </div>
              </Reveal>

              {/* Valor 2 */}
              <Reveal delay={0.1}>
                <div className="h-full rounded-2xl border border-line bg-panel/60 p-6 hover:border-accent/40 transition duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <FaceIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold uppercase text-white">
                    Estilo
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Asesoramiento personalizado de imagen para adaptar cortes clásicos y modernos a tus facciones.
                  </p>
                </div>
              </Reveal>

              {/* Valor 3 */}
              <Reveal delay={0.15}>
                <div className="h-full rounded-2xl border border-line bg-panel/60 p-6 hover:border-accent/40 transition duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <UsersIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold uppercase text-white">
                    Comunidad
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Un espacio ideal para conversar, relajarte y pasar un rato agradable en la mejor compañía.
                  </p>
                </div>
              </Reveal>

              {/* Valor 4 */}
              <Reveal delay={0.2}>
                <div className="h-full rounded-2xl border border-line bg-panel/60 p-6 hover:border-accent/40 transition duration-300">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 text-accent">
                    <PinIcon className="h-6 w-6" />
                  </div>
                  <h3 className="mt-4 font-display text-lg font-semibold uppercase text-white">
                    Ambiente
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Instalaciones premium, excelente iluminación, buena música y café selecto para ti.
                  </p>
                </div>
              </Reveal>

            </div>
          </div>
        </section>

        {/* Nuestras Instalaciones (Muestra los locales directamente sin modal) */}
        <section className="mx-auto max-w-6xl px-6 py-20">
          <Reveal className="text-center max-w-2xl mx-auto mb-16">
            <p className="text-xs uppercase tracking-[0.3em] text-accent font-semibold">
              Espacios Premium
            </p>
            <h2 className="mt-2 font-display text-3xl font-semibold uppercase text-white sm:text-4xl">
              Nuestras Sedes
            </h2>
            <p className="mt-4 text-sm text-muted">
              Diseño de primera clase pensado para tu confort y relajación. Visítanos en cualquiera de nuestras sedes.
            </p>
          </Reveal>

          <div className="grid gap-8 sm:grid-cols-2">
            
            {/* Sede 1 */}
            <Reveal>
              <div className="group rounded-2xl border border-line bg-panel overflow-hidden">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src="/sedes/parque-venezuela-interior.jpg"
                    alt="Interior Parque Venezuela"
                    fill
                    sizes="(max-width:768px) 100vw, 500px"
                    className="object-cover transition duration-700 ease-out group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-semibold uppercase text-white">
                    Parque Venezuela
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Calle 88 #44 - 10, Local 4, Barranquilla
                  </p>
                  <Link
                    href="/reservar?sede=parque-venezuela"
                    className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                  >
                    Reservar en esta sede →
                  </Link>
                </div>
              </div>
            </Reveal>

            {/* Sede 2 */}
            <Reveal delay={0.1}>
              <div className="group rounded-2xl border border-line bg-panel overflow-hidden">
                <div className="relative aspect-[16/10] w-full overflow-hidden">
                  <Image
                    src="/sedes/plaza-de-la-paz-interior.jpg"
                    alt="Interior Plaza de la Paz"
                    fill
                    sizes="(max-width:768px) 100vw, 500px"
                    className="object-cover transition duration-700 ease-out group-hover:scale-102"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-semibold uppercase text-white">
                    Plaza de la Paz
                  </h3>
                  <p className="mt-2 text-sm text-muted leading-relaxed">
                    Carrera 45 frente a la Plaza de la Paz, Barranquilla
                  </p>
                  <Link
                    href="/reservar?sede=plaza-de-la-paz"
                    className="mt-5 inline-block rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                  >
                    Reservar en esta sede →
                  </Link>
                </div>
              </div>
            </Reveal>

          </div>
        </section>

        {/* CTA General */}
        <section className="border-t border-line py-20 text-center">
          <div className="mx-auto max-w-xl px-6">
            <Reveal>
              <h2 className="font-display text-3xl font-bold uppercase text-white sm:text-4xl">
                ¿Listo para tu corte?
              </h2>
              <p className="mt-4 text-sm text-muted leading-relaxed">
                Agenda tu cita con tu barbero favorito y vive la auténtica experiencia de Barbas & Bigotes.
              </p>
              <div className="mt-8 flex justify-center gap-4">
                <Link
                  href="/reservar"
                  className="rounded-full bg-accent px-8 py-3.5 text-sm font-semibold uppercase tracking-wider text-on-accent transition hover:bg-accent-soft"
                >
                  Reservar Turno Ahora
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

      </main>
      <SiteFooter />
    </>
  );
}
