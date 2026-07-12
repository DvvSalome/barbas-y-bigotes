"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDisponibilidad } from "@/lib/actions";
import { cancelarReservaCliente, reagendarReservaCliente } from "@/lib/cliente-actions";
import { DOW, fmtTime, buildSlots, computeTaken, nextDays, CANCELACION_MIN_HORAS } from "@/lib/slots";

const WA_NUM = "573006734799";

// Etiqueta del chip de día: "Hoy" / "Mañana" / "{DOW} {n}" (proto §2.7).
function dayLabel(d: Date): string {
  const hoy = new Date();
  const manana = new Date(hoy);
  manana.setDate(hoy.getDate() + 1);
  if (d.toDateString() === hoy.toDateString()) return "Hoy";
  if (d.toDateString() === manana.toDateString()) return "Mañana";
  return `${DOW[d.getDay()]} ${d.getDate()}`;
}

export function CitaAcciones({
  reservaId,
  barberoId,
  duracionMin,
  inicio,
}: {
  reservaId: string;
  barberoId: string | null;
  duracionMin: number;
  inicio: string;
}) {
  const router = useRouter();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // Date.now() en state initializer: estable durante el render (regla de pureza
  // del compiler); se re-evalúa en cada mount, suficiente para la ventana de 2h.
  const [ahora] = useState(() => Date.now());
  const dentroVentana = new Date(inicio).getTime() <= ahora + CANCELACION_MIN_HORAS * 3600_000;

  if (dentroVentana) {
    const msg = encodeURIComponent(
      `Hola Barbas & Bigotes, necesito cancelar o cambiar mi cita del ${new Date(inicio).toLocaleString("es-CO", {
        weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit",
      })}.`,
    );
    return (
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
        <span className="text-muted">Faltan menos de {CANCELACION_MIN_HORAS}h — no se puede cancelar online.</span>
        <a
          href={`https://wa.me/${WA_NUM}?text=${msg}`}
          target="_blank"
          rel="noopener noreferrer"
          className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 font-semibold text-accent-soft transition hover:bg-accent/15"
        >
          Avisar por WhatsApp
        </a>
      </div>
    );
  }

  async function doCancel() {
    setBusy(true);
    setErr(null);
    const res = await cancelarReservaCliente(reservaId);
    setBusy(false);
    if (res.ok) router.refresh();
    else {
      setErr(res.error ?? "No se pudo cancelar");
      setConfirmCancel(false);
    }
  }

  return (
    <div className="mt-3">
      <div className="flex flex-wrap items-center gap-2">
        {!confirmCancel ? (
          <>
            <button
              onClick={() => setRescheduleOpen((v) => !v)}
              className={`rounded-full border px-3 py-1.5 text-xs transition ${
                rescheduleOpen
                  ? "border-accent/60 bg-accent/10 text-ink"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              Reagendar
            </button>
            <button
              onClick={() => {
                setConfirmCancel(true);
                setRescheduleOpen(false);
              }}
              className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </>
        ) : (
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted">¿Cancelar esta cita?</span>
            <button
              onClick={doCancel}
              disabled={busy}
              className="rounded-full bg-accent px-3 py-1.5 font-semibold text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
            >
              {busy ? "…" : "Sí, cancelar"}
            </button>
            <button
              onClick={() => setConfirmCancel(false)}
              disabled={busy}
              className="rounded-full border border-line px-3 py-1.5 text-muted transition hover:text-ink"
            >
              No
            </button>
          </div>
        )}
        {err && <span className="text-xs text-accent-soft">{err}</span>}
      </div>

      {rescheduleOpen && !confirmCancel && (
        <ReagendarPanel
          reservaId={reservaId}
          barberoId={barberoId}
          duracionMin={duracionMin}
          onDone={() => {
            setRescheduleOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

// Panel inline dentro de la card (proto §2.7): reemplaza al viejo modal overlay.
// Toda la lógica de datos se conserva (getDisponibilidad + guard de carrera reqId,
// buildSlots/computeTaken, reagendarReservaCliente + manejo de error).
function ReagendarPanel({
  reservaId,
  barberoId,
  duracionMin,
  onDone,
}: {
  reservaId: string;
  barberoId: string | null;
  duracionMin: number;
  onDone: () => void;
}) {
  const days = nextDays(7);
  const [day, setDay] = useState<Date | null>(null);
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  const slots = buildSlots(duracionMin);
  const taken = day ? computeTaken({ slots, ocupados, day, duracionMin }) : new Set<number>();

  async function pickDay(d: Date) {
    setDay(d);
    setErr(null);
    if (!barberoId) return;
    const myReq = ++reqId.current;
    setCargando(true);
    const r = await getDisponibilidad({ barberoId, fechaISO: d.toISOString() });
    if (myReq !== reqId.current) return; // llegó una selección de día más reciente; descartar
    setOcupados(r);
    setCargando(false);
  }

  // Al abrir, preselecciona "Mañana" para mostrar el grid de una (proto §2.7).
  // Diferido a microtask: sin setState síncrono en el cuerpo del effect (regla
  // del React Compiler). pickDay conserva su guard de carrera reqId.
  useEffect(() => {
    let cancel = false;
    Promise.resolve().then(() => {
      if (!cancel) pickDay(days[1] ?? days[0]);
    });
    return () => {
      cancel = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tocar una hora confirma de una (proto §2.7): "Tocá una hora y queda confirmada".
  async function confirmar(t: number) {
    if (!day) return;
    const nuevo = new Date(day);
    nuevo.setHours(Math.floor(t / 60), t % 60, 0, 0);
    setSavingSlot(t);
    setErr(null);
    const res = await reagendarReservaCliente(reservaId, nuevo.toISOString());
    if (res.ok) {
      onDone();
      return;
    }
    // Error: se mantiene el panel abierto para reintentar con otra hora.
    setSavingSlot(null);
    setErr(res.error ?? "No se pudo reagendar");
  }

  if (!barberoId) {
    return (
      <div className="mt-3 rounded-xl border border-accent/35 bg-accent/[0.05] p-3">
        <p className="text-sm text-muted">
          Esta cita no tiene barbero asignado; escribinos por WhatsApp para reagendarla.
        </p>
      </div>
    );
  }

  const saving = savingSlot !== null;

  return (
    <div className="mt-3 rounded-xl border border-accent/35 bg-accent/[0.05] p-3">
      <div className="mb-2 text-[12.5px] font-bold">Elegí el nuevo horario</div>

      {/* Chips de día (pill, selección roja) */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {days.map((d) => {
          const active = day?.toDateString() === d.toDateString();
          return (
            <button
              key={d.toISOString()}
              onClick={() => pickDay(d)}
              disabled={saving}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs transition disabled:opacity-50 ${
                active
                  ? "border-accent/75 bg-accent/[0.14] text-ink"
                  : "border-line text-muted hover:text-ink"
              }`}
            >
              {dayLabel(d)}
            </button>
          );
        })}
      </div>

      {/* Grid de horas (4 columnas, cabe a 390px sin scroll horizontal) */}
      <div className="mt-3">
        {!day ? (
          <p className="text-sm text-muted">Elegí un día para ver horarios.</p>
        ) : cargando ? (
          <div className="grid grid-cols-4 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded-[10px] border border-line/50 bg-bg" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {slots.map((t) => {
              const isTaken = taken.has(t);
              const isSaving = savingSlot === t;
              return (
                <button
                  key={t}
                  disabled={isTaken || saving}
                  onClick={() => confirmar(t)}
                  className={`flex min-h-10 items-center justify-center rounded-[10px] border text-xs tabular-nums transition ${
                    isTaken
                      ? "cursor-not-allowed border-line/50 text-muted/40 line-through"
                      : isSaving
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-elevated hover:border-accent/50 disabled:opacity-50"
                  }`}
                >
                  {isSaving ? "…" : fmtTime(t)}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
          {err}
        </div>
      )}

      <p className="mt-2 text-[11px] text-muted">
        Tocá una hora y queda confirmada · te llega el correo con el cambio.
      </p>
    </div>
  );
}
