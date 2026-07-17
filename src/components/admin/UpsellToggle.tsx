"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProductoUpsell } from "@/lib/actions";

// Pill para marcar un producto como bebida del upsell de reserva (por sede).
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
      title={on ? "Aparece en el paso de bebida al reservar" : "No aparece al reservar"}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition disabled:opacity-50 ${
        on
          ? "bg-accent/15 text-accent-soft ring-1 ring-accent/40"
          : "border border-line text-muted hover:text-ink"
      }`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${on ? "bg-accent" : "bg-muted/50"}`} />
      En reserva
    </button>
  );
}
