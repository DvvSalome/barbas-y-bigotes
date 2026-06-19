"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirCaja, cerrarCaja } from "@/lib/actions";
import { cop } from "@/lib/format";
import type { CajaSesionSede } from "@/lib/data/queries";

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

function desdeHora(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "am" : "pm";
  h = ((h + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

export function CajaSesiones({ cajas }: { cajas: CajaSesionSede[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cajas.map((c) => (
        <CajaCard key={c.sede} caja={c} />
      ))}
    </div>
  );
}

function CajaCard({ caja }: { caja: CajaSesionSede }) {
  const router = useRouter();
  const abierta = !!caja.sesionId;
  const pct = caja.metaDia > 0 ? Math.min(100, Math.round((caja.ingresos / caja.metaDia) * 100)) : 0;

  const [openForm, setOpenForm] = useState(false);
  const [meta, setMeta] = useState("");
  const [apertura, setApertura] = useState("");
  const [contado, setContado] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function abrir(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await abrirCaja({ sede: caja.sede, metaDia: Number(meta) || 0, montoApertura: Number(apertura) || 0 });
    setBusy(false);
    if (res.ok) {
      setOpenForm(false);
      setMeta("");
      setApertura("");
      router.refresh();
    } else setErr(res.error ?? "No se pudo abrir");
  }

  async function cerrar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await cerrarCaja({
      sesionId: caja.sesionId!,
      sede: caja.sede,
      abiertaEnISO: caja.abiertaEn!,
      efectivoContado: Number(contado) || 0,
      nota,
    });
    setBusy(false);
    if (res.ok) {
      setOpenForm(false);
      setContado("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "No se pudo cerrar");
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex items-center justify-between">
        <div className="font-display text-2xl">{caja.nombre}</div>
        <span
          className={`rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            abierta ? "bg-emerald-500/15 text-emerald-400" : "bg-white/10 text-muted"
          }`}
        >
          {abierta ? `Caja abierta · ${desdeHora(caja.abiertaEn!)}` : "Caja cerrada"}
        </span>
      </div>

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">Recaudado</div>
          <div className="font-display text-3xl text-accent-soft">{cop(caja.ingresos)}</div>
          <div className="mt-0.5 text-xs text-muted">
            {cop(caja.efectivo)} efectivo · {cop(caja.datafono)} datáfono · {caja.citas} citas
          </div>
        </div>
        {abierta && caja.metaDia > 0 && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Meta</div>
            <div className="font-display text-xl">{cop(caja.metaDia)}</div>
            <div className="text-xs text-accent-soft">{pct}%</div>
          </div>
        )}
      </div>

      {abierta && caja.metaDia > 0 && (
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-bg">
          <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {err && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>
      )}

      {!openForm ? (
        <button
          onClick={() => setOpenForm(true)}
          className={`mt-4 w-full rounded-full px-5 py-2.5 text-sm font-semibold uppercase tracking-wide transition ${
            abierta
              ? "border border-line text-muted hover:text-ink"
              : "bg-accent text-on-accent hover:bg-accent-soft"
          }`}
        >
          {abierta ? "Cerrar caja" : "Abrir caja"}
        </button>
      ) : abierta ? (
        <form onSubmit={cerrar} className="mt-4 space-y-2.5">
          <div className="text-xs text-muted">
            Esperado en efectivo: <b className="text-ink">{cop(caja.efectivo)}</b>
          </div>
          <input
            type="number"
            value={contado}
            onChange={(e) => setContado(e.target.value)}
            placeholder="Efectivo contado en caja"
            className={fld}
          />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota de cierre (opcional)" className={fld} />
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
              {busy ? "Cerrando…" : "Confirmar cierre"}
            </button>
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-full border border-line px-5 py-2 text-xs text-muted">
              Cancelar
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={abrir} className="mt-4 space-y-2.5">
          <input type="number" value={meta} onChange={(e) => setMeta(e.target.value)} placeholder="Meta del día (COP)" className={fld} />
          <input type="number" value={apertura} onChange={(e) => setApertura(e.target.value)} placeholder="Base / monto de apertura (opcional)" className={fld} />
          <div className="flex gap-2">
            <button disabled={busy} className="rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
              {busy ? "Abriendo…" : "Abrir caja"}
            </button>
            <button type="button" onClick={() => setOpenForm(false)} className="rounded-full border border-line px-5 py-2 text-xs text-muted">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
