"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleProductoUpsell } from "@/lib/actions";
import { Switch } from "@/components/admin/Switch";

// "Se ofrece al reservar": si el producto aparece en el último paso del wizard.
// Optimista: refleja el cambio al instante y revierte si el server falla.
// Era una pill "Sí/No" de 32 px; ahora es el Switch común del panel.
export function UpsellToggle({ productoId, enUpsell }: { productoId: string; enUpsell: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(enUpsell);
  const [pending, startTransition] = useTransition();

  function cambiar(next: boolean) {
    setOn(next);
    startTransition(async () => {
      const res = await toggleProductoUpsell(productoId, next);
      if (!res.ok) setOn(!next); // revierte si falló
      else router.refresh();
    });
  }

  return <Switch checked={on} onChange={cambiar} disabled={pending} label="Ofrecer al reservar" />;
}
