"use client";

import { useEffect, type ReactNode } from "react";
import { botonClases } from "@/components/ui/Boton";

/*
  LA hoja del staff (tanda 2). Sube desde el borde de abajo, deja el fondo
  atenuado y visible —el barbero no pierde de vista la agenda— y cuando trae
  formulario pone el pie PEGADO abajo: con el teclado abierto en un celular, un
  botón "Guardar" al final del scroll queda fuera de alcance.

  Sale de HojaInferior (barbero/AgendaList.tsx), que ya era esto pero sin pie y
  estaba copiada a mano cinco veces más dentro de AgendaDia.tsx. Aquella sigue
  existiendo como re-exportación para no romper lo que la importa.

  La regla del pie es la de WeiBook y la del sistema: salir a la izquierda como
  texto, la acción real a la derecha, y el primario apagado hasta que el
  formulario sea válido — que el botón no mienta diciendo que ya se puede.
*/
export function Hoja({
  titulo,
  onCerrar,
  children,
  pie,
  ancho = "max-w-2xl",
}: {
  titulo: string;
  onCerrar: () => void;
  children: ReactNode;
  /** Pie pegado abajo. Se arma con <PieHoja>; si no viene, la hoja es solo lectura. */
  pie?: ReactNode;
  ancho?: string;
}) {
  // Escape cierra. El toque afuera ya lo cubre el botón de fondo.
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onCerrar();
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onCerrar]);

  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal="true" aria-label={titulo}>
      <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/60" />
      <div className="relative flex max-h-[92dvh] flex-col rounded-t-[24px] border-t border-line bg-bg">
        <div className={`mx-auto flex w-full ${ancho} flex-col overflow-hidden`}>
          {/* Agarradera: dice "esto se arrastra" sin escribirlo. */}
          <div aria-hidden className="mx-auto mb-3 mt-3 h-1 w-10 shrink-0 rounded-full bg-line" />
          <div className="flex shrink-0 items-center justify-between gap-3 px-4 pb-3 sm:px-6">
            <h2 className="font-display text-[22px] font-bold uppercase leading-none">{titulo}</h2>
            <button
              onClick={onCerrar}
              className="inline-flex min-h-11 shrink-0 items-center rounded-full border border-line px-4 text-[13px] font-semibold text-muted transition hover:text-ink"
            >
              Cerrar
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-4 sm:px-6">{children}</div>
          {pie ? (
            <div className="shrink-0 border-t border-line bg-bg/95 px-4 pt-3 backdrop-blur sm:px-6 [padding-bottom:max(env(safe-area-inset-bottom),12px)]">
              {pie}
            </div>
          ) : (
            <div aria-hidden className="[height:max(env(safe-area-inset-bottom),16px)]" />
          )}
        </div>
      </div>
    </div>
  );
}

/** Pie estándar: salir a la izquierda, la acción a la derecha y apagada hasta que valga. */
export function PieHoja({
  onCancelar,
  textoCancelar = "Cancelar",
  children,
}: {
  onCancelar: () => void;
  textoCancelar?: string;
  /** El botón primario. Va con disabled mientras el formulario no sea válido. */
  children: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onCancelar}
        className="min-h-11 shrink-0 px-2 text-[13px] font-semibold text-muted underline decoration-line underline-offset-4 transition hover:text-ink"
      >
        {textoCancelar}
      </button>
      {children}
    </div>
  );
}

/** Clases del primario del pie, para no repetir el mismo `botonClases` en cada hoja. */
export const primarioDeHoja = botonClases("primario", "md", "min-w-[46%]");
