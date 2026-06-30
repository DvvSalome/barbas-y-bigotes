"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "motion/react";
import { Reveal } from "@/components/motion/Reveal";

const EASE = [0.22, 1, 0.36, 1] as const;

// Historia/manifiesto: brecha del sistema actual. El copy real (origen, filosofía,
// relación con Barranquilla) está pendiente del cliente — no se inventa narrativa de
// marca. El texto de abajo es un placeholder visible a propósito.
export function Historia() {
  const reduce = useReducedMotion();

  return (
    <section className="mx-auto max-w-6xl px-6 pt-14 sm:pt-24">
      <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-14">
        <Reveal>
          <p className="text-xs uppercase tracking-[0.3em] text-accent">Nuestra historia</p>
          <h2 className="mb-5 font-display text-4xl font-semibold uppercase">Quiénes somos</h2>
          <p className="text-ink/85 leading-relaxed">
            Nacimos en el corazón de Barranquilla con un propósito claro: rescatar el ritual clásico de la barbería y devolverle al hombre su espacio. Con nuestras dos sedes en Parque Venezuela y Plaza de la Paz, en Barbas & Bigotes combinamos las técnicas tradicionales de afeitado con toalla caliente y navaja libre con las últimas tendencias de corte de cabello y cuidado facial.
          </p>
          <p className="mt-4 text-ink/85 leading-relaxed">
            Más que un simple corte, ofrecemos una experiencia completa de relajación, buena música, café y atención al detalle en un ambiente clásico y profesional.
          </p>
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <a
              href="https://instagram.com/barbasybigotes.baq"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-accent/40 bg-accent/5 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-accent-soft hover:bg-accent/15 transition duration-300"
            >
              Síguenos en Instagram · @barbasybigotes.baq
            </a>
          </div>
        </Reveal>
        <motion.div
          initial={reduce ? false : { opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.7, ease: EASE }}
          className="relative aspect-[4/5] overflow-hidden rounded-2xl border border-line"
        >
          <Image
            src="/quienes-somos/logo-vapor-v2.jpg"
            alt="Emblema Barbas & Bigotes entre vapor cálido — identidad de marca"
            fill
            sizes="(max-width:1024px) 100vw, 50vw"
            className="object-cover"
          />
        </motion.div>
      </div>
    </section>
  );
}
