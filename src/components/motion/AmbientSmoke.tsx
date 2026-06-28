"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "motion/react";

// Atmósfera de fondo fija para toda la página: vetas verticales angostas
// (no círculos) que suben lentísimo y se desvanecen antes de reiniciar el
// loop — mismo motivo del vapor que ya usamos en la foto de "Quiénes somos".
// mix-blend-screen para que se sienta como vapor con luz, no como una mancha
// de color plana. z-index negativo, sibling del video del hero (no ancestro),
// así no repite el bug de compositing de Chrome con z negativo + <video>.
type Wisp = {
  left: string;
  width: number;
  height: number;
  rotate: number;
  duration: number;
  delay: number;
  driftX: number;
};

const WISPS: Wisp[] = [
  { left: "6%", width: 110, height: 560, rotate: -10, duration: 34, delay: 0, driftX: 35 },
  { left: "24%", width: 80, height: 460, rotate: 9, duration: 41, delay: 5, driftX: -25 },
  { left: "48%", width: 130, height: 600, rotate: -5, duration: 37, delay: 11, driftX: 28 },
  { left: "70%", width: 90, height: 480, rotate: 13, duration: 45, delay: 3, driftX: -32 },
  { left: "88%", width: 105, height: 520, rotate: -16, duration: 39, delay: 8, driftX: 20 },
];

export function AmbientSmoke() {
  const reduce = useReducedMotion();
  // Monta recién después del primer paint: el hero (video + texto) tiene que
  // pintar e hidratar sin competir con estas animaciones por el hilo principal.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  if (reduce || !mounted) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      {WISPS.map((w, i) => (
        <motion.div
          key={i}
          className="absolute bottom-0 mix-blend-screen"
          style={{
            left: w.left,
            width: w.width,
            height: w.height,
            rotate: w.rotate,
            borderRadius: "50%",
            background:
              "radial-gradient(closest-side, rgba(242,237,228,0.13), rgba(242,237,228,0.04) 55%, transparent 80%)",
            filter: "blur(34px)",
          }}
          animate={{
            y: ["8%", "-75%"],
            x: [0, w.driftX],
            opacity: [0, 0.85, 0],
          }}
          transition={{
            duration: w.duration,
            delay: w.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}
