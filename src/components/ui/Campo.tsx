"use client";

import type { ComponentProps, ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/*
  EL campo del staff (tanda 2). La etiqueta va FIJA sobre el borde, no como
  placeholder: el placeholder desaparece justo cuando el campo se llena, que es
  cuando uno quiere releer qué estaba escribiendo. La auditoría contó 6 estilos
  de input en el panel y varios con la etiqueta SOLO en el placeholder y en
  mayúsculas (CuponesAdmin, CuadreForms).

  Alto 56 px, radio 16, foco en TINTA y no en rojo (el rojo es acción, no
  atención), obligatorio y error en ámbar. 56 y no los 72 de WeiBook: a 360 px
  con el teclado abierto, con 72 entran tres campos y el pie se va de pantalla.
*/

type Base = {
  etiqueta: string;
  obligatorio?: boolean;
  error?: string;
  /** Texto de apoyo bajo el campo cuando no hay error. */
  ayuda?: ReactNode;
  className?: string;
};

const CAJA =
  "peer w-full rounded-2xl border bg-transparent px-4 pb-2 pt-5 text-[15px] text-ink outline-none transition placeholder:text-transparent";

function marco(error?: string) {
  return error ? "border-warn focus:border-warn" : "border-line focus:border-ink/60";
}

function Envoltorio({
  etiqueta,
  obligatorio,
  error,
  ayuda,
  id,
  children,
  className = "",
}: Base & { id: string; children: ReactNode }) {
  return (
    <div className={`relative ${className}`}>
      {children}
      {/* La etiqueta se apoya SOBRE el borde: el fondo la recorta para que la
          línea no la cruce. Va con pointer-events-none para no robar el toque. */}
      <label
        htmlFor={id}
        className="pointer-events-none absolute left-3 top-2 px-1 text-[12px] font-medium leading-none text-muted"
      >
        {etiqueta}
        {obligatorio && <span className="text-warn"> *</span>}
      </label>
      {(error || ayuda) && (
        <p className={`mt-1.5 px-1 text-[12px] ${error ? "text-warn" : "text-muted"}`}>{error || ayuda}</p>
      )}
    </div>
  );
}

export function Campo({
  etiqueta,
  obligatorio,
  error,
  ayuda,
  className,
  id,
  ...rest
}: Base & Omit<ComponentProps<"input">, "className"> & { id: string }) {
  return (
    <Envoltorio etiqueta={etiqueta} obligatorio={obligatorio} error={error} ayuda={ayuda} id={id} className={className}>
      <input id={id} placeholder={etiqueta} className={`${CAJA} ${marco(error)} min-h-14`} {...rest} />
    </Envoltorio>
  );
}

export function CampoArea({
  etiqueta,
  obligatorio,
  error,
  ayuda,
  className,
  id,
  ...rest
}: Base & Omit<ComponentProps<"textarea">, "className"> & { id: string }) {
  return (
    <Envoltorio etiqueta={etiqueta} obligatorio={obligatorio} error={error} ayuda={ayuda} id={id} className={className}>
      <textarea id={id} placeholder={etiqueta} rows={3} className={`${CAJA} ${marco(error)} min-h-24 resize-y`} {...rest} />
    </Envoltorio>
  );
}

export function CampoSelect({
  etiqueta,
  obligatorio,
  error,
  ayuda,
  className,
  id,
  children,
  ...rest
}: Base & Omit<ComponentProps<"select">, "className"> & { id: string }) {
  return (
    <Envoltorio etiqueta={etiqueta} obligatorio={obligatorio} error={error} ayuda={ayuda} id={id} className={className}>
      <select id={id} className={`${CAJA} ${marco(error)} min-h-14 appearance-none pr-11`} {...rest}>
        {children}
      </select>
      <ChevronDownIcon className="pointer-events-none absolute right-4 top-[26px] h-4 w-4 text-muted" />
    </Envoltorio>
  );
}
