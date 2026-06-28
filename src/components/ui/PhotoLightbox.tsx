"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";

const EASE = [0.22, 1, 0.36, 1] as const;

// Lightbox genérico: el trigger (render prop) decide su propia UI/estilo;
// este componente solo aporta el estado open/close y el overlay con la foto.
// ctaHref/ctaLabel son opcionales — cuando se pasan, el modal muestra una
// salida clara hacia otra parte del sitio (ej. Reservar) además de la foto.
export function PhotoLightbox({
  src,
  alt,
  title,
  ctaHref,
  ctaLabel,
  children,
}: {
  src: string;
  alt: string;
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
  children: (open: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {children(() => setOpen(true))}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm sm:p-8"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label={title ?? alt}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.97 }}
              transition={{ duration: 0.28, ease: EASE }}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar"
                className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-ink backdrop-blur transition hover:bg-black/80"
              >
                ✕
              </button>
              <div className="relative aspect-[4/3] w-full sm:aspect-[16/10]">
                <Image src={src} alt={alt} fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
              </div>
              {title && (
                <div className="absolute inset-x-5 bottom-4 flex flex-wrap items-end justify-between gap-3">
                  <div>
                    <div className="text-xs uppercase tracking-[0.3em] text-accent-soft">Sede</div>
                    <div className="font-display text-2xl font-semibold uppercase leading-tight">{title}</div>
                  </div>
                  {ctaHref && (
                    <Link
                      href={ctaHref}
                      className="shrink-0 rounded-full bg-accent px-5 py-2.5 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                    >
                      {ctaLabel ?? "Reservar →"}
                    </Link>
                  )}
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
