"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useReducedMotion } from "motion/react";

/*
  Hero de la home (spec §1.2 móvil + §2.2 desktop). Es un único client
  component porque el typewriter móvil necesita JS; en desktop no hay typewriter
  (panel "video ambiente" con card glass + logo-hero). Un solo <h1 sr-only> para
  SEO; lo visible (typewriter / logo) es decorativo.
*/

// Frases del typewriter — LITERAL del prototipo (spec §1.2, L3755).
const HERO_FRASES = [
  "Tu mejor versión sale de la silla",
  "Degradados que hablan por ti",
  "Barba perfilada, actitud renovada",
  "El ritual clásico, hecho arte",
];

// Timing exacto (spec §1.2, L3756-3771): tick de 60ms, 1 char por tick;
// al completar pausa 26 ticks y borra; al vaciar pausa 4 ticks y sigue.
function useTypewriter(enabled: boolean) {
  const [text, setText] = useState(HERO_FRASES[0]);

  useEffect(() => {
    if (!enabled) return;
    let frase = 0;
    let pos = HERO_FRASES[0].length; // arranca con la 1ª frase completa
    let dir: 1 | -1 = -1; // -1 borrando, 1 escribiendo
    let pausa = 26; // pausa inicial como si acabara de escribir la frase 0

    const id = setInterval(() => {
      if (pausa > 0) {
        pausa--;
        return;
      }
      if (dir === 1) {
        pos++;
        setText(HERO_FRASES[frase].slice(0, pos));
        if (pos >= HERO_FRASES[frase].length) {
          dir = -1;
          pausa = 26;
        }
      } else {
        pos--;
        setText(HERO_FRASES[frase].slice(0, pos));
        if (pos <= 0) {
          dir = 1;
          pausa = 4;
          frase = (frase + 1) % HERO_FRASES.length;
        }
      }
    }, 60);

    return () => clearInterval(id);
  }, [enabled]);

  return text;
}

const Caret = () => (
  <span
    aria-hidden
    className="ml-[3px] inline-block h-[0.85em] w-[3px] align-[-2px] bg-accent [animation:bbcaret_1s_step-end_infinite]"
  />
);

export function HomeHero() {
  const reduce = useReducedMotion();
  const text = useTypewriter(!reduce);
  const kbClass = reduce ? "" : "[animation:bbkb_18s_ease-in-out_infinite_alternate]";

  return (
    <section aria-label="Barbas & Bigotes Barbershop">
      {/* Un único h1 para SEO; lo visual es decorativo. */}
      <h1 className="sr-only">
        Barbas &amp; Bigotes Barbershop, barbería en Barranquilla
      </h1>

      {/* ---------------- MÓVIL (spec §1.2) ---------------- */}
      <div className="bb-foto-skeleton relative h-[380px] overflow-hidden md:hidden">
        <div className={`absolute inset-[-4%] ${kbClass}`}>
          <Image
            src="/sedes/parque-venezuela-interior.jpg"
            alt="Interior de la sede Parque Venezuela"
            fill
            priority
            sizes="100vw"
            className="object-cover [filter:brightness(1.05)_contrast(1.05)]"
          />
        </div>
        {/* Overlay que funde al fondo */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(12,11,10,0.25)_0%,rgba(12,11,10,0.55)_55%,#0c0b0a_100%)]" />

        {/* Badge "En vivo" */}
        <div className="absolute right-4 top-4 flex items-center gap-1.5 rounded-full border border-[rgba(242,237,228,0.14)] bg-[rgba(5,4,3,0.55)] px-[11px] py-[5px]">
          <span className="h-1.5 w-1.5 rounded-full bg-accent shadow-[0_0_8px_#d23f34]" />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-ink">
            En vivo
          </span>
        </div>

        {/* Bloque de texto anclado abajo */}
        <div className="absolute inset-x-5 bottom-[22px]">
          <p className="font-display text-xs font-bold uppercase tracking-[0.34em] text-accent-soft">
            Barranquilla · 2 sedes
          </p>
          <div className="mt-2 min-h-[126px] font-display text-[44px] font-extrabold uppercase leading-[0.95] text-ink">
            {text}
            <Caret />
          </div>
          <p className="max-w-[30ch] text-sm text-muted">
            Reserva online, sin filas y con el barbero que te conoce.
          </p>
          <Link
            href="/reservar"
            className="mt-4 inline-block rounded-full bg-[linear-gradient(180deg,var(--accent-soft),var(--accent))] px-[26px] py-[13px] font-display text-base font-bold uppercase tracking-[0.06em] text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.7)]"
          >
            Reservar cita
          </Link>
        </div>
      </div>

      {/* ---------------- DESKTOP (spec §2.2) ---------------- */}
      <div className="hidden md:block">
        <div className="mx-auto max-w-[1180px] px-6 pt-6">
          <div className="bb-foto-skeleton relative h-[600px] overflow-hidden rounded-[30px] border border-[rgba(242,237,228,0.07)] shadow-[0_45px_120px_-50px_rgba(0,0,0,0.9)]">
            {/* Video ambiente del local (autoplay silenciado, en loop). El poster
                es la foto fija: pinta al instante mientras baja el mp4, y con
                reduce-motion (o si el navegador bloquea autoplay) queda esa foto.
                Solo desktop: este bloque es hidden md:block, así el mp4 (~5MB) no
                se descarga en móvil. */}
            {reduce ? (
              <div className={`absolute inset-[-4%] ${kbClass}`}>
                <Image
                  src="/sedes/parque-venezuela-interior.jpg"
                  alt="Interior de la sede Parque Venezuela"
                  fill
                  priority
                  sizes="100vw"
                  className="object-cover [filter:brightness(1.25)_contrast(1.05)_saturate(1.1)]"
                />
              </div>
            ) : (
              <video
                className="absolute inset-0 h-full w-full object-cover [filter:brightness(1.25)_contrast(1.05)_saturate(1.1)]"
                autoPlay
                muted
                loop
                playsInline
                preload="auto"
                poster="/sedes/parque-venezuela-interior.jpg"
                aria-label="Video ambiente de la sede Parque Venezuela"
              >
                <source src="/video/hero.mp4" type="video/mp4" />
              </video>
            )}
            <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_28%,rgba(12,11,10,0.08)_0%,rgba(8,7,6,0.35)_62%,rgba(4,3,3,0.68)_100%)]" />

            {/* Badge arriba-derecha */}
            <div className="absolute right-6 top-6 flex items-center gap-2 rounded-full border border-[rgba(242,237,228,0.14)] bg-[rgba(5,4,3,0.55)] px-3 py-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-accent [animation:bbping_1.6s_cubic-bezier(0,0,0.2,1)_infinite]" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#c9c2b6]">
                Video ambiente del local
              </span>
            </div>

            {/* Card glass central */}
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="flex flex-col items-center rounded-[24px] border border-white/[0.08] bg-[rgba(5,4,3,0.55)] px-14 py-11 text-center shadow-[0_30px_90px_-40px_rgba(0,0,0,0.75)] backdrop-blur-[3px]">
                <p className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-accent">
                  <span aria-hidden className="h-px w-8 bg-accent" />
                  Barbería · Barranquilla
                  <span aria-hidden className="h-px w-8 bg-accent" />
                </p>
                <Image
                  src="/brand/logo-hero.png"
                  alt="Barbas & Bigotes Barbershop"
                  width={840}
                  height={255}
                  priority
                  className="mt-8 h-auto w-[380px] max-w-[78%] drop-shadow-[0_12px_60px_rgba(0,0,0,0.75)]"
                />
                <p className="mt-6 max-w-[44ch] text-[17px] leading-[1.55] text-ink/80">
                  Estilo clásico, manos expertas. Tu mejor versión en cualquiera de
                  nuestras dos sedes.
                </p>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
                  <Link
                    href="/reservar"
                    className="rounded-full bg-accent px-[34px] py-4 text-[13px] font-semibold uppercase tracking-[0.06em] text-on-accent shadow-[0_18px_50px_-14px_rgba(210,63,52,0.8)] transition hover:bg-accent-soft"
                  >
                    Reservar cita
                  </Link>
                  <Link
                    href="/barberos"
                    className="rounded-full border border-[rgba(242,237,228,0.3)] bg-black/30 px-[30px] py-4 text-[13px] text-ink backdrop-blur-[6px] transition hover:border-accent-soft"
                  >
                    Conoce a los barberos
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Scroll cue */}
          <div className="flex flex-col items-center gap-2 pt-4">
            <span className="text-[10px] uppercase tracking-[0.35em] text-[rgba(242,237,228,0.45)]">
              Desliza
            </span>
            <span className="h-[26px] w-px bg-[linear-gradient(180deg,#d23f34,transparent)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
