"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { guardarConfigTarjeta } from "@/lib/actions";
import { TARJETA_MAX, TARJETA_MIN, type ConfigTarjeta, type Hito } from "@/lib/tarjeta";

// La regla de la tarjeta, editable. Se dibuja como la tarjeta misma —una fila de
// casillas— y no como un formulario de campos sueltos: el dueño piensa "el regalo
// va en la quinta", no "posicion=5, tipo=regalo".

export function TarjetaAdmin({ inicial }: { inicial: ConfigTarjeta }) {
  const router = useRouter();
  const [tamano, setTamano] = useState(inicial.tamano);
  const [hitos, setHitos] = useState<Hito[]>(inicial.hitos);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);

  const hitoDe = (n: number) => hitos.find((h) => h.posicion === n) ?? null;

  /** Ciclo de la casilla: sin premio → regalo → porcentaje → sin premio. */
  function ciclar(n: number) {
    setGuardado(false);
    setHitos((prev) => {
      const actual = prev.find((h) => h.posicion === n);
      const resto = prev.filter((h) => h.posicion !== n);
      const con = (h: Hito) => [...resto, h].sort((a, b) => a.posicion - b.posicion);
      if (!actual) return con({ posicion: n, tipo: "regalo", valor: 0 });
      if (actual.tipo === "regalo") return con({ posicion: n, tipo: "porcentaje", valor: 50 });
      return resto;
    });
  }

  function cambiarPct(n: number, valor: number) {
    setGuardado(false);
    setHitos((prev) => prev.map((h) => (h.posicion === n ? { ...h, valor } : h)));
  }

  function cambiarTamano(n: number) {
    setGuardado(false);
    setTamano(n);
    // Los premios que quedan fuera de la tarjeta nueva se caen: dejarlos guardados
    // sería prometer algo que ningún cliente puede alcanzar.
    setHitos((prev) => prev.filter((h) => h.posicion <= n));
  }

  async function guardar() {
    setSaving(true);
    setError(null);
    const res = await guardarConfigTarjeta({ tamano, hitos });
    setSaving(false);
    if (res.ok) {
      setGuardado(true);
      router.refresh();
    } else {
      setError(res.error ?? "No se pudo guardar.");
    }
  }

  const cambio = tamano !== inicial.tamano || JSON.stringify(hitos) !== JSON.stringify(inicial.hitos);

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="text-[13px] text-muted">
          La tarjeta tiene
          <input
            type="number"
            min={TARJETA_MIN}
            max={TARJETA_MAX}
            value={tamano}
            onChange={(e) => cambiarTamano(Math.max(TARJETA_MIN, Math.min(TARJETA_MAX, Math.round(Number(e.target.value) || TARJETA_MIN))))}
            className="mx-2 min-h-11 w-20 rounded-xl border border-line bg-bg px-3 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
          />
          cortes
        </label>
        <span className="text-[12px] text-muted">Tocá una casilla para poner o quitar premio.</span>
      </div>

      {/* Las casillas, como en la tarjeta real. */}
      <div className="mt-4 flex flex-wrap gap-2">
        {Array.from({ length: tamano }, (_, i) => i + 1).map((n) => {
          const h = hitoDe(n);
          return (
            <button
              key={n}
              type="button"
              onClick={() => ciclar(n)}
              aria-label={`Corte ${n}: ${h ? (h.tipo === "regalo" ? "regalo" : `${h.valor}% de descuento`) : "sin premio"}`}
              className={`grid h-16 w-16 place-items-center rounded-xl border text-center transition ${
                h ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:border-accent/40"
              }`}
            >
              <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">{n}</span>
              <span className="font-display text-[15px] font-bold leading-none">
                {h ? (h.tipo === "regalo" ? "🎁" : `${h.valor}%`) : "—"}
              </span>
            </button>
          );
        })}
      </div>

      {/* Porcentaje de cada hito que lo tenga. */}
      {hitos.some((h) => h.tipo === "porcentaje") && (
        <div className="mt-4 space-y-2">
          {hitos
            .filter((h) => h.tipo === "porcentaje")
            .map((h) => (
              <label key={h.posicion} className="flex items-center gap-3 text-[13px] text-muted">
                En el corte <b className="text-ink">#{h.posicion}</b> se descuenta
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={h.valor}
                  onChange={(e) => cambiarPct(h.posicion, Math.max(1, Math.min(100, Math.round(Number(e.target.value) || 1))))}
                  className="min-h-11 w-20 rounded-xl border border-line bg-bg px-3 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
                />
                % del servicio que se hizo
              </label>
            ))}
        </div>
      )}

      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        El <b className="text-ink">regalo</b> no descuenta plata: el cliente paga completo y se lleva algo. El{" "}
        <b className="text-ink">porcentaje</b> se aplica sobre el servicio que se hizo, no sobre un precio fijo — al que
        se hace un combo se le descuenta del combo.
      </p>

      {error && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent-soft">
          {error}
        </div>
      )}
      {guardado && !cambio && (
        <div className="mt-3 rounded-xl border border-ok/40 bg-ok/10 px-3.5 py-2.5 text-[13px] text-ok">
          Guardado. Aplica desde el próximo cobro.
        </div>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={saving || !cambio}
        className="mt-4 min-h-12 rounded-full bg-accent px-6 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        {saving ? "Guardando…" : "Guardar la tarjeta"}
      </button>
    </div>
  );
}
