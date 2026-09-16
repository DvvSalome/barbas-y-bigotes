"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { PlusIcon } from "@/components/icons";

/*
  El botón flotante de crear. UNA sola acción, nunca un menú: si la pantalla
  tiene tres cosas distintas para anotar, eso es una lista de filas grandes
  (Cierre, Caja), no un botón que despliega opciones y agrega un toque.

  Va SOLO donde hay un alta real: Agenda y calendario del mostrador (+ CITA),
  Clientes (+ CLIENTE), Turnos (+ CLIENTE), Espera (+ EN ESPERA), Inventario
  (+ PRODUCTO), Catálogo, Cupones. En Inicio, Ajustes, Métricas, Liquidación,
  Horarios, Cierre y Equipo NO va: donde no se crea nada sería un control muerto.

  EL OFFSET ES ÚNICO Y NO SE TOCA: la barra inferior mide 64 px y flota sobre el
  área segura, así que el botón se sienta 84 px arriba del borde. Un offset
  distinto por pantalla es exactamente cómo se termina con un botón encima de la
  barra, y el arnés lo mide (`solapados`).
*/
export const FAB_OFFSET = "bottom-[calc(env(safe-area-inset-bottom)+84px)]";

export function Fab({
  etiqueta,
  onClick,
  href,
  icono,
  oculto = false,
}: {
  /** Qué crea, en imperativo corto: "Cita", "Cliente". Se lee y se anuncia. */
  etiqueta: string;
  onClick?: () => void;
  href?: string;
  icono?: ReactNode;
  /** Se esconde con una hoja abierta o durante un arrastre: ahí estorba. */
  oculto?: boolean;
}) {
  if (oculto) return null;
  const clases = `fixed right-4 ${FAB_OFFSET} z-30 inline-flex h-14 min-w-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-4 text-[13px] font-bold uppercase tracking-[0.06em] text-on-accent shadow-[0_14px_30px_-10px_rgba(173,47,36,0.7)] transition hover:brightness-110 lg:hidden`;
  const dentro = (
    <>
      {icono ?? <PlusIcon className="h-5 w-5" />}
      <span>{etiqueta}</span>
    </>
  );
  if (href) {
    return (
      <Link href={href} className={clases} aria-label={`Crear ${etiqueta.toLowerCase()}`}>
        {dentro}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={clases} aria-label={`Crear ${etiqueta.toLowerCase()}`}>
      {dentro}
    </button>
  );
}
