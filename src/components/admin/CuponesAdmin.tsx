"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCupon, toggleCupon } from "@/lib/actions";
import { cop } from "@/lib/format";
import { TicketIcon } from "@/components/icons";
import type { Cupon } from "@/lib/data/queries";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function CuponesAdmin({ cupones }: { cupones: Cupon[] }) {
  const router = useRouter();
  const [codigo, setCodigo] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState<"porcentaje" | "monto">("porcentaje");
  const [valor, setValor] = useState("");
  const [usosMax, setUsosMax] = useState("");
  const [venceEn, setVenceEn] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await crearCupon({
      codigo,
      descripcion,
      tipo,
      valor: Number(valor) || 0,
      usosMax: usosMax ? Number(usosMax) : null,
      venceEn: venceEn || null,
    });
    setBusy(false);
    if (res.ok) {
      setCodigo(""); setDescripcion(""); setValor(""); setUsosMax(""); setVenceEn("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  async function toggle(cod: string, activo: boolean) {
    await toggleCupon(cod, activo);
    router.refresh();
  }

  return (
    <div className="grid gap-6 md:grid-cols-2">
      <form onSubmit={crear} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <TicketIcon className="h-4 w-4 text-accent" /> Nuevo cupón
        </h3>
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        <input value={codigo} onChange={(e) => setCodigo(e.target.value.toUpperCase())} placeholder="CÓDIGO (ej. BIENVENIDA)" maxLength={24} className={`${fld} uppercase`} />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className={fld} />
        <div className="flex gap-2">
          {(["porcentaje", "monto"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setTipo(t)} className={`flex-1 rounded-lg border px-3 py-1.5 text-xs transition ${tipo === t ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"}`}>
              {t === "porcentaje" ? "Porcentaje (%)" : "Monto fijo ($)"}
            </button>
          ))}
        </div>
        <input type="number" value={valor} onChange={(e) => setValor(e.target.value)} placeholder={tipo === "porcentaje" ? "% de descuento (1-100)" : "Monto en COP"} className={fld} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={usosMax} onChange={(e) => setUsosMax(e.target.value)} placeholder="Usos máx (vacío = ∞)" className={fld} />
          <input type="date" value={venceEn} onChange={(e) => setVenceEn(e.target.value)} className={fld} />
        </div>
        <button disabled={busy} className="rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
          {busy ? "Creando…" : "Crear cupón"}
        </button>
      </form>

      <div>
        <h3 className="mb-3 font-display text-xl">Cupones ({cupones.length})</h3>
        {cupones.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted">Sin cupones todavía.</p>
        ) : (
          <div className="space-y-2">
            {cupones.map((c) => (
              <div key={c.codigo} className={`rounded-xl border bg-panel p-4 transition ${c.activo ? "border-line hover:border-accent/30" : "border-line/60 opacity-70"}`}>
                <div className="flex items-center justify-between">
                  <span className="rounded-md border border-dashed border-accent/40 px-2 py-0.5 font-display text-lg tracking-wide text-accent-soft">
                    {c.codigo}
                  </span>
                  <button
                    onClick={() => toggle(c.codigo, !c.activo)}
                    className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition ${c.activo ? "bg-ok/15 text-ok" : "bg-ink/10 text-muted"}`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${c.activo ? "bg-ok" : "bg-muted"}`} />
                    {c.activo ? "Activo" : "Inactivo"}
                  </button>
                </div>
                <div className="mt-1 text-sm text-accent-soft">
                  {c.tipo === "porcentaje" ? `${c.valor}% de descuento` : `${cop(c.valor)} de descuento`}
                </div>
                {c.descripcion ? <div className="text-xs text-muted">{c.descripcion}</div> : null}
                <div className="mt-1 text-xs text-muted">
                  Usos: {c.usos}{c.usosMax !== null ? ` / ${c.usosMax}` : ""}
                  {c.venceEn ? ` · vence ${c.venceEn}` : ""}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
