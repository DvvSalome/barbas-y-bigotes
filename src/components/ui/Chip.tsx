import Link from "next/link";
import type { ReactNode } from "react";

// Chips del panel (tanda 1, 9-sep): dos trabajos distintos, dos piezas.
//
// ChipEstado: dice en qué está algo (una cita, una caja). 28 px, mayúsculas,
// punto de color. El color es semántico, no de marca: verde bien, ámbar en
// espera, rojo suave "en la silla", gris terminado, tachado no vino.
//
// ChipFiltro: elige qué se ve (Todos / Semana / Cortes 7). 44 px tocables y el
// activo INVIERTE (tinta sobre fondo): el rojo se reserva para la acción primaria.

export type TonoEstado = "ok" | "espera" | "activo" | "neutro" | "fuera";

const TONO: Record<TonoEstado, string> = {
  ok: "border-ok/35 bg-ok/10 text-ok",
  espera: "border-warn/35 bg-warn/10 text-warn",
  activo: "border-accent-soft/40 bg-accent-soft/10 text-accent-soft",
  neutro: "border-line bg-transparent text-muted",
  fuera: "border-line bg-ink/5 text-ink line-through decoration-ink/60",
};

export function ChipEstado({ tono = "neutro", children, className = "" }: { tono?: TonoEstado; children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex min-h-7 items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-[12px] font-bold uppercase tracking-[0.06em] ${TONO[tono]} ${className}`}
    >
      {tono !== "fuera" && <i aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function chipFiltroClases(activo: boolean, extra = ""): string {
  return `inline-flex min-h-11 shrink-0 items-center justify-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold transition ${
    activo ? "border-ink bg-ink text-bg" : "border-line bg-transparent text-muted hover:border-ink/40 hover:text-ink"
  } ${extra}`.trim();
}

type FiltroBase = { activo: boolean; children: ReactNode; className?: string; "aria-label"?: string };

export function ChipFiltro(props: FiltroBase & ({ href: string; onClick?: undefined } | { href?: undefined; onClick: () => void; disabled?: boolean })) {
  const { activo, children, className = "" } = props;
  const clases = chipFiltroClases(activo, className);
  if (props.href !== undefined) {
    return (
      <Link href={props.href} aria-current={activo ? "page" : undefined} aria-label={props["aria-label"]} className={clases}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" aria-pressed={activo} aria-label={props["aria-label"]} onClick={props.onClick} disabled={props.disabled} className={clases}>
      {children}
    </button>
  );
}
