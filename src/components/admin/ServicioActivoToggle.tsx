"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setServicioActivo } from "@/lib/actions";

// Toggle Desactivar/Activar de un servicio (proto §7.2: gestión posterior del combo).
// Desactivado no aparece en la reserva; el historial de ventas no se toca.
export function ServicioActivoToggle({ id, activo }: { id: string; activo: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    // Desactivar saca el servicio de la reserva pública al instante: se pregunta
    // una vez antes de hacerlo, para no tumbar el catálogo por un toque accidental.
    // Reactivar no tiene fricción (un solo clic).
    if (
      activo &&
      !window.confirm(
        "Este servicio deja de aparecer en la reserva pública. ¿Lo sacamos del catálogo?",
      )
    )
      return;
    setErr(null);
    setSaving(true);
    const res = await setServicioActivo(id, !activo);
    setSaving(false);
    if (res.ok) startTransition(() => router.refresh());
    else setErr(res.error ?? "No se pudo cambiar el estado.");
  }

  const busy = saving || pending;

  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-[12px] text-warn">{err}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={botonClases(activo ? "secundario" : "primario", "sm")}
      >
        {busy ? "…" : activo ? "Desactivar" : "Activar"}
      </button>
    </span>
  );
}
