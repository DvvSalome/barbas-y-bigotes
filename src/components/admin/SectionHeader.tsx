import type { ReactNode } from "react";
import { AyudaSeccion } from "@/components/admin/AyudaSeccion";

// Encabezado de sección del panel (v2, tanda 1 · 9-sep): eyebrow gris de 12 px
// (el rojo de 4,21:1 fallaba el contraste AA en todas las secciones), título
// display y la explicación detrás de un "?" que arranca abierto la primera vez.
// `clave` identifica la sección para recordar que ya se leyó; si no viene, sale
// del título.
export function SectionHeader({
  eyebrow,
  title,
  description,
  action,
  subtitulo,
  clave,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  /** Dato corto SIEMPRE visible (la fecha, la sede): no es explicación, no va detrás del "?". */
  subtitulo?: ReactNode;
  clave?: string;
}) {
  const titulo = (
    <h1 className="font-display text-[28px] font-extrabold uppercase leading-none tracking-tight text-ink sm:text-[32px]">{title}</h1>
  );
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        {description ? (
          <AyudaSeccion clave={clave ?? title.toLowerCase().replace(/[^a-z0-9]+/g, "-")} titulo={titulo}>
            {description}
          </AyudaSeccion>
        ) : (
          <div className="mt-1">{titulo}</div>
        )}
        {subtitulo && <p className="mt-1.5 text-[13px] text-muted">{subtitulo}</p>}
      </div>
      {action}
    </div>
  );
}
