"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { Barbero } from "@/lib/data/types";
import { sedes } from "@/lib/data/seed";
import { FaceIcon, PinIcon, CamIcon } from "@/components/icons";
import type { BarberLiveStatus } from "@/lib/actions";

const EASE = [0.22, 1, 0.36, 1] as const;

const sedeNombre = (id: Barbero["sede"]) =>
  sedes.find((s) => s.id === id)?.nombre ?? id;

// Foto en blanco y negro por defecto — al tocar/clickear, pasa a color y
// revela rating, especialidades y CTA. El cliente sabe quién lo atiende solo
// después de "conocerlo". Por ahora todos los barberos usan la misma foto
// genérica (seed.ts → /barberos/generico.jpg) solo para probar la interacción
// grises→color — reemplazar por la foto real de cada uno cuando lleguen.
export function BarberCard({
  barbero: b,
  onSelect,
  liveStatus,
}: {
  barbero: Barbero;
  /** Cuando se pasa, reemplaza el link "Reservar cita" por un botón que elige
   * este barbero dentro de un flujo en curso (ej. paso 2 del wizard de Reservar)
   * en vez de navegar a una reserva nueva. */
  onSelect?: (b: Barbero) => void;
  liveStatus?: BarberLiveStatus;
}) {
  const [revealed, setRevealed] = useState(false);
  const reduce = useReducedMotion();

  return (
    <article className="group overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_18px_40px_-28px_rgba(0,0,0,0.9)] transition duration-200 hover:-translate-y-1.5 hover:border-accent/40 hover:shadow-[0_30px_60px_-30px_rgba(210,63,52,0.45)]">
      <button
        type="button"
        onClick={() => setRevealed((r) => !r)}
        aria-pressed={revealed}
        aria-label={revealed ? `Ocultar información de ${b.nombre}` : `Ver información de ${b.nombre}`}
        className="relative flex aspect-[4/4.4] w-full items-center justify-center overflow-hidden bg-[linear-gradient(165deg,#262019,#0b0a09)]"
      >
        <Image
          src={b.fotoUrl || "/barberos/generico.jpg"}
          alt={b.nombre}
          fill
          sizes="(max-width:640px) 50vw, 33vw"
          className={`object-cover transition-all duration-700 group-hover:grayscale-0 ${revealed ? "grayscale-0" : "grayscale"}`}
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgba(0,0,0,0.85))]" />

        {b.destacado && (
          <span className="absolute left-3 top-3 rounded-full bg-accent px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-on-accent">
            ★ Top
          </span>
        )}
        {liveStatus && (
          <span className={`absolute right-3 top-3 z-10 flex items-center gap-1.5 rounded-full bg-black/75 px-2.5 py-1 text-[9.5px] font-semibold uppercase tracking-wider backdrop-blur-sm border ${liveStatus.status === "ocupado" ? "border-accent/40 text-accent-soft" : "border-emerald-500/40 text-emerald-400"}`}>
            <span className={`h-1.5 w-1.5 rounded-full ${liveStatus.status === "ocupado" ? "bg-accent animate-pulse" : "bg-emerald-500"}`} />
            {liveStatus.status === "ocupado" ? "Atendiendo" : "Libre"}
          </span>
        )}
        {!b.fotoUrl && (
          <span className={`absolute right-3 ${liveStatus ? "top-10" : "top-3"} flex items-center gap-1.5 rounded-full border border-accent/45 bg-black/40 px-2.5 py-1 text-[9.5px] uppercase tracking-wide text-accent-soft backdrop-blur-sm`}>
            <CamIcon className="h-3 w-3" /> Foto
          </span>
        )}

        <div className="absolute inset-x-3.5 bottom-3.5 text-left sm:inset-x-4 sm:bottom-4">
          <div className="font-display text-2xl lg:text-3xl font-semibold uppercase leading-none tracking-wide text-white">
            {b.nombre}
          </div>
          <div className="mt-1.5 flex items-center gap-1.5 text-[11px] sm:text-[12.5px] text-ink/85">
            <PinIcon className="h-3 w-3 text-accent-soft" /> {sedeNombre(b.sede)}
          </div>
          {!revealed && (
            <div className="mt-2 text-[9.5px] sm:text-[11px] uppercase tracking-[0.2em] text-accent-soft">
              Tocá para conocerlo →
            </div>
          )}
        </div>
      </button>

      <div className="h-0.5 w-full bg-accent/70" />

      <AnimatePresence initial={false}>
        {revealed && (
          <motion.div
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
            transition={{ duration: 0.4, ease: EASE }}
            className="overflow-hidden"
          >
            <div className="p-3.5 lg:p-5">
              <div className="mb-3.5 flex items-center gap-1.5 text-xs sm:text-[13px] text-ink/80">
                <span className="tracking-[1px] text-accent">★★★★★</span>
                <b className="text-ink">{b.rating?.toFixed(1)}</b>
                <span className="text-muted">·</span>
                <span className="text-muted">{b.resenas} reseñas</span>
              </div>

              {liveStatus && liveStatus.status === "ocupado" && (
                <div className="mb-3.5 p-3 rounded-xl border border-accent/25 bg-accent/5 text-[11px] sm:text-xs text-accent-soft leading-relaxed">
                  <span className="font-bold text-white uppercase tracking-wider block text-[9.5px] mb-1">En servicio ahora:</span>
                  <span className="text-ink font-semibold">{liveStatus.servicioActual}</span>
                  <span className="block mt-1 text-muted text-[10px]">Libre estimado a las {liveStatus.terminaA}</span>
                </div>
              )}

              {b.bio && <p className="mb-4 text-xs sm:text-sm text-ink/85">{b.bio}</p>}

              <div className="mb-2 text-[9px] sm:text-[10px] uppercase tracking-[0.18em] text-muted">
                Especialista en
              </div>
              <div className="mb-4 flex flex-wrap gap-1">
                {b.especialidades.map((e) => (
                  <span
                    key={e}
                    className="rounded-full border border-line bg-white/[0.04] px-2 py-1 text-[10px] sm:text-[12px]"
                  >
                    {e}
                  </span>
                ))}
              </div>

              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(b)}
                  className="block w-full rounded-xl bg-accent py-2.5 lg:py-3 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-soft"
                >
                  Elegir a {b.nombre.split(" ")[0]}
                </button>
              ) : (
                <Link
                  href={`/reservar?barbero=${b.id}`}
                  className="block rounded-xl bg-accent py-2.5 lg:py-3 text-center text-[10px] sm:text-xs font-semibold uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-soft"
                >
                  Reservar cita
                </Link>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </article>
  );
}
