"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarEmailBarbero } from "@/lib/actions";
import type { Barbero } from "@/lib/data/types";

// El correo al que le avisamos a cada barbero "te cayó una cita" (lo manda n8n
// al momento de la reserva). Lo pone el admin acá; vacío = sin aviso por correo
// (le queda solo el push, si lo tiene activo).
export function CorreosBarberos({ barberos, emails }: { barberos: Barbero[]; emails: Record<string, string> }) {
  const router = useRouter();
  // Borrador por barbero: cada fila edita lo suyo sin pisar a las demás.
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function guardar(barberoId: string) {
    const valor = draft[barberoId] ?? emails[barberoId] ?? "";
    setBusy(barberoId);
    setMsg(null);
    const res = await guardarEmailBarbero(barberoId, valor);
    setBusy(null);
    if (res.ok) {
      setMsg({ id: barberoId, text: res.aviso ?? "Correo guardado ✓ — le llegan los avisos de citas.", ok: true });
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res.error ?? "No se pudo guardar.", ok: false });
    }
  }

  return (
    <div className="grid gap-2">
      {barberos.map((b) => {
        const valor = draft[b.id] ?? emails[b.id] ?? "";
        const cambiado = valor !== (emails[b.id] ?? "");
        return (
          <div key={b.id} className="rounded-2xl border border-line bg-panel p-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-28 text-[13px] font-semibold text-ink">{b.nombre}</span>
              <input
                type="email"
                value={valor}
                onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                placeholder="correo@gmail.com (vacío = sin aviso)"
                className="min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => guardar(b.id)}
                disabled={busy === b.id || !cambiado}
                className="rounded-full bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-40"
              >
                {busy === b.id ? "…" : "Guardar"}
              </button>
            </div>
            {msg?.id === b.id && (
              <p className={`mt-2 text-[12px] ${msg.ok ? "text-muted" : "font-semibold text-warn"}`}>{msg.text}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
