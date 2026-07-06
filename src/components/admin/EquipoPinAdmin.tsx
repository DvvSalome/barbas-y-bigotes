"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { setearPinBarbero, desbloquearBarbero } from "@/lib/barbero-auth";
import type { Barbero, Sede } from "@/lib/data/types";

type Estado = Record<string, { tienePin: boolean; bloqueado: boolean }>;

export function EquipoPinAdmin({ barberos, sedes, estado }: { barberos: Barbero[]; sedes: Sede[]; estado: Estado }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  async function guardar(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await setearPinBarbero(barberoId, pin);
    setBusy(false);
    if (res.ok) {
      setEditing(null);
      setPin("");
      setMsg({ id: barberoId, text: "PIN guardado", ok: true });
      router.refresh();
    } else {
      setMsg({ id: barberoId, text: res.error ?? "Error", ok: false });
    }
  }

  async function desbloquear(barberoId: string) {
    setBusy(true);
    setMsg(null);
    const res = await desbloquearBarbero(barberoId);
    setBusy(false);
    setMsg({ id: barberoId, text: res.ok ? "Desbloqueado" : res.error ?? "Error", ok: res.ok });
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-6">
      {sedes.map((s) => {
        const list = barberos.filter((b) => b.sede === s.id);
        if (!list.length) return null;
        return (
          <section key={s.id}>
            <h2 className="mb-3 text-xs uppercase tracking-[0.3em] text-accent">{s.nombre}</h2>
            <div className="space-y-2">
              {list.map((b) => {
                const e = estado[b.id];
                return (
                  <div key={b.id} className="rounded-xl border border-line bg-panel p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold">{b.nombre}</div>
                        <div className="text-xs text-muted">
                          {e?.tienePin ? "PIN configurado" : "Sin PIN"}
                          {e?.bloqueado ? " · 🔒 bloqueado" : ""}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        {e?.bloqueado && (
                          <button onClick={() => desbloquear(b.id)} disabled={busy}
                            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink disabled:opacity-50">
                            Desbloquear
                          </button>
                        )}
                        <button onClick={() => { setEditing(editing === b.id ? null : b.id); setPin(""); setMsg(null); }}
                          className="rounded-full bg-accent px-4 py-1.5 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft">
                          {e?.tienePin ? "Cambiar PIN" : "Setear PIN"}
                        </button>
                      </div>
                    </div>
                    {editing === b.id && (
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <input
                          value={pin}
                          onChange={(ev) => setPin(ev.target.value.replace(/\D/g, "").slice(0, 6))}
                          inputMode="numeric"
                          placeholder="6 dígitos"
                          className="w-32 rounded-lg border border-line bg-bg px-3 py-2 text-center tracking-[0.3em] text-ink placeholder:text-muted placeholder:tracking-normal focus:border-accent focus:outline-none"
                        />
                        <button onClick={() => guardar(b.id)} disabled={busy || pin.length !== 6}
                          className="rounded-full bg-accent px-4 py-2 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
                          {busy ? "…" : "Guardar"}
                        </button>
                        <button onClick={() => { setEditing(null); setPin(""); }} className="text-xs text-muted transition hover:text-ink">
                          Cancelar
                        </button>
                      </div>
                    )}
                    {msg?.id === b.id && (
                      <div className={`mt-2 text-xs ${msg.ok ? "text-ok" : "text-accent-soft"}`}>{msg.text}</div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
