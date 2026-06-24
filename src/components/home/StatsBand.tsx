"use client";

import { animate, useInView, useReducedMotion } from "motion/react";
import { useEffect, useRef, useState } from "react";

const EASE = [0.22, 1, 0.36, 1] as const;

const stats: [number, string][] = [
  [2, "Sedes en Barranquilla"],
  [6, "Barberos expertos"],
  [26, "Servicios y combos"],
];

function CountUp({ to }: { to: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-60px" });
  const reduce = useReducedMotion();
  const [val, setVal] = useState(reduce ? to : 0);

  useEffect(() => {
    if (reduce || !inView) return;
    const controls = animate(0, to, {
      duration: 1.2,
      ease: EASE,
      onUpdate: (v) => setVal(Math.round(v)),
    });
    return () => controls.stop();
  }, [inView, to, reduce]);

  return <span ref={ref}>{val}</span>;
}

export function StatsBand() {
  return (
    <section className="border-y border-line bg-panel/40">
      <div className="mx-auto grid max-w-5xl grid-cols-3 divide-x divide-line px-6">
        {stats.map(([n, l]) => (
          <div key={l} className="px-3 py-8 text-center">
            <div className="font-display text-5xl font-semibold text-accent-soft tabular-nums">
              <CountUp to={n} />
            </div>
            <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted">{l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}
