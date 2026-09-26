"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon, CheckIcon } from "@/components/icons";
import { botonClases } from "@/components/ui/Boton";
import type { ActionResult } from "@/lib/actions";

/*
  El nombre, editable donde se lee (pedido del administrador: "no me deja
  cambiar el nombre de los productos" / "de los servicios ya creados"). Mismo
  gesto que PrecioEditable: el texto con el lápiz siempre visible, un toque abre
  el campo, Enter o ✓ guarda y Escape cancela.

  `gemelo`: el mismo producto en la otra sede. Aparece la casilla "Cambiar
  también en…", marcada: los productos de las dos sedes se llaman igual, y
  renombrar uno solo los separaría en el reporte y en las métricas.
*/
export function NombreEditable({
  nombre,
  max,
  que = "nombre",
  gemelo,
  onGuardar,
  className = "",
}: {
  nombre: string;
  max: number;
  /** Para el lector de pantalla: "nombre del producto", "nombre del servicio". */
  que?: string;
  gemelo?: { texto: string };
  onGuardar: (nombre: string, tambienGemelo: boolean) => Promise<ActionResult>;
  className?: string;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(nombre);
  const [gem, setGem] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  async function guardar() {
    const limpio = val.trim().replace(/\s+/g, " ");
    if (!limpio) return setErr("Pon un nombre.");
    if (limpio.length > max) return setErr(`Hasta ${max} caracteres.`);
    if (limpio === nombre && !(gemelo && gem)) return setEditando(false);
    setBusy(true);
    setErr(null);
    const res = await onGuardar(limpio, !!gemelo && gem);
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      setAviso(res.aviso ?? null);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar el nombre.");
  }

  if (!editando) {
    return (
      <span className={`inline-flex flex-col items-start ${className}`}>
        <button
          type="button"
          onClick={() => {
            setVal(nombre);
            setErr(null);
            setAviso(null);
            setGem(true);
            setEditando(true);
          }}
          aria-label={`Tocar para cambiar el ${que}`}
          className="inline-flex min-h-11 items-center gap-1.5 text-left underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent"
        >
          <span className="min-w-0">{nombre}</span>
          <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
        </button>
        {aviso && <span className="text-[12.5px] leading-snug text-warn">{aviso}</span>}
      </span>
    );
  }

  return (
    <span className={`flex w-full flex-col gap-1.5 ${className}`}>
      <span className="flex w-full items-center gap-1.5">
        <input
          value={val}
          autoFocus
          maxLength={max}
          aria-label={`Nuevo ${que}`}
          aria-invalid={!!err}
          onChange={(e) => {
            setVal(e.target.value);
            if (err) setErr(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              guardar();
            }
            if (e.key === "Escape") {
              // Sin esto, la Hoja también escucha el Escape y se cierra entera.
              e.stopPropagation();
              e.nativeEvent.stopImmediatePropagation();
              setEditando(false);
            }
          }}
          className={`min-h-11 min-w-0 flex-1 rounded-lg border bg-bg px-3 text-[15px] text-ink focus:outline-none ${
            err ? "border-red-500" : "border-accent"
          }`}
        />
        <button type="button" onClick={guardar} disabled={busy} aria-label={`Guardar ${que}`} className={botonClases("primario")}>
          <CheckIcon className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={() => setEditando(false)}
          aria-label="Cancelar"
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-line text-sm text-muted transition hover:text-ink"
        >
          ×
        </button>
      </span>
      {gemelo && (
        <label className="flex min-h-11 cursor-pointer items-center gap-2.5 text-[13px] text-ink">
          <input
            type="checkbox"
            checked={gem}
            onChange={(e) => setGem(e.target.checked)}
            className="h-5 w-5 shrink-0 accent-[var(--color-accent)]"
          />
          {gemelo.texto}
        </label>
      )}
      {err && <span className="text-[12.5px] leading-tight text-accent-soft">{err}</span>}
    </span>
  );
}
