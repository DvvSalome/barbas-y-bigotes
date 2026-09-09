"use client";

import { botonClases } from "@/components/ui/Boton";
import { PencilIcon, CheckIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarPrecioServicioSede } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { cop } from "@/lib/format";

// Precio de un servicio EN UNA SEDE, editable donde se lee: toque sobre el monto
// → input → Enter o ✓ guarda. Sin modal ni pantalla aparte.
// `precio` en null = la sede todavía no cobra ese servicio; al guardar se crea la
// fila (upsert), que es como se habilita.
export function PrecioSedeEditable({
  servicioId,
  sedeId,
  precio,
  etiqueta,
}: {
  servicioId: string;
  sedeId: string;
  precio: number | null;
  etiqueta: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(precio != null ? String(precio) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    const n = sanearCop(val);
    if (n === null || n <= 0) {
      setError("Poné un precio en pesos, sin decimales y mayor a $0.");
      return;
    }
    if (n === precio) {
      setEditando(false);
      setError(null);
      return;
    }
    setGuardando(true);
    const res = await actualizarPrecioServicioSede(servicioId, sedeId, n);
    setGuardando(false);
    if (res.ok) {
      setEditando(false);
      setError(null);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar.");
    }
  }

  if (!editando) {
    return (
      <button
        type="button"
        onClick={() => {
          setVal(precio != null ? String(precio) : "");
          setError(null);
          setEditando(true);
        }}
        title={`Toca para editar el precio en ${etiqueta}`}
        className="group inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 tabular-nums transition hover:bg-elevated"
      >
        {precio != null ? (
          <span className="font-semibold text-ink underline decoration-dotted decoration-line underline-offset-4 transition group-hover:decoration-accent">
            {cop(precio)}
          </span>
        ) : (
          <span className="text-[12.5px] text-muted underline decoration-dotted decoration-line underline-offset-4 transition group-hover:decoration-accent">
            Sin precio
          </span>
        )}
        <span aria-hidden className="text-[12px] text-muted opacity-0 transition group-hover:opacity-100">
          <PencilIcon className="h-3.5 w-3.5 text-muted" />
        </span>
      </button>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1">
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
            if (e.key === "Escape") setEditando(false);
          }}
          aria-invalid={!!error}
          aria-label={`Precio en ${etiqueta}`}
          className={`w-24 rounded-lg border bg-bg px-2 py-1 text-sm text-ink tabular-nums focus:outline-none ${
            error ? "border-accent" : "border-accent/60"
          }`}
        />
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          aria-label="Guardar precio"
          className={botonClases("primario")}
        >
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setError(null);
          }}
          aria-label="Cancelar"
          className="grid h-7 w-7 place-items-center rounded-full border border-line text-xs text-muted transition hover:text-ink"
        >
          ×
        </button>
      </span>
      {error && <span className="max-w-[190px] text-right text-[12px] leading-tight text-accent-soft">{error}</span>}
    </span>
  );
}
