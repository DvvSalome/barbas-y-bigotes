"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ingresarStock, ajustarStock } from "@/lib/actions";
import { sanearCantidad } from "@/lib/admin-reglas";

// Control de stock del producto. Dos gestos distintos, a propósito:
//  · "Entró mercancía" SUMA (es lo que pasa en el local: llegaron 12 aguas).
//  · "Corregir" fija el número contado (el dueño contó y hay otra cantidad).
// El número en bodega lo muestra la tarjeta; acá solo viven las dos acciones,
// a 44 px y con texto legible (auditoría del 6-sep).
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
      <div className="flex w-full flex-col gap-1.5">
        {/* En el celular no hay hover: la diferencia clave (sumar vs fijar) se dice
            con palabras, no en un title. Evita descuadrar el stock por confusión. */}
        <p className="text-[12.5px] font-semibold text-ink">
          {modo === "entrada"
            ? `¿Cuántas ENTRARON? (se suman a ${stock})`
            : "¿Cuántas hay REALMENTE? (fija el total contado)"}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
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
            className="min-h-11 w-[96px] rounded-xl border border-accent/60 bg-bg px-3 text-sm text-ink tabular-nums focus:outline-none"
          />
          <button
            type="button"
            onClick={enviar}
            disabled={guardando}
            aria-label="Guardar"
            className={botonClases("primario")}
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
            className="grid h-11 w-11 place-items-center rounded-full border border-line text-sm text-muted transition hover:text-ink"
          >
            ×
          </button>
        </div>
        {error && <span className="text-[12.5px] leading-tight text-accent-soft">{error}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => {
          setModo("entrada");
          setVal("");
        }}
        className={`inline-flex min-h-11 items-center rounded-full border px-4 text-[13px] font-bold transition ${
          bajo
            ? "border-warn/50 bg-warn/10 text-warn hover:bg-warn/15"
            : "border-accent/40 bg-accent/[0.07] text-accent-soft hover:bg-accent/15"
        }`}
      >
        + Entró
      </button>
      <button
        type="button"
        onClick={() => {
          setModo("correccion");
          setVal(String(stock));
        }}
        className="inline-flex min-h-11 items-center rounded-full border border-line px-4 text-[13px] text-muted transition hover:text-ink"
      >
        Corregir
      </button>
    </div>
  );
}
