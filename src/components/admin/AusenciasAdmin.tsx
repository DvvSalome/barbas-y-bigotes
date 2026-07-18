"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { marcarAusencia, quitarAusencia } from "@/lib/actions";
import { bogotaYmd } from "@/lib/slots";
import type { Barbero, Sede } from "@/lib/data/types";
import type { Ausencia } from "@/lib/data/queries";

const input =
  "rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

// Formatea YYYY-MM-DD a "vie 18 jul" sin líos de timezone (la fecha ya es local).
function fechaLabel(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" });
}

export function AusenciasAdmin({
  barberos,
  sedes,
  ausencias,
}: {
  barberos: Barbero[];
  sedes: Sede[];
  ausencias: Ausencia[];
}) {
  const router = useRouter();
  const hoy = bogotaYmd();
  const [barberoId, setBarberoId] = useState("");
  const [fecha, setFecha] = useState(hoy);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const nombreBarbero = (id: string) => barberos.find((b) => b.id === id)?.nombre ?? "Barbero";
  const sedeDeBarbero = (id: string) => {
    const s = barberos.find((b) => b.id === id)?.sede;
    return sedes.find((x) => x.id === s)?.nombre ?? "";
  };

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!barberoId) {
      setErr("Elegí el barbero.");
      return;
    }
    setSaving(true);
    const res = await marcarAusencia({ barberoId, fecha, motivo });
    setSaving(false);
    if (res.ok) {
      setMotivo("");
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo guardar.");
    }
  }

  async function quitar(id: string) {
    await quitarAusencia(id);
    router.refresh();
  }

  return (
    <div>
      <form onSubmit={agregar} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-4">
        <h3 className="font-display text-lg sm:col-span-4">Marcar ausencia</h3>
        <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={input}>
          <option value="">Barbero…</option>
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>
              {b.nombre}
            </option>
          ))}
        </select>
        <input type="date" min={hoy} value={fecha} onChange={(e) => setFecha(e.target.value)} className={input} />
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="Motivo (opcional)"
          className={`${input} sm:col-span-2`}
        />
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
            {saving ? "Guardando…" : "Marcar ausente"}
          </button>
        </div>
      </form>

      <div className="mt-5">
        <h3 className="mb-2 text-xs uppercase tracking-[0.3em] text-accent">Ausencias próximas</h3>
        {ausencias.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-4 text-sm text-muted">
            No hay ausencias marcadas. Cuando un barbero no vaya, marcalo acá y deja de aparecer para reservar ese día.
          </p>
        ) : (
          <div className="space-y-2">
            {ausencias.map((a) => (
              <div
                key={a.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-line bg-panel px-4 py-3"
              >
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-ink">
                    {nombreBarbero(a.barberoId)} <span className="font-normal text-muted">· {fechaLabel(a.fecha)}</span>
                  </div>
                  <div className="truncate text-xs text-muted">{sedeDeBarbero(a.barberoId)}</div>
                </div>
                <button
                  onClick={() => quitar(a.id)}
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
