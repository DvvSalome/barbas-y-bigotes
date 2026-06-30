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
  id,
}: {
  src: string;
  alt: string;
  title?: string;
  ctaHref?: string;
  ctaLabel?: string;
  children: (open: () => void) => React.ReactNode;
  id?: string;
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
              layoutId={id ? `card-container-${id}` : undefined}
              transition={{ duration: 0.4, ease: EASE }}
              className="relative w-full max-w-3xl overflow-hidden rounded-2xl border border-line bg-panel shadow-[0_40px_120px_-40px_rgba(0,0,0,0.9)]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="relative aspect-[4/3] w-full sm:aspect-[16/10] overflow-hidden">
                <Image src={src} alt={alt} fill sizes="(max-width:768px) 100vw, 768px" className="object-cover" />
                
                {/* Gradient for top navbar readability */}
                <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-black/90 via-black/50 to-transparent pointer-events-none" />

                {title ? (
                  <div className="absolute inset-x-0 top-0 flex items-center justify-between px-5 py-4 z-10">
                    <div>
                      <motion.div
                        layoutId={id ? `label-${id}` : undefined}
                        className="text-[10px] uppercase tracking-[0.2em] text-accent-soft"
                      >
                        Sede
                      </motion.div>
                      <motion.h3
                        layoutId={id ? `title-${id}` : undefined}
                        className="font-display text-xl font-semibold uppercase leading-tight text-white"
                      >
                        {title}
                      </motion.h3>
                    </div>
                    <div className="flex items-center gap-3">
                      {ctaHref && (
                        <motion.div layoutId={id ? `cta-btn-${id}` : undefined}>
                          <Link
                            href={ctaHref}
                            className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
                          >
                            {ctaLabel ?? "Reservar →"}
                          </Link>
                        </motion.div>
                      )}
                      <button
                        type="button"
                        onClick={() => setOpen(false)}
                        aria-label="Cerrar"
                        className="flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white hover:bg-black/60 transition border border-white/10 backdrop-blur"
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    aria-label="Cerrar"
                    className="absolute right-3 top-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-black/60 text-lg text-white backdrop-blur transition hover:bg-black/80"
                  >
                    ✕
                  </button>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
