"use client";

import { useState, useTransition, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { chipFiltroClases } from "@/components/ui/Chip";

/*
  Los botones de período de /admin/metricas y lo que cambia con ellos.

  Cambiar de período recalcula todo en el servidor (cerca de un segundo). Next
  deja la pantalla anterior puesta mientras tanto, pero sin ninguna señal: el
  dueño tocaba "90 días" y no pasaba nada (medido: el esqueleto de loading.tsx no
  aparece al cambiar solo ?p=). Acá el botón tocado se marca AL INSTANTE y lo de
  abajo se atenúa hasta que llega lo nuevo: se sabe que el toque entró y que lo
  que se ve todavía es lo de antes.
*/
export function PeriodoChips({
  opciones,
  extra,
  children,
}: {
  opciones: { href: string; label: string; activo: boolean }[];
  /** Lo que va al final de la fila (el Excel del período). */
  extra?: ReactNode;
  children: ReactNode;
}) {
  const router = useRouter();
  const [cargando, enTransicion] = useTransition();
  const [destino, setDestino] = useState<string | null>(null);

  return (
    <>
      <div className="scroll-x-limpio -mx-4 mt-5 flex items-center gap-2 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:px-0">
        {opciones.map((o) => (
          <Link
            key={o.href}
            href={o.href}
            prefetch={false}
            scroll={false}
            aria-current={o.activo ? "page" : undefined}
            className={chipFiltroClases(cargando ? o.href === destino : o.activo)}
            onClick={(e) => {
              // Abrir en otra pestaña (Ctrl/⌘ + clic) sigue siendo cosa del navegador.
              if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
              e.preventDefault();
              // Mientras carga otro período, tocar el que sigue en pantalla sí vale:
              // cancela el cambio y vuelve a él.
              if (o.activo && !cargando) return;
              setDestino(o.href);
              enTransicion(() => router.push(o.href, { scroll: false }));
            }}
          >
            {o.label}
          </Link>
        ))}
        {extra}
      </div>
      <div className="bb-cuerpo" data-cargando={cargando || undefined} aria-busy={cargando}>
        {children}
      </div>
    </>
  );
}
