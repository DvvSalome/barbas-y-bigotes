import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

// EL botón del panel (tanda 1 de la propuesta de diseño, 9-sep). La auditoría
// contó 32 estilos de botón distintos en el admin; acá quedan tres variantes y
// dos tamaños, y cada pantalla las combina en vez de inventar el suyo.
//
//   primario   degradado rojo — UNO por pantalla: la acción que se quiere que pase
//   secundario contorno — todo lo demás que hace algo
//   terciario  solo texto — cerrar, ver más, deshacer
//   peligro    contorno ámbar — cancelar, borrar (el rojo ya no es alerta)
//
// md = 44 px (tocable con el dedo), sm = 36 px (dentro de tarjetas densas).
export type BotonVariante = "primario" | "secundario" | "terciario" | "peligro";
export type BotonTam = "md" | "sm";

const BASE =
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-full transition disabled:cursor-not-allowed disabled:opacity-40";
const TAM: Record<BotonTam, string> = {
  md: "min-h-11 px-4 text-[12.5px]",
  sm: "min-h-9 px-3.5 text-[12px]",
};
const VARIANTE: Record<BotonVariante, string> = {
  primario:
    "bg-linear-to-b from-accent-soft to-accent font-bold uppercase tracking-[0.06em] text-on-accent shadow-[0_10px_24px_-8px_rgba(210,63,52,0.55)] hover:brightness-105",
  secundario: "border border-line bg-transparent font-bold uppercase tracking-[0.06em] text-ink hover:border-ink/40",
  terciario: "bg-transparent px-2 font-semibold text-muted hover:text-ink",
  peligro: "border border-warn/45 bg-transparent font-bold uppercase tracking-[0.06em] text-warn hover:bg-warn/10",
};

/** Las clases solas, para elementos que no pueden ser <Boton> (labels, inputs file, Link de Next con props raras). */
export function botonClases(variante: BotonVariante = "secundario", tam: BotonTam = "md", extra = ""): string {
  return `${BASE} ${TAM[tam]} ${VARIANTE[variante]} ${extra}`.trim();
}

type Comunes = { variante?: BotonVariante; tam?: BotonTam; className?: string; children: ReactNode };
type ComoBoton = Comunes & Omit<ComponentProps<"button">, "className" | "children"> & { href?: undefined };
type ComoEnlace = Comunes & Omit<ComponentProps<typeof Link>, "className" | "children"> & { href: string };

export function Boton(props: ComoBoton | ComoEnlace) {
  const { variante = "secundario", tam = "md", className = "", children, ...rest } = props;
  const clases = botonClases(variante, tam, className);
  if ("href" in rest && rest.href !== undefined) {
    const { href, ...enlace } = rest as Omit<ComoEnlace, keyof Comunes>;
    return (
      <Link href={href} className={clases} {...enlace}>
        {children}
      </Link>
    );
  }
  const { type = "button", ...boton } = rest as Omit<ComoBoton, keyof Comunes>;
  return (
    <button type={type} className={clases} {...boton}>
      {children}
    </button>
  );
}
