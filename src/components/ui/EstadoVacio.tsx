import type { ReactNode } from "react";
import { IconTile, type Tinte } from "@/components/ui/IconTile";

/*
  Qué se ve cuando todavía no hay nada. Hoy el panel resuelve esto con una línea
  de texto gris suelta, que se lee igual que un error: no queda claro si la
  pantalla está vacía o si se rompió.

  Tres partes y ninguna de adorno: el cuadrito dice de qué hablamos, el título
  dice que está vacío A PROPÓSITO, y el texto dice qué hacer. La acción es
  opcional porque hay vacíos que no se arreglan tocando un botón ("todavía no
  hay citas hoy").
*/
export function EstadoVacio({
  icono,
  tinte = "neutro",
  titulo,
  texto,
  accion,
  className = "",
}: {
  icono: ReactNode;
  tinte?: Tinte;
  titulo: string;
  texto?: string;
  accion?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col items-center px-6 py-10 text-center ${className}`}>
      <IconTile tinte={tinte} tam="lg">
        {icono}
      </IconTile>
      <p className="mt-4 text-[15px] font-semibold text-ink">{titulo}</p>
      {texto && <p className="mt-1.5 max-w-[28ch] text-[13px] leading-relaxed text-muted">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  );
}
