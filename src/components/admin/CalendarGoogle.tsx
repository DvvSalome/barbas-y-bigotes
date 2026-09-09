"use client";

import { botonClases } from "@/components/ui/Boton";
import { CloseIcon } from "@/components/icons";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  prepararCalendarios,
  compartirAgendasConBarberos,
  compartirAgendasCon,
  quitarCompartido,
  sincronizarCalendarAhora,
} from "@/lib/calendar-actions";
import type { CalendarEstado } from "@/lib/data/queries";

// Google Calendar en Equipo: la agenda de cada barbero vive en un calendario de
// Google que la app llena sola. Tres toques del dueño, en orden: crear las
// agendas, compartirlas con los barberos (usa el correo de avisos de arriba) y,
// si quiere ver todo desde su propio Google Calendar, poner su Gmail.
export function CalendarGoogle({
  estado,
  barberos,
  emails,
}: {
  estado: CalendarEstado;
  barberos: { id: string; nombre: string }[];
  emails: Record<string, string>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const [correo, setCorreo] = useState("");

  async function correr(id: string, fn: () => Promise<{ ok: boolean; error?: string; aviso?: string }>) {
    setBusy(id);
    setMsg(null);
    const res = await fn().catch(() => null);
    setBusy(null);
    setMsg(res?.ok ? { text: res.aviso ?? "Listo.", ok: true } : { text: res?.error ?? "No se pudo completar. Revisá la conexión.", ok: false });
    router.refresh();
  }

  const conAgenda = barberos.filter((b) => estado.agendas[b.id]);
  
  if (!estado.configurado) {
    return (
      <div className="rounded-2xl border border-warn/40 bg-panel p-4 text-[13px] text-warn">
        Falta la credencial de Google en el servidor (GOOGLE_CALENDAR_SA_JSON). Sin eso no se puede crear ninguna agenda.
      </div>
    );
  }

  return (
    <div className="grid gap-3">
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => correr("preparar", prepararCalendarios)}
            disabled={busy !== null}
            className={botonClases("primario")}
          >
            {busy === "preparar" ? "Creando…" : conAgenda.length ? "Revisar agendas" : "1 · Crear las agendas"}
          </button>
          <button
            type="button"
            onClick={() => correr("compartir", compartirAgendasConBarberos)}
            disabled={busy !== null || !conAgenda.length}
            className={botonClases("secundario")}
          >
            {busy === "compartir" ? "Compartiendo…" : "2 · Compartir con los barberos"}
          </button>
          <button
            type="button"
            onClick={() => correr("sync", sincronizarCalendarAhora)}
            disabled={busy !== null || !conAgenda.length}
            className={botonClases("secundario")}
          >
            {busy === "sync" ? "Sincronizando…" : "Sincronizar ahora"}
          </button>
        </div>
        <p className="mt-3 text-[12px] text-muted">
          {estado.sincronizadas} citas en Google Calendar · {estado.pendientes} por sincronizar
          {estado.errores.length > 0 && (
            <span className="text-warn"> · {estado.errores.length} con error (se reintentan solas)</span>
          )}
        </p>
        {estado.errores.length > 0 && (
          <ul className="mt-2 grid gap-1 text-[12px] text-warn">
            {estado.errores.slice(0, 3).map((e) => (
              <li key={e.reservaId}>
                {e.reservaId.slice(0, 8)}: {e.error}
              </li>
            ))}
          </ul>
        )}
        {msg && <p className={`mt-3 text-[12.5px] ${msg.ok ? "text-ok" : "font-semibold text-warn"}`}>{msg.text}</p>}
      </div>

      <ul className="grid gap-2">
        {barberos.map((b) => {
          const a = estado.agendas[b.id];
          const email = emails[b.id];
          return (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-line bg-panel px-3.5 py-3 text-[13px]">
              <span className="font-semibold text-ink">{b.nombre}</span>
              <span className={a?.compartidoCon ? "text-ok" : "text-muted"}>
                {!a && "Sin agenda todavía"}
                {a && a.compartidoCon && `Agenda compartida con ${a.compartidoCon}`}
                {a && !a.compartidoCon && (email ? `Agenda creada · falta compartirla con ${email}` : "Agenda creada · sin correo cargado arriba")}
              </span>
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!correo.trim()) return;
          correr("dueno", () => compartirAgendasCon(correo)).then(() => setCorreo(""));
        }}
        className="rounded-2xl border border-line bg-panel p-4"
      >
        <p className="text-[13px] font-semibold text-ink">Ver todas las agendas desde mi Google Calendar</p>
        <p className="mt-1 text-[12px] text-muted">
          Poné el Gmail del dueño (o del mostrador): recibe una agenda por barbero y ve todo junto en su calendario.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            type="email"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            placeholder="dueno@gmail.com"
            className="min-h-11 min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button type="submit" disabled={busy !== null || !correo.trim() || !conAgenda.length} className={botonClases("primario")}>
            {busy === "dueno" ? "Compartiendo…" : "Compartir"}
          </button>
        </div>
        {estado.compartidos.length > 0 && (
          <ul className="mt-3 flex flex-wrap gap-2">
            {estado.compartidos.map((c) => (
              <li key={c.email} className="flex items-center gap-1 rounded-full border border-line pl-3 text-[12px] text-ink">
                {c.email}
                <button
                  type="button"
                  onClick={() => correr(`quitar:${c.email}`, () => quitarCompartido(c.email))}
                  disabled={busy !== null}
                  className="grid h-11 w-11 place-items-center rounded-full text-muted transition hover:text-warn"
                  aria-label={`Quitar ${c.email}`}
                >
                  <CloseIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </form>

      <p className="text-[12px] text-muted">
        Cómo lo ve el barbero: le llega un correo de Google &ldquo;compartieron un calendario contigo&rdquo;, lo acepta y la agenda
        aparece en su app de Google Calendar. Ahí mismo, en la configuración de esa agenda, puede activar las notificaciones
        (por ejemplo 30 minutos antes de cada cita). Cada cita nueva, cambio o cancelación se refleja en minutos.
      </p>
    </div>
  );
}
