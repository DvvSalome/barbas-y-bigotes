"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinSede } from "@/lib/barbero-auth";
import type { Sede } from "@/lib/data/types";

// PIN del MOSTRADOR de cada sede (migración 0044). Es el que usa el aparato
// compartido del local: uno por sede en vez de uno por barbero.
// Vive acá y no en un panel aparte porque la pregunta del dueño es la misma —
// "quién puede entrar a la app" — y ya estaba respondiéndola en esta pantalla.

type Estado = Record<string, { tienePin: boolean; bloqueado: boolean }>;

export function SedePinAdmin({ sedes, estado }: { sedes: Sede[]; estado: Estado }) {
  const router = useRouter();
  const [editando, setEditando] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function guardar(sedeId: string) {
    setBusy(true);
    setMsg(null);
    const res = await setearPinSede(sedeId, pin);
    setBusy(false);
    if (res.ok) {
      setEditando(null);
      setPin("");
      setMsg({ id: sedeId, text: "PIN guardado", ok: true });
      router.refresh();
    } else {
      setMsg({ id: sedeId, text: res.error ?? "Error", ok: false });
    }
  }

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      {sedes.map((s) => {
        const e = estado[s.id];
        return (
          <div
            key={s.id}
            className={`rounded-2xl border bg-panel p-4 ${editando === s.id ? "border-accent/50" : "border-line"}`}
          >
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl border border-accent/35 text-accent">
                <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                  <path
                    d="M3 9h18M4 9V6l2-2h12l2 2v3M5 9v11h14V9"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <div className="min-w-0 flex-1">
                <div className="truncate font-display text-[17px] font-bold uppercase leading-tight">
                  {s.nombre}
                </div>
                <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                  <span
                    className={`rounded-full px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide ${
                      e?.tienePin ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
                    }`}
                  >
                    {e?.tienePin ? "PIN listo" : "Sin PIN"}
                  </span>
                  {e?.bloqueado && (
                    <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-accent-soft">
                      Bloqueado 5 min
                    </span>
                  )}
                  <span className="text-[12px] text-muted">lo usa todo el equipo del local</span>
                </div>
              </div>
            </div>

            <div className="mt-3">
              <button
                onClick={() => {
                  setEditando(editando === s.id ? null : s.id);
                  setPin("");
                  setMsg(null);
                }}
                className={`min-h-9 rounded-full px-3.5 text-[12px] font-semibold transition ${
                  e?.tienePin
                    ? "border border-line text-muted hover:text-ink"
                    : "bg-accent text-on-accent hover:bg-accent-soft"
                }`}
              >
                {e?.tienePin ? "Cambiar PIN" : "Poner PIN"}
              </button>
            </div>

            {editando === s.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <input
                  value={pin}
                  onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                  inputMode="numeric"
                  placeholder="6 dígitos"
                  className="w-32 rounded-lg border border-line bg-bg px-3 py-2 text-center tracking-[0.3em] text-ink placeholder:tracking-normal placeholder:text-muted focus:border-accent focus:outline-none"
                />
                <button
                  onClick={() => guardar(s.id)}
                  disabled={busy || pin.length !== 6}
                  className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
                >
                  {busy ? "…" : "Guardar"}
                </button>
                <button
                  onClick={() => {
                    setEditando(null);
                    setPin("");
                  }}
                  className="text-xs text-muted transition hover:text-ink"
                >
                  Cancelar
                </button>
              </div>
            )}

            {msg?.id === s.id && (
              <div className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-accent-soft"}`}>{msg.text}</div>
            )}
          </div>
        );
      })}
    </div>
  );
}
