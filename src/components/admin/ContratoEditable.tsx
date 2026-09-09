"use client";

import { botonClases } from "@/components/ui/Boton";
import { PencilIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarContratoBarbero } from "@/lib/actions";
import { sanearCop, sanearComisionPct } from "@/lib/admin-reglas";
import { cop } from "@/lib/format";
import type { TipoContrato } from "@/lib/data/types";

// Contrato del barbero, editable donde se lee. Dos formas excluyentes:
// porcentaje de comisión o arriendo de silla. Es el dato que usa el cobro para
// repartir, así que el resumen (cerrado) tiene que leerse de un vistazo.
export function ContratoEditable({
  barberoId,
  nombre,
  tipo,
  comisionPct,
  arriendoMensual,
}: {
  barberoId: string;
  nombre: string;
  tipo: TipoContrato;
  comisionPct?: number;
  arriendoMensual?: number;
}) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [t, setT] = useState<TipoContrato>(tipo);
  const [pct, setPct] = useState(comisionPct != null ? String(comisionPct) : "50");
  const [arr, setArr] = useState(arriendoMensual != null ? String(arriendoMensual) : "");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function guardar() {
    if (t === "porcentaje" && sanearComisionPct(pct) === null) {
      setError("La comisión va entre 0 y 100.");
      return;
    }
    if (t === "arriendo") {
      const m = sanearCop(arr);
      if (m === null || m <= 0) {
        setError("El arriendo va en pesos, mayor a $0.");
        return;
      }
    }
    setGuardando(true);
    const res = await actualizarContratoBarbero({
      barberoId,
      tipo: t,
      comisionPct: t === "porcentaje" ? Number(pct) : null,
      arriendoMensual: t === "arriendo" ? Number(arr) : null,
    });
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
          setT(tipo);
          setPct(comisionPct != null ? String(comisionPct) : "50");
          setArr(arriendoMensual != null ? String(arriendoMensual) : "");
          setError(null);
          setEditando(true);
        }}
        title={`Toca para cambiar el contrato de ${nombre}`}
        className="inline-flex items-center gap-2 rounded-lg px-2.5 py-2 transition hover:bg-elevated"
      >
        {tipo === "porcentaje" ? (
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-accent/35 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-accent-soft">
              Comisión
            </span>
            <span className="font-semibold text-ink tabular-nums">{comisionPct ?? 0}%</span>
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5">
            <span className="rounded-full border border-line px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-muted">
              Arriendo
            </span>
            <span className="font-semibold text-ink tabular-nums">
              {arriendoMensual != null ? `${cop(arriendoMensual)}/mes` : "sin monto"}
            </span>
          </span>
        )}
        {/* ✎ SIEMPRE visible: en el celular no hay hover, así que el chip del
            contrato parecía una etiqueta muerta y el dueño no sabía que se toca. */}
        <PencilIcon className="h-3.5 w-3.5 shrink-0 text-muted" />
      </button>
    );
  }

  return (
    <div className="flex flex-col items-start gap-2 rounded-xl border border-accent/40 bg-elevated p-3 text-left">
      {/* Las dos formas son excluyentes: se elige una y solo se pide su dato. */}
      <div className="flex gap-1.5" role="group" aria-label="Tipo de contrato">
        {(["porcentaje", "arriendo"] as const).map((op) => (
          <button
            key={op}
            type="button"
            onClick={() => {
              setT(op);
              setError(null);
            }}
            className={`rounded-full border px-3 py-1 text-[12px] font-bold uppercase tracking-wide transition ${
              t === op ? "border-ink bg-ink text-bg" : "border-line text-muted hover:text-ink"
            }`}
          >
            {op === "porcentaje" ? "Comisión" : "Arriendo"}
          </button>
        ))}
      </div>

      {t === "porcentaje" ? (
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Se lleva
          <input
            type="number"
            min={0}
            max={100}
            step={1}
            autoFocus
            value={pct}
            onChange={(e) => {
              setPct(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            aria-label="Porcentaje de comisión"
            className="w-20 rounded-lg border border-accent/60 bg-bg px-2 py-1 text-sm text-ink tabular-nums focus:outline-none"
          />
          % de lo que cobra
        </label>
      ) : (
        <label className="flex items-center gap-2 text-[12.5px] text-muted">
          Paga
          <input
            type="number"
            min={1}
            step={1000}
            autoFocus
            value={arr}
            onChange={(e) => {
              setArr(e.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(e) => e.key === "Enter" && guardar()}
            aria-label="Arriendo mensual en pesos"
            placeholder="500000"
            className="w-28 rounded-lg border border-accent/60 bg-bg px-2 py-1 text-sm text-ink tabular-nums focus:outline-none"
          />
          al mes por la silla
        </label>
      )}

      {error && <p className="text-[12px] text-accent-soft">{error}</p>}

      <div className="flex gap-2">
        <button
          type="button"
          onClick={guardar}
          disabled={guardando}
          className={botonClases("primario")}
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setError(null);
          }}
          className="rounded-full border border-line px-4 py-2.5 text-[12px] text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
