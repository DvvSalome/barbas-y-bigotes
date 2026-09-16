"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarGasto } from "@/lib/actions";
import { sanearCop } from "@/lib/admin-reglas";
import { CATS_GASTO } from "@/components/admin/CuadreForms";

// "Compré una botella de agua para el local": el gasto se anota en el momento y
// desde el mostrador, no cuando el admin se acuerde en el cuadre. Cae en la misma
// tabla `gastos` que ve el cierre de caja (descuenta del efectivo esperado), así
// que el cajón cuadra sin llamadas de "¿y estos $5.000?".
export function GastoRapido({ sede, medios = [] }: { sede: string; medios?: { slug: string; nombre: string }[] }) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [cat, setCat] = useState("");
  const [monto, setMonto] = useState("");
  const [desc, setDesc] = useState("");
  const [medio, setMedio] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  async function guardar() {
    const n = sanearCop(monto);
    if (n === null || n <= 0) {
      setError("Pon el monto en pesos, mayor a $0, sin decimales.");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await registrarGasto({ sede, categoria: cat || "Otro", monto: n, descripcion: desc.trim(), medio });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar el gasto.");
      return;
    }
    setHecho(`${cat || "Otro"} · $${n.toLocaleString("es-CO")} — queda en el cierre de caja.`);
    setCat("");
    setMonto("");
    setDesc("");
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          setHecho(null);
        }}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-[13px] font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
      >
        + Registrar un gasto del local (agua, aseo, un arreglo…)
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-ink">Gasto del local</h3>
        <button type="button" onClick={() => setAbierto(false)} className="text-xs text-muted hover:text-ink">
          Cerrar
        </button>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {CATS_GASTO.map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCat(cat === c ? "" : c)}
            className={`min-h-[38px] rounded-full border px-3 text-xs font-semibold transition ${
              cat === c ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
            }`}
          >
            {c}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          inputMode="numeric"
          min={1}
          step={1}
          value={monto}
          onChange={(e) => setMonto(e.target.value)}
          placeholder="Monto en $"
          className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink tabular-nums placeholder:text-muted focus:border-accent focus:outline-none"
        />
        <input
          value={desc}
          onChange={(e) => setDesc(e.target.value)}
          maxLength={120}
          placeholder="Qué fue (ej: botella de agua)"
          className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>
      {/* Con qué se pagó: solo el efectivo descuenta del cajón del cierre. */}
      {medios.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {medios.map((m) => (
            <button
              key={m.slug}
              type="button"
              onClick={() => setMedio(m.slug)}
              className={`min-h-[38px] rounded-full border px-3 text-xs font-semibold transition ${
                medio === m.slug ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {m.nombre}
            </button>
          ))}
        </div>
      )}
      {error && <p className="text-[12px] font-semibold text-warn">{error}</p>}
      {hecho && <p className="text-[12px] text-muted">Gasto guardado ✓ — {hecho}</p>}
      <button
        type="button"
        onClick={guardar}
        disabled={saving}
        className="w-full rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar gasto"}
      </button>
    </div>
  );
}
