"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarPrecioProducto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { cop } from "@/lib/format";

// Precio con edición inline: tap sobre el monto → input numérico → Enter o ✓
// guarda. Sin modal ni pantalla aparte; se edita donde se lee.
export function PrecioEditable({ productoId, precio }: { productoId: string; precio: number }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [val, setVal] = useState(String(precio));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  async function guardar() {
    // Borrar el campo dejaba Number("")=0 → se guardaba el producto GRATIS;
    // un decimal se truncaba en silencio. sanearCop rechaza vacío, negativo,
    // decimal y no-numérico; además exigimos > 0 (un producto no vale $0).
    const n = sanearCop(val);
    if (n === null || n <= 0) {
      // Input inválido: no guardamos y restauramos el valor previo a la vista.
      setVal(String(precio));
      setError(true);
      return;
    }
    setError(false);
    if (n === precio) {
      setEditing(false);
      return;
    }
    setSaving(true);
    const res = await actualizarPrecioProducto(productoId, n);
    setSaving(false);
    if (res.ok) {
      setEditing(false);
      router.refresh();
    } else {
      alert(res.error ?? "No se pudo guardar el precio.");
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(precio));
          setError(false);
          setEditing(true);
        }}
        title="Toca para editar el precio"
        className="group inline-flex items-center gap-1 tabular-nums underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent"
      >
        {cop(precio)}
        <span aria-hidden className="text-[10px] text-muted opacity-0 transition group-hover:opacity-100">✎</span>
      </button>
    );
  }

  return (
    <span className="inline-flex items-center gap-1">
      <input
        type="number"
        min={1}
        step={1}
        autoFocus
        value={val}
        onChange={(e) => { setVal(e.target.value); if (error) setError(false); }}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-invalid={error}
        title={error ? "Poné un precio válido en pesos (mayor a $0, sin decimales)." : undefined}
        className={`w-24 rounded-lg border bg-bg px-2 py-1 text-sm text-ink tabular-nums focus:outline-none ${error ? "border-red-500" : "border-accent"}`}
      />
      <button
        type="button"
        onClick={guardar}
        disabled={saving}
        aria-label="Guardar precio"
        className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        ✓
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        aria-label="Cancelar edición"
        className="grid h-7 w-7 place-items-center rounded-full border border-line text-xs text-muted transition hover:text-ink"
      >
        ×
      </button>
    </span>
  );
}
