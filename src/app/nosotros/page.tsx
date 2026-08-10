import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "@/components/SiteHeader";
import { SiteFooter } from "@/components/SiteFooter";

export const metadata: Metadata = {
  title: "Quiénes somos",
  description:
    "Barbas & Bigotes: tradición, estilo y cuidado para el caballero moderno en Barranquilla. El ritual clásico de la barbería con técnicas tradicionales y tendencias actuales.",
};

// ISR de 10 min (igual que / y /barberos): el footer muestra "Horarios de atención"
// desde la BD; sin esto la página quedaba 100% estática y congelaba los horarios al
// build. Los cambios del dueño se reflejan en ≤10 min sin redeploy.
export const revalidate = 600;

// Pilares (spec §4, L4243-4248) — copy y glyphs LITERALES.
const PILARES = [
  {
    glyph: "✂",
    titulo: "Tradición",
    texto:
      "Técnicas de barbería clásica, afeitado a navaja tradicional y toallas calientes para tu comodidad.",
  },
  {
    glyph: "◆",
    titulo: "Estilo",
    texto:
      "Asesoramiento personalizado de imagen para adaptar cortes clásicos y modernos a tus facciones.",
  },
  {
    glyph: "✦",
    titulo: "Comunidad",
    texto:
      "Un espacio ideal para conversar, relajarte y pasar un rato agradable en la mejor compañía.",
  },
  {
    glyph: "★",
    titulo: "Ambiente",
    texto:
      "Instalaciones premium, excelente iluminación, buena música y café selecto para ti.",
  },
];

const SEDES = [
  {
    id: "parque-venezuela",
    nombre: "Parque Venezuela",
    direccion: "Calle 88 #44 - 10, Local 4, Barranquilla",
    foto: "/sedes/parque-venezuela-interior.jpg",
  },
  {
    id: "plaza-de-la-paz",
    nombre: "Plaza de la Paz",
    direccion: "Carrera 45 frente a la Plaza de la Paz, Barranquilla",
    foto: "/sedes/plaza-de-la-paz-interior.jpg",
  },
];

export default function NosotrosPage() {
  return (
    <>
      <SiteHeader />
      <main>
        {/* Hero */}
        <section className="mx-auto max-w-[1180px] px-6 pt-14 text-center md:px-16 md:pt-[60px]">
          <p className="text-xs uppercase tracking-[0.4em] text-accent">Nuestra esencia</p>
          <h1 className="mt-3 font-display text-[44px] font-extrabold uppercase leading-[0.95] md:text-[58px]">
            Quiénes somos
          </h1>
          <p className="mx-auto mt-4 max-w-[56ch] text-base leading-[1.65] text-muted">
            Tradición, estilo y cuidado para el caballero moderno. Un espacio diseñado
            para revivir el ritual clásico de la barbería en Barranquilla.
          </p>
        </section>

        {/* Historia */}
        <section className="mx-auto grid max-w-[1180px] items-center gap-8 px-6 pb-[50px] pt-8 md:grid-cols-2 md:gap-12 md:px-16 md:pt-[30px]">
          <div data-reveal>
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Nuestra historia</p>
            <h2 className="mt-2 font-display text-[32px] font-bold uppercase md:text-[36px]">
              El arte de la barbería
            </h2>
            <div className="mt-6 space-y-5 text-[14.5px] leading-[1.7] text-[rgba(242,237,228,0.85)]">
              <p>
                Nacimos en el corazón de Barranquilla con un propósito claro: rescatar el
                ritual clásico de la barbería y devolverle al hombre su espacio.
              </p>
              <p>
                En Barbas &amp; Bigotes combinamos técnicas tradicionales de afeitado con
                toalla caliente y navaja libre con las últimas tendencias de corte de
                cabello y cuidado facial.
              </p>
              <p>
                Más que un simple corte, ofrecemos una experiencia completa de relajación,
                buena música, café y atención al detalle en un ambiente clásico y
                profesional.
              </p>
            </div>
            <a
              href="https://instagram.com/barbasybigotes.baq"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-block rounded-full border border-accent/40 bg-accent/5 px-5 py-2.5 text-[11.5px] font-bold uppercase tracking-[0.1em] text-accent-soft transition hover:bg-accent/10"
            >
              Síguenos en Instagram · @barbasybigotes.baq
            </a>
          </div>

          <div className="relative aspect-[4/5] overflow-hidden rounded-[18px] border border-[rgba(242,237,228,0.12)] shadow-[0_40px_90px_-50px_rgba(0,0,0,0.9)]">
            <Image
              src="/quienes-somos/logo-vapor-v2.jpg"
              alt="Emblema Barbas y Bigotes entre vapor cálido"
              fill
              priority
              sizes="(max-width:768px) 100vw, 560px"
              className="object-cover"
            />
          </div>
        </section>

        {/* Pilares */}
        <section className="border-t border-[rgba(242,237,228,0.08)] bg-[rgba(21,19,17,0.35)] py-14 md:py-[56px]">
          <div className="mx-auto max-w-[1180px] px-6 md:px-16">
            <div data-reveal className="text-center">
              <p className="text-xs uppercase tracking-[0.3em] text-accent">Nuestra filosofía</p>
              <h2 className="mt-2 font-display text-[32px] font-bold uppercase md:text-[36px]">
                Los pilares de Barbas &amp; Bigotes
              </h2>
            </div>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {PILARES.map((p, i) => (
                <div
                  key={p.titulo}
                  data-reveal
                  style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
                  className="rounded-2xl border border-[rgba(242,237,228,0.1)] bg-[rgba(21,19,17,0.6)] p-[22px] transition hover:border-accent/40"
                >
                  <div className="grid h-[46px] w-[46px] place-items-center rounded-xl bg-accent/10 text-xl text-accent">
                    {p.glyph}
                  </div>
                  <h3 className="mt-4 font-display text-lg font-bold uppercase">{p.titulo}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{p.texto}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Sedes */}
        <section className="mx-auto max-w-[1180px] px-6 py-14 md:px-16 md:py-[56px]">
          <div className="text-center">
            <p className="text-xs uppercase tracking-[0.3em] text-accent">Espacios premium</p>
            <h2 className="mt-2 font-display text-[32px] font-bold uppercase md:text-[36px]">
              Nuestras sedes
            </h2>
          </div>
          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            {SEDES.map((s, i) => (
              <div
                data-reveal
                style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
                key={s.id}
                className="group overflow-hidden rounded-2xl border border-[rgba(242,237,228,0.1)] bg-panel"
              >
                <div className="relative aspect-[16/10] overflow-hidden">
                  <Image
                    src={s.foto}
                    alt={`Interior ${s.nombre}`}
                    fill
                    sizes="(max-width:768px) 100vw, 560px"
                    className="object-cover transition duration-700 ease-out group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                </div>
                <div className="p-6">
                  <h3 className="font-display text-2xl font-bold uppercase">{s.nombre}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-muted">{s.direccion}</p>
                  <Link
                    href={`/reservar?sede=${s.id}`}
                    className="mt-5 inline-block rounded-full bg-accent px-5 py-2.5 text-[11px] font-bold uppercase tracking-[0.1em] text-on-accent transition hover:bg-accent-soft"
                  >
                    Reservar en esta sede →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
