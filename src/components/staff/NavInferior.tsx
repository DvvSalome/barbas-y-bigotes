"use client";

import Link from "next/link";
import type { ReactNode } from "react";

/*
  La barra de abajo del staff (tanda 2). Reemplaza en el celular a las pestañas
  con scroll horizontal de la cabecera, donde NUNCA se veían todas: la medición
  del panel las muestra cortadas ("Hoy Agenda Métricas Caja Clientes Ca…") y el
  cromo del celular come entre 146 y 206 px antes de que empiece el contenido.

  Pill flotante, no barra pegada al borde: el fondo se ve por los costados y la
  pantalla no parece partida en dos. Cada destino mide 56 px de alto y lleva
  SIEMPRE su etiqueta —un ícono solo se adivina, y acá adivinar cuesta un toque
  de más en medio de un corte—. El activo se marca invirtiendo, como todo lo
  seleccionado del sistema.

  Solo en celular: en escritorio manda la topbar, que ahí sí entra entera.
*/

export type DestinoNav = {
  clave: string;
  etiqueta: string;
  icono: ReactNode;
  href?: string;
  onClick?: () => void;
  /** Ámbar con número: algo de ese destino pide atención. */
  badge?: number;
};

export function NavInferior({
  destinos,
  activo,
  fila = false,
  className = "",
}: {
  destinos: readonly DestinoNav[];
  /** `clave` del destino actual. `undefined` en una ruta que no está en el mapa: no marca ninguno y no revienta. */
  activo?: string;
  /**
   * Ícono y etiqueta EN LÍNEA, no apilados. Es para el mostrador, que corre en
   * una tablet de 768 px o más: ahí el ancho sobra y apilar desperdicia alto.
   * En el celular del panel se apilan, que es lo que entra.
   */
  fila?: boolean;
  className?: string;
}) {
  return (
    <nav
      aria-label="Secciones"
      className={`fixed inset-x-3 bottom-[max(env(safe-area-inset-bottom),10px)] z-30 flex items-center gap-1 rounded-full border border-line bg-bg/85 px-1.5 backdrop-blur-md ${
        fila ? "h-[58px]" : "h-16 lg:hidden"
      } ${className}`}
    >
      {destinos.map((d) => {
        const act = d.clave === activo;
        const dentro = (
          <>
            <span aria-hidden className={`relative ${fila ? "[&>svg]:h-[19px] [&>svg]:w-[19px]" : "[&>svg]:h-[22px] [&>svg]:w-[22px]"}`}>
              {d.icono}
              {/* Apilado el número va encima del ícono; en línea estorbaría ahí,
                  así que va después de la etiqueta como una pastilla aparte. */}
              {!fila && d.badge !== undefined && d.badge > 0 && (
                <span className="absolute -right-2 -top-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-warn px-1 text-[11px] font-bold leading-none text-bg">
                  {d.badge > 9 ? "9+" : d.badge}
                </span>
              )}
            </span>
            <span className={`font-semibold leading-none ${fila ? "text-[14px]" : "text-[12px]"}`}>{d.etiqueta}</span>
            {fila && d.badge !== undefined && d.badge > 0 && (
              <span className="grid h-5 min-w-5 place-items-center rounded-full bg-warn/20 px-1.5 text-[12px] font-extrabold tabular-nums leading-none text-warn">
                {d.badge}
              </span>
            )}
          </>
        );
        const clases = `flex flex-1 items-center justify-center rounded-full transition ${
          fila ? "min-h-[46px] gap-2" : "min-h-14 flex-col gap-1"
        } ${act ? "bg-elevated text-ink" : "text-muted"}`;
        if (d.href) {
          return (
            <Link key={d.clave} href={d.href} aria-current={act ? "page" : undefined} className={clases}>
              {dentro}
            </Link>
          );
        }
        return (
          <button key={d.clave} type="button" onClick={d.onClick} aria-current={act ? "page" : undefined} className={clases}>
            {dentro}
          </button>
        );
      })}
    </nav>
  );
}
