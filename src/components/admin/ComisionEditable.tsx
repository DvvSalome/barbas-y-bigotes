"use client";

import { PencilIcon, CheckIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarComisionProducto } from "@/lib/actions";
import { sanearComisionPct } from "@/lib/admin-reglas";

// La comisión del producto con edición inline, calcada de PrecioEditable: tap
// sobre el "10% para el barbero" → input → ✓ guarda. Antes cambiarla obligaba a
// borrar y recrear el producto.
export function ComisionEditable({ productoId, pct }: { productoId: string; pct: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(pct));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const n = sanearComisionPct(Number(val));
    if (n === null) {
      setVal(String(pct));
      setError("La comisión va de 0 a 100 (en %).");
      return;
    }
    setError(null);
    if (n === pct) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await actualizarComisionProducto(productoId, n);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar la comisión.");
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(pct));
          setError(null);
          setEditing(true);
        }}
        aria-label="Tocar para editar la comisión del barbero"
        className="inline-flex min-h-11 items-center gap-1 text-[12.5px] text-muted underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent"
      >
        {pct}% para el barbero
        <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={100}
          step={1}
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
          className={`min-h-11 w-16 rounded-lg border bg-bg px-2 text-sm text-ink tabular-nums focus:outline-none ${
            error ? "border-red-500" : "border-accent"
          }`}
        />
        <span className="text-[12.5px] text-muted">% barbero</span>
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          aria-label="Guardar comisión"
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
      {error && <span className="text-[12.5px] leading-tight text-accent-soft">{error}</span>}
    </span>
  );
}
