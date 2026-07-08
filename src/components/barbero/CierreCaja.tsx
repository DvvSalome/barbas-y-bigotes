"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cerrarCajaSede } from "@/lib/actions";
import { cop } from "@/lib/format";
import type { CajaSedeEstado } from "@/lib/data/queries";

// Hora civil en Bogotá sin depender del TZ del proceso (server/cliente en UTC).
function horaBogota(iso: string) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn =
  "rounded-full bg-gradient-to-b from-accent-soft to-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 disabled:opacity-50 disabled:shadow-none";

export function CierreCaja({ caja }: { caja: CajaSedeEstado }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<{ total: number; diferencia: number } | null>(null);

  // Cierre confirmado: pantalla de resumen.
  if (hecho) {
    const cuadra = hecho.diferencia === 0;
    return (
      <section className="rounded-2xl border border-line bg-panel p-5">
        <h3 className="font-display text-xl text-ink">Caja cerrada ✓</h3>
        <p className="mt-2 text-sm text-muted">
          Total del día <span className="font-semibold text-ink">{cop(hecho.total)}</span> ·{" "}
          {cuadra ? (
            <span className="font-semibold text-ok">cuadra exacto</span>
          ) : (
            <span className="font-semibold text-warn">
              diferencia {hecho.diferencia > 0 ? "+" : ""}
              {cop(hecho.diferencia)}
            </span>
          )}
        </p>
      </section>
    );
  }

  // Sin caja abierta: mensaje sutil (la caja se abre sola con la primera venta).
  if (!caja) {
    return (
      <p className="text-xs text-muted">La caja se abre sola con la primera venta del día.</p>
    );
  }

  const esperado = caja.esperadoEfectivo;
  const contadoNum = Math.max(0, Math.floor(Number(contado) || 0));
  const diferencia = contadoNum - esperado;

  async function confirmar(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const res = await cerrarCajaSede({ efectivoContado: contadoNum, nota });
    setSaving(false);
    if (res.ok) {
      setHecho({ total: res.total ?? 0, diferencia: res.diferencia ?? 0 });
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo cerrar la caja.");
    }
  }

  return (
    <section className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-bold uppercase text-ink">Caja de la sede</h3>
        <span className="rounded-full bg-ok/10 px-2.5 py-0.5 font-display text-[10px] font-bold uppercase tracking-wide text-ok">
          Abierta desde {horaBogota(caja.abiertaEn)}
        </span>
      </div>
      <div className="mt-4 rounded-xl border border-line bg-elevated p-4 text-center">
        <div className="font-display text-[11px] font-bold uppercase tracking-[0.18em] text-muted">
          Esperado en efectivo
        </div>
        <div className="mt-1 font-display text-4xl font-extrabold tabular-nums text-ink">
          {cop(esperado)}
        </div>
      </div>

      {!abierto ? (
        <button className={`${btn} mt-4`} onClick={() => setAbierto(true)}>
          Cerrar caja
        </button>
      ) : (
        <form onSubmit={confirmar} className="mt-4 space-y-3">
          <label className="block text-sm text-muted">
            ¿Cuánto contaste en efectivo?
            <input
              type="number"
              inputMode="numeric"
              min={0}
              value={contado}
              onChange={(e) => setContado(e.target.value)}
              placeholder="Efectivo contado (COP)"
              className={`${fld} mt-1`}
              autoFocus
            />
          </label>
          <input
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="Nota del cierre (opcional)"
            className={fld}
          />
          <p className="text-sm tabular-nums">
            Diferencia:{" "}
            <span className={diferencia === 0 ? "font-semibold text-ok" : "font-semibold text-warn"}>
              {diferencia > 0 ? "+" : ""}
              {cop(diferencia)}
            </span>
            {diferencia !== 0 && (
              <span className="text-muted"> ({diferencia > 0 ? "sobra" : "falta"})</span>
            )}
          </p>
          {error && <p className="text-sm text-warn">{error}</p>}
          <div className="flex items-center gap-3">
            <button disabled={saving} className={btn}>
              {saving ? "Cerrando…" : "Confirmar cierre"}
            </button>
            <button
              type="button"
              onClick={() => setAbierto(false)}
              className="text-xs font-semibold uppercase tracking-wide text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
