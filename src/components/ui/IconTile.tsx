import type { ReactNode } from "react";

/*
  El cuadrito de 44 px con ícono que encabeza cada fila de los hubs. Es lo que
  hace que una lista larga se lea de un vistazo: el color dice de qué habla la
  fila antes de leerla.

  Cinco tintes y no más, todos de tokens que ya existen. NO son decoración
  suelta: cada uno significa algo.
    marca   lo del negocio de cara al cliente (servicios, marketing)
    equipo  personas (barberos, clientes)
    plata   dinero (caja, gastos, liquidación)
    local   el local en sí (horario, sede, inventario)
    neutro  lo demás (ayuda, ajustes, historial)

  aria-hidden porque el ícono nunca dice nada que el título no diga. El tostado
  del tinte "local" queda en 3,6:1, que cumple el 3:1 que piden los gráficos.
*/
export type Tinte = "marca" | "equipo" | "plata" | "local" | "neutro";

const TINTE: Record<Tinte, string> = {
  marca: "bg-accent/10 text-accent-soft",
  equipo: "bg-ok/10 text-ok",
  plata: "bg-warn/10 text-warn",
  local: "bg-bar/15 text-bar",
  neutro: "bg-elevated text-muted",
};

export function IconTile({
  children,
  tinte = "neutro",
  tam = "md",
  className = "",
}: {
  children: ReactNode;
  tinte?: Tinte;
  /** md = 44 px (filas). lg = 64 px (estados vacíos y cabeceras). */
  tam?: "md" | "lg";
  className?: string;
}) {
  const medida = tam === "lg" ? "h-16 w-16 rounded-2xl [&>svg]:h-7 [&>svg]:w-7" : "h-11 w-11 rounded-xl [&>svg]:h-5 [&>svg]:w-5";
  return (
    <span aria-hidden className={`grid shrink-0 place-items-center ${medida} ${TINTE[tinte]} ${className}`}>
      {children}
    </span>
  );
}
