"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { desbloquearBarbero } from "@/lib/barbero-auth";

// Botón "Desbloquear" del dashboard Hoy (equipo con PIN bloqueado).
export function DesbloquearPinBtn({ barberoId }: { barberoId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function desbloquear() {
    setBusy(true);
    setErr(null);
    const res = await desbloquearBarbero(barberoId);
    setBusy(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo desbloquear.");
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        onClick={desbloquear}
        disabled={busy}
        className="rounded-lg px-2.5 py-1.5 text-xs font-semibold text-accent-soft transition hover:bg-accent/10 hover:text-ink disabled:opacity-50"
      >
        {busy ? "Desbloqueando…" : "Desbloquear"}
      </button>
      {err && <span className="text-[10px] text-accent-soft">{err}</span>}
    </span>
  );
}
