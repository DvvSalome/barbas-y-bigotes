"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { setServicioCuentaSello } from "@/lib/actions";

/**
 * ¿Este servicio suma sello en la tarjeta de cortes? (0064)
 *
 * El dueño pidió que "las barbas no cuenten". Antes eso era una lista de ids
 * escrita a mano en el código —y duplicada en el mostrador—, así que cambiarla
 * era un deploy y las dos copias podían quedar distintas sin que nadie lo notara.
 *
 * Solo se dibuja en cortes y combos: el resto de categorías no entra al conteo,
 * y ofrecer el interruptor ahí prometería algo que no pasa.
 */
export function SelloToggle({ id, suma }: { id: string; suma: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setErr(null);
    setSaving(true);
    const res = await setServicioCuentaSello(id, !suma);
    setSaving(false);
    if (res.ok) startTransition(() => router.refresh());
    else setErr(res.error ?? "No se pudo cambiar.");
  }

  const busy = saving || pending;

  return (
    <span className="inline-flex items-center gap-2">
      {err && <span className="text-[11px] text-accent-soft">{err}</span>}
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={suma}
        title={suma ? "Suma sello en la tarjeta de cortes" : "No suma sello"}
        className={`shrink-0 rounded-full border px-3 py-1.5 text-[11.5px] font-semibold transition disabled:opacity-50 ${
          suma ? "border-accent/45 bg-accent/10 text-accent-soft" : "border-line text-muted hover:text-ink"
        }`}
      >
        {busy ? "…" : suma ? "🎫 Suma sello" : "No suma sello"}
      </button>
    </span>
  );
}
