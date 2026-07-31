"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { crearCombo } from "@/lib/actions";
import { cop } from "@/lib/format";
import type { SedeId, Servicio } from "@/lib/data/types";

// Armador de combos (proto §7.1). Se arma con servicios NO combo de la sede activa
// (cada uno con su precio) + una bebida opcional (+$5.000). El nombre/duración/precio
// se autocompletan al tocar las partes y quedan editables. El combo se crea SOLO en
// la sede activa (decisión del dueño). CTA deshabilitado hasta que sea válido.

const BEBIDA = 5000; // proto §7.1: "Incluye bebida · +$5.000"
const PISO = 5000; // piso de precio del combo (proto §7.3)

const inputCls =
  "w-full rounded-xl border border-line bg-bg px-3.5 py-2.5 text-[14px] text-ink placeholder:text-muted focus:border-accent focus:outline-none";

const shortName = (n: string) => n.split("(")[0].trim();
const capitalizar = (s: string) => (s ? s[0].toUpperCase() + s.slice(1) : s);
const sugeridoDe = (suelto: number) => Math.max(PISO, Math.round((suelto * 0.9) / 1000) * 1000);

function Stepper({
  value,
  step,
  min,
  onChange,
  money,
  label,
}: {
  value: number;
  step: number;
  min: number;
  onChange: (v: number) => void;
  money?: boolean;
  label: string;
}) {
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-elevated" role="group" aria-label={label}>
      <button
        type="button"
        aria-label={`Bajar ${label}`}
        onClick={() => onChange(Math.max(min, value - step))}
        disabled={value <= min}
        className="flex h-9 w-9 items-center justify-center text-lg text-muted transition hover:text-ink disabled:opacity-40"
      >
        −
      </button>
      <span className="min-w-[80px] text-center font-display text-[17px] font-extrabold tabular-nums text-ink">
        {money ? cop(value) : value}
      </span>
      <button
        type="button"
        aria-label={`Subir ${label}`}
        onClick={() => onChange(value + step)}
        className="flex h-9 w-9 items-center justify-center text-lg text-muted transition hover:text-ink"
      >
        +
      </button>
    </div>
  );
}

export function ComboBuilder({
  partesDisponibles,
  sedeActiva,
  sedeNombre,
}: {
  partesDisponibles: Servicio[];
  sedeActiva: SedeId;
  sedeNombre: string;
}) {
  const router = useRouter();
  const [partes, setPartes] = useState<Set<string>>(new Set());
  const [conBebida, setConBebida] = useState(false);
  const [nombre, setNombre] = useState("");
  const [duracion, setDuracion] = useState(0);
  const [precio, setPrecio] = useState(PISO);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  // Selección en el orden de la lista (estable, no depende del orden de tap).
  const seleccion = useMemo(
    () => partesDisponibles.filter((p) => partes.has(p.id)),
    [partesDisponibles, partes],
  );
  const sumaPartes = seleccion.reduce((a, p) => a + (p.precios[sedeActiva] ?? 0), 0);
  const suelto = sumaPartes + (conBebida ? BEBIDA : 0);
  const durSugerida = seleccion.reduce((a, p) => a + p.duracionMin, 0);
  const sugerido = sugeridoDe(suelto);

  // Al tocar partes/bebida se auto-rellenan nombre/duración/precio (proto §7.1).
  function aplicar(nuevas: Set<string>, bebida: boolean) {
    setOk(false);
    setPartes(nuevas);
    setConBebida(bebida);
    const sel = partesDisponibles.filter((p) => nuevas.has(p.id));
    const suma = sel.reduce((a, p) => a + (p.precios[sedeActiva] ?? 0), 0) + (bebida ? BEBIDA : 0);
    const nombres = sel.map((p) => shortName(p.nombre));
    if (bebida) nombres.push("bebida");
    setNombre(capitalizar(nombres.join(" + ")));
    setDuracion(sel.reduce((a, p) => a + p.duracionMin, 0));
    setPrecio(sugeridoDe(suma));
  }

  function togglePart(id: string) {
    const n = new Set(partes);
    if (n.has(id)) n.delete(id);
    else n.add(id);
    aplicar(n, conBebida);
  }

  const cantidad = partes.size;
  const valido =
    (cantidad >= 2 || (cantidad >= 1 && conBebida)) && nombre.trim() !== "" && precio > 0 && duracion > 0;

  async function submit() {
    if (!valido || saving) return;
    setErr(null);
    setOk(false);
    setSaving(true);
    const res = await crearCombo({
      sede: sedeActiva,
      partes: [...partes],
      conBebida,
      nombre: nombre.trim(),
      duracionMin: duracion,
      precio,
    });
    setSaving(false);
    if (res.ok) {
      setPartes(new Set());
      setConBebida(false);
      setNombre("");
      setDuracion(0);
      setPrecio(PISO);
      setOk(true);
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo crear el combo.");
    }
  }

  return (
    <div className="rounded-2xl border border-accent/30 bg-accent/5 p-4 sm:p-5">
      <div className="text-[11px] font-bold uppercase tracking-[0.14em] text-accent-soft">
        Arma el combo · toca lo que incluye
      </div>
      <p className="mt-1 text-xs text-muted">
        Se crea en <span className="font-semibold text-ink">{sedeNombre}</span> · queda disponible solo en esta sede.
      </p>

      {/* Partes: servicios no combo de la sede activa, con su precio */}
      <div className="mt-3 flex flex-wrap gap-2">
        {partesDisponibles.map((p) => {
          const on = partes.has(p.id);
          return (
            <button
              key={p.id}
              type="button"
              aria-pressed={on}
              onClick={() => togglePart(p.id)}
              className={`inline-flex min-h-[38px] items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[12.5px] transition ${
                on ? "border-accent/75 bg-accent/[0.14] text-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              <span className="font-medium">{shortName(p.nombre)}</span>
              <span className={`tabular-nums ${on ? "text-accent-soft" : "text-muted"}`}>
                +{cop(p.precios[sedeActiva] ?? 0)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Bebida */}
      <button
        type="button"
        aria-pressed={conBebida}
        onClick={() => aplicar(partes, !conBebida)}
        className={`mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-full border px-4 py-1.5 text-[12.5px] font-bold transition ${
          conBebida ? "border-ok/50 bg-ok/10 text-ok" : "border-line text-muted hover:text-ink"
        }`}
      >
        {conBebida ? "✓ " : ""}Incluye bebida · +{cop(BEBIDA)}
      </button>

      {/* Resumen (cuando hay al menos una parte) */}
      {cantidad >= 1 && (
        <div className="mt-3 border-t border-line pt-3">
          <div className="text-[12.5px] font-bold text-ink">{nombre || "Combo"}</div>
          <p className="mt-0.5 text-xs text-muted">
            Suelto vale <span className="tabular-nums text-ink">{cop(suelto)}</span> · {durSugerida} min · precio de
            combo sugerido <span className="font-bold tabular-nums text-ok">{cop(sugerido)}</span> (10% menos)
          </p>
          <p className="mt-1 text-[11px] text-muted">Nombre, precio y duración quedaron abajo — ajústalos si quieres.</p>
        </div>
      )}

      {/* Editables */}
      <div className="mt-3 grid gap-3">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Nombre del combo
          </span>
          <input
            value={nombre}
            onChange={(e) => {
              setNombre(e.target.value);
              setOk(false);
            }}
            placeholder="Nombre del combo"
            className={inputCls}
          />
        </label>
        <div className="flex flex-wrap gap-4">
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Duración (min)
            </span>
            <Stepper value={duracion} step={5} min={5} onChange={setDuracion} label="duración" />
          </div>
          <div>
            <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
              Precio (COP)
            </span>
            <Stepper value={precio} step={1000} min={PISO} onChange={setPrecio} money label="precio" />
          </div>
        </div>
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
          {err}
        </div>
      )}
      {ok && (
        <div className="mt-3 rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">
          Combo creado en {sedeNombre}. Ya aparece en el catálogo de abajo.
        </div>
      )}

      <button
        type="button"
        disabled={!valido || saving}
        onClick={submit}
        className="mt-4 w-full rounded-[13px] bg-accent px-6 py-3 text-sm font-extrabold uppercase tracking-[0.05em] text-on-accent transition hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
      >
        {saving ? "Creando…" : "Crear combo"}
      </button>
    </div>
  );
}
