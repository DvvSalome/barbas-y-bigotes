"use client";

import Image from "next/image";
import Link from "next/link";
import { motion, useScroll, useTransform, useReducedMotion } from "motion/react";
import { useRef } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

// Hero inmersivo con parallax: el fondo se mueve más lento y escala suave al scrollear,
// el contenido sube y se desvanece. Entrada escalonada del logo + texto + CTAs.
export function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });

  const bgY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "20%"]);
  const bgScale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [1.06, 1.16]);
  const contentY = useTransform(scrollYProgress, [0, 1], reduce ? ["0%", "0%"] : ["0%", "38%"]);
  const fade = useTransform(scrollYProgress, [0, 0.6], [1, 0]);

  return (
    <section ref={ref} className="relative flex min-h-screen flex-col overflow-hidden">
      <motion.div style={{ y: bgY, scale: bgScale }} className="absolute inset-0 will-change-transform">
        <Image
          src="/sedes/parque-venezuela-interior.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover brightness-[0.4] contrast-[1.08] saturate-[0.85]"
        />
      </motion.div>
      <div className="absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_28%,rgba(12,11,10,0.3)_0%,rgba(8,7,6,0.9)_62%,rgba(4,3,3,1)_100%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(8,7,6,0.85)_0%,transparent_24%,transparent_58%,rgba(4,3,3,0.99)_100%)]" />

      <motion.div
        style={{ y: contentY, opacity: fade }}
        className="relative z-10 flex flex-1 flex-col items-center justify-center px-6 py-28 text-center"
      >
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: EASE }}
          className="mb-9 flex items-center gap-3 text-xs uppercase tracking-[0.3em] text-accent font-semibold"
        >
          <span className="h-px w-8 bg-accent" /> Barbería · Barranquilla{" "}
          <span className="h-px w-8 bg-accent" />
        </motion.p>
        <h1 className="sr-only">Barbas &amp; Bigotes Barbershop</h1>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 24, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.9, delay: 0.2, ease: EASE }}
        >
          <Image
            src="/brand/logo.png"
            alt="Barbas & Bigotes Barbershop"
            width={1024}
            height={1024}
            priority
            className="mx-auto h-auto w-full max-w-lg drop-shadow-[0_12px_60px_rgba(0,0,0,0.75)]"
          />
        </motion.div>
        <motion.p
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.36, ease: EASE }}
          className="mx-auto mt-7 max-w-md text-balance text-lg text-ink/80"
        >
          Estilo clásico, manos expertas. Tu mejor versión en cualquiera de nuestras dos sedes.
        </motion.p>
        <motion.div
          initial={reduce ? false : { opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.5, ease: EASE }}
          className="mt-10 flex flex-wrap justify-center gap-4"
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
      </motion.div>

      <motion.div
        style={{ opacity: fade }}
        initial={reduce ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.1, duration: 1, ease: EASE }}
        className="relative z-10 flex flex-col items-center gap-2 pb-9"
      >
        <span className="text-[10px] uppercase tracking-[0.35em] text-ink/45">Desliza</span>
        <motion.span
          className="h-9 w-px bg-gradient-to-b from-accent to-transparent"
          animate={reduce ? undefined : { scaleY: [0.4, 1, 0.4], opacity: [0.4, 1, 0.4] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          style={{ transformOrigin: "top" }}
        />
      </motion.div>
    </section>
  );
}
