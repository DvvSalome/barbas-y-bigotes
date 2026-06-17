import Link from "next/link";
import type { Barbero } from "@/lib/data/types";
import { sedes } from "@/lib/data/seed";
import { FaceIcon, PinIcon, CamIcon } from "@/components/icons";

const sedeNombre = (id: Barbero["sede"]) =>
  sedes.find((s) => s.id === id)?.nombre ?? id;

export function BarberCard({ barbero: b }: { barbero: Barbero }) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-[0_30px_60px_-30px_rgba(210,63,52,0.45)]">
      {/* foto (placeholder hasta tener la real) */}
      <div className="relative flex aspect-[4/4.4] items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#262019,#0b0a09)]">
        <FaceIcon className="w-[42%] text-ink opacity-15" />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.85))]" />

        {b.destacado && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-accent">
            ★ Top
          </span>
        )}
        <span className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full border border-accent/45 bg-black/40 px-2.5 py-1 text-[9.5px] uppercase tracking-wide text-accent-soft backdrop-blur-sm">
          <CamIcon className="h-3 w-3" /> Foto
        </span>

        <div className="absolute inset-x-4 bottom-4">
          <div className="font-display text-4xl font-semibold uppercase leading-none tracking-wide">
            {b.nombre}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[12.5px] text-ink/85">
            <PinIcon className="h-3 w-3 text-accent-soft" /> {sedeNombre(b.sede)}
          </div>
        </div>
      </div>

      <div className="h-0.5 w-full bg-accent/70" />

      <div className="p-5">
        <div className="mb-3.5 flex items-center gap-2 text-[13px] text-ink/80">
          <span className="tracking-[1px] text-accent">★★★★★</span>
          <b className="text-ink">{b.rating?.toFixed(1)}</b>
          <span className="text-muted">·</span>
          <span className="text-muted">{b.resenas} reseñas</span>
        </div>

        <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted">
          Especialista en
        </div>
        <div className="mb-4 flex flex-wrap gap-1.5">
          {b.especialidades.slice(0, 4).map((e) => (
            <span
              key={e}
              className="rounded-full border border-line bg-white/[0.04] px-2.5 py-1.5 text-[12px]"
            >
              {e}
            </span>
          ))}
        </div>

        <Link
          href={`/reservar?barbero=${b.id}`}
          className="block rounded-xl bg-accent py-3 text-center text-xs font-semibold uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-soft"
        >
          Reservar cita
        </Link>
      </div>
    </article>
  );
}
