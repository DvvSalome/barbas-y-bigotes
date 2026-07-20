"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarDiaEspecial, quitarDiaEspecial } from "@/lib/actions";
import { bogotaYmd } from "@/lib/slots";
import type { Sede } from "@/lib/data/types";
import type { DiaEspecial } from "@/lib/data/queries";

const input =
  "rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

// YYYY-MM-DD a "dom 20 jul" sin líos de huso (la fecha ya es civil, no instante).
function fechaLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}
const esDomingo = (ymd: string) => {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).getDay() === 0;
};

export function DiasEspecialesAdmin({
  sedes,
  dias,
}: {
  sedes: Sede[];
  dias: DiaEspecial[];
}) {
  const router = useRouter();
  const hoy = bogotaYmd();
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [fecha, setFecha] = useState(hoy);
  const [abierta, setAbierta] = useState(true);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const res = await marcarDiaEspecial({ sede, fecha, abierta, motivo });
    setSaving(false);
    if (res.ok) {
      setMotivo("");
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  async function quitar(id: string) {
    await quitarDiaEspecial(id);
    router.refresh();
  }

  const nombreSede = (id: string) => sedes.find((s) => s.id === id)?.nombre ?? id;

  return (
    <div>
      <form onSubmit={guardar} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-4">
        <h3 className="font-display text-lg sm:col-span-4">Abrir o cerrar un día</h3>

        <select value={sede} onChange={(e) => setSede(e.target.value as typeof sede)} className={input}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre}
            </option>
          ))}
        </select>
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />

        {/* Abrir / Cerrar como par de botones: más claro que un checkbox suelto. */}
        <div className="flex gap-1 rounded-lg border border-line bg-bg p-1 sm:col-span-2">
          {(
            [
              { v: true, label: "Abrimos" },
              { v: false, label: "Cerramos" },
            ] as const
          ).map((o) => (
            <button
              key={String(o.v)}
              type="button"
              onClick={() => setAbierta(o.v)}
              className={`flex-1 rounded-md px-3 py-1.5 text-[13px] font-semibold transition ${
                abierta === o.v
                  ? o.v
                    ? "bg-ok/15 text-ok shadow-[inset_0_0_0_1px_rgba(52,211,153,.35)]"
                    : "bg-accent/15 text-accent-soft shadow-[inset_0_0_0_1px_rgba(210,63,52,.35)]"
                  : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>

        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder={abierta ? "Motivo (ej. domingo de feria)" : "Motivo (ej. festivo, cierre)"}
          className={`${input} sm:col-span-4`}
        />

        <p className="text-[11.5px] leading-relaxed text-muted sm:col-span-4">
          Por defecto se atiende de lunes a sábado, 9:00 am a 8:00 pm. Acá solo se marcan las
          excepciones. Si un barbero no va ese día, marcalo como ausente arriba.
        </p>

        {err && (
          <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-4">
            {err}
          </div>
        )}
        <div className="sm:col-span-4">
          <button
            disabled={saving}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar día"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">Días marcados</h3>
        {dias.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-muted">
            Sin excepciones. Se atiende de lunes a sábado y los domingos está cerrado.
          </p>
        ) : (
          <div className="space-y-2">
            {dias.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-ink">{fechaLabel(d.fecha)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                        d.abierta ? "bg-ok/15 text-ok" : "bg-accent/15 text-accent-soft"
                      }`}
                    >
                      {d.abierta ? "Abrimos" : "Cerramos"}
                    </span>
                    {d.abierta && esDomingo(d.fecha) && (
                      <span className="rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
                        domingo
                      </span>
                    )}
                  </div>
                  <div className="truncate text-xs text-muted">
                    {nombreSede(d.sede)}
                    {d.motivo ? ` · ${d.motivo}` : ""}
                  </div>
                </div>
                <button
                  onClick={() => quitar(d.id)}
                  className="shrink-0 rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-ink"
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
