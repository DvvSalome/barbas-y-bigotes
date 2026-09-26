"use client";

import { chipFiltroClases } from "@/components/ui/Chip";
import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearCupon, toggleCupon } from "@/lib/actions";
import { cop, plataEnCampo, digitosDePlata } from "@/lib/format";
import { TicketIcon } from "@/components/icons";
import type { Cupon } from "@/lib/data/queries";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

const MESES = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
// venceEn llega como "YYYY-MM-DD"; en crudo se leía "de sistema". Lo mostramos "15 ago 2026".
function fechaCorta(ymd: string) {
  const [y, m, d] = ymd.split("-").map(Number);
  return MESES[m - 1] ? `${d} ${MESES[m - 1]} ${y}` : ymd;
}

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
  const [okMsg, setOkMsg] = useState(false);
  // Estado del toggle: antes se ignoraba res.ok y no había feedback — el dueño
  // creía que apagaba un cupón y si fallaba no se enteraba (descuentos fantasma).
  const [toggleErr, setToggleErr] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);

  // Fecha de HOY en Bogotá (día civil) para marcar cupones vencidos.
  const hoyBogota = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOkMsg(false);
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
      setOkMsg(true);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  async function toggle(cod: string, activo: boolean) {
    setToggling(cod);
    setToggleErr(null);
    const res = await toggleCupon(cod, activo);
    setToggling(null);
    if (res.ok) router.refresh();
    else setToggleErr(res.error ?? "No se pudo cambiar el cupón.");
  }

  return (
    // Patrón del panel: lo que se MIRA (cupones) a la izquierda; lo que se HACE
    // (crear cupón) fijo a la derecha en escritorio. En móvil el form va primero.
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <aside className="order-first lg:order-last lg:sticky lg:top-28">
      <form onSubmit={crear} className="space-y-3 rounded-2xl border border-line bg-panel p-5">
        <h3 className="flex items-center gap-2 font-display text-xl">
          <TicketIcon className="h-4 w-4 text-accent" /> Nuevo cupón
        </h3>
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        {okMsg && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Cupón creado ✓ — ya aparece en la lista.</div>}
        <input value={codigo} onChange={(e) => { setCodigo(e.target.value.toUpperCase()); if (okMsg) setOkMsg(false); }} placeholder="CÓDIGO (ej. BIENVENIDA)" maxLength={24} className={`${fld} uppercase`} />
        <input value={descripcion} onChange={(e) => setDescripcion(e.target.value)} placeholder="Descripción (opcional)" className={fld} />
        <div className="flex gap-2">
          {(["porcentaje", "monto"] as const).map((t) => (
            <button type="button" key={t} onClick={() => setTipo(t)} className={chipFiltroClases(tipo === t, "flex-1")}>
              {t === "porcentaje" ? "Porcentaje (%)" : "Monto fijo ($)"}
            </button>
          ))}
        </div>
        <input type="text" inputMode="numeric" value={tipo === "porcentaje" ? valor : plataEnCampo(valor)} onChange={(e) => setValor(digitosDePlata(e.target.value))} placeholder={tipo === "porcentaje" ? "% de descuento (1-100)" : "Descuento en pesos, ej. $ 5.000"} className={fld} />
        <div className="grid grid-cols-2 gap-2">
          <input type="number" value={usosMax} onChange={(e) => setUsosMax(e.target.value)} placeholder="Usos máx (vacío = ∞)" className={fld} />
          <input type="date" value={venceEn} onChange={(e) => setVenceEn(e.target.value)} className={fld} />
        </div>
        <button disabled={busy} className={botonClases("primario")}>
          {busy ? "Creando…" : "Crear cupón"}
        </button>
      </form>
      </aside>

      <div className="min-w-0">
        <h3 className="mb-3 font-display text-xl">Cupones ({cupones.length})</h3>
        {toggleErr && <div className="mb-2 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{toggleErr}</div>}
        {cupones.length === 0 ? (
          <p className="rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted">Sin cupones todavía.</p>
        ) : (
          <div className="space-y-2">
            {cupones.map((c) => {
              const vencido = !!c.venceEn && c.venceEn < hoyBogota;
              const agotado = c.usosMax !== null && c.usos >= c.usosMax;
              // "efectivo" = realmente aplica en el cobro (prendido, no vencido, no agotado).
              const efectivo = c.activo && !vencido && !agotado;
              return (
                <div key={c.codigo} className={`rounded-xl border bg-panel p-4 transition ${efectivo ? "border-line hover:border-accent/30" : "border-line/60 opacity-70"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-2">
                      <span className="rounded-md border border-dashed border-accent/40 px-2 py-0.5 font-display text-lg tracking-wide text-accent-soft">
                        {c.codigo}
                      </span>
                      {(vencido || agotado) && (
                        <span className="rounded-full bg-warn/15 px-2 py-0.5 text-[12px] font-bold uppercase tracking-wide text-warn">
                          {vencido ? "Vencido" : "Agotado"}
                        </span>
                      )}
                    </span>
                    <button
                      onClick={() => toggle(c.codigo, !c.activo)}
                      disabled={toggling === c.codigo}
                      className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-semibold uppercase tracking-wide transition disabled:opacity-50 ${c.activo ? "bg-ok/15 text-ok" : "bg-ink/10 text-muted"}`}
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
                    {c.venceEn ? ` · vence ${fechaCorta(c.venceEn)}` : ""}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
