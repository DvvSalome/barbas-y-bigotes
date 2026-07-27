import Image from "next/image";
import Link from "next/link";

/*
  "Nuestros trabajos" (spec §1.5 móvil: grid 2×2 con 3 fotos + tile CTA /
  §2.6 desktop: mosaico de 6 columnas). Fotos en public/cortes/. Server component.
*/

// Mosaico desktop: cada foto con su span (spec §2.6).
const MOSAICO = [
  { n: 1, span: "col-span-4 row-span-2" },
  { n: 2, span: "col-span-2" },
  { n: 3, span: "col-span-2" },
  { n: 4, span: "col-span-2" },
  { n: 5, span: "col-span-2 row-span-2" },
  { n: 6, span: "col-span-2" },
  { n: 7, span: "col-span-2" },
];

export function HomeGaleria() {
  return (
    <>
      {/* ---------------- MÓVIL (spec §1.5) ---------------- */}
      <section className="px-[18px] pt-[26px] md:hidden">
        <div data-reveal>
          <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Galería</p>
          <h2 className="font-display text-[28px] font-bold uppercase">Nuestros trabajos</h2>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {[2, 3, 5].map((n, i) => (
            <div
              data-reveal
              style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              key={n}
              className="relative aspect-[3/4] overflow-hidden rounded-xl border border-[rgba(242,237,228,0.1)]"
            >
              <Image
                src={`/cortes/corte-${n}.jpg`}
                alt={`Trabajo de Barbas & Bigotes`}
                fill
                sizes="50vw"
                className="object-cover"
              />
            </div>
          ))}
          <Link
            href="/reservar"
            className="flex aspect-[3/4] flex-col items-center justify-center gap-1 rounded-xl border border-accent/40 bg-accent/5 text-center"
          >
            <span className="font-display text-2xl font-bold uppercase text-accent-soft">
              Tu turno
            </span>
            <span className="text-[11px] text-muted">Reservar cita →</span>
          </Link>
        </div>
      </section>

      {/* ---------------- DESKTOP (spec §2.6) ---------------- */}
      <section className="mx-auto hidden max-w-[1180px] px-16 pt-[52px] md:block">
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Galería</p>
        <h2 className="font-display text-[38px] font-bold uppercase">Nuestros trabajos</h2>
        <div className="mt-8 grid grid-cols-6 gap-3 [grid-auto-rows:150px]">
          {MOSAICO.map(({ n, span }, i) => (
            <div
              data-reveal
              style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              key={n}
              className={`relative overflow-hidden rounded-[14px] border border-[rgba(242,237,228,0.1)] ${span}`}
            >
              <Image
                src={`/cortes/corte-${n}.jpg`}
                alt={`Trabajo de Barbas & Bigotes`}
                fill
                sizes="(max-width:1200px) 66vw, 800px"
                className="object-cover"
              />
            </div>
          ))}
          <Link
            href="/reservar"
            className="col-span-2 flex flex-col items-center justify-center gap-1 rounded-[14px] border border-accent/40 bg-accent/5 text-center transition hover:bg-accent/10"
          >
            <span className="font-display text-[26px] font-bold uppercase text-accent-soft">
              Tu turno
            </span>
            <span className="text-xs text-muted">Reservar cita →</span>
          </Link>
        </div>
      </section>
    </>
  );
}
