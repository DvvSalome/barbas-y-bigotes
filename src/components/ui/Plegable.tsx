import type { ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/*
  "Configuración adicional ▾". Lo que la mayoría no toca casi nunca va acá y no
  ocupa pantalla: las de catálogo y equipo miden 2.842 y 5.051 px de alto en un
  celular, y buena parte es de campos que se llenan una vez.

  Es <details> nativo a propósito: abre y cierra sin JavaScript, el navegador ya
  le pone el rol correcto, y el buscador del navegador encuentra el texto de
  adentro aunque esté cerrado. La fila mide 56 px y el chevron gira al abrir.
*/
export function Plegable({
  titulo,
  subtitulo,
  children,
  abierto = false,
  className = "",
}: {
  titulo: string;
  subtitulo?: string;
  children: ReactNode;
  abierto?: boolean;
  className?: string;
}) {
  return (
    <details open={abierto} className={`group border-t border-line ${className}`}>
      <summary className="flex min-h-14 cursor-pointer list-none items-center justify-between gap-3 py-3 [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block text-[15px] font-semibold text-ink">{titulo}</span>
          {subtitulo && <span className="mt-0.5 block truncate text-[13px] text-muted">{subtitulo}</span>}
        </span>
        <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
      </summary>
      <div className="pb-4">{children}</div>
    </details>
  );
}
