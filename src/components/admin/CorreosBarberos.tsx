"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarEmailBarbero } from "@/lib/actions";
import type { Barbero } from "@/lib/data/types";

// El correo al que le avisamos a cada barbero "te cayó una cita" (lo manda n8n
// al momento de la reserva). Lo pone el admin acá; vacío = sin aviso por correo.
//
// 5-sep: el dueño creyó haber registrado el de Abel y no quedó guardado (la
// tabla estaba vacía). Por eso ahora se guarda al salir del campo o con Enter,
// no solo con el botón, y cada barbero sin correo lo dice en rojo.
export function CorreosBarberos({ barberos, emails }: { barberos: Barbero[]; emails: Record<string, string> }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function guardar(barberoId: string) {
    const valor = (draft[barberoId] ?? emails[barberoId] ?? "").trim();
    if (valor === (emails[barberoId] ?? "")) return; // nada que guardar
    setBusy(barberoId);
    setMsg(null);
    const res = await guardarEmailBarbero(barberoId, valor).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      setMsg({ id: barberoId, text: res.aviso ?? "Correo guardado ✓ — le llegan los avisos de citas.", ok: true });
      setDraft((d) => ({ ...d, [barberoId]: valor }));
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res?.error ?? "No se pudo guardar. Revisá la conexión.", ok: false });
    }
  }

  return (
    <div className="grid gap-2">
      {barberos.map((b) => {
        const valor = draft[b.id] ?? emails[b.id] ?? "";
        const guardado = !!emails[b.id];
        const cambiado = valor.trim() !== (emails[b.id] ?? "");
        return (
          <form
            key={b.id}
            onSubmit={(e) => {
              e.preventDefault();
              guardar(b.id);
            }}
            className={`rounded-2xl border bg-panel p-3.5 ${guardado ? "border-line" : "border-warn/40"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-28 text-[13px] font-semibold text-ink">
                {b.nombre}
                {!guardado && !cambiado && (
                  <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
                    sin correo
                  </span>
                )}
              </span>
              <input
                type="email"
                value={valor}
                onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                onBlur={() => guardar(b.id)}
                placeholder="correo@gmail.com"
                className="min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                disabled={busy === b.id || !cambiado}
                className="rounded-full bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-40"
              >
                {busy === b.id ? "…" : "Guardar"}
              </button>
            </div>
            {msg?.id === b.id && (
              <p className={`mt-2 text-[12px] ${msg.ok ? "text-ok" : "font-semibold text-warn"}`}>{msg.text}</p>
            )}
          </form>
        );
      })}
    </div>
  );
}
