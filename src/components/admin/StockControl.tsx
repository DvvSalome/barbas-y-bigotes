"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingresarStock, ajustarStock } from "@/lib/actions";
import { sanearCantidad } from "@/lib/admin-reglas";

// Control de stock del producto. Dos gestos distintos, a propósito:
//  · "Entró mercancía" SUMA (es lo que pasa en el local: llegaron 12 aguas).
//  · "Corregir" fija el número contado (el dueño contó y hay otra cantidad).
// Antes no existía ninguno: el stock solo bajaba con las ventas y no había
// forma de volver a subirlo.
export function StockControl({
  productoId,
  stock,
  stockMinimo,
}: {
  productoId: string;
  stock: number;
  stockMinimo: number;
}) {
  const router = useRouter();
  const [modo, setModo] = useState<null | "entrada" | "correccion">(null);
  const [val, setVal] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bajo = stock <= stockMinimo;

  async function enviar() {
    const n = sanearCantidad(val);
    if (n === null || (modo === "entrada" && n <= 0) || (modo === "correccion" && n < 0)) {
      setError(modo === "entrada" ? "¿Cuántas entraron?" : "Poné el número contado.");
      return;
    }
    setGuardando(true);
    const res =
      modo === "entrada"
        ? await ingresarStock({ productoId, cantidad: n })
        : await ajustarStock(productoId, n);
    setGuardando(false);
    if (res.ok) {
      setModo(null);
      setVal("");
      setError(null);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar.");
    }
  }

  if (modo) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-1.5">
          <input
            type="number"
            min={modo === "entrada" ? 1 : 0}
            step={1}
            autoFocus
            value={val}
            onChange={(e) => {
              setVal(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") enviar();
              if (e.key === "Escape") setModo(null);
            }}
            placeholder={modo === "entrada" ? "+ cuántas" : "quedan"}
            aria-label={modo === "entrada" ? "Cuántas unidades entraron" : "Cuántas hay realmente"}
            className="w-[86px] rounded-lg border border-accent/60 bg-bg px-2 py-1 text-sm text-ink tabular-nums focus:outline-none"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={guardando}
            aria-label="Guardar"
            className="grid h-7 w-7 place-items-center rounded-full bg-accent text-xs font-bold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            ✓
          </button>
          <button
            type="button"
            onClick={() => {
              setModo(null);
              setError(null);
            }}
            aria-label="Cancelar"
            className="grid h-7 w-7 place-items-center rounded-full border border-line text-xs text-muted transition hover:text-ink"
          >
            ×
          </button>
        </div>
        {error && <span className="text-[11px] leading-tight text-accent-soft">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="flex items-baseline gap-1">
        <span
          className={`font-display text-[22px] font-extrabold leading-none tabular-nums ${
            bajo ? "text-warn" : "text-ink"
          }`}
        >
          {stock}
        </span>
        <span className="text-[11px] text-muted">en bodega</span>
      </div>
      <button
        type="button"
        onClick={() => {
          setModo("entrada");
          setVal("");
        }}
        title="Llegó mercancía: suma unidades al stock"
        className="rounded-full border border-accent/40 bg-accent/[0.07] px-2.5 py-1 text-[11.5px] font-bold text-accent-soft transition hover:bg-accent/15"
      >
        + Entró
      </button>
      <button
        type="button"
        onClick={() => {
          setModo("correccion");
          setVal(String(stock));
        }}
        title="Conté y hay otra cantidad"
        className="rounded-full border border-line px-2.5 py-1 text-[11.5px] text-muted transition hover:text-ink"
      >
        Corregir
      </button>
    </div>
  );
}
