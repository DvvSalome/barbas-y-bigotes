"use client";

import { PencilIcon, CheckIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarDuracionServicio } from "@/lib/actions";
import { sanearDuracionMin } from "@/lib/admin-reglas";

// Duración con edición inline, mismo gesto que el precio: tap sobre los minutos →
// input → Enter o ✓. Va acá y no en una pantalla aparte porque es el número que se
// mira junto al precio cuando el dueño revisa el catálogo.
//
// Importa de verdad: esta cifra es la que bloquea la silla y la que decide qué
// turnos se le ofrecen al cliente. Con la barba en 30 minutos cuando toma 20, cada
// barba regalaba 10 minutos de agenda.
export function DuracionEditable({ servicioId, min }: { servicioId: string; min: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(min));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    // Mismo saneo que el servidor: vacío, decimal o fuera de rango no pasa. Una
    // duración de 0 dejaría una cita que no bloquea nada (dos clientes, una silla).
    const n = sanearDuracionMin(val);
    if (n === null) {
      setVal(String(min));
      setError("Entre 5 minutos y 8 horas.");
      return;
    }
    setError(null);
    if (n === min) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await actualizarDuracionServicio(servicioId, n);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar la duración.");
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(min));
          setError(null);
          setEditing(true);
        }}
        aria-label={`Duración: ${min} minutos. Tocar para cambiar`}
        className="inline-flex min-h-11 items-center gap-1 text-[12px] text-muted underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent hover:text-ink"
      >
        <span className="tabular-nums">{min} min</span>
        <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex items-center gap-1.5">
        <input
          type="number"
          min={5}
          max={480}
          step={5}
          autoFocus
          value={val}
          onChange={(e) => {
            setVal(e.target.value);
            if (error) setError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") guardar();
            if (e.key === "Escape") setEditing(false);
          }}
          aria-invalid={!!error}
          aria-label="Minutos"
          className={`min-h-11 w-20 rounded-lg border bg-bg px-2 text-sm text-ink tabular-nums focus:outline-none ${
            error ? "border-red-500" : "border-accent"
          }`}
        />
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          aria-label="Guardar duración"
          className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditing(false);
            setError(null);
          }}
          aria-label="Cancelar edición"
          className="grid h-11 w-11 place-items-center rounded-full border border-line text-sm text-muted transition hover:text-ink"
        >
          ×
        </button>
      </span>
      {error && <span className="text-[12px] leading-tight text-accent-soft">{error}</span>}
    </span>
  );
}
