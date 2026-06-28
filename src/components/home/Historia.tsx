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
          <p className="text-ink/85">
            [Pendiente — copy real del cliente: origen de la barbería, filosofía de servicio
            y relación con Barranquilla. No reemplazar con texto genérico.]
          </p>
          <p className="mt-3 text-xs uppercase tracking-[0.2em] text-muted/70">
            Sección estructural — contenido pendiente de aprobación del cliente
          </p>
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
