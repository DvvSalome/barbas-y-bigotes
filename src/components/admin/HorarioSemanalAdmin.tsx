"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { actualizarHorarioSemanal } from "@/lib/actions";
import type { Sede } from "@/lib/data/types";
import type { HorarioSemanal } from "@/lib/data/queries";

// Horario base de la semana por sede (migración 0048). Cada día se prende/apaga y
// tiene su franja; se guarda al instante (mismo patrón que el editor de precios).
// El orden de la semana empieza en lunes, que es como uno la lee; el dato guarda
// dow al estilo Postgres/JS (0=domingo).

const DIAS: { dow: number; nombre: string }[] = [
  { dow: 1, nombre: "Lunes" },
  { dow: 2, nombre: "Martes" },
  { dow: 3, nombre: "Miércoles" },
  { dow: 4, nombre: "Jueves" },
  { dow: 5, nombre: "Viernes" },
  { dow: 6, nombre: "Sábado" },
  { dow: 0, nombre: "Domingo" },
];

const minToTime = (m: number) =>
  `${Math.floor(m / 60).toString().padStart(2, "0")}:${(m % 60).toString().padStart(2, "0")}`;
const timeToMin = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};

type Estado = { abierta: boolean; abreMin: number; cierraMin: number };

export function HorarioSemanalAdmin({ sedes, horario }: { sedes: Sede[]; horario: HorarioSemanal[] }) {
  const router = useRouter();
  const [sedeId, setSedeId] = useState<string>(sedes[0]?.id ?? "");
  const [msg, setMsg] = useState<{ dow: number; text: string; ok: boolean } | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  // Estado local por (sede, dow): arranca de la BD; el respaldo es 9-20 abierto
  // (dom cerrado) por si la migración aún no se aplicó y no hay filas.
  const inicial = (dow: number): Estado => {
    const fila = horario.find((h) => h.sede === sedeId && h.dow === dow);
    if (fila) return { abierta: fila.abierta, abreMin: fila.abreMin, cierraMin: fila.cierraMin };
    return { abierta: dow !== 0, abreMin: 540, cierraMin: 1200 };
  };
  const [filas, setFilas] = useState<Record<number, Estado>>(() =>
    Object.fromEntries(DIAS.map((d) => [d.dow, inicial(d.dow)])),
  );

  // Al cambiar de sede, recargar el estado local desde la BD de esa sede.
  function cambiarSede(id: string) {
    setSedeId(id);
    setMsg(null);
    const src = (dow: number): Estado => {
      const fila = horario.find((h) => h.sede === id && h.dow === dow);
      return fila
        ? { abierta: fila.abierta, abreMin: fila.abreMin, cierraMin: fila.cierraMin }
        : { abierta: dow !== 0, abreMin: 540, cierraMin: 1200 };
    };
    setFilas(Object.fromEntries(DIAS.map((d) => [d.dow, src(d.dow)])));
  }

  async function guardar(dow: number, e: Estado) {
    setBusy(dow);
    setMsg(null);
    const res = await actualizarHorarioSemanal({
      sede: sedeId,
      dow,
      abierta: e.abierta,
      abreMin: e.abreMin,
      cierraMin: e.cierraMin,
    });
    setBusy(null);
    setMsg({ dow, text: res.ok ? "Guardado" : res.error ?? "Error", ok: res.ok });
    if (res.ok) router.refresh();
  }

  const setFila = (dow: number, patch: Partial<Estado>, guardarYa = false) => {
    setFilas((prev) => {
      const next = { ...prev[dow], ...patch };
      const copia = { ...prev, [dow]: next };
      if (guardarYa) guardar(dow, next);
      return copia;
    });
  };

  return (
    <div>
      {sedes.length > 1 && (
        <div className="mb-3 flex gap-1.5" role="tablist" aria-label="Sede">
          {sedes.map((s) => (
            <button
              key={s.id}
              type="button"
              aria-pressed={s.id === sedeId}
              onClick={() => cambiarSede(s.id)}
              className={`min-h-9 rounded-lg px-3 text-[12.5px] font-semibold transition ${
                s.id === sedeId ? "bg-accent/15 text-accent-soft" : "text-muted hover:text-ink"
              }`}
            >
              {s.nombre}
            </button>
          ))}
        </div>
      )}

      <div className="divide-y divide-line/60 overflow-hidden rounded-2xl border border-line bg-panel">
        {DIAS.map((d) => {
          const e = filas[d.dow];
          if (!e) return null;
          return (
            <div key={d.dow} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
              <span className="w-24 shrink-0 font-display text-[15px] font-bold uppercase">{d.nombre}</span>

              {/* Abre / Cierra el día */}
              <div className="flex shrink-0 overflow-hidden rounded-lg border border-line">
                {[
                  { v: true, txt: "Abre" },
                  { v: false, txt: "Cerrado" },
                ].map((o) => (
                  <button
                    key={o.txt}
                    type="button"
                    onClick={() => setFila(d.dow, { abierta: o.v }, true)}
                    className={`min-h-9 px-3 text-[12.5px] font-semibold transition ${
                      e.abierta === o.v
                        ? o.v
                          ? "bg-ok/15 text-ok"
                          : "bg-ink/10 text-muted"
                        : "text-muted hover:text-ink"
                    }`}
                  >
                    {o.txt}
                  </button>
                ))}
              </div>

              {/* Horas (solo si abre) */}
              {e.abierta ? (
                <div className="flex items-center gap-2 text-[13px] text-muted">
                  <span>de</span>
                  <input
                    type="time"
                    step={1800}
                    value={minToTime(e.abreMin)}
                    onChange={(ev) => setFila(d.dow, { abreMin: timeToMin(ev.target.value) })}
                    onBlur={() => guardar(d.dow, e)}
                    className="rounded-lg border border-line bg-bg px-2 py-1.5 text-ink focus:border-accent focus:outline-none"
                  />
                  <span>a</span>
                  <input
                    type="time"
                    step={1800}
                    value={minToTime(e.cierraMin)}
                    onChange={(ev) => setFila(d.dow, { cierraMin: timeToMin(ev.target.value) })}
                    onBlur={() => guardar(d.dow, e)}
                    className="rounded-lg border border-line bg-bg px-2 py-1.5 text-ink focus:border-accent focus:outline-none"
                  />
                </div>
              ) : (
                <span className="text-[12.5px] text-muted">No se atiende</span>
              )}

              {busy === d.dow && <span className="text-[11.5px] text-muted">…</span>}
              {msg?.dow === d.dow && (
                <span className={`text-[11.5px] ${msg.ok ? "text-ok" : "text-accent-soft"}`}>{msg.text}</span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[12px] text-muted">
        Este es el horario de siempre. Para un cambio de un solo día (un festivo, un sábado distinto), usá
        &quot;Días especiales&quot; abajo.
      </p>
    </div>
  );
}
