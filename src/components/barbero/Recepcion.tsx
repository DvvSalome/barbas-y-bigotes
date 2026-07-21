"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import { actualizarReserva } from "@/lib/actions";
import { faltaParaLlegar } from "@/lib/slots";
import type { Barbero } from "@/lib/data/types";
import type { AgendaItem } from "@/lib/data/queries";

// Vista MOSTRADOR: una sola pantalla compartida en el local, con una columna por
// barbero. Cualquiera del equipo marca llegadas y abre el cobro sin cambiar de
// sesión; la comisión igual cae en el barbero de la cita (el server la fija
// desde reservas.barbero_id, no desde quién está logueado).
const DONE = ["completada", "no_show", "cancelada"];

const CHIP: Record<string, string> = {
  pendiente: "bg-ink/10 text-muted",
  confirmada: "bg-accent/15 text-accent-soft",
  en_curso: "bg-ok/15 text-ok",
  completada: "bg-ok/15 text-ok",
  no_show: "bg-warn/15 text-warn",
  cancelada: "bg-ink/10 text-muted",
};
const ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En silla",
  completada: "Cobrada",
  no_show: "No llegó",
  cancelada: "Cancelada",
};

function hora(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "am" : "pm";
  h = ((h + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

const iniciales = (n: string) =>
  (n || "?").trim().split(/\s+/).slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");

export function Recepcion({
  agenda,
  barberos,
  sedeNombre,
  cobrado,
  porBarbero,
  onCobrar,
}: {
  agenda: AgendaItem[];
  barberos: Barbero[];
  sedeNombre: string;
  cobrado: number;
  porBarbero: Record<string, number>;
  /** Abre la hoja de cobro de la agenda normal (misma lógica de plata). */
  onCobrar: (reservaId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // Instante estable: evita recalcular "faltan Xh" en cada render (regla del
  // React Compiler). Basta con la frescura del refresh de la agenda.
  const [ahora] = useState(() => Date.now());

  async function marcar(r: AgendaItem, estado: string) {
    if (estado === "cancelada" && !window.confirm(`¿Cancelar la cita de ${r.cliente || "este cliente"} a las ${hora(r.inicio)}? Se le avisa al cliente y el cupo queda libre.`))
      return;
    setBusy(r.id);
    await actualizarReserva(r.id, estado === "en_curso" ? { estado, llegada: "a_tiempo" } : { estado });
    setBusy(null);
    router.refresh();
  }

  const totalCitas = agenda.length;
  const hechas = agenda.filter((r) => DONE.includes(r.estado)).length;

  return (
    <div>
      {/* Encabezado del local */}
      <div className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display text-[11px] font-bold uppercase tracking-[0.3em] text-accent-soft">
            Mostrador
          </p>
          <h1 className="mt-1 font-display text-[30px] font-bold uppercase leading-none">{sedeNombre}</h1>
          <p className="mt-1.5 text-[12.5px] text-muted">
            {hechas} de {totalCitas} atenciones cerradas hoy
          </p>
        </div>
        <div className="text-right">
          <div className="font-display text-[30px] font-bold leading-none tabular-nums text-ok">{cop(cobrado)}</div>
          <div className="text-[10px] uppercase tracking-[0.14em] text-muted">cobrado hoy en la sede</div>
        </div>
      </div>

      {/* Una columna por barbero */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {barberos.map((b) => {
          const suyas = agenda.filter((r) => r.barberoId === b.id);
          const activas = suyas.filter((r) => !DONE.includes(r.estado));
          const enSilla = suyas.find((r) => r.estado === "en_curso") ?? null;
          const cerradas = suyas.filter((r) => DONE.includes(r.estado)).length;

          return (
            <section
              key={b.id}
              className={`flex flex-col overflow-hidden rounded-[18px] border bg-panel ${
                enSilla ? "border-ok/45" : "border-line"
              }`}
            >
              {/* Cabecera del barbero */}
              <header className="flex items-center gap-3 border-b border-line/70 px-3.5 py-3">
                {b.fotoUrl ? (
                  <Image
                    src={b.fotoUrl}
                    alt={b.nombre}
                    width={44}
                    height={44}
                    className={`h-11 w-11 shrink-0 rounded-full object-cover object-top ring-2 ${
                      enSilla ? "ring-ok/60" : "ring-line"
                    }`}
                  />
                ) : (
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-elevated font-display text-sm font-bold text-ink ring-2 ring-line">
                    {iniciales(b.nombre)}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="truncate font-display text-[19px] font-bold uppercase leading-tight">
                    {b.nombre}
                  </div>
                  <div className="text-[11.5px] text-muted">
                    {enSilla ? "Atendiendo ahora" : activas.length ? `${activas.length} por atender` : "Sin citas activas"}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-display text-[15px] font-bold tabular-nums text-ok">
                    {cop(porBarbero[b.id] ?? 0)}
                  </div>
                  <div className="text-[9.5px] uppercase tracking-[0.1em] text-muted">{cerradas} cerradas</div>
                </div>
              </header>

              {/* Citas del barbero */}
              <div className="flex-1 divide-y divide-line/60">
                {activas.length === 0 && (
                  <p className="px-3.5 py-6 text-center text-[12.5px] text-muted">
                    Sin citas pendientes. Sumá un walk-in desde la agenda.
                  </p>
                )}
                {activas.map((r) => {
                  const enCurso = r.estado === "en_curso";
                  return (
                    <div key={r.id} className={`px-3.5 py-3 ${enCurso ? "bg-ok/[0.05]" : ""}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="w-[52px] shrink-0 font-display text-[17px] font-bold tabular-nums text-accent-soft">
                          {hora(r.inicio)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold">{r.cliente || "Walk-in"}</span>
                          <span className="block truncate text-[11.5px] text-muted">{r.servicio || "—"}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          <span
                            className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                              CHIP[r.estado] ?? "bg-ink/10 text-muted"
                            }`}
                          >
                            {ESTADO[r.estado] ?? r.estado}
                          </span>
                          {/* Señal de confirmación: solo relevante en citas por venir
                              (una cita reservada por app; el walk-in llega en persona). */}
                          {!enCurso && r.canal !== "walkin" && (
                            <span
                              className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${
                                r.confirmado ? "bg-ok/15 text-ok" : "bg-warn/15 text-warn"
                              }`}
                            >
                              {r.confirmado ? "✓ confirmó" : "sin confirmar"}
                            </span>
                          )}
                        </span>
                      </div>

                      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                        {enCurso ? (
                          <button
                            onClick={() => onCobrar(r.id)}
                            className="rounded-lg bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-3.5 py-2 text-[12.5px] font-bold text-on-accent transition hover:brightness-105"
                          >
                            Cobrar
                          </button>
                        ) : (
                          (() => {
                            const temprano = faltaParaLlegar(r.inicio, ahora);
                            return (
                              <button
                                onClick={() => marcar(r, "en_curso")}
                                disabled={busy === r.id || temprano !== null}
                                title={temprano ? "Todavía no empieza esta cita" : undefined}
                                className="rounded-lg bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-3.5 py-2 text-[12.5px] font-bold text-on-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {temprano ? `Llegó · ${temprano}` : "✓ Llegó"}
                              </button>
                            );
                          })()
                        )}
                        <button
                          onClick={() => marcar(r, "no_show")}
                          disabled={busy === r.id}
                          className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:text-ink disabled:opacity-50"
                        >
                          No llegó
                        </button>
                        {!enCurso && (
                          <button
                            onClick={() => marcar(r, "cancelada")}
                            disabled={busy === r.id}
                            className="rounded-lg border border-line px-3 py-2 text-[12px] text-muted transition hover:border-accent/40 hover:text-accent-soft disabled:opacity-50"
                          >
                            Cancelar
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
