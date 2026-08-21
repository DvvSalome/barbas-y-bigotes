"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getDisponibilidad, agendarCita } from "@/lib/actions";
import {
  DOW,
  fmtTime,
  slotsDisponibles,
  computeTaken,
  nextDays,
  horarioEfectivo,
  instanteBogota,
} from "@/lib/slots";
import type { Barbero, Servicio, SedeId } from "@/lib/data/types";
import type { HorarioSemanal, DiaEspecial } from "@/lib/data/queries";

// Agendar una cita FUTURA desde el mostrador (cliente que escribió por WhatsApp). El
// mostrador elige barbero (de su sede), servicio, día, hora y datos del cliente. Los
// días/horas salen del MISMO horarioEfectivo + buildSlots + disponibilidad que el
// wizard, así que no ofrece nada que el server vaya a rechazar. La hora se arma en
// Bogotá (instanteBogota), no en la TZ del dispositivo.

const input =
  "w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const sLabel = "mb-1.5 text-[11px] font-bold uppercase tracking-wide text-muted";

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

export function AgendarCitaForm({
  sede,
  barberos,
  servicios,
  horarioSemanal,
  diasEspeciales,
  barberoInicial,
  diaInicial,
  slotInicial,
  onDone,
  onCancel,
}: {
  sede: string;
  barberos: Barbero[];
  servicios: Servicio[];
  horarioSemanal: HorarioSemanal[]; // ya filtrado por la sede
  diasEspeciales: DiaEspecial[]; // ya filtrado por la sede
  /** Preselección al abrir desde el calendario (columna/día/hora tocados). */
  barberoInicial?: string;
  diaInicial?: Date;
  /** Minuto-del-día tocado en la grilla (estilo Google Calendar): la hora ya
   *  viene elegida; si está ocupada, la grilla lo muestra y se elige otra. */
  slotInicial?: number;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Solo servicios con precio en esta sede (los que se pueden cobrar acá).
  const serviciosSede = useMemo(() => servicios.filter((s) => s.precios[sede as SedeId] != null), [servicios, sede]);

  const [barberoId, setBarberoId] = useState(barberoInicial ?? barberos[0]?.id ?? "");
  const [servicioId, setServicioId] = useState(serviciosSede[0]?.id ?? "");
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(slotInicial ?? null);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  const servicio = serviciosSede.find((s) => s.id === servicioId) ?? null;
  // Duración a medida de ESTA cita. null = la del catálogo, así cambiar de
  // servicio trae su duración sola (sin un effect que las sincronice).
  const [durManual, setDurManual] = useState<number | null>(null);
  const dur = durManual ?? servicio?.duracionMin ?? 30;

  // Próximos días que la sede ABRE (mismo criterio que el wizard).
  const dias = useMemo(
    () => nextDays(14).filter((d) => horarioEfectivo(ymdLocal(d), horarioSemanal, diasEspeciales).abierta),
    [horarioSemanal, diasEspeciales],
  );

  // Turnos del día elegido: la grilla MÁS el instante en que se desocupa la
  // silla, para poder encadenar al cliente que sigue sin dejar huecos muertos.
  const slots = useMemo(() => {
    if (!day) return [] as number[];
    const v = horarioEfectivo(ymdLocal(day), horarioSemanal, diasEspeciales);
    return v.abierta ? slotsDisponibles(dur, v.abreMin, v.cierraMin, ocupados) : [];
  }, [day, dur, horarioSemanal, diasEspeciales, ocupados]);

  const taken = day ? computeTaken({ slots, ocupados, day, duracionMin: dur }) : new Set<number>();
  // La hora escrita a mano no está en la grilla, así que `taken` no la cubre: se
  // chequea aparte con la MISMA función, para avisar antes de que el servidor la
  // rebote (computeTaken también marca las horas ya pasadas de hoy).
  const chocaElegido =
    slot !== null && day ? computeTaken({ slots: [slot], ocupados, day, duracionMin: dur }).has(slot) : false;

  // Al cambiar barbero o día, traer su ocupación (guard de carrera reqId). Sin
  // setState síncrono en el cuerpo del effect (regla del React Compiler).
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

  // Preselecciona el día pedido (calendario) o el primer día abierto.
  useEffect(() => {
    const pref = diaInicial && dias.find((d) => d.toDateString() === diaInicial.toDateString());
    // eslint-disable-next-line react-hooks/set-state-in-effect -- preselección de UX al montar (no cascada real)
    if (!day && dias.length) setDay(pref ?? dias[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dias]);

  async function guardar() {
    if (!barberoId || !servicioId || !day || slot === null) {
      setErr("Elegí barbero, servicio, día y hora.");
      return;
    }
    if (!nombre.trim() || !telefono.trim()) {
      setErr("Poné el nombre y el teléfono del cliente.");
      return;
    }
    setSaving(true);
    setErr(null);
    const inicioISO = instanteBogota(ymdLocal(day), slot).toISOString();
    const res = await agendarCita({
      barberoId,
      servicioId,
      inicioISO,
      clienteNombre: nombre.trim(),
      telefono: telefono.trim(),
      email: email.trim() || undefined,
      duracionMin: durManual ?? undefined,
    });
    setSaving(false);
    if (res.ok) onDone();
    else setErr(res.error ?? "No se pudo agendar.");
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
        <div className={sLabel}>Servicio</div>
        <select
          value={servicioId}
          onChange={(e) => {
            setServicioId(e.target.value);
            setSlot(null);
          }}
          className={input}
        >
          {serviciosSede.map((s) => (
            <option key={s.id} value={s.id}>
              {s.nombre} · {s.duracionMin} min
            </option>
          ))}
        </select>
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
        <div className={sLabel}>Hora</div>
        {!day ? (
          <p className="text-sm text-muted">Elegí un día.</p>
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

        {/* Escape de la grilla: el cliente llegó 2:40 y se le agenda 2:40, no 2:45.
            Los dos campos son nativos —el teléfono abre su propio selector— y
            escriben sobre el MISMO `slot` que los chips, así el resto del form no
            se entera de por dónde entró la hora. */}
        <div className="mt-3 grid grid-cols-2 gap-2 rounded-xl border border-line bg-elevated/60 p-3">
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Hora exacta
            <input
              type="time"
              step={300}
              value={slot === null ? "" : `${String(Math.floor(slot / 60)).padStart(2, "0")}:${String(slot % 60).padStart(2, "0")}`}
              onChange={(e) => {
                const [h, m] = e.target.value.split(":").map(Number);
                setSlot(Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null);
              }}
              className={`${input} mt-1 tabular-nums`}
            />
          </label>
          <label className="text-[11px] font-semibold uppercase tracking-wide text-muted">
            Dura (min)
            <input
              type="number"
              min={5}
              max={480}
              step={5}
              value={dur}
              onChange={(e) => {
                const n = Number(e.target.value);
                setDurManual(Number.isFinite(n) && n > 0 ? Math.round(n) : null);
              }}
              className={`${input} mt-1 tabular-nums`}
            />
          </label>
          <p className="col-span-2 text-[12px] text-muted">
            {slot === null ? (
              "Elegí un turno arriba o escribí la hora."
            ) : (
              <>
                Queda de <b className="text-ink tabular-nums">{fmtTime(slot)}</b> a{" "}
                <b className="text-ink tabular-nums">{fmtTime(slot + dur)}</b>
                {durManual !== null && servicio && durManual !== servicio.duracionMin && (
                  <span className="text-muted"> · el servicio dura {servicio.duracionMin} min</span>
                )}
              </>
            )}
          </p>
          {chocaElegido && (
            <p className="col-span-2 text-[12px] font-semibold text-warn">
              A esa hora el barbero está ocupado (o ya pasó). Elegí otra.
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div>
          <div className={sLabel}>Nombre del cliente</div>
          <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Andrés" className={input} />
        </div>
        <div>
          <div className={sLabel}>Teléfono (WhatsApp)</div>
          <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="300 123 4567" className={input} />
        </div>
      </div>
      <div>
        <div className={sLabel}>Correo (opcional, para el recordatorio)</div>
        <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="correo@ejemplo.com" className={input} />
      </div>

      {err && (
        <div className="rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-sm text-accent-soft">{err}</div>
      )}

      <div className="flex gap-2 pt-1">
        <button
          onClick={guardar}
          disabled={saving}
          className="flex-1 rounded-full bg-accent px-5 py-3 text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {saving ? "Agendando…" : "Agendar cita"}
        </button>
        <button onClick={onCancel} className="rounded-full border border-line px-5 py-3 text-sm text-muted">
          Cancelar
        </button>
      </div>
    </div>
  );
}
