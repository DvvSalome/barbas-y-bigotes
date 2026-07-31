"use client";

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
      {err && <span className="text-[11px] text-accent-soft">{err}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-50 ${
          activo
            ? "border-line text-muted hover:text-ink"
            : "border-ok/40 bg-ok/10 text-ok hover:bg-ok/[0.16]"
        }`}
      >
        {busy ? "…" : activo ? "Desactivar" : "Activar"}
      </button>
    </span>
  );
}
