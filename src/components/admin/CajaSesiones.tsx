"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { abrirCaja, cerrarCaja } from "@/lib/actions";
import { cop, horaBogota, fechaCortaBogota, diasDesde } from "@/lib/format";
import { CashIcon } from "@/components/icons";
import type { CajaSesionSede, MedioPago } from "@/lib/data/queries";

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";



export function CajaSesiones({ cajas, medios }: { cajas: CajaSesionSede[]; medios: MedioPago[] }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {cajas.map((c) => (
        <CajaCard key={c.sede} caja={c} medios={medios} />
      ))}
    </div>
  );
}

function CajaCard({ caja, medios }: { caja: CajaSesionSede; medios: MedioPago[] }) {
  const router = useRouter();
  const abierta = !!caja.sesionId;
  const dias = abierta ? diasDesde(caja.abiertaEn!) : 0;
  const pct = caja.metaDia > 0 ? Math.min(100, Math.round((caja.ingresos / caja.metaDia) * 100)) : 0;

  // Desglose por medio (ordenado como en la config); slugs sin ficha se capitalizan.
  const ordenDe = new Map(medios.map((m) => [m.slug, m.orden]));
  const nombreDe = (slug: string) =>
    medios.find((m) => m.slug === slug)?.nombre ?? slug.charAt(0).toUpperCase() + slug.slice(1);
  const desglose = Object.entries(caja.totales)
    .sort(([a], [b]) => (ordenDe.get(a) ?? 999) - (ordenDe.get(b) ?? 999))
    .map(([slug, t]) => `${cop(t.total)} ${nombreDe(slug).toLowerCase()}`)
    .join(" · ");
  // El esperado del cajón viene YA calculado del servidor (fondo + efectivo +
  // propina efectivo − gastos), el MISMO número que usa el cierre real. Antes se
  // re-derivaba acá como efectivo+propina, sin fondo ni gastos, y engañaba.
  const esperadoEfectivo = caja.esperadoEfectivo;

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
    <div className={`relative overflow-hidden rounded-2xl border bg-panel p-5 transition ${abierta ? "border-ok/30" : "border-line"}`}>
      <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-accent/10 blur-2xl" />
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-accent/40 text-accent">
            <CashIcon className="h-4 w-4" />
          </div>
          <div className="font-display text-2xl">{caja.nombre}</div>
        </div>
        <span
          className={`flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide ${
            abierta ? "bg-ok/15 text-ok" : "bg-ink/10 text-muted"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${abierta ? "bg-ok" : "bg-muted"}`} />
          {abierta
            ? dias === 0
              ? `Abierta · ${horaBogota(caja.abiertaEn!)}`
              : `Abierta desde el ${fechaCortaBogota(caja.abiertaEn!)}`
            : "Cerrada"}
        </span>
      </div>

      {/* Una caja que quedó abierta de días arrastra las ventas de todos esos
          días en "Recaudado", y nadie lo notaba porque el chip solo decía la
          hora. Ahora lo dice y ofrece cerrarla. */}
      {abierta && dias > 0 && (
        <p className="mt-3 rounded-lg border border-warn/35 bg-warn/[0.08] px-3 py-2 text-[12.5px] text-warn">
          Lleva {dias === 1 ? "1 día" : `${dias} días`} sin cerrar: lo de abajo suma todo ese
          período, no solo hoy.
        </p>
      )}

      <div className="mt-4 flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">
            {abierta && dias > 0 ? "Recaudado desde que abrió" : "Recaudado"}
          </div>
          <div className="font-display text-3xl text-accent-soft">{cop(caja.ingresos)}</div>
          <div className="mt-0.5 text-xs text-muted">
            {desglose ? `${desglose} · ` : ""}{caja.citas} citas
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
          <div
            className="h-full rounded-full bg-gradient-to-r from-accent to-accent-soft shadow-[0_0_10px_rgba(210,63,52,0.6)] transition-all"
            style={{ width: `${pct}%` }}
          />
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
            Esperado en efectivo: <b className="text-ink">{cop(esperadoEfectivo)}</b>
            {caja.montoApertura > 0 && <> · base {cop(caja.montoApertura)}</>}
            {caja.propinaEfectivo > 0 && <> · +{cop(caja.propinaEfectivo)} propinas</>}
            {caja.gastos > 0 && <> · −{cop(caja.gastos)} gastos</>}
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
