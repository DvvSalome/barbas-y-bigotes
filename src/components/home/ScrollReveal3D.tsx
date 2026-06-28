"use client";

import { useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";

gsap.registerPlugin(ScrollTrigger);

// En mobile, mostrar/ocultar la barra de direcciones cambia innerHeight y
// dispara un recálculo de ScrollTrigger a mitad de scroll — eso es lo que
// hacía que el pin fallara "a veces" hasta recargar la página.
ScrollTrigger.config({ ignoreMobileResize: true });

const FRAME_COUNT = 90;
const PX_PER_FRAME = 18; // ~2vh/frame: snappy, no "qué horror"
const pad = (i: number) => String(i + 1).padStart(3, "0");

// Sección inmersiva estilo Apple: el scroll scrubea un canvas frame-by-frame
// (walkthrough real del local). Canvas + secuencia de imágenes (no <video>),
// pin + scrub con GSAP, preload escalonado, DPR scaling, reduced-motion safe.
export function ScrollReveal3D() {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useGSAP(
    () => {
      const canvas = canvasRef.current;
      const wrap = wrapRef.current;
      if (!canvas || !wrap) return;
      const ctx = canvas.getContext("2d", { alpha: false });
      if (!ctx) return;

      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const dir = window.innerWidth < 768 ? "mobile" : "desktop";
      const DPR = Math.min(window.devicePixelRatio || 1, 2);
      const images: HTMLImageElement[] = [];
      const state = { frame: 0 };

      const url = (i: number) => `/scroll/${dir}/f_${pad(i)}.webp`;

      function draw(idx: number) {
        const img = images[idx];
        if (!img || !img.naturalWidth || !canvas || !ctx) return;
        const cw = canvas.width, ch = canvas.height;
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const cr = cw / ch, ir = iw / ih;
        let sx, sy, sw, sh;
        if (cr > ir) { sw = iw; sh = iw / cr; sx = 0; sy = (ih - sh) / 2; }
        else { sh = ih; sw = ih * cr; sx = (iw - sw) / 2; sy = 0; }
        ctx.drawImage(img, sx, sy, sw, sh, 0, 0, cw, ch);
      }

      function resize() {
        if (!canvas) return;
        canvas.width = Math.round(canvas.clientWidth * DPR);
        canvas.height = Math.round(canvas.clientHeight * DPR);
        draw(Math.round(state.frame));
      }

      function loadFrame(i: number) {
        const img = new Image();
        img.onload = () => { if (i === 0) draw(0); };
        img.src = url(i);
        images[i] = img;
      }

      // Preload escalonado: 12 primeras al toque, resto en lotes de 6 (patrón OPTIKKA).
      const priority = Math.min(12, FRAME_COUNT);
      for (let i = 0; i < priority; i++) loadFrame(i);
      const queue = Array.from({ length: FRAME_COUNT - priority }, (_, i) => i + priority);
      const batch = () => {
        const b = queue.splice(0, 6);
        if (!b.length) return;
        b.forEach(loadFrame);
        setTimeout(batch, 30);
      };
      setTimeout(batch, 100);

      const resizeObserver = new ResizeObserver(() => {
        resize();
      });
      resizeObserver.observe(canvas);

      if (reduce) {
        // Sin scrub: mostramos un frame representativo cuando cargue.
        const mid = Math.floor(FRAME_COUNT / 2);
        loadFrame(mid);
        images[mid].onload = () => draw(mid);
        return () => resizeObserver.disconnect();
      }

      // Las secciones de arriba (hero, historia, etc.) pueden seguir
      // acomodando su layout (fuentes, imágenes) después de que este efecto
      // ya midió su start/end — si eso pasa, el pin queda desalineado y el
      // scroll "no activa" hasta refrescar. Forzamos un recálculo cuando todo
      // terminó de cargar, pero SOLO si el usuario todavía no llegó a esta
      // sección: refrescar mientras el pin ya está activo (o ya se pasó) hace
      // que GSAP recalcule a mitad de scroll y todo "salte" — esa es la
      // distorsión donde la sección de arriba y el tour parecen moverse juntos.
      const refreshIfNotReachedYet = () => {
        if (!wrap) return;
        const top = wrap.getBoundingClientRect().top;
        if (top > window.innerHeight) ScrollTrigger.refresh();
      };
      window.addEventListener("load", refreshIfNotReachedYet);
      const settleTimer = setTimeout(refreshIfNotReachedYet, 600);

      // direction.current se actualiza en cada tick de scroll; el draw lo lee
      // para decidir si anima normal (bajando) o se queda fijo (subiendo).
      const direction = { current: 1 as 1 | -1 };

      gsap.to(state, {
        frame: FRAME_COUNT - 1,
        ease: "none",
        snap: "frame",
        scrollTrigger: {
          trigger: wrap,
          start: "top top",
          end: "+=" + FRAME_COUNT * PX_PER_FRAME,
          scrub: 0.5,
          pin: true,
          anticipatePin: 1,
          invalidateOnRefresh: true,
          onUpdate: (self) => {
            direction.current = self.direction as 1 | -1;
          },
        },
        // Al subir no se repite el recorrido cuadro por cuadro — se deja fija
        // la imagen inicial para que el usuario sienta que vuelve directo,
        // en vez de ver el efecto reproducirse en reversa.
        onUpdate: () => draw(direction.current === -1 ? 0 : Math.round(state.frame)),
      });

      return () => {
        resizeObserver.disconnect();
        window.removeEventListener("load", refreshIfNotReachedYet);
        clearTimeout(settleTimer);
      };
    },
    { scope: wrapRef },
  );

  return (
    <section className="mx-auto max-w-6xl px-6 pt-12 sm:pt-20">
      <div
        ref={wrapRef}
        aria-label="Recorrido por la barbería"
        className="relative aspect-[9/16] w-full max-w-md mx-auto overflow-hidden rounded-2xl border border-line bg-bg shadow-2xl"
        style={{ backgroundImage: "url(/scroll/desktop/f_001.webp)", backgroundSize: "cover", backgroundPosition: "center" }}
      >
        <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full" />
        {/* viñeta + gradiente para legibilidad del texto */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(120%_120%_at_50%_40%,transparent_30%,rgba(4,3,3,0.55)_100%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(4,3,3,0.6)_0%,transparent_30%,transparent_60%,rgba(4,3,3,0.85)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-col items-center px-6 pt-[12%] text-center">
          <p className="mb-3 flex items-center gap-3 text-[10px] uppercase tracking-[0.45em] text-accent">
            <span className="h-px w-6 bg-accent/50" /> El espacio <span className="h-px w-6 bg-accent/50" />
          </p>
          <h2 className="font-display text-3xl font-semibold uppercase leading-[0.95] text-ink drop-shadow-[0_8px_40px_rgba(0,0,0,0.8)] sm:text-4xl">
            Entrá a la barbería
          </h2>
          <p className="mt-3 max-w-xs text-balance text-ink/80 text-xs sm:text-xs">
            Deslizá para recorrer el local. Donde cada corte es un ritual.
          </p>
        </div>
      </div>
    </section>
  );
}
