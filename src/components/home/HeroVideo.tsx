"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useEffect, useRef } from "react";

// Hero con video ambiente del local (loop, sin sync a scroll). El recorrido
// scroll-driven ya existe en ScrollReveal3D más abajo en la página — el hero no
// debe competir con esa animación ni duplicarla.
//
// El video vive en un panel con marco (borde + esquinas redondeadas + margen
// del bg-bg alrededor) en vez de full-bleed — efecto "ventana cinematográfica"
// en lugar de wallpaper de pantalla completa.
//
// public/video/hero.mp4 es horizontal (960x540, generado con IA) — el cover-fit
// mantiene buen encuadre en mobile y desktop sin recortes agresivos.
//
// logo-hero.png es un recorte ajustado de logo.png (que trae ~78% de relleno
// transparente vertical dentro de su lienzo 1024x1024) — sin recortar, ese
// espacio muerto separaba el eyebrow del subtítulo/botones y rompía el ritmo
// vertical del bloque de texto.
export function HeroVideo() {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });

  // Algunos navegadores no respetan el atributo `muted` seteado por React a
  // tiempo para el autoplay-gate — hay que forzar la IDL property e invocar
  // play() a mano, o el <video> queda congelado en el primer frame sin pintar.
  useEffect(() => {
    if (reduce) return;
    const el = videoRef.current;
    if (!el) return;
    el.muted = true;
    const tryPlay = () => el.play().catch(() => {});
    tryPlay();
    document.addEventListener("visibilitychange", tryPlay);
    return () => document.removeEventListener("visibilitychange", tryPlay);
  }, [reduce]);

  const contentY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "38%"]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section
      ref={sectionRef}
      className="relative flex min-h-[88vh] flex-col bg-bg px-3 py-4 sm:min-h-[92vh] sm:px-6 sm:py-7"
    >
      <div className="relative flex-1 overflow-hidden rounded-[20px] border border-line/70 shadow-[0_45px_120px_-50px_rgba(0,0,0,0.9)] sm:rounded-[30px]">
        <div className="absolute inset-0 z-0">
          <video
            ref={videoRef}
            autoPlay={!reduce}
            muted
            loop
            playsInline
            preload="auto"
            poster="/sedes/parque-venezuela-interior.jpg"
            className="absolute inset-0 h-full w-full object-cover [filter:brightness(1.25)_contrast(1.05)_saturate(1.1)]"
          >
            <source src="/video/hero.mp4" type="video/mp4" />
          </video>
          <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_28%,rgba(12,11,10,0.08)_0%,rgba(8,7,6,0.35)_62%,rgba(4,3,3,0.68)_100%)]" />
        </div>

        <motion.div
          style={{ y: contentY, opacity: fade }}
          className="relative z-10 flex h-full flex-col items-center justify-center px-6 py-16 text-center"
        >
          <div className="flex flex-col items-center rounded-[24px] border border-white/10 bg-black/40 px-7 py-9 shadow-[0_30px_90px_-40px_rgba(0,0,0,0.75)] backdrop-blur-md sm:px-14 sm:py-11">
            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-accent font-semibold"
            >
              <span className="h-px w-8 bg-accent" /> Barbería · Barranquilla
              <span className="h-px w-8 bg-accent" />
            </motion.p>
            <h1 className="sr-only">Barbas &amp; Bigotes Barbershop</h1>
            <motion.div initial={false} animate={{ opacity: 1, y: 0, scale: 1 }} className="mt-8">
              <Image
                src="/brand/logo-hero.png"
                alt="Barbas & Bigotes Barbershop"
                width={840}
                height={255}
                priority
                className="mx-auto h-auto w-[78%] max-w-xs drop-shadow-[0_12px_60px_rgba(0,0,0,0.75)] sm:max-w-sm"
              />
            </motion.div>
            <motion.p
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="mx-auto mt-6 max-w-md text-balance text-lg text-ink/80"
            >
              Estilo clásico, manos expertas. Tu mejor versión en cualquiera de nuestras dos sedes.
            </motion.p>
            <motion.div
              initial={false}
              animate={{ opacity: 1, y: 0 }}
              className="mt-9 flex flex-wrap justify-center gap-4"
            >
              <Link
                href="/reservar"
                className="rounded-full bg-accent px-9 py-4 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_18px_50px_-14px_rgba(210,63,52,0.8)] transition hover:bg-accent-soft hover:-translate-y-0.5"
              >
                Reservar cita
              </Link>
              <Link
                href="/barberos"
                className="rounded-full border border-ink/30 bg-black/30 px-9 py-4 text-sm backdrop-blur transition hover:border-accent/60 hover:-translate-y-0.5"
              >
                Conocé a los barberos
              </Link>
            </motion.div>
          </div>
        </motion.div>
      </div>

      <motion.div
        initial={false}
        animate={{ opacity: 1 }}
        className="relative z-10 flex flex-col items-center gap-2 pt-4 sm:pt-6"
      >
        <span className="text-[10px] uppercase tracking-[0.35em] text-ink/45">Desliza</span>
        <motion.span
          className="h-7 w-px bg-gradient-to-b from-accent to-transparent"
          animate={reduce ? undefined : { scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "top" }}
        />
      </motion.div>
    </section>
  );
}
