"use client";

import { useState } from "react";
import { cambiarServicioCita } from "@/lib/actions";
import type { Servicio } from "@/lib/data/types";

// "Me equivoqué al agendar y ya no me dan modificar": cambia el servicio de una
// cita desde el detalle del calendario. Antes solo se podía al cobrar.
export function CambiarServicioCita({
  reservaId,
  servicioActual,
  servicios,
  sede,
  onDone,
}: {
  reservaId: string;
  /** Nombre del servicio de hoy (el detalle no trae el id): preselecciona por nombre. */
  servicioActual: string;
  servicios: Servicio[];
  sede: string;
  onDone: (aviso?: string) => void;
}) {
  const disponibles = servicios.filter((s) => s.precios[sede as keyof typeof s.precios] != null);
  const actual = disponibles.find((s) => s.nombre === servicioActual)?.id ?? "";
  const [abierto, setAbierto] = useState(false);
  const [elegido, setElegido] = useState(actual);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (!elegido || elegido === actual) {
      setAbierto(false);
      return;
    }
    setSaving(true);
    setError(null);
    const res = await cambiarServicioCita({ reservaId, servicioId: elegido }).catch(() => null);
    setSaving(false);
    if (!res?.ok) {
      setError(res?.error ?? "No se pudo cambiar el servicio.");
      return;
    }
    onDone(res.aviso);
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="w-full rounded-full border border-line px-5 py-3 text-sm font-bold uppercase tracking-wide text-ink transition hover:border-accent/40"
      >
        Cambiar servicio
      </button>
    );
  }

  return (
    <div className="space-y-2 rounded-2xl border border-accent/40 bg-panel p-3">
      <select
        value={elegido}
        onChange={(e) => setElegido(e.target.value)}
        className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none"
      >
        {!actual && <option value="">Elegí el servicio…</option>}
        {disponibles.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre} · {s.duracionMin} min
          </option>
        ))}
      </select>
      <p className="text-[11.5px] text-muted">
        La cita toma la duración del servicio nuevo; si pisa la siguiente, conserva la de ahora y te avisamos.
      </p>
      {error && <p className="text-[12px] font-semibold text-warn">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={saving || !elegido}
          className="flex-1 rounded-full bg-accent px-5 py-2.5 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Guardar servicio"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-full border border-line px-4 text-sm text-muted"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
