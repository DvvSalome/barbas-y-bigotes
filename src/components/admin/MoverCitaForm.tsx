"use client";

import { botonClases } from "@/components/ui/Boton";
import { useEffect, useMemo, useRef, useState } from "react";
import { getDisponibilidad, moverCita } from "@/lib/actions";
import { DOW, fmtTime, slotsDisponibles, computeTaken, nextDays, horarioEfectivo } from "@/lib/slots";
import { instanteBogota } from "@/lib/slots";
import type { Barbero } from "@/lib/data/types";
import type { AgendaDiaItem, HorarioSemanal, DiaEspecial } from "@/lib/data/queries";

// Mover una cita existente: otro barbero de la sede y/u otra hora. Mismos
// bloques de armado que AgendarCitaForm (días abiertos por horarioEfectivo,
// slots ocupados por getDisponibilidad), pero sin datos del cliente — la cita
// ya existe, solo cambia de lugar.

const sLabel = "mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted";

const ymdLocal = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function dayLabel(d: Date): string {
  const hoy = new Date();
  const man = new Date(hoy);
  man.setDate(hoy.getDate() + 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === man.toDateString()) return "Mañana";
  return `${DOW[d.getDay()]} ${d.getDate()}`;
}

export function MoverCitaForm({
  cita,
  barberos,
  horarioSemanal,
  diasEspeciales,
  onDone,
  onCancel,
}: {
  cita: AgendaDiaItem;
  barberos: Barbero[]; // de la sede de la cita
  horarioSemanal: HorarioSemanal[];
  diasEspeciales: DiaEspecial[];
  /** Recibe el YYYY-MM-DD destino: el calendario salta a donde quedó la cita. */
  /** Dónde quedó la cita: el llamador arma con esto el aviso al cliente. */
  onDone: (destino: { ymd: string; slot: number; barberoId: string }) => void;
  onCancel: () => void;
}) {
  const [barberoId, setBarberoId] = useState(cita.barberoId ?? barberos[0]?.id ?? "");
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  const dur = cita.duracionMin;

  const dias = useMemo(
    () => nextDays(14).filter((d) => horarioEfectivo(ymdLocal(d), horarioSemanal, diasEspeciales).abierta),
    [horarioSemanal, diasEspeciales],
  );

  const slots = useMemo(() => {
    if (!day) return [] as number[];
    const v = horarioEfectivo(ymdLocal(day), horarioSemanal, diasEspeciales);
    return v.abierta ? slotsDisponibles(dur, v.abreMin, v.cierraMin, ocupados) : [];
  }, [day, dur, horarioSemanal, diasEspeciales, ocupados]);

  // La cita NO choca consigo misma: al mirar su propio barbero se descuenta su
  // rango actual (si no, moverla 30 min aparecía como "ocupado" por ella misma).
  const ocupadosSinYo = useMemo(
    () => (barberoId === cita.barberoId ? ocupados.filter((o) => o.inicio !== cita.inicio) : ocupados),
    [ocupados, barberoId, cita.barberoId, cita.inicio],
  );
  const taken = day ? computeTaken({ slots, ocupados: ocupadosSinYo, day, duracionMin: dur }) : new Set<number>();

  useEffect(() => {
    if (!day || !barberoId) return;
    const my = ++reqId.current;
    Promise.resolve()
      .then(() => {
        if (my === reqId.current) setCargando(true);
        return getDisponibilidad({ barberoId, fechaISO: day.toISOString() });
      })
      .then((r) => {
        if (my === reqId.current) setOcupados(r);
      })
      .finally(() => {
        if (my === reqId.current) setCargando(false);
      });
  }, [day, barberoId]);

  useEffect(() => {
    // Preselecciona EL DÍA DE LA CITA, no el primero disponible: arrancar en
    // "Hoy" hacía que mover una cita del jueves la mandara a HOY sin querer
    // (le pasó al dueño: la movió "a las 4:30"... de otro día).
    const diaCita = new Date(cita.inicio);
    const pref = dias.find((d) => d.toDateString() === diaCita.toDateString());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselección de UX al montar (no cascada real)
    if (!day && dias.length) setDay(pref ?? dias[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  async function guardar() {
    if (!barberoId || !day || slot === null) {
      setErr("Elige barbero, día y hora.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await moverCita({
      reservaId: cita.id,
      inicioISO: instanteBogota(ymdLocal(day), slot).toISOString(),
      barberoId,
    });
    setSaving(false);
    if (res.ok) onDone({ ymd: ymdLocal(day), slot, barberoId });
    else setErr(res.error ?? "No se pudo mover.");
  }

  const btn = (activo: boolean) =>
    `min-h-[44px] rounded-xl border px-3 text-xs font-bold transition ${
      activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
    }`;

  return (
    <div className="space-y-4">
      <div>
        <div className={sLabel}>Barbero</div>
        <div className="flex flex-wrap gap-2">
          {barberos.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => {
                setBarberoId(b.id);
                setSlot(null);
              }}
              className={btn(barberoId === b.id)}
            >
              {b.nombre}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sLabel}>Día</div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {dias.map((d) => (
            <button
              key={d.toISOString()}
              type="button"
              onClick={() => {
                setDay(d);
                setSlot(null);
              }}
              className={`shrink-0 ${btn(day?.toDateString() === d.toDateString())}`}
            >
              {dayLabel(d)}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div className={sLabel}>Nueva hora</div>
        {!day ? (
          <p className="text-sm text-muted">Elige un día.</p>
        ) : cargando ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-11 animate-pulse rounded-xl border border-line/50 bg-bg" />
            ))}
          </div>
        ) : slots.length === 0 ? (
          <p className="text-sm text-muted">Ese día no hay horario.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((t) => {
              const ocupado = taken.has(t);
              const activo = slot === t;
              return (
                <button
                  key={t}
                  type="button"
                  disabled={ocupado}
                  onClick={() => setSlot(t)}
                  className={`flex min-h-11 items-center justify-center rounded-xl border text-xs tabular-nums transition ${
                    ocupado
                      ? "cursor-not-allowed border-line/50 text-muted/40 line-through"
                      : activo
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-elevated hover:border-accent/50"
                  }`}
                >
                  {fmtTime(t)}
                </button>
              );
            })}
          </div>
        )}
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
          {saving ? "Moviendo…" : "Mover cita"}
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-5 py-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
