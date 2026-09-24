"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { CaraBarbero } from "@/components/staff/Elegir";
import { bloquearHoras } from "@/lib/actions";
import { fmtTime } from "@/lib/slots";
import type { Barbero } from "@/lib/data/types";

// Bloquear un rato del barbero desde el calendario: almuerzo, diligencia, o el
// día entero. El rango se elige en pasos de 30 min dentro de la ventana del día.

const sLabel = "mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted";
const MOTIVOS = ["Almuerzo", "Diligencia", "Descanso"];

export function BloquearHorasForm({
  fecha,
  barberos,
  barberoInicial,
  abreMin,
  cierraMin,
  onDone,
  onCancel,
}: {
  fecha: string; // YYYY-MM-DD mostrado en el calendario
  barberos: Barbero[];
  barberoInicial?: string;
  abreMin: number;
  cierraMin: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [barberoId, setBarberoId] = useState(barberoInicial ?? barberos[0]?.id ?? "");
  const [todoElDia, setTodoElDia] = useState(false);
  const [desde, setDesde] = useState(Math.max(abreMin, 12 * 60)); // arranque útil: mediodía
  const [hasta, setHasta] = useState(Math.min(cierraMin, 13 * 60));
  const [motivo, setMotivo] = useState("Almuerzo");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pasos: number[] = [];
  for (let m = abreMin; m <= cierraMin; m += 30) pasos.push(m);

  const btn = (activo: boolean) =>
    `min-h-[44px] rounded-xl border px-3 text-xs font-bold transition ${
      activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
    }`;
  const select =
    "w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink focus:border-accent focus:outline-none";

  async function guardar() {
    if (!barberoId) {
      setErr("Elige el barbero.");
      return;
    }
    if (!todoElDia && desde >= hasta) {
      setErr("El rango no cuadra: 'desde' tiene que ir antes de 'hasta'.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await bloquearHoras({
      barberoId,
      fecha,
      ...(todoElDia ? {} : { desdeMin: desde, hastaMin: hasta }),
      motivo,
    });
    setSaving(false);
    if (res.ok) onDone();
    else setErr(res.error ?? "No se pudo bloquear.");
  }

  return (
    <div className="space-y-4">
      <div>
        <div className={sLabel}>Barbero</div>
        <div className="flex flex-wrap gap-2">
          {barberos.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setBarberoId(b.id)}
              className={`${btn(barberoId === b.id)} inline-flex items-center gap-2`}
            >
              <CaraBarbero b={b} size={22} />
              {b.nombre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sLabel}>Cuánto tiempo</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setTodoElDia(false)} className={btn(!todoElDia)}>
            Un rato
          </button>
          <button type="button" onClick={() => setTodoElDia(true)} className={btn(todoElDia)}>
            Todo el día
          </button>
        </div>
      </div>

      {!todoElDia && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className={sLabel}>Desde</div>
            <select value={desde} onChange={(e) => setDesde(Number(e.target.value))} className={select}>
              {pasos.slice(0, -1).map((m) => (
                <option key={m} value={m}>
                  {fmtTime(m)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <div className={sLabel}>Hasta</div>
            <select value={hasta} onChange={(e) => setHasta(Number(e.target.value))} className={select}>
              {pasos.filter((m) => m > desde).map((m) => (
                <option key={m} value={m}>
                  {fmtTime(m)}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      <div>
        <div className={sLabel}>Motivo</div>
        <div className="flex flex-wrap gap-2">
          {MOTIVOS.map((m) => (
            <button key={m} type="button" onClick={() => setMotivo(m)} className={btn(motivo === m)}>
              {m}
            </button>
          ))}
        </div>
        <input
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          placeholder="O escribe otro motivo"
          className="mt-2 w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      {err && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-sm text-accent-soft">{err}</div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={guardar}
          disabled={saving}
          className={botonClases("primario", "md", "flex-1")}
        >
          {saving ? "Bloqueando…" : todoElDia ? "Bloquear el día" : "Bloquear ese rato"}
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-5 py-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
