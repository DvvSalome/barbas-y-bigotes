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
  const [armado, setArmado] = useState(false);

  async function toggle() {
    // Desactivar saca el servicio de la reserva pública al instante, así que se
    // pide DOS toques para que un roce no tumbe el catálogo. Reactivar no tiene
    // fricción: es un solo clic.
    //
    // Dos toques y no un confirm() del navegador: el confirm bloquea la pestaña
    // entera, sale con la tipografía del sistema en medio de una pantalla que no
    // se parece en nada, y en la tablet del local aparece arriba, lejos del dedo
    // que acaba de tocar abajo. Es el mismo patrón con el que ya se cancela una
    // cita o se unen fichas.
    if (activo && !armado) {
      setArmado(true);
      return;
    }
    setArmado(false);
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
      {armado && !busy && (
        <span className="text-[12px] text-warn">Deja de aparecer en la reserva.</span>
      )}
      <button
        type="button"
        onClick={toggle}
        onBlur={() => setArmado(false)}
        disabled={busy}
        className={botonClases(armado ? "peligro" : activo ? "secundario" : "primario", "sm")}
      >
        {busy ? "…" : armado ? "¿Seguro? Toca de nuevo" : activo ? "Desactivar" : "Activar"}
      </button>
    </span>
  );
}
