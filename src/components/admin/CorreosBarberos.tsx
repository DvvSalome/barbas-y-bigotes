"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarEmailBarbero, probarCorreoBarbero } from "@/lib/actions";
import type { Barbero } from "@/lib/data/types";

// El correo al que le avisamos a cada barbero "te cayó una cita" (lo manda n8n
// al momento de la reserva). Lo pone el admin acá; vacío = sin aviso por correo.
//
// 8-sep: el dueño quiere PROBAR el correo antes de guardarlo. "Probar" manda el
// aviso de prueba a lo que está escrito, por el mismo camino del aviso real, sin
// tocar lo guardado; cuando el barbero confirma que le llegó, "Guardar". Por eso
// ya no se guarda solo al salir del campo (5-sep): guardar es un toque
// deliberado, y mientras haya algo escrito sin guardar la fila lo dice.
export function CorreosBarberos({ barberos, emails }: { barberos: Barbero[]; emails: Record<string, string> }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, string>>({});
  // `${barberoId}:guardar` | `${barberoId}:probar`
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ id: string; text: string; ok: boolean } | null>(null);

  function escrito(barberoId: string) {
    return (draft[barberoId] ?? emails[barberoId] ?? "").trim();
  }

  async function guardar(barberoId: string) {
    const valor = escrito(barberoId);
    if (valor === (emails[barberoId] ?? "")) return; // nada que guardar
    setBusy(`${barberoId}:guardar`);
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

  async function probar(barberoId: string) {
    const valor = escrito(barberoId);
    if (!valor) return;
    setBusy(`${barberoId}:probar`);
    setMsg(null);
    const res = await probarCorreoBarbero(barberoId, valor).catch(() => null);
    setBusy(null);
    if (res?.ok) {
      const sinGuardar = valor !== (emails[barberoId] ?? "");
      setMsg({
        id: barberoId,
        text: `${res.aviso ?? `Prueba enviada a ${valor}.`}${sinGuardar ? " Cuando confirme que le llegó, tocá Guardar." : ""}`,
        ok: true,
      });
    } else {
      setMsg({ id: barberoId, text: res?.error ?? "No se pudo mandar la prueba. Revisá la conexión.", ok: false });
    }
  }

  return (
    <div className="grid gap-2">
      {barberos.map((b) => {
        const valor = draft[b.id] ?? emails[b.id] ?? "";
        const guardado = !!emails[b.id];
        const cambiado = valor.trim() !== (emails[b.id] ?? "");
        const ocupado = busy?.startsWith(`${b.id}:`) ?? false;
        return (
          <form
            key={b.id}
            onSubmit={(e) => {
              e.preventDefault();
              guardar(b.id);
            }}
            className={`rounded-2xl border bg-panel p-3.5 ${guardado || cambiado ? "border-line" : "border-warn/40"}`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="min-w-28 text-[13px] font-semibold text-ink">
                {b.nombre}
                {!guardado && !cambiado && (
                  <span className="ml-2 rounded-full bg-warn/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-warn">
                    sin correo
                  </span>
                )}
                {cambiado && (
                  <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                    sin guardar
                  </span>
                )}
              </span>
              <input
                type="email"
                value={valor}
                onChange={(e) => setDraft((d) => ({ ...d, [b.id]: e.target.value }))}
                placeholder="correo@gmail.com"
                className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                onClick={() => probar(b.id)}
                disabled={ocupado || !valor.trim()}
                title="Manda un aviso de prueba a ese correo, sin guardarlo"
                className="min-h-11 rounded-full border border-line px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-ink transition hover:border-accent disabled:opacity-40"
              >
                {busy === `${b.id}:probar` ? "Enviando…" : "Probar"}
              </button>
              <button
                type="submit"
                disabled={ocupado || !cambiado}
                className="min-h-11 rounded-full bg-accent px-4 py-2.5 text-xs font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-40"
              >
                {busy === `${b.id}:guardar` ? "…" : "Guardar"}
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
