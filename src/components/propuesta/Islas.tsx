"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import css from "./propuesta.module.css";

/*
  Las dos únicas islas de JavaScript de la propuesta. Todo lo demás es HTML del
  servidor y CSS.
*/

/**
 * La pared del hero en escritorio sigue apenas al puntero (se inclina hacia
 * donde miras). GSAP se descarga SOLO con pantalla ancha, puntero fino y
 * movimiento permitido; en celular este componente es un <div> y nada más. El
 * movimiento de las columnas y el encendido de las fotos son CSS puro.
 */
export function Inclinable({ className = "", children }: { className?: string; children: React.ReactNode }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    if (!el) return;
    const quiere = window.matchMedia("(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!quiere.matches) return;
    let vivo = true;
    let limpiar = () => {};
    import("gsap").then(({ gsap }) => {
      if (!vivo) return;
      const mover = (e: PointerEvent) => {
        const px = e.clientX / window.innerWidth - 0.5;
        const py = e.clientY / window.innerHeight - 0.5;
        gsap.to(el, { "--rx": `${(-py * 5).toFixed(2)}deg`, "--ry": `${(px * 7).toFixed(2)}deg`, duration: 1.1, ease: "power3.out", overwrite: true });
      };
      window.addEventListener("pointermove", mover, { passive: true });
      limpiar = () => window.removeEventListener("pointermove", mover);
    });
    return () => {
      vivo = false;
      limpiar();
    };
  }, []);
  return (
    <div ref={caja} className={className}>
      {children}
    </div>
  );
}

/**
 * La barra fija de reserva del celular. Aparece solo cuando ningún CTA de la
 * página ([data-cta]) está a la vista: así nunca tapa el botón del hero ni el
 * del cierre, y aparece justo cuando el lector ya bajó y le puede servir.
 */
export function BarraReserva({ whatsapp }: { whatsapp: string }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const ctas = Array.from(document.querySelectorAll<HTMLElement>("[data-cta]"));
    if (!ctas.length || !("IntersectionObserver" in window)) return;
    const aLaVista = new Set<Element>();
    const io = new IntersectionObserver(
      (es) => {
        for (const e of es) {
          if (e.isIntersecting) aLaVista.add(e.target);
          else aLaVista.delete(e.target);
        }
        setVisible(aLaVista.size === 0);
      },
      { threshold: 0.2 },
    );
    ctas.forEach((c) => io.observe(c));
    return () => io.disconnect();
  }, []);
  return (
    <div
      className={`${css.barra} fixed inset-x-0 bottom-0 z-30 flex items-center gap-2.5 bg-[linear-gradient(180deg,rgba(12,11,10,0),rgba(12,11,10,0.94)_30%)] px-4 pb-[max(14px,env(safe-area-inset-bottom))] pt-5 md:hidden`}
      data-visible={visible ? "" : undefined}
      aria-hidden={!visible}
    >
      <a
        href={whatsapp}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Escribir por WhatsApp"
        tabIndex={visible ? 0 : -1}
        className="grid h-[52px] w-[52px] shrink-0 place-items-center rounded-full border border-line bg-bg text-[#25d366]"
      >
        <svg viewBox="0 0 24 24" className="h-6 w-6" aria-hidden fill="currentColor">
          <path d="M17.47 14.38c-.3-.15-1.76-.87-2.03-.97-.27-.1-.47-.15-.67.15-.2.3-.77.97-.94 1.17-.17.2-.35.22-.64.07-.3-.15-1.25-.46-2.39-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.61.13-.13.3-.35.45-.52.15-.17.2-.3.3-.5.1-.2.05-.37-.02-.52-.08-.15-.67-1.62-.92-2.22-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.79.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.21 3.08c.15.2 2.1 3.2 5.08 4.49.71.31 1.26.49 1.69.63.71.23 1.36.2 1.87.12.57-.09 1.76-.72 2-1.41.25-.7.25-1.29.17-1.41-.07-.13-.27-.2-.57-.35zM12.04 21.5h-.01a9.43 9.43 0 0 1-4.8-1.32l-.35-.2-3.57.93.95-3.48-.22-.36a9.43 9.43 0 0 1-1.45-5.03c0-5.21 4.24-9.45 9.46-9.45 2.52 0 4.9.99 6.68 2.77a9.4 9.4 0 0 1 2.77 6.69c0 5.21-4.24 9.45-9.46 9.45zm8.05-17.5A11.33 11.33 0 0 0 12.04.66C5.77.66.66 5.77.66 12.04c0 2 .52 3.96 1.52 5.69L.57 23.6l6.01-1.58a11.37 11.37 0 0 0 5.45 1.39h.01c6.27 0 11.38-5.11 11.38-11.38 0-3.04-1.18-5.9-3.33-8.03z" />
        </svg>
      </a>
      <Link
        href="/reservar?desde=barra"
        tabIndex={visible ? 0 : -1}
        className="flex min-h-[52px] flex-1 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] font-display text-[17px] font-bold uppercase tracking-[0.06em] text-on-accent shadow-[0_12px_26px_-10px_rgba(173,47,36,0.8)]"
      >
        Reservar mi cita
      </Link>
    </div>
  );
}
