"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import {
  registrarWalkin,
  completarReserva,
  actualizarReserva,
  historialCliente,
  validarCupon,
  proponerAdelanto,
  getTarjetaParaCobro,
  type ActionResult,
} from "@/lib/actions";
import { calcularCobro } from "@/lib/cobro";
import { CERQUILLO_EXCLUIDOS } from "@/lib/tarjeta";
import { categorias } from "@/lib/data/seed";
import type { Categoria } from "@/lib/data/types";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { MedioLogo } from "@/components/staff/MedioLogo";
import { Recepcion } from "@/components/barbero/Recepcion";
import type { Sede, SedeId, Barbero, Servicio, Producto } from "@/lib/data/types";
import type { AgendaItem, MedioPago, PrecioServicioStaff } from "@/lib/data/queries";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-accent focus:outline-none";

const ESTADO: Record<string, string> = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  en_curso: "En curso",
  completada: "Completada",
  cancelada: "Cancelada",
  no_show: "No llegó",
};

type HistItem = { id: string; total: number; fecha: string; barbero: string; items: string[] };

function hora(iso: string) {
  const d = new Date(iso);
  let h = d.getHours();
  const m = d.getMinutes();
  const ap = h < 12 ? "am" : "pm";
  h = ((h + 11) % 12) + 1;
  return `${h}:${m.toString().padStart(2, "0")} ${ap}`;
}

const DONE = ["completada", "no_show", "cancelada"];

// Chips de estado (mapa del prototipo, resuelto con tokens del staff para que el
// tema claro/oscuro entinte solo). El punto interno hereda currentColor.
const CHIP: Record<string, string> = {
  pendiente: "bg-ink/10 text-muted",
  confirmada: "bg-accent/15 text-accent-soft",
  en_curso: "bg-ok/15 text-ok",
  completada: "bg-ok/15 text-ok",
  no_show: "bg-warn/15 text-warn",
  cancelada: "bg-ink/10 text-muted",
};
const chipCls = (estado: string) => CHIP[estado] ?? "bg-ink/10 text-muted";

// Avatar del cliente: en la agenda no hay foto, así que van las iniciales sobre un
// tono cálido derivado del nombre (tonos del prototipo). Son decorativos y estables
// por nombre; no hay token para ellos, por eso van en crudo.
const AVI_TONOS = ["#a3907c", "#e8675c", "#c9b18a", "#8f7a60", "#d9a066"];
const aviTono = (n: string) => AVI_TONOS[(n?.trim().length ?? 0) % AVI_TONOS.length];
const iniciales = (n: string) => {
  const parts = (n || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  return parts.slice(0, 2).map((p) => p.charAt(0).toUpperCase()).join("");
};

// Origen de la cita, en el copy del prototipo.
const canalLabel = (r: AgendaItem) =>
  r.canal === "walkin"
    ? "Sin reserva · en la barbería"
    : r.estado === "pendiente"
      ? "Reservó por la app · aún no confirma el correo"
      : "Reservó por la app";

export function AgendaList({
  agenda,
  sedes,
  barberos,
  servicios,
  preciosServicios,
  productos,
  medios,
  esAdmin = false,
  hoyLabel,
  subtitulo,
  cobradoHoy,
  mostrador,
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  productos: Producto[];
  medios: MedioPago[];
  esAdmin?: boolean;
  hoyLabel: string;
  subtitulo: string;
  cobradoHoy: number;
  /** Datos de TODA la sede para la vista mostrador (solo sesión de barbero). */
  mostrador?: {
    sedeNombre: string;
    agendaSede: AgendaItem[];
    barberosSede: Barbero[];
    cobradoSede: number;
    porBarbero: Record<string, number>;
  };
}) {
  const router = useRouter();
  // Vista activa: "mia" (la del barbero) o "sede" (mostrador compartido). Vive acá
  // para que la hoja de cobro (completeFor) sea la misma en las dos.
  // Arranca en MOSTRADOR: el negocio se opera desde el equipo del local, con la
  // sede entera a la vista. "Mi agenda" queda para el barbero que mira su día
  // desde el celular, que es el caso secundario.
  const [vista, setVista] = useState<"mia" | "sede">(mostrador ? "sede" : "mia");
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [ventaOpen, setVentaOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [terminadasOpen, setTerminadasOpen] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const freeSlots = agenda.filter((item) => ["cancelada", "no_show"].includes(item.estado));

  // Agenda HERO: activos primero, con el que está en la silla (en_curso) al tope;
  // el resto conserva el orden por hora (getAgendaHoy ya ordena por inicio).
  const activos = agenda.filter((r) => !DONE.includes(r.estado));
  const hechas = agenda.filter((r) => DONE.includes(r.estado));
  const activosOrd = [...activos].sort(
    (a, b) => (b.estado === "en_curso" ? 1 : 0) - (a.estado === "en_curso" ? 1 : 0),
  );
  const hero = activosOrd.length > 0 ? activosOrd[0] : null;
  const resto = activosOrd.slice(1);
  const progPct = agenda.length ? Math.round((hechas.length / agenda.length) * 100) : 0;
  const sigue = activosOrd.find((r) => r.estado !== "en_curso") ?? null;

  async function setEstado(id: string, patch: { estado?: string; llegada?: string }) {
    setBusy(true);
    await actualizarReserva(id, patch);
    setBusy(false);
    router.refresh();
  }

  // Cancelar por la barbería: confirmación nativa, libera el cupo (constraint y
  // disponibilidad excluyen canceladas) y le llega push al cliente.
  function cancelarCita(r: AgendaItem) {
    if (!window.confirm(`¿Cancelar la cita de ${r.cliente || "este cliente"} a las ${hora(r.inicio)}? Se le avisa al cliente y el cupo queda libre.`)) return;
    setEstado(r.id, { estado: "cancelada" });
  }

  async function showHistory(ref: string | null, id: string) {
    if (!ref) return;
    setHistoryFor(id);
    setHistory(null);
    const h = await historialCliente(ref);
    setHistory(h as HistItem[]);
  }

  // Precio del servicio de la cita, resuelto desde preciosServicios (los mismos
  // que usa el cobro). null si es walk-in sin servicio o no hay precio en la sede.
  const precioDe = (r: AgendaItem): number | null => {
    if (!r.servicioId) return null;
    return preciosServicios.find((s) => s.id === r.servicioId)?.preciosPorSede[r.sede] ?? null;
  };
  const durDe = (r: AgendaItem): number | null =>
    servicios.find((s) => s.id === r.servicioId)?.duracionMin ?? null;

  // Adelanto: si un cupo anterior quedó libre (no llegó / canceló), se le puede
  // ofrecer al cliente adelantar su cita. Conserva la lógica previa.
  const proposalInfo = (r: AgendaItem) => {
    const earliestSlot: AgendaItem | undefined = freeSlots
      .filter(
        (fs) =>
          fs.barberoId === r.barberoId &&
          new Date(fs.inicio).getTime() < new Date(r.inicio).getTime(),
      )
      .sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0];
    let hasPendingProposal = false;
    let proposedTimeStr = "";
    if (r.nota) {
      try {
        const obj = JSON.parse(r.nota);
        if (obj.propuesta_adelanto?.estado === "pendiente") {
          hasPendingProposal = true;
          proposedTimeStr = new Date(obj.propuesta_adelanto.inicio).toLocaleTimeString("es-CO", {
            hour: "numeric",
            minute: "2-digit",
          });
        }
      } catch {}
    }
    return { earliestSlot, hasPendingProposal, proposedTimeStr };
  };

  const ofrecerAdelanto = async (r: AgendaItem, inicioISO: string) => {
    setBusy(true);
    const res = await proponerAdelanto({ reservaId: r.id, inicioISO });
    setBusy(false);
    if (res.ok) {
      alert("Propuesta de adelanto enviada al cliente.");
      router.refresh();
    } else {
      alert(res.error);
    }
  };

  // Panel de historial (mismo markup para hero y filas de "Después").
  const historialPanel = () => (
    <div className="mt-3 rounded-xl border border-line bg-bg p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Historial del cliente</span>
        <button onClick={() => setHistoryFor(null)} className="text-xs text-muted hover:text-ink">
          cerrar
        </button>
      </div>
      {history === null ? (
        <p className="text-sm text-muted">Cargando…</p>
      ) : history.length === 0 ? (
        <p className="text-sm text-muted">Sin visitas previas.</p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {history.map((h) => (
            <li key={h.id} className="flex justify-between gap-3">
              <span className="text-muted">
                {new Date(h.fecha).toLocaleDateString("es-CO")} · {h.items.join(", ") || "—"}
              </span>
              <span className="text-ink">{cop(h.total)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  // Hoja de cobro (CheckoutForm): lógica de cobro/tarjeta intacta; solo cambia
  // desde dónde se dispara (botón "Cobrar" del hero o de una fila).
  const cobroDe = (r: AgendaItem) => (
    <CheckoutForm
      reserva={r}
      sedes={sedes}
      barberos={barberos}
      servicios={servicios}
      preciosServicios={preciosServicios}
      productos={productos}
      medios={medios}
      esAdmin={esAdmin}
      onDone={() => {
        setCompleteFor(null);
        router.refresh();
      }}
      onCancel={() => setCompleteFor(null)}
    />
  );

  // Tarjeta HERO del cliente en foco (en la silla = verde, próximo = rojo).
  const renderHero = (r: AgendaItem) => {
    const enCurso = r.estado === "en_curso";
    const precio = precioDe(r);
    const dur = durDe(r);
    const { earliestSlot, hasPendingProposal, proposedTimeStr } = proposalInfo(r);
    return (
      <div
        className={`relative overflow-hidden rounded-[22px] border bg-panel p-4 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.8)] ${
          enCurso ? "border-ok/50" : "border-accent/40"
        }`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent ${
            enCurso ? "from-ok/15" : "from-accent/15"
          }`}
        />
        <span aria-hidden className={`absolute inset-y-0 left-0 w-1 ${enCurso ? "bg-ok" : "bg-accent"}`} />
        <div className="relative">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-[0.1em] ${
                enCurso ? "bg-ok/15 text-ok" : chipCls(r.estado)
              }`}
            >
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
              {enCurso ? "En la silla ahora" : ESTADO[r.estado] ?? r.estado}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="font-display text-3xl font-bold leading-none tabular-nums">{hora(r.inicio)}</span>
              {dur != null && <span className="text-[11px] text-muted">· {dur} min</span>}
            </span>
          </div>

          <div className="mt-3.5 flex items-center gap-3.5">
            <span
              className={`grid h-[66px] w-[66px] shrink-0 place-items-center rounded-full font-display text-[26px] font-bold text-[#0c0b0a] ring-2 ${
                enCurso ? "ring-ok/70" : "ring-accent/60"
              }`}
              style={{ background: aviTono(r.cliente) }}
            >
              {iniciales(r.cliente || "Walk-in")}
            </span>
            <div className="min-w-0">
              <div className="truncate font-display text-[27px] font-bold uppercase leading-none">
                {r.cliente || "Walk-in"}
              </div>
              <div className="mt-1 truncate text-[13.5px] text-ink/80">{r.servicio || "—"}</div>
            </div>
          </div>

          <div className="mt-3.5 flex items-center justify-between gap-3 border-t border-line pt-3">
            <span className="min-w-0 truncate text-[11.5px] text-muted">{canalLabel(r)}</span>
            {precio != null && (
              <span className="shrink-0 font-display text-2xl font-bold tabular-nums">{cop(precio)}</span>
            )}
          </div>

          <div className="mt-3.5 flex flex-col gap-2">
            {enCurso ? (
              <button
                onClick={() => setCompleteFor(completeFor === r.id ? null : r.id)}
                className="min-h-[58px] w-full whitespace-nowrap rounded-[15px] bg-gradient-to-b from-accent-soft to-accent text-base font-extrabold text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.6)] transition hover:brightness-105"
              >
                {precio != null ? `Cobrar ${cop(precio)} →` : "Cobrar →"}
              </button>
            ) : (
              <>
                <button
                  onClick={() => setEstado(r.id, { estado: "en_curso", llegada: "a_tiempo" })}
                  disabled={busy}
                  className="min-h-[58px] w-full rounded-[15px] bg-gradient-to-b from-accent-soft to-accent text-base font-extrabold text-on-accent shadow-[0_12px_26px_-10px_rgba(210,63,52,0.6)] transition hover:brightness-105 disabled:opacity-50"
                >
                  ✓ Llegó · pasá a la silla
                </button>
                {r.estado === "pendiente" && (
                  <button
                    onClick={() => setEstado(r.id, { estado: "confirmada" })}
                    disabled={busy}
                    className="min-h-[44px] w-full rounded-xl border border-line text-[13px] text-ink/80 transition hover:border-accent/50 disabled:opacity-50"
                  >
                    El cliente confirmó (llamada o WhatsApp)
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => setEstado(r.id, { estado: "no_show" })}
                    disabled={busy}
                    className="min-h-[40px] flex-1 text-[13px] text-muted transition hover:text-ink disabled:opacity-50"
                  >
                    No llegó · avisar a la fila
                  </button>
                  <button
                    onClick={() => cancelarCita(r)}
                    disabled={busy}
                    className="min-h-[40px] flex-1 text-[13px] text-muted transition hover:text-accent-soft disabled:opacity-50"
                  >
                    Cancelar cita
                  </button>
                </div>
              </>
            )}
            {(r.clienteRef || hasPendingProposal || earliestSlot) && (
              <div className="flex flex-wrap justify-center gap-2 pt-0.5">
                {r.clienteRef && (
                  <button
                    onClick={() => showHistory(r.clienteRef, r.id)}
                    className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
                  >
                    Ver historial
                  </button>
                )}
                {hasPendingProposal && (
                  <span className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-warn">
                    Propuesto {proposedTimeStr}
                  </span>
                )}
                {earliestSlot && !hasPendingProposal && (
                  <button
                    onClick={() => ofrecerAdelanto(r, earliestSlot.inicio)}
                    disabled={busy}
                    className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs text-accent-soft transition hover:bg-accent/15 disabled:opacity-50"
                  >
                    Ofrecer adelanto ({hora(earliestSlot.inicio)})
                  </button>
                )}
              </div>
            )}
          </div>

          {historyFor === r.id && historialPanel()}
        </div>
      </div>
    );
  };

  // La hoja de cobro se busca en la agenda de la sede también: desde el mostrador
  // se cobra la cita de otro barbero, que no está en `agenda` (la propia).
  const reservaEnCobro =
    agenda.find((x) => x.id === completeFor) ??
    mostrador?.agendaSede.find((x) => x.id === completeFor) ??
    null;

  return (
    <div>
      {/* Cambio de vista: mi agenda (celular) o mostrador (equipo del local) */}
      {mostrador && (
        <div className="mb-4 inline-flex rounded-full border border-line bg-panel p-1">
          {(
            [
              { id: "mia", label: "Mi agenda" },
              { id: "sede", label: "Mostrador" },
            ] as const
          ).map((o) => (
            <button
              key={o.id}
              onClick={() => setVista(o.id)}
              className={`rounded-full px-4 py-1.5 text-[12.5px] font-semibold transition ${
                vista === o.id ? "bg-elevated text-ink shadow-[inset_0_0_0_1px_var(--line)]" : "text-muted hover:text-ink"
              }`}
            >
              {o.label}
            </button>
          ))}
        </div>
      )}

      {mostrador && vista === "sede" ? (
        <>
          <Recepcion
            agenda={mostrador.agendaSede}
            barberos={mostrador.barberosSede}
            sedeNombre={mostrador.sedeNombre}
            cobrado={mostrador.cobradoSede}
            porBarbero={mostrador.porBarbero}
            onCobrar={(id) => setCompleteFor(completeFor === id ? null : id)}
          />
          {/* La hoja de cobro estaba fuera de todo límite de ancho: en el equipo
              del mostrador se estiraba a los 1152px del contenedor y los chips
              quedaban desparramados de punta a punta. Misma medida que la agenda. */}
          {reservaEnCobro && <div className="mx-auto w-full max-w-2xl">{cobroDe(reservaEnCobro)}</div>}
        </>
      ) : (
        <div className={mostrador ? "mx-auto w-full max-w-2xl" : ""}>
      {/* Encabezado del día + cobrado hoy */}
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-[26px] font-bold uppercase leading-none">Hoy, {hoyLabel}</h1>
          {subtitulo && <p className="mt-1 truncate text-xs text-muted">{subtitulo}</p>}
        </div>
        <div className="shrink-0 text-right">
          <div className="font-display text-[22px] font-bold tabular-nums text-ok">{cop(cobradoHoy)}</div>
          <div className="text-[10px] uppercase tracking-[0.12em] text-muted">cobrado hoy</div>
        </div>
      </div>

      {/* Progreso del día */}
      <div className="mb-3 rounded-2xl border border-line bg-panel px-3.5 py-3">
        <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.1em] text-muted">
          <span>Tu día</span>
          <span>
            {hechas.length} de {agenda.length} atenciones
          </span>
        </div>
        <div className="mt-1.5 h-[5px] overflow-hidden rounded-full bg-ink/10">
          <div
            className="h-full rounded-full"
            style={{ width: `${progPct}%`, background: "linear-gradient(90deg, var(--bar), var(--accent))" }}
          />
        </div>
        {sigue && (
          <div className="mt-2 text-[12.5px]">
            <span className="text-muted">Sigue:</span>{" "}
            <b>
              {sigue.cliente || "Walk-in"} · {hora(sigue.inicio)}
            </b>
          </div>
        )}
      </div>

      {/* Walk-in / Venta rápida (como estaban) */}
      <div className="mb-4 space-y-3">
        {!walkinOpen && !ventaOpen && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setWalkinOpen(true)}
              className="rounded-full bg-gradient-to-b from-accent-soft to-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
            >
              + Cliente sin reserva (walk-in)
            </button>
            <button
              onClick={() => setVentaOpen(true)}
              className="rounded-full border border-accent/50 bg-accent/[0.06] px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent-soft transition hover:bg-accent/15"
            >
              Venta rápida
            </button>
          </div>
        )}
        {walkinOpen && (
          <WalkinForm
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            onDone={() => {
              setWalkinOpen(false);
              router.refresh();
            }}
            onCancel={() => setWalkinOpen(false)}
          />
        )}
        {ventaOpen && (
          <CheckoutForm
            reserva={null}
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            preciosServicios={preciosServicios}
            productos={productos}
            medios={medios}
            esAdmin={esAdmin}
            onDone={() => {
              setVentaOpen(false);
              router.refresh();
            }}
            onCancel={() => setVentaOpen(false)}
          />
        )}
      </div>

      {/* Tarjeta HERO del cliente en foco, o silla libre */}
      {hero ? (
        renderHero(hero)
      ) : (
        <div className="rounded-[18px] border border-dashed border-ink/15 px-5 py-9 text-center">
          <div className="font-display text-[22px] font-bold uppercase">Silla libre</div>
          <div className="mx-auto mt-1.5 max-w-xs text-[13px] text-muted">
            No tenés a nadie en la silla ahora. Sumá un walk-in o esperá la próxima cita.
          </div>
        </div>
      )}

      {/* Hoja de cobro en un punto de montaje ESTABLE (no dentro del hero/fila):
          al cobrar, el realtime refresca y la cita salta a "Terminadas"; si el
          form vivía dentro de la fila se desmontaba y el ¡Cobrado! (con el botón
          de reseña) desaparecía antes de poder tocarlo (bug cazado en QA). Acá
          sobrevive al reordenamiento hasta que el barbero toque "Listo". */}
      {reservaEnCobro && cobroDe(reservaEnCobro)}
        </div>
      )}

      {/* Después: resto de la agenda en filas compactas (tap para acciones) */}
      {resto.length > 0 && (
        <div className="mt-6">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-muted">Después</span>
            <span aria-hidden className="h-px flex-1 bg-line" />
          </div>
          <div className="space-y-2">
            {resto.map((r) => {
              const abierto = expandedRow === r.id;
              const enCurso = r.estado === "en_curso";
              const { earliestSlot, hasPendingProposal, proposedTimeStr } = proposalInfo(r);
              return (
                <div key={r.id} className="overflow-hidden rounded-2xl border border-line bg-panel">
                  <button
                    onClick={() => setExpandedRow(abierto ? null : r.id)}
                    className="flex w-full items-center gap-3 px-3.5 py-3 text-left transition hover:bg-ink/[0.02]"
                  >
                    <span className="w-12 shrink-0 font-display text-lg font-bold tabular-nums text-accent-soft">
                      {hora(r.inicio)}
                    </span>
                    <span
                      className="grid h-[38px] w-[38px] shrink-0 place-items-center rounded-full font-display text-sm font-bold text-[#0c0b0a]"
                      style={{ background: aviTono(r.cliente) }}
                    >
                      {iniciales(r.cliente || "Walk-in")}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold">{r.cliente || "Walk-in"}</span>
                      <span className="block truncate text-[11.5px] text-muted">{r.servicio || "—"}</span>
                    </span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${chipCls(r.estado)}`}
                    >
                      {ESTADO[r.estado] ?? r.estado}
                    </span>
                    <span aria-hidden className="shrink-0 text-xs text-muted">
                      {abierto ? "▴" : "▾"}
                    </span>
                  </button>
                  {abierto && (
                    <div className="border-t border-line/60 px-3.5 py-3">
                      <div className="flex flex-wrap gap-2">
                        {r.clienteRef && (
                          <button
                            onClick={() => showHistory(r.clienteRef, r.id)}
                            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink"
                          >
                            Ver historial
                          </button>
                        )}
                        {hasPendingProposal && (
                          <span className="rounded-full border border-warn/30 bg-warn/10 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider text-warn">
                            Propuesto {proposedTimeStr}
                          </span>
                        )}
                        {earliestSlot && !hasPendingProposal && (
                          <button
                            onClick={() => ofrecerAdelanto(r, earliestSlot.inicio)}
                            disabled={busy}
                            className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs text-accent-soft transition hover:bg-accent/15 disabled:opacity-50"
                          >
                            Ofrecer adelanto ({hora(earliestSlot.inicio)})
                          </button>
                        )}
                        {enCurso ? (
                          <button
                            onClick={() => setCompleteFor(completeFor === r.id ? null : r.id)}
                            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft"
                          >
                            Cobrar
                          </button>
                        ) : (
                          <button
                            onClick={() => setEstado(r.id, { estado: "en_curso", llegada: "a_tiempo" })}
                            disabled={busy}
                            className="rounded-full border border-line px-3 py-1.5 text-xs transition hover:border-accent/50 disabled:opacity-50"
                          >
                            Llegó · a la silla
                          </button>
                        )}
                        <button
                          onClick={() => setEstado(r.id, { estado: "no_show" })}
                          disabled={busy}
                          className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink disabled:opacity-50"
                        >
                          No llegó
                        </button>
                        {!enCurso && (
                          <button
                            onClick={() => cancelarCita(r)}
                            disabled={busy}
                            className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:border-accent/40 hover:text-accent-soft disabled:opacity-50"
                          >
                            Cancelar cita
                          </button>
                        )}
                      </div>
                      {historyFor === r.id && historialPanel()}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Terminadas hoy (colapsable) */}
      {hechas.length > 0 && (
        <div className="mt-6">
          <button
            onClick={() => setTerminadasOpen((v) => !v)}
            className="min-h-[46px] w-full rounded-[13px] border border-line text-[13px] font-bold text-muted transition hover:text-ink"
          >
            Terminadas hoy ({hechas.length}) {terminadasOpen ? "▲" : "▼"}
          </button>
          {terminadasOpen && (
            <div className="mt-2 space-y-1.5">
              {hechas.map((r) => {
                const precio = precioDe(r);
                return (
                  <div
                    key={r.id}
                    className="flex items-center gap-3 rounded-xl border border-line/60 bg-panel px-3.5 py-2.5 opacity-75"
                  >
                    <span className="w-12 shrink-0 font-display text-sm tabular-nums text-muted">{hora(r.inicio)}</span>
                    <span className="min-w-0 flex-1 truncate text-sm">{r.cliente || "Walk-in"}</span>
                    <span
                      className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide ${chipCls(r.estado)}`}
                    >
                      {ESTADO[r.estado] ?? r.estado}
                    </span>
                    {precio != null && (
                      <span className="shrink-0 text-[12.5px] tabular-nums text-muted">{cop(precio)}</span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function WalkinForm({
  sedes,
  barberos,
  servicios,
  onDone,
  onCancel,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState("");
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [fidelizar, setFidelizar] = useState(true);
  const [saving, setSaving] = useState(false);
  const sedeBarberos = barberos.filter((b) => b.sede === sede);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberoId) {
      alert("Elegí el barbero");
      return;
    }
    setSaving(true);
    const res = await registrarWalkin({ sede, barberoId, servicioId, clienteNombre: nombre, telefono: tel, fidelizar });
    setSaving(false);
    if (res.ok) {
      if (res.encolado) {
        const hasta = res.esperaHasta ? ` (~${hora(res.esperaHasta)})` : "";
        alert(`El barbero está ocupado. ${nombre.trim() || "El cliente"} quedó en la lista de espera${hasta}.`);
      }
      onDone();
    } else alert(res.error);
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-2">
      <select value={sede} onChange={(e) => { setSede(e.target.value as typeof sede); setBarberoId(""); }} className={fld}>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
      <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
        <option value="">Barbero…</option>
        {sedeBarberos.map((b) => (
          <option key={b.id} value={b.id}>{b.nombre}</option>
        ))}
      </select>
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className={fld} />
      <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Teléfono" inputMode="tel" className={fld} />
      <select value={servicioId} onChange={(e) => setServicioId(e.target.value)} className={`${fld} sm:col-span-2`}>
        <option value="">Servicio (opcional)…</option>
        {servicios.map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
      <label className="flex items-center gap-2 text-sm text-muted sm:col-span-2">
        <input type="checkbox" checked={fidelizar} onChange={(e) => setFidelizar(e.target.checked)} className="accent-accent" />
        Inscribir en fidelización (gana puntos por la visita)
      </label>
      <div className="flex gap-2 sm:col-span-2">
        <button disabled={saving} className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
          {saving ? "Agregando…" : "Agregar a la agenda"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-line px-6 py-2.5 text-sm text-muted transition hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}

const PROPINA_CHIPS = [2000, 5000, 10000];

// Form de cobro: cierra una reserva (servicio fijo + adicionales + consumos +
// propina + nota) o registra una venta rápida (reserva null: sin cita).
function CheckoutForm({
  reserva,
  sedes,
  barberos,
  servicios,
  preciosServicios,
  productos,
  medios,
  esAdmin = false,
  onDone,
  onCancel,
}: {
  reserva: AgendaItem | null;
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  productos: Producto[];
  medios: MedioPago[];
  esAdmin?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const rapida = !reserva;
  // Token de idempotencia: se genera UNA vez por apertura del form (el initializer
  // de useState corre solo en el primer render). En la venta rápida es el backstop
  // anti doble-cobro (no hay reserva que reclamar); en el cobro de reserva no
  // molesta (el claim ya protege). Al cerrar y reabrir el form, el componente se
  // remonta y nace un token nuevo → cada cobro real usa su propio token.
  const [idemToken] = useState(() => crypto.randomUUID());
  const [sede, setSede] = useState(reserva?.sede ?? sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState(""); // venta rápida: el admin puede cobrar por otro
  const [nombre, setNombre] = useState(""); // venta rápida: nombre del cliente (opcional)
  const [extras, setExtras] = useState<string[]>([]);
  // Acordeón de adicionales: una categoría abierta a la vez, todas cerradas al
  // entrar (lo normal es cobrar la cita tal cual, sin sumar nada).
  const [catAbierta, setCatAbierta] = useState<Categoria | null>(null);
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [propina, setPropina] = useState(0);
  const [propinaOtra, setPropinaOtra] = useState(false); // "Otra…" abre el input libre
  const [nota, setNota] = useState("");
  const [medio, setMedio] = useState(medios[0]?.slug ?? "");
  const [saving, setSaving] = useState(false);
  const [cupon, setCupon] = useState("");
  const [cuponInfo, setCuponInfo] = useState<{
    ok: boolean;
    msg: string;
    tipo?: "porcentaje" | "monto";
    valor?: number;
  } | null>(null);
  const [resumen, setResumen] = useState<{
    total: number;
    descuento: number;
    propina: number;
    puntos: number;
    tarjeta?: ActionResult["tarjeta"];
    resenaUrl?: string | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Estado de la tarjeta de cortes del cliente (solo cobro de reserva con cliente).
  // Solo se setea si hay un beneficio (5º/10º); el server es la fuente de verdad.
  const [tarjeta, setTarjeta] = useState<{ tipo: "50%" | "gratis"; descuento: number } | null>(null);
  useEffect(() => {
    if (!reserva?.clienteRef) return;
    let vivo = true;
    getTarjetaParaCobro(reserva.clienteRef, reserva.sede).then((r) => {
      if (vivo && r.ok && r.tipo) setTarjeta({ tipo: r.tipo, descuento: r.descuento });
    });
    return () => {
      vivo = false;
    };
  }, [reserva?.clienteRef, reserva?.sede]);

  const sedeId = sede as SedeId;
  const serviciosSede = servicios.filter((s) => s.precios[sedeId] != null);
  const productosSede = productos.filter((p) => p.sede === sedeId);
  const barberosSede = barberos.filter((b) => b.sede === sedeId);
  // Servicio FIJO de la reserva: se resuelve nombre+precio desde preciosServicios
  // (TODOS los servicios, activos e inactivos) para que el total en vivo coincida
  // con lo que cobra el server aunque el admin haya desactivado el servicio. Los
  // chips de adicionales siguen usando `servicios` (solo activos, más abajo).
  const servicioFijo = reserva?.servicioId
    ? preciosServicios.find((s) => s.id === reserva.servicioId) ?? null
    : null;
  const precioFijo = servicioFijo?.preciosPorSede[sedeId];

  // Los adicionales EXCLUYEN el servicio de la cita. Estaba en las dos partes:
  // fijo arriba y además como chip, y tocarlo lo sumaba dos veces al total (y el
  // server hacía lo mismo, así que se cobraba de más de verdad).
  const extrasPorCategoria = (Object.keys(categorias) as Categoria[]).flatMap((cat) => {
    const items = serviciosSede.filter((s) => s.categoria === cat && s.id !== servicioFijo?.id);
    return items.length ? [{ cat, label: categorias[cat], items }] : [];
  });

  function cambiarSede(id: string) {
    // Cambiar de sede cambia precios y catálogo: se resetea lo elegido.
    setSede(id);
    setBarberoId("");
    setExtras([]);
    setProdQty({});
  }

  function setQty(id: string, q: number) {
    setProdQty((prev) => {
      const n = { ...prev };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  }

  function toggleExtra(id: string) {
    setExtras((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function chequearCupon() {
    if (!cupon.trim()) return;
    const v = await validarCupon(cupon);
    if (v.ok) {
      const detalle = v.tipo === "porcentaje" ? `${v.valor}% de descuento` : `${cop(v.valor!)} de descuento`;
      setCuponInfo({ ok: true, msg: `${v.codigo}: ${detalle}`, tipo: v.tipo, valor: v.valor });
    } else {
      setCuponInfo({ ok: false, msg: v.error ?? "Cupón inválido" });
    }
  }

  // Detección de "corte" (igual criterio que la tarjeta): categoría cortes/combos
  // menos los cerquillos. Sirve para saber si esta venta suma un sello y aplica el
  // beneficio, para que el total en vivo coincida con lo que recomputa el server.
  const esCorteId = (id: string | null | undefined): boolean => {
    if (!id) return false;
    const s = servicios.find((x) => x.id === id);
    return s ? (s.categoria === "cortes" || s.categoria === "combos") && !CERQUILLO_EXCLUIDOS.has(s.id) : false;
  };
  const preciosCortePreview: number[] = [];
  if (esCorteId(reserva?.servicioId) && precioFijo != null) preciosCortePreview.push(precioFijo);
  for (const id of extras) {
    if (esCorteId(id)) preciosCortePreview.push(serviciosSede.find((s) => s.id === id)?.precios[sedeId] ?? 0);
  }
  // El beneficio se topa al precio de la línea de corte más cara (como el server).
  const precioCorteMax = preciosCortePreview.length ? Math.max(...preciosCortePreview) : null;
  const descuentoTarjeta = tarjeta && precioCorteMax != null ? Math.min(tarjeta.descuento, precioCorteMax) : 0;

  // Total en vivo con la MISMA matemática del servidor (calcularCobro).
  const vivo = calcularCobro({
    items: [
      ...(precioFijo != null ? [{ precio: precioFijo, cantidad: 1 }] : []),
      ...extras.map((id) => ({ precio: serviciosSede.find((s) => s.id === id)?.precios[sedeId] ?? 0, cantidad: 1 })),
      ...Object.entries(prodQty).map(([id, cantidad]) => ({
        precio: productosSede.find((p) => p.id === id)?.precio ?? 0,
        cantidad,
      })),
    ],
    cupon: cuponInfo?.ok && cuponInfo.tipo ? { tipo: cuponInfo.tipo, valor: cuponInfo.valor ?? 0 } : null,
    propina,
    descuentoExtra: descuentoTarjeta,
  });
  const sinItems = rapida && extras.length === 0 && Object.keys(prodQty).length === 0;

  async function submit() {
    if (sinItems) {
      setErr("Agregá al menos un servicio o producto.");
      return;
    }
    if (!medio) {
      setErr("Elegí el medio de pago.");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await completarReserva({
      reservaId: reserva?.id ?? null,
      sede,
      barberoId: reserva ? reserva.barberoId : barberoId || null,
      clienteRef: reserva?.clienteRef ?? null,
      clienteNombre: rapida ? nombre : undefined,
      servicioId: reserva?.servicioId ?? null,
      serviciosExtra: extras,
      medio,
      productos: Object.entries(prodQty).map(([id, cantidad]) => ({ id, cantidad })),
      propina,
      nota,
      cuponCodigo: cupon.trim() || undefined,
      idemToken,
    });
    setSaving(false);
    if (res.ok)
      setResumen({
        total: res.total ?? 0,
        descuento: res.descuento ?? 0,
        propina: res.propina ?? 0,
        puntos: res.puntos ?? 0,
        tarjeta: res.tarjeta,
        resenaUrl: res.resenaUrl,
      });
    else setErr(res.error ?? "No se pudo completar");
  }

  if (resumen) {
    return (
      <div className={`${rapida ? "" : "mt-3 "}rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm`}>
        <div className="font-display text-xl text-accent-soft">¡Cobrado!</div>
        <div className="mt-2 space-y-1">
          {resumen.descuento > 0 && <div className="text-muted">Descuento aplicado: −{cop(resumen.descuento)}</div>}
          <div>Total cobrado: <b className="text-ink">{cop(resumen.total)}</b></div>
          {resumen.propina > 0 && (
            <div className="text-muted">
              + {cop(resumen.propina)} de propina · en la mano: <b className="text-ink">{cop(resumen.total + resumen.propina)}</b>
            </div>
          )}
          {resumen.tarjeta && (
            <div className="text-accent-soft">
              🎫{" "}
              {resumen.tarjeta.beneficio === "gratis"
                ? "¡Corte gratis aplicado! Tarjeta completa, arranca una nueva."
                : resumen.tarjeta.beneficio === "50%"
                  ? "50% aplicado (corte #5 de la tarjeta)."
                  : `Corte ${((resumen.tarjeta.cortesTotales - 1) % 10) + 1}/10 de su tarjeta.`}
            </div>
          )}
        </div>
        {/* Reseña: QR para que la deje desde SU celular, nunca desde este equipo.
            Antes acá había un link que abría el formulario de Google en la pantalla
            del mostrador. Google marca como manipulación las reseñas publicadas de
            forma coordinada desde un dispositivo compartido (misma máquina, misma
            IP), y el castigo escala hasta un banner público de "reseñas falsas" en
            la ficha. El QR corta ese riesgo sin quitarle nada al barbero.
            ponytail: el SVG es estático por sede porque el place ID de Google no
            cambia nunca. Sede nueva → generar su QR en public/qr/. */}
        {resumen.resenaUrl && (
          <div className="mt-3 flex items-center gap-3 rounded-xl border border-line bg-bg/60 p-3">
            <img
              src={`/qr/resena-${sede}.svg`}
              alt="Código QR para dejar la reseña en Google"
              className="h-[104px] w-[104px] shrink-0 rounded-lg bg-white p-1.5"
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">Pedile la reseña en Google</div>
              <p className="mt-1 text-xs leading-relaxed text-muted">
                Que lo escanee con su celular. Se le abre Google directo en la ficha de{" "}
                {sedes.find((s) => s.id === sede)?.nombre ?? "la sede"}.
              </p>
            </div>
          </div>
        )}
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={onDone} className="rounded-full bg-gradient-to-b from-accent-soft to-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105">
            Listo
          </button>
        </div>
      </div>
    );
  }

  const sLabel = "mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted";
  const medioNombre = medios.find((m) => m.slug === medio)?.nombre ?? "—";

  // v3 (mockup aprobado): hoja "Cerrar y cobrar" en una columna, targets táctiles
  // grandes y barra de cobro sticky con el total vivo. La lógica de cobro
  // (calcularCobro + completarReserva) es exactamente la misma de antes.
  return (
    <div className={`${rapida ? "" : "mt-3 "}rounded-2xl border border-line bg-bg`}>
      <div className="border-b border-line/60 px-4 py-3.5 font-display text-lg font-semibold text-ink">
        {rapida ? "Venta rápida (sin cita)" : "Cerrar y cobrar"}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {rapida && (
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={sede} onChange={(e) => cambiarSede(e.target.value)} className={fld}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {/* Solo el admin puede atribuir la venta a otro barbero; para el rol
                barbero el server la registra a su nombre sí o sí. */}
            {esAdmin && (
              <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
                <option value="">Barbero (opcional)…</option>
                {barberosSede.map((b) => (
                  <option key={b.id} value={b.id}>{b.nombre}</option>
                ))}
              </select>
            )}
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Nombre del cliente (opcional)"
              className={`${fld} sm:col-span-2`}
            />
          </div>
        )}

        {servicioFijo && (
          <div>
            <div className={sLabel}>Servicio de la cita</div>
            <div className="flex items-center justify-between gap-3 rounded-xl border border-line bg-elevated px-3.5 py-3 text-sm">
              <span className="font-semibold text-ink">{servicioFijo.nombre}</span>
              <span className="font-bold text-ink tabular-nums">{precioFijo != null ? cop(precioFijo) : "—"}</span>
            </div>
          </div>
        )}

        <div>
          <div className={sLabel}>{rapida ? "Servicios" : "¿Se sumó algo en la silla?"}</div>
          {extrasPorCategoria.length === 0 ? (
            <p className="text-sm text-muted">Sin servicios con precio en esta sede.</p>
          ) : (
            // Antes esto era UNA grilla plana con los ~45 servicios de la sede.
            // Nombres de hasta 130 caracteres, chips de ancho desparejo y filas
            // rotas: un muro que nadie lee con un cliente en la silla. Los
            // servicios ya traen `categoria`, así que se agrupan y se abre una a
            // la vez. Arranca todo cerrado porque el caso normal es no sumar nada.
            <div className="space-y-1.5">
              {extrasPorCategoria.map(({ cat, label, items }) => {
                const elegidos = items.filter((s) => extras.includes(s.id)).length;
                const abierta = catAbierta === cat;
                return (
                  <div key={cat} className="overflow-hidden rounded-xl border border-line">
                    <button
                      type="button"
                      aria-expanded={abierta}
                      onClick={() => setCatAbierta(abierta ? null : cat)}
                      className="flex w-full items-center justify-between gap-3 bg-panel px-3.5 py-2.5 text-left transition hover:bg-elevated"
                    >
                      <span className="text-[13px] font-semibold text-ink">
                        {label}
                        {elegidos > 0 && (
                          <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-[11px] font-bold text-accent-soft">
                            {elegidos}
                          </span>
                        )}
                      </span>
                      <span className="text-xs text-muted">
                        {items.length} · {abierta ? "▲" : "▼"}
                      </span>
                    </button>
                    {abierta && (
                      <div className="flex flex-wrap gap-2 border-t border-line bg-bg p-3">
                        {items.map((s) => {
                          const activo = extras.includes(s.id);
                          return (
                            <button
                              key={s.id}
                              type="button"
                              aria-pressed={activo}
                              onClick={() => toggleExtra(s.id)}
                              className={`min-h-10 max-w-full rounded-full border px-3.5 py-2 text-left text-[13px] font-semibold transition ${
                                activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                              }`}
                            >
                              {s.nombre}
                              <span className={`ml-1.5 font-medium tabular-nums ${activo ? "text-accent-soft" : "text-muted"}`}>
                                +{cop(s.precios[sedeId] ?? 0)}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className={sLabel}>Consumos · stock real de la sede</div>
          {productosSede.length === 0 ? (
            <p className="text-sm text-muted">Sin productos en esta sede.</p>
          ) : (
            <div>
              {productosSede.map((p) => {
                const q = prodQty[p.id] ?? 0;
                const resta = p.stock - q;
                const agotado = p.stock <= 0;
                return (
                  <div
                    key={p.id}
                    className={`grid grid-cols-[auto_1fr_auto] items-center gap-3 border-b border-line/60 py-2.5 last:border-b-0 ${
                      agotado ? "opacity-45" : ""
                    }`}
                  >
                    <ProductoThumb nombre={p.nombre} fotoUrl={p.fotoUrl} size={42} />
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-ink">{p.nombre}</div>
                      <div
                        className={`text-xs tabular-nums ${
                          agotado ? "text-muted line-through" : resta <= 3 ? "text-warn" : "text-muted"
                        }`}
                      >
                        {cop(p.precio)} · {agotado ? "Agotado" : `quedan ${resta}${resta <= 3 ? " · poco stock" : ""}`}
                      </div>
                    </div>
                    <div className="flex items-center rounded-full border border-line bg-elevated">
                      <button
                        type="button"
                        aria-label={`Quitar ${p.nombre}`}
                        onClick={() => setQty(p.id, q - 1)}
                        disabled={q === 0}
                        className="h-[38px] w-[38px] rounded-full text-lg font-bold text-ink transition disabled:text-muted/40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-[15px] font-bold text-ink tabular-nums">{q}</span>
                      <button
                        type="button"
                        aria-label={`Agregar ${p.nombre}`}
                        onClick={() => setQty(p.id, Math.min(q + 1, p.stock))}
                        disabled={agotado || resta <= 0}
                        className="h-[38px] w-[38px] rounded-full text-lg font-bold text-ink transition disabled:text-muted/40"
                      >
                        +
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className={sLabel}>Propina</div>
          <div className="flex flex-wrap items-center gap-2">
            {PROPINA_CHIPS.map((p) => {
              const activo = !propinaOtra && propina === p;
              return (
                <button
                  type="button"
                  key={p}
                  aria-pressed={activo}
                  onClick={() => {
                    setPropinaOtra(false);
                    setPropina(activo ? 0 : p);
                  }}
                  className={`min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-semibold tabular-nums transition ${
                    activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                  }`}
                >
                  {cop(p)}
                </button>
              );
            })}
            <button
              type="button"
              aria-pressed={propinaOtra}
              onClick={() => {
                if (propinaOtra) {
                  setPropinaOtra(false);
                  setPropina(0);
                } else {
                  setPropinaOtra(true);
                  setPropina(0);
                }
              }}
              className={`min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
                propinaOtra ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
              }`}
            >
              Otra…
            </button>
            {propinaOtra && (
              <input
                type="number"
                min={0}
                autoFocus
                value={propina || ""}
                onChange={(e) => setPropina(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
                placeholder="Monto"
                className="w-28 rounded-full border border-line bg-bg px-3.5 py-2 text-sm text-ink tabular-nums placeholder:text-muted focus:border-accent focus:outline-none"
              />
            )}
          </div>
        </div>

        <div>
          <div className={sLabel}>¿Cómo pagó?</div>
          {medios.length === 0 ? (
            <p className="text-sm text-muted">Sin medios de pago configurados (avisale al admin).</p>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {medios.map((m) => {
                const activo = medio === m.slug;
                return (
                  <button
                    type="button"
                    key={m.slug}
                    aria-pressed={activo}
                    onClick={() => setMedio(m.slug)}
                    className={`flex min-h-[68px] flex-col items-center justify-center gap-1.5 rounded-xl border px-1.5 py-2.5 text-xs font-bold transition ${
                      activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                    }`}
                  >
                    <MedioLogo slug={m.slug} nombre={m.nombre} />
                    <span className="max-w-full truncate">{m.nombre}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <div className={sLabel}>Nota (opcional)</div>
          <textarea
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            rows={2}
            placeholder="Ej: pidió el degradado más alto la próxima"
            className="w-full rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>

        <div>
          <div className={sLabel}>Cupón (opcional)</div>
          <div className="flex gap-2">
            <input
              value={cupon}
              onChange={(e) => { setCupon(e.target.value.toUpperCase()); setCuponInfo(null); }}
              placeholder="Código"
              className="min-w-0 flex-1 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm uppercase text-ink placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={chequearCupon}
              className="rounded-xl border border-line px-4 text-xs font-semibold text-muted transition hover:text-ink"
            >
              Validar
            </button>
          </div>
          {cuponInfo && (
            <div className={`mt-1.5 text-xs ${cuponInfo.ok ? "text-ok" : "text-accent-soft"}`}>{cuponInfo.msg}</div>
          )}
        </div>
      </div>

      {/* Tarjeta de cortes: aviso del canje automático (se aplica solo, el server
          recomputa). Solo cuando esta venta suma un corte y toca beneficio. */}
      {tarjeta && descuentoTarjeta > 0 && (
        <div className="flex items-center gap-2 border-t border-accent/30 bg-accent/[0.07] px-4 py-2.5 text-sm font-semibold text-accent-soft">
          <span aria-hidden>🎫</span>
          <span>
            {tarjeta.tipo === "gratis" ? "Corte #10 · ¡corte gratis!" : "Corte #5 · −50% en el corte"} · −
            {cop(descuentoTarjeta)}
          </span>
        </div>
      )}

      {/* Barra de cobro: pegada abajo mientras el form está a la vista (mobile-first). */}
      <div className="sticky bottom-0 rounded-b-2xl border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md">
        {err && (
          <div className="mb-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-muted">
              Total a cobrar · {medioNombre}
              {vivo.descuento > 0 && <span className="tabular-nums"> · −{cop(vivo.descuento)} de descuento</span>}
            </div>
            <div className="font-display text-[26px] font-bold leading-tight text-ink tabular-nums">{cop(vivo.total)}</div>
            {vivo.propina > 0 && (
              <div className="text-xs text-ok tabular-nums">
                + {cop(vivo.propina)} de propina · en la mano {cop(vivo.aCobrar)}
              </div>
            )}
          </div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="min-h-[44px] rounded-xl border border-line px-4 text-xs font-semibold text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          )}
          <button
            onClick={submit}
            disabled={saving}
            className="min-h-[50px] rounded-xl bg-accent px-5 text-[15px] font-bold tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50 sm:px-7"
          >
            {saving ? "Cobrando…" : `Cobrar ${cop(vivo.total)}`}
          </button>
        </div>
      </div>
    </div>
  );
}
