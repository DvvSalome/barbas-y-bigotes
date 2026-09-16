import Link from "next/link";
import type { ReactNode } from "react";
import { ChevronRightIcon } from "@/components/icons";
import { IconTile, type Tinte } from "@/components/ui/IconTile";

/*
  La lista de los hubs: un rótulo gris arriba y debajo una tarjeta con filas
  separadas por una línea fina. Es el patrón que hace legible una pantalla de
  Ajustes con veinte entradas, y el que reemplaza a las pestañas con scroll
  horizontal donde nunca se veían todas.

  Cada fila mide 72 px, lleva su cuadrito de color, título, una línea de
  subtítulo que dice QUÉ hay adentro (no repite el título) y el chevron que
  promete que se entra a algún lado. La variante destacada es para la fila que
  uno abre el 80 % de las veces.
*/

export function Grupo({ eyebrow, children, className = "" }: { eyebrow?: string; children: ReactNode; className?: string }) {
  return (
    <section className={className}>
      {eyebrow && <p className="eyebrow mb-2">{eyebrow}</p>}
      <div className="overflow-hidden rounded-2xl border border-line bg-panel divide-y divide-line/60">{children}</div>
    </section>
  );
}

export function Fila({
  href,
  onClick,
  icono,
  tinte = "neutro",
  titulo,
  subtitulo,
  badge,
  pill,
  destacada = false,
}: {
  href?: string;
  onClick?: () => void;
  icono: ReactNode;
  tinte?: Tinte;
  titulo: string;
  subtitulo?: string;
  /** Número en ámbar: algo pide atención (PIN bloqueado, stock bajo). */
  badge?: number;
  /** Etiqueta corta de texto ("Nuevo"). */
  pill?: string;
  destacada?: boolean;
}) {
  const dentro = (
    <>
      {destacada && <span aria-hidden className="bb-poste absolute inset-y-0 left-0 w-1" />}
      <IconTile tinte={tinte}>{icono}</IconTile>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{titulo}</span>
        {subtitulo && <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitulo}</span>}
      </span>
      {pill && (
        <span className="shrink-0 rounded-full bg-accent/12 px-2 py-1 text-[11px] font-bold uppercase tracking-[0.06em] text-accent-soft">
          {pill}
        </span>
      )}
      {badge !== undefined && badge > 0 && (
        <span className="grid h-[22px] min-w-[22px] shrink-0 place-items-center rounded-full bg-warn px-1.5 text-[12px] font-bold text-bg">
          {badge > 99 ? "99+" : badge}
        </span>
      )}
      <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
    </>
  );

  const clases = `relative flex min-h-[72px] w-full items-center gap-3 px-4 text-left transition hover:bg-elevated/60 ${
    destacada ? "bb-relieve pl-5" : ""
  }`;

  if (href) {
    return (
      <Link href={href} className={clases}>
        {dentro}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clases}>
      {dentro}
    </button>
  );
}
