import Image from "next/image";
import Link from "next/link";

/*
  "Dos casas, un mismo oficio" (spec §1.6 móvil: 2 cards apiladas 150px /
  §2.7 desktop: grid 1fr 1fr, cards 230px). Tap → wizard con la sede fijada.
  Server component.
*/

// La dirección NO se escribe acá: era la cuarta copia del mismo dato y decía
// "Cra 65" para una sede que queda en la Calle 88. Sale de SEDE_INFO, que ya es
// la fuente que usa el wizard — se corrige en un lugar y cambia en todos.
import { SEDE_INFO } from "@/lib/data/sede-info";

const SEDES = (["parque-venezuela", "plaza-de-la-paz"] as const).map((id) => ({
  id,
  nombre: SEDE_INFO[id].nombre,
  // Solo la calle: el "· Barranquilla" de SEDE_INFO sobra en una tarjeta que ya
  // está bajo el título "Sedes en Barranquilla".
  detalle: SEDE_INFO[id].detalle.split(" · ")[0],
  foto: SEDE_INFO[id].frente ?? "",
}));

export function HomeSedes() {
  return (
    <>
      {/* ---------------- MÓVIL (spec §1.6) ---------------- */}
      <section className="px-[18px] pb-[30px] pt-[26px] md:hidden">
        <p className="text-[11px] uppercase tracking-[0.3em] text-accent">Sedes</p>
        <h2 className="font-display text-[28px] font-bold uppercase">
          Dos casas, un mismo oficio
        </h2>
        <div className="mt-4 grid gap-3">
          {SEDES.map((s, i) => (
            <Link
            data-reveal
            style={{ "--reveal-delay": `${i * 80}ms` } as React.CSSProperties}
              key={s.id}
              href={`/reservar?sede=${s.id}`}
              className="bb-foto-skeleton relative block h-[150px] overflow-hidden rounded-2xl border border-[rgba(242,237,228,0.1)]"
            >
              <Image
                src={s.foto}
                alt={`Sede ${s.nombre}`}
                fill
                sizes="100vw"
                quality={70}
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_20%,rgba(12,11,10,0.85)_100%)]" />
              <div className="absolute inset-x-4 bottom-3 flex items-end justify-between gap-3">
                <div>
                  <div className="font-display text-[22px] font-bold uppercase leading-none text-white">
                    {s.nombre}
                  </div>
                  <div className="mt-1.5 text-xs text-muted">Lun–sáb 9 am – 8 pm</div>
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.08em] text-accent-soft">
                  Reservar acá →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ---------------- DESKTOP (spec §2.7) ---------------- */}
      <section className="mx-auto hidden max-w-[1180px] px-16 pt-[52px] md:block">
        <h2 data-reveal className="font-display text-[38px] font-bold uppercase">
          Dos casas, un mismo oficio
        </h2>
        <div className="mt-8 grid grid-cols-2 gap-3.5">
          {SEDES.map((s) => (
            <Link
              key={s.id}
              href={`/reservar?sede=${s.id}`}
              className="bb-foto-skeleton group relative block h-[230px] overflow-hidden rounded-[18px] border border-[rgba(242,237,228,0.1)]"
            >
              <Image
                src={s.foto}
                alt={`Sede ${s.nombre}`}
                fill
                sizes="(max-width:1200px) 50vw, 560px"
                quality={70}
                className="object-cover transition duration-700 ease-out group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_30%,rgba(12,11,10,0.88)_100%)]" />
              <div className="absolute inset-x-6 bottom-5">
                <div className="font-display text-[28px] font-bold uppercase leading-none text-white">
                  {s.nombre}
                </div>
                <p className="mt-2 text-[13px] text-[#c9c2b6]">
                  {s.detalle} · Lun–sáb 9 am – 8 pm ·{" "}
                  <span className="font-semibold text-accent-soft">Reservar acá →</span>
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
