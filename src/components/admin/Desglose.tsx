"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDownIcon } from "@/components/icons";

/*
  Los números de la tarjeta "Entró en caja" de /admin/metricas, como botones:
  se toca uno y abajo se abre su detalle (de quién fueron las propinas, cuánto
  cobra cada barbero por cliente, cobro por cobro con su medio de pago). Uno a
  la vez; tocar el mismo lo cierra.

  El detalle llega ya pintado por el servidor (`panel`): acá solo se guarda cuál
  está abierto. El que no está abierto va con `hidden`, así que al mostrarse el
  CSS le corre la entrada (ver .bb-panel en globals.css).
*/
export function Desglose({
  items,
}: {
  items: { clave: string; numero: string; etiqueta: string; panel: ReactNode }[];
}) {
  const [abierto, setAbierto] = useState<string | null>(null);
  const id = useId();

  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="grid grid-cols-3 gap-1.5 sm:flex sm:gap-2">
        {items.map((it) => {
          const activo = abierto === it.clave;
          return (
            <button
              key={it.clave}
              type="button"
              aria-expanded={activo}
              aria-controls={`${id}-${it.clave}`}
              onClick={() => setAbierto(activo ? null : it.clave)}
              className={`bb-tile flex min-h-14 min-w-0 flex-col justify-center rounded-xl border px-2 py-2 text-left text-[12.5px] leading-tight sm:min-w-[9.5rem] sm:px-3 ${
                activo ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:border-ink/40"
              }`}
            >
              {/* Medido con las fuentes reales: a 360-375 px "por cobro" y un número de
                  siete cifras se cortaban; con estos tamaños caben los tres. */}
              <b className="bb-monto block truncate font-display text-base font-semibold tabular-nums leading-tight text-ink sm:text-xl">
                {it.numero}
              </b>
              <span className="flex items-center justify-between gap-0.5 sm:gap-1">
                <span className="truncate">{it.etiqueta}</span>
                <ChevronDownIcon className={`bb-tile-flecha h-3 w-3 shrink-0 max-[359px]:hidden sm:h-3.5 sm:w-3.5 ${activo ? "rotate-180" : ""}`} />
              </span>
            </button>
          );
        })}
      </div>
      {items.map((it) => (
        <div key={it.clave} id={`${id}-${it.clave}`} hidden={abierto !== it.clave} className="bb-panel mt-3 rounded-xl border border-line bg-bg p-4">
          {it.panel}
        </div>
      ))}
    </div>
  );
}
