"use client";

import Link from "next/link";
import { AnimatePresence, motion, useMotionValueEvent, useReducedMotion, useScroll } from "motion/react";
import { useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;
const SHOW_AFTER_PX = 480; // aparece después de salir del hero

// Barra fija inferior solo en mobile — acción principal siempre a un toque.
export function MobileStickyCta() {
  const [visible, setVisible] = useState(false);
  const reduce = useReducedMotion();
  const { scrollY } = useScroll();

  useMotionValueEvent(scrollY, "change", (y) => setVisible(y > SHOW_AFTER_PX));

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:hidden">
      <AnimatePresence>
        {visible && (
          <motion.div
            initial={reduce ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
            transition={{ duration: 0.28, ease: EASE }}
            className="pointer-events-auto rounded-2xl border border-line bg-bg/95 p-2 shadow-[0_-12px_30px_-10px_rgba(0,0,0,0.6)] backdrop-blur-md"
          >
            <Link
              href="/reservar"
              className="block rounded-xl bg-accent py-3.5 text-center text-sm font-semibold uppercase tracking-[0.12em] text-on-accent transition hover:bg-accent-soft"
            >
              Reservar cita
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
