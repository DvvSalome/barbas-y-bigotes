"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProductoUpsell } from "@/lib/actions";

// Pill de "se ofrece al reservar": marca si el producto aparece en el ultimo
// paso del wizard. Decia "En reserva", que en una tabla de inventario se leia
// como stock reservado, o sea lo contrario de lo que hace.
// Optimista: refleja el cambio al instante y revierte si el server falla.
export function UpsellToggle({ productoId, enUpsell }: { productoId: string; enUpsell: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enUpsell);
  const [pending, startTransition] = useTransition();

  function toggle() {
    const next = !on;
    setOn(next);
    startTransition(async () => {
      const res = await toggleProductoUpsell(productoId, next);
      if (!res.ok) setOn(!next); // revierte si falló
      else router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={on}
      title={on ? "Se le ofrece al cliente al final de la reserva" : "No se le ofrece al reservar"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold transition disabled:opacity-50 ${
        on
          ? "bg-accent/15 text-accent-soft ring-1 ring-accent/40"
          : "border border-line text-muted hover:text-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-muted/50"}`} />
      {on ? "Sí" : "No"}
    </button>
  );
}
