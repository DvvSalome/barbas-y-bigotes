"use client";

import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

/*
  Lo único interactivo de una gráfica de /admin/metricas: qué tramo está elegido.

  Las marcas (columnas, líneas, ejes) llegan como `children` ya pintadas por el
  servidor, y los textos de lectura llegan armados con cop(): acá no se calcula
  ni se formatea nada. Encima va una capa transparente que elige el tramo por
  dónde cae el dedo (el tramo entero, no la barra: una de $ 20.000 mide 3 px) y
  una guía que marca cuál es. Arriba, una fila fija dice el valor: en el celular
  no existe el "pasar por encima", y un globo bajo el dedo queda tapado.

  Sin JavaScript se ve todo igual, con la lectura del tramo inicial.
*/
export function LecturaGrafica({
  lecturas,
  inicial,
  etiqueta,
  guia = "banda",
  alVer = false,
  children,
}: {
  /** Una por tramo, en orden. `fuerte` es el valor; `resto`, de qué tramo es. */
  lecturas: { fuerte: string; resto: string }[];
  /** El tramo que se lee mientras nadie toca (el pico, o el de hoy). */
  inicial: number;
  etiqueta: string;
  guia?: "banda" | "linea";
  /** La gráfica nace abajo del pliegue: su entrada espera a que se vea. */
  alVer?: boolean;
  children: ReactNode;
}) {
  const n = lecturas.length;
  // null = nadie ha tocado. No se guarda `inicial` en el estado: si llega un
  // cobro y el pico cambia, la lectura por defecto lo sigue sola.
  const [elegido, setElegido] = useState<number | null>(null);
  const caja = useRef<HTMLDivElement>(null);
  const i = Math.min(elegido ?? inicial, n - 1);
  const lectura = lecturas[i];

  // Lo que nace fuera de pantalla se guarda la entrada para cuando se vea (el
  // CSS la retiene con [data-espera]). Es un atributo del DOM, no estado: un
  // refresco por un cobro nuevo no lo vuelve a poner.
  useEffect(() => {
    const el = caja.current;
    if (!alVer || !el || el.getBoundingClientRect().top < window.innerHeight) return;
    el.dataset.espera = "";
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return;
        delete el.dataset.espera;
        io.disconnect();
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [alVer]);

  const tocar = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    setElegido(Math.min(n - 1, Math.max(0, Math.floor(((e.clientX - r.left) / r.width) * n))));
  };
  const tecla = (e: KeyboardEvent<HTMLDivElement>) => {
    const a = { ArrowLeft: i - 1, ArrowRight: i + 1, Home: 0, End: n - 1 }[e.key];
    if (a === undefined) return;
    e.preventDefault();
    setElegido(Math.min(n - 1, Math.max(0, a)));
  };

  if (!lectura) return <>{children}</>;
  return (
    <div ref={caja} className="bb-graf">
      {/* Alto fijo para dos renglones en el celular: si la lectura larga mide más
          que la corta, la gráfica salta bajo el dedo al cambiar de tramo. */}
      <p className="flex min-h-[60px] flex-wrap content-start items-baseline gap-x-2 gap-y-0.5 text-[13px] leading-snug text-muted sm:min-h-11">
        <b className="bb-monto font-display text-[22px] font-bold leading-none text-ink">{lectura.fuerte}</b>
        <span>{lectura.resto}</span>
      </p>
      {/* flow-root: el margen de arriba del plot queda ADENTRO de esta caja. Sin
          eso colapsa hacia afuera y la capa de toque caía 22 px más abajo que la gráfica. */}
      <div className="relative flow-root">
        {children}
        <div
          role="slider"
          tabIndex={0}
          aria-label={etiqueta}
          aria-orientation="horizontal"
          aria-valuemin={1}
          aria-valuemax={n}
          aria-valuenow={i + 1}
          aria-valuetext={`${lectura.fuerte}, ${lectura.resto}`}
          className="bb-toque"
          onPointerDown={tocar}
          // Con el mouse basta pasar por encima; con el dedo, arrastrar.
          onPointerMove={(e) => (e.pointerType === "mouse" || e.buttons > 0) && tocar(e)}
          onPointerLeave={(e) => e.pointerType === "mouse" && setElegido(null)}
          // El navegador se quedó con el gesto para bajar la página: lo que se
          // rozó al arrancar no debe quedar elegido.
          onPointerCancel={() => setElegido(null)}
          onBlur={() => setElegido(null)}
          onKeyDown={tecla}
        >
          <span
            aria-hidden
            className={guia === "linea" ? "bb-guia bb-guia-linea" : "bb-guia"}
            data-activa={elegido !== null || undefined}
            style={{ width: `${100 / n}%`, transform: `translateX(${i * 100}%)` }}
          />
        </div>
      </div>
    </div>
  );
}
