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
  // Mensaje de error (null = sin error). Antes era un booleano + un title de
  // hover invisible en el celular; ahora el motivo se muestra inline.
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    // Borrar el campo dejaba Number("")=0 → se guardaba el producto GRATIS;
    // un decimal se truncaba en silencio. sanearCop rechaza vacío, negativo,
    // decimal y no-numérico; además exigimos > 0 (un producto no vale $0).
    const n = sanearCop(val);
    if (n === null || n <= 0) {
      setVal(String(precio));
      setError("Poné un precio en pesos, mayor a $0, sin decimales.");
      return;
    }
    setError(null);
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
      // Antes un alert() nativo (patrón único que rompía la estética); ahora el
      // error va inline como en el resto del inventario.
      setError(res.error ?? "No se pudo guardar el precio.");
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(String(precio));
          setError(null);
          setEditing(true);
        }}
        aria-label="Tocar para editar el precio"
        className="inline-flex min-h-11 items-center gap-1 tabular-nums underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent"
      >
        {cop(precio)}
        {/* Lápiz SIEMPRE visible: en el celular no hay hover, así que si estaba
            oculto el dueño no sabía que el precio se toca para cambiarlo. */}
        <span aria-hidden className="text-[12.5px] text-muted">✎</span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <span className="inline-flex flex-wrap items-center gap-1.5">
        <input
          type="number"
          min={1}
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
          className={`min-h-11 w-24 rounded-lg border bg-bg px-2 text-sm text-ink tabular-nums focus:outline-none ${
            error ? "border-red-500" : "border-accent"
          }`}
        />
        <button
          type="button"
          onClick={guardar}
          disabled={saving}
          aria-label="Guardar precio"
          className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          ✓
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
