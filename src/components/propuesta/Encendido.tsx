"use client";

import { useEffect, useRef } from "react";
import { Panal } from "@/components/propuesta/Panal";
import css from "./propuesta.module.css";

const PIXEL = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

/**
 * La foto del techo que pasa de penumbra a luz. El destello arranca cuando la
 * foto YA está pintada (si arrancara antes, se encendería un cuadro negro). No
 * guarda estado de React: marca el contenedor y el resto lo hace el CSS.
 *
 * Dirección de arte con <picture>: en el celular, el techo de Plaza de la Paz en
 * una banda; en escritorio, el de Parque Venezuela a sangre. Cada aparato baja
 * SOLO su foto (con dos <Image> escondidos por CSS bajaban las dos).
 */
export function FotoEncendida({
  className = "",
  srcSetEscritorio = PIXEL,
  img,
}: {
  className?: string;
  /** Sin esto, en escritorio no se baja nada (un pixel transparente). */
  srcSetEscritorio?: string;
  img: React.ImgHTMLAttributes<HTMLImageElement>;
}) {
  const caja = useRef<HTMLDivElement>(null);
  const lista = () => caja.current?.setAttribute("data-lista", "");
  useEffect(() => {
    // Desde la caché la foto puede estar completa antes de hidratar: el onLoad
    // ya no llega.
    if (caja.current?.querySelector("img")?.complete) lista();
  }, []);
  return (
    <div ref={caja} className={`${css.foto} ${className}`}>
      <picture>
        <source media="(min-width: 1024px)" srcSet={srcSetEscritorio} />
        {/* eslint-disable-next-line jsx-a11y/alt-text -- getImageProps arma el img y trae el alt */}
        <img {...img} onLoad={lista} className="absolute inset-0 h-full w-full object-cover" />
      </picture>
      <div className={css.velo} />
    </div>
  );
}

/** Prende el panal cuando entra en pantalla (el cierre de la página). */
export function PanalAlVer({ className = "" }: { className?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    const svg = el?.querySelector("svg");
    if (!el || !svg || !("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (es) => {
        if (es.some((e) => e.isIntersecting)) {
          svg.setAttribute("data-encendido", "");
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={caja} className={className}>
      <Panal apagable />
    </div>
  );
}

/**
 * El techo grande del hero en escritorio: se prende en ola con GSAP y un brillo
 * sigue al puntero. GSAP se descarga SOLO si hay pantalla ancha, puntero fino y
 * movimiento permitido; si no, el mismo encendido lo hace el CSS (y en celular
 * este bloque ni se muestra).
 */
export function PanalHero({ className = "" }: { className?: string }) {
  const caja = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = caja.current;
    const svg = el?.querySelector("svg");
    if (!el || !svg) return;
    const quiere = window.matchMedia("(min-width: 1024px) and (pointer: fine) and (prefers-reduced-motion: no-preference)");
    if (!quiere.matches) {
      svg.setAttribute("data-encendido", "");
      return;
    }
    let vivo = true;
    let limpiar = () => {};
    import("gsap").then(({ gsap }) => {
      if (!vivo) return;
      svg.setAttribute("data-gsap", "");
      const tubos = svg.querySelectorAll<SVGGElement>("[data-tubo]");
      const parpadean = svg.querySelectorAll<SVGGElement>("[data-parpadea]");
      const tl = gsap.timeline({ delay: 0.35 });
      tl.fromTo(tubos, { opacity: 0.1 }, { opacity: 1, duration: 0.45, ease: "power2.out", stagger: 0.03 });
      // Uno de cada tres tubos titila al prender, como los de verdad.
      tl.to(parpadean, { keyframes: [{ opacity: 0.2 }, { opacity: 1 }, { opacity: 0.5 }, { opacity: 1 }], duration: 0.5, stagger: 0.04 }, 0.4);

      // El brillo y un leve giro siguen al puntero: el techo "mira" hacia uno.
      const ry = gsap.quickTo(svg, "rotationY", { duration: 0.8, ease: "power3.out" });
      const rx = gsap.quickTo(svg, "rotationX", { duration: 0.8, ease: "power3.out" });
      gsap.set(svg, { transformPerspective: 900 });
      gsap.set(el, { "--gx": "55%", "--gy": "45%" });
      const mover = (e: PointerEvent) => {
        const r = el.getBoundingClientRect();
        const px = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
        const py = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
        gsap.to(el, { "--gx": `${Math.round(px * 100)}%`, "--gy": `${Math.round(py * 100)}%`, duration: 0.6, ease: "power3.out", overwrite: true });
        ry((px - 0.5) * 8);
        rx((0.5 - py) * 6);
      };
      window.addEventListener("pointermove", mover, { passive: true });
      limpiar = () => {
        window.removeEventListener("pointermove", mover);
        tl.kill();
      };
    });
    return () => {
      vivo = false;
      limpiar();
    };
  }, []);
  return (
    <div ref={caja} className={`relative ${className}`}>
      <div className={css.resplandor} />
      <Panal apagable className="relative" />
    </div>
  );
}
