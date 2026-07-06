"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getDisponibilidad } from "@/lib/actions";
import { cancelarReservaCliente, reagendarReservaCliente } from "@/lib/cliente-actions";
import { DOW, MON, fmtTime, buildSlots, computeTaken, nextDays, CANCELACION_MIN_HORAS } from "@/lib/slots";

const WA_NUM = "573006734799";

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
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {!confirmCancel ? (
        <>
          <button
            onClick={() => setRescheduleOpen(true)}
            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
          >
            Reagendar
          </button>
          <button
            onClick={() => setConfirmCancel(true)}
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

      {rescheduleOpen && (
        <ReagendarModal
          reservaId={reservaId}
          barberoId={barberoId}
          duracionMin={duracionMin}
          onClose={() => setRescheduleOpen(false)}
          onDone={() => {
            setRescheduleOpen(false);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function ReagendarModal({
  reservaId,
  barberoId,
  duracionMin,
  onClose,
  onDone,
}: {
  reservaId: string;
  barberoId: string | null;
  duracionMin: number;
  onClose: () => void;
  onDone: () => void;
}) {
  const days = nextDays(7);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<number | null>(null);
  const [ocupados, setOcupados] = useState<{ inicio: string; fin: string }[]>([]);
  const [cargando, setCargando] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const reqId = useRef(0);

  const slots = buildSlots(duracionMin);
  const taken = day ? computeTaken({ slots, ocupados, day, duracionMin }) : new Set<number>();

  async function pickDay(d: Date) {
    setDay(d);
    setSlot(null);
    setErr(null);
    if (!barberoId) return;
    const myReq = ++reqId.current;
    setCargando(true);
    const r = await getDisponibilidad({ barberoId, fechaISO: d.toISOString() });
    if (myReq !== reqId.current) return; // llegó una selección de día más reciente; descartar
    setOcupados(r);
    setCargando(false);
  }

  async function confirmar() {
    if (!day || slot === null) return;
    const nuevo = new Date(day);
    nuevo.setHours(Math.floor(slot / 60), slot % 60, 0, 0);
    setSaving(true);
    setErr(null);
    const res = await reagendarReservaCliente(reservaId, nuevo.toISOString());
    setSaving(false);
    if (res.ok) onDone();
    else {
      setErr(res.error ?? "No se pudo reagendar");
      setSlot(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-2xl border border-line bg-panel p-5" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-display text-xl">Reagendar cita</h3>
          <button onClick={onClose} aria-label="Cerrar" className="text-muted transition hover:text-ink">✕</button>
        </div>

        {!barberoId ? (
          <p className="text-sm text-muted">
            Esta cita no tiene barbero asignado; escribinos por WhatsApp para reagendarla.
          </p>
        ) : (
          <>
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
              {days.map((d) => {
                const active = day?.toDateString() === d.toDateString();
                return (
                  <button
                    key={d.toISOString()}
                    onClick={() => pickDay(d)}
                    className={`flex shrink-0 flex-col items-center rounded-xl border px-4 py-2.5 ${
                      active ? "border-accent bg-accent/10" : "border-line hover:border-accent/40"
                    }`}
                  >
                    <span className="text-[11px] uppercase text-muted">{DOW[d.getDay()]}</span>
                    <span className="font-display text-xl">{d.getDate()}</span>
                    <span className="text-[10px] text-muted">{MON[d.getMonth()]}</span>
                  </button>
                );
              })}
            </div>

            {!day ? (
              <p className="text-sm text-muted">Elegí un día para ver horarios.</p>
            ) : cargando ? (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded-lg border border-line/50 bg-bg" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {slots.map((t) => {
                  const isTaken = taken.has(t);
                  const active = slot === t;
                  return (
                    <button
                      key={t}
                      disabled={isTaken}
                      onClick={() => {
                        setSlot(t);
                        setErr(null);
                      }}
                      className={`rounded-lg border py-2.5 text-sm transition ${
                        isTaken
                          ? "cursor-not-allowed border-line/50 text-muted/40 line-through"
                          : active
                            ? "border-accent bg-accent text-on-accent"
                            : "border-line hover:border-accent/50"
                      }`}
                    >
                      {fmtTime(t)}
                    </button>
                  );
                })}
              </div>
            )}

            {err && (
              <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">
                {err}
              </div>
            )}

            {slot !== null && (
              <button
                onClick={confirmar}
                disabled={saving}
                className="mt-5 w-full rounded-full bg-accent py-3 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
              >
                {saving ? "Guardando…" : `Confirmar ${fmtTime(slot)}`}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}
