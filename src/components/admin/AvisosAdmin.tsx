"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarAjustesAvisos } from "@/lib/actions";
import type { AjustesAvisos } from "@/lib/data/queries";

// Opciones cerradas en vez de un campo libre: el dueño elige de una lista corta y
// no hay forma de escribir "0.3" ni "48". Los valores viven dentro del rango que
// acepta el CHECK de ajustes_avisos.
const OPCIONES = [
  { horas: 1, label: "1 hora antes" },
  { horas: 2, label: "2 horas antes" },
  { horas: 3, label: "3 horas antes" },
  { horas: 4, label: "4 horas antes" },
  { horas: 6, label: "6 horas antes" },
] as const;

export function AvisosAdmin({ ajustes }: { ajustes: AjustesAvisos }) {
  const router = useRouter();
  const [horas, setHoras] = useState<number>(ajustes.previoHoras);
  const [activo, setActivo] = useState<boolean>(ajustes.previoActivo);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; texto: string } | null>(null);

  const sinCambios = horas === ajustes.previoHoras && activo === ajustes.previoActivo;

  async function guardar() {
    setSaving(true);
    setMsg(null);
    const res = await actualizarAjustesAvisos({ previoHoras: horas, previoActivo: activo });
    setSaving(false);
    setMsg(
      res.ok
        ? { ok: true, texto: "Listo. Aplica desde el próximo envío." }
        : { ok: false, texto: res.error ?? "No se pudo guardar." },
    );
    if (res.ok) router.refresh();
  }

  return (
    <div className="space-y-8">
      {/* ---- El único ajuste editable ---- */}
      <section className="rounded-2xl border border-line bg-panel p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <h3 className="font-display text-lg">Aviso antes de la cita</h3>
            <p className="mt-1 max-w-[52ch] text-[12.5px] leading-relaxed text-muted">
              Le recuerda al cliente que su turno es en un rato. Es el que más ayuda a que
              no falten, porque a esa hora todavía alcanza a avisar si no puede venir.
            </p>
          </div>
          {/* Interruptor: el dueño puede apagarlo sin perder la antelación elegida. */}
          <button
            type="button"
            role="switch"
            aria-checked={activo}
            onClick={() => setActivo((v) => !v)}
            className={`relative h-[30px] w-[54px] shrink-0 rounded-full border transition ${
              activo ? "border-ok/50 bg-ok/25" : "border-line bg-elevated"
            }`}
          >
            <span
              className={`absolute top-[3px] h-[22px] w-[22px] rounded-full transition-all ${
                activo ? "left-[28px] bg-ok" : "left-[3px] bg-muted"
              }`}
            />
          </button>
        </div>

        <div className={`mt-5 ${activo ? "" : "pointer-events-none opacity-40"}`}>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            ¿Con cuánto tiempo?
          </div>
          <div className="flex flex-wrap gap-2">
            {OPCIONES.map((o) => (
              <button
                key={o.horas}
                type="button"
                onClick={() => setHoras(o.horas)}
                aria-pressed={horas === o.horas}
                className={`min-h-11 rounded-xl border px-4 text-[13px] font-semibold transition ${
                  horas === o.horas
                    ? "border-accent bg-accent/15 text-ink"
                    : "border-line text-muted hover:border-ink/25 hover:text-ink"
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="mt-3 text-[11.5px] leading-relaxed text-muted">
            Solo le llega a quien reservó con más de {horas === 1 ? "una hora" : `${horas} horas`} de
            anticipación. Al que acaba de reservar no se le avisa: ya lo sabe.
          </p>
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-3">
          <button
            onClick={guardar}
            disabled={saving || sinCambios}
            // bg-accent plano: el MISMO botón "Guardar" que usan las demás
            // secciones del admin (el degradado era un one-off que desentonaba).
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-40"
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
          {msg && (
            <span className={`text-[12.5px] ${msg.ok ? "text-ok" : "text-accent-soft"}`}>{msg.texto}</span>
          )}
        </div>
      </section>

      {/* ---- Los demás avisos: informativos, para que el dueño sepa qué se manda ---- */}
      <section>
        <h3 className="mb-1 font-display text-lg">Los otros avisos</h3>
        <p className="mb-3 text-[12.5px] text-muted">
          Salen solos, no hay nada que configurar. Se listan para que sepas qué le llega a tu cliente.
        </p>
        <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-panel">
          {[
            { t: "Confirmación de la reserva", c: "Apenas reserva, con el detalle de la cita." },
            { t: "Recordatorio del día antes", c: "El día previo, con el botón para confirmar que viene." },
            { t: "Se liberó un cupo", c: "Si alguien cancela, al primero de la lista de espera." },
            { t: "Reseña después del corte", c: "Un par de horas después de cobrar, invita a calificar en Google." },
          ].map((a) => (
            <div key={a.t} className="flex items-start gap-3 px-4 py-3.5">
              <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-ok" />
              <div className="min-w-0">
                <div className="text-[13.5px] font-semibold text-ink">{a.t}</div>
                <div className="text-[12px] text-muted">{a.c}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
