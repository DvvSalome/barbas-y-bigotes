"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import {
  registrarWalkin,
  completarReserva,
  historialCliente,
  validarCupon,
  proponerAdelanto,
  getTarjetaParaCobro,
  type ActionResult,
} from "@/lib/actions";
import { calcularCobro } from "@/lib/cobro";
import { CERQUILLO_EXCLUIDOS, type BeneficioTarjeta } from "@/lib/tarjeta";
import { categorias } from "@/lib/data/seed";
import type { Categoria } from "@/lib/data/types";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { MedioLogo } from "@/components/staff/MedioLogo";
import { Recepcion } from "@/components/barbero/Recepcion";
import { ElegirBarbero, ElegirServicio } from "@/components/staff/Elegir";
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

/**
 * Lo que más se vende, para ponerlo a un toque en el alta de walk-in. El
 * catálogo tiene 47 servicios ordenados alfabéticamente y "Corte" caía en la
 * posición 41. Si alguno no existe en la sede, simplemente no se dibuja.
 */
const FRECUENTES = ["corte", "corte-barba", "corte-cejas", "corte-barba-cejas"];

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

/** Pestañas del mostrador: lo vivo, la cola y el cierre. */
type TabMostrador = "turnos" | "espera" | "cierre";

export function AgendaList({
  agenda,
  sedes,
  barberos,
  servicios,
  preciosServicios,
  productos,
  medios,
  elegirBarbero = false,
  mostrador,
  esperaSlot,
  cierreSlot,
  esperaCount = 0,
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  productos: Producto[];
  medios: MedioPago[];
  /** El operador no tiene barbero propio (admin o perfil sede): debe poder elegir
   *  a qué barbero se atribuye una venta rápida. */
  elegirBarbero?: boolean;
  /** La sede que se opera desde el mostrador (o las dos, para el dueño). */
  mostrador: {
    /** null = el dueño mirando las dos sedes; hay que elegir en cada alta. */
    sedeId: string | null;
    sedeNombre: string;
    agendaSede: AgendaItem[];
    barberosSede: Barbero[];
    cobradoSede: number;
    porBarbero: Record<string, number>;
  };
  /** Lista de espera (server component): vive en su pestaña. */
  esperaSlot?: React.ReactNode;
  /** Cierre del día: qué se llevó cada cliente + caja (server components). */
  cierreSlot?: React.ReactNode;
  /** Cuántos esperan ahora: la insignia de la pestaña. */
  esperaCount?: number;
}) {
  const router = useRouter();
  // El mostrador era UNA página de ~3.000px: agenda, formularios, espera, caja y
  // cierre apilados. De pie y con un dedo eso es scroll a ciegas. Ahora son tres
  // pestañas en una barra FIJA abajo (donde cae el pulgar en una pantalla táctil)
  // y los formularios suben como hoja desde el borde inferior.
  const [tab, setTab] = useState<TabMostrador>("turnos");
  const [walkinOpen, setWalkinOpen] = useState(false);
  // Barbero preseleccionado al abrir el walk-in desde la tira de libres.
  const [walkinBarbero, setWalkinBarbero] = useState<string>("");
  const [ventaOpen, setVentaOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<string | null>(null);

  /**
   * Abrir el cobro de una cita. NO es un toggle a propósito: antes, volver a
   * tocar "Cobrar" —el reflejo natural cuando parecía que no había pasado
   * nada— CERRABA la hoja. Para cerrarla está "Cancelar".
   * La hoja ahora sube desde abajo (ver <HojaInferior>): ya no hay que
   * desplazar la página hasta un formulario montado fuera de la vista.
   */
  const abrirCobro = (id: string) => {
    setCompleteFor(id);
  };
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const freeSlots = agenda.filter((item) => ["cancelada", "no_show"].includes(item.estado));

  // Agenda HERO: activos primero, con el que está en la silla (en_curso) al tope;
  // el resto conserva el orden por hora (getAgendaHoy ya ordena por inicio).
  const activos = agenda.filter((r) => !DONE.includes(r.estado));
  const activosOrd = [...activos].sort(
    (a, b) => (b.estado === "en_curso" ? 1 : 0) - (a.estado === "en_curso" ? 1 : 0),
  );
  const resto = activosOrd.slice(1);

  async function showHistory(ref: string | null, id: string) {
    if (!ref) return;
    setHistoryFor(id);
    setHistory(null);
    const h = await historialCliente(ref);
    setHistory(h as HistItem[]);
  }

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

  // Panel de historial (se abre desde una fila de "Después").
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
  // desde dónde se dispara (botón "Cobrar" del mostrador o de una fila).
  const cobroDe = (r: AgendaItem) => (
    <CheckoutForm
      reserva={r}
      sedes={sedes}
      barberos={barberos}
      servicios={servicios}
      preciosServicios={preciosServicios}
      productos={productos}
      medios={medios}
      elegirBarbero={elegirBarbero}
      onDone={() => {
        setCompleteFor(null);
        router.refresh();
      }}
      onCancel={() => setCompleteFor(null)}
    />
  );

  // La hoja de cobro se busca en la agenda de la sede también: desde el mostrador
  // se cobra la cita de otro barbero, que no está en `agenda` (la propia).
  const reservaEnCobro =
    agenda.find((x) => x.id === completeFor) ??
    mostrador?.agendaSede.find((x) => x.id === completeFor) ??
    null;

  return (
    <div>

      {/* Pestaña TURNOS: lo vivo. Las otras se ocultan con CSS (no se desmontan)
          para que cambiar de pestaña sea instantáneo y no pierda estado. */}
      <div className={tab === "turnos" ? "" : "hidden"}>
      <Recepcion
        agenda={mostrador.agendaSede}
        barberos={mostrador.barberosSede}
        sedeNombre={mostrador.sedeNombre}
        cobrado={mostrador.cobradoSede}
        porBarbero={mostrador.porBarbero}
        preciosServicios={preciosServicios}
        onCobrar={abrirCobro}
        onWalkin={(barberoId) => {
          setWalkinBarbero(barberoId);
          setWalkinOpen(true);
        }}
      />

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
                        {/* Cobrar sigue acá para la cita en la silla (usa abrirCobro:
                            lleva la hoja a la vista, no togglea). Marcar llegada /
                            no-show / cancelar se hace SOLO en la columna del barbero
                            (Recepcion): tenerlos también acá duplicaba la cita en
                            pantalla y arriesgaba el doble-marcado. */}
                        {enCurso && (
                          <button
                            onClick={() => abrirCobro(r.id)}
                            className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft"
                          >
                            Cobrar
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

      </div>
      {/* fin pestaña Turnos */}

      <div className={`mx-auto w-full max-w-2xl ${tab === "espera" ? "" : "hidden"}`}>{esperaSlot}</div>
      <div className={tab === "cierre" ? "" : "hidden"}>{cierreSlot}</div>

      {/* HOJAS que suben desde abajo. En una pantalla táctil de pie, un
          formulario incrustado a mitad del scroll obliga a buscarlo; la hoja
          aparece SOBRE lo que estabas mirando y se cierra donde mismo. Es el
          patrón estándar de un POS táctil, no un modal por pereza: se agotó la
          alternativa inline (probada un mes: el "scrollIntoView al form" perdía
          al barbero cada vez que el realtime refrescaba la página).
          El montaje sigue siendo ESTABLE (nivel AgendaList, nunca dentro de una
          fila): al cobrar, el realtime refresca y la cita cambia de lista; si el
          form viviera en la fila se desmontaría y el "¡Cobrado!" (con el botón
          de reseña) desaparecería antes de poder tocarlo. */}
      {reservaEnCobro && (
        <HojaInferior
          titulo={`Cobrar a ${reservaEnCobro.cliente || "walk-in"}`}
          onCerrar={() => {
            setCompleteFor(null);
            router.refresh();
          }}
        >
          {cobroDe(reservaEnCobro)}
        </HojaInferior>
      )}

      {walkinOpen && (
        <HojaInferior titulo="Cliente sin reserva" onCerrar={() => { setWalkinOpen(false); setWalkinBarbero(""); }}>
          {/* El caso hermano a un toque: llegó solo a comprar un producto. */}
          <button
            onClick={() => { setWalkinOpen(false); setWalkinBarbero(""); setVentaOpen(true); }}
            className="mb-3 min-h-11 rounded-full border border-line px-4 text-[13.5px] font-semibold text-muted transition hover:text-ink"
          >
            ¿Solo lleva productos? Venta rápida →
          </button>
          <WalkinForm
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            preciosServicios={preciosServicios}
            sedeFija={mostrador.sedeId}
            barberoInicial={walkinBarbero}
            onDone={() => {
              setWalkinOpen(false);
              setWalkinBarbero("");
              router.refresh();
            }}
            onCancel={() => { setWalkinOpen(false); setWalkinBarbero(""); }}
          />
        </HojaInferior>
      )}

      {ventaOpen && (
        <HojaInferior titulo="Venta rápida" onCerrar={() => setVentaOpen(false)}>
          <CheckoutForm
            reserva={null}
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            preciosServicios={preciosServicios}
            productos={productos}
            medios={medios}
            elegirBarbero={elegirBarbero}
            onDone={() => {
              setVentaOpen(false);
              router.refresh();
            }}
            onCancel={() => setVentaOpen(false)}
          />
        </HojaInferior>
      )}

      {/* BARRA FIJA inferior: navegación + la acción más frecuente del día.
          Abajo porque ahí cae el pulgar de pie frente a una pantalla táctil;
          los 56px de alto son el mínimo cómodo con el cliente enfrente. */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-stretch gap-1.5 px-3 pt-2 [padding-bottom:max(env(safe-area-inset-bottom),10px)]">
          {(
            [
              { id: "turnos", label: "Turnos", badge: 0 },
              { id: "espera", label: "Espera", badge: esperaCount },
              { id: "cierre", label: "Cierre", badge: 0 },
            ] as { id: TabMostrador; label: string; badge: number }[]
          ).map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              aria-current={tab === t.id ? "page" : undefined}
              className={`min-h-14 flex-1 rounded-xl text-[14px] font-bold transition ${
                tab === t.id ? "bg-elevated text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.badge > 0 && (
                <span className="ml-1.5 inline-flex min-w-5 items-center justify-center rounded-full bg-warn/20 px-1.5 text-[11.5px] font-extrabold tabular-nums text-warn">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
          <button
            onClick={() => { setWalkinBarbero(""); setWalkinOpen(true); }}
            className="min-h-14 flex-1 rounded-xl bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] text-[14.5px] font-bold text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
          >
            + Cliente
          </button>
        </div>
      </nav>
    </div>
  );
}

/**
 * Hoja que sube desde el borde inferior (formularios del mostrador). El fondo
 * queda visible y atenuado: el barbero no pierde el contexto de la agenda.
 */
function HojaInferior({
  titulo,
  onCerrar,
  children,
}: {
  titulo: string;
  onCerrar: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end">
      <button aria-label="Cerrar" onClick={onCerrar} className="absolute inset-0 bg-black/60" />
      <div className="relative max-h-[92dvh] overflow-y-auto rounded-t-[22px] border-t border-line bg-bg px-4 pb-10 pt-3 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-display text-[22px] font-bold uppercase leading-none">{titulo}</h2>
            <button
              onClick={onCerrar}
              className="min-h-11 shrink-0 rounded-full border border-line px-4 text-[13.5px] font-semibold text-muted transition hover:text-ink"
            >
              Cerrar
            </button>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function WalkinForm({
  sedes,
  barberos,
  servicios,
  preciosServicios,
  sedeFija,
  barberoInicial,
  onDone,
  onCancel,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  /** Sede del mostrador. Si viene, el walk-in arranca ahí y no se elige. */
  sedeFija?: string | null;
  /** Barbero ya elegido (se abrió desde su fila en la tira de libres). */
  barberoInicial?: string;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Arrancaba SIEMPRE en sedes[0] —Parque Venezuela, por orden alfabético—, así
  // que un barbero de Plaza de la Paz que no lo cambiaba mandaba el cliente, la
  // venta y la comisión a la sede equivocada.
  const [sede, setSede] = useState(sedeFija ?? sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState(barberoInicial ?? "");
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [servicioId, setServicioId] = useState("");
  const [fidelizar, setFidelizar] = useState(true);
  const [saving, setSaving] = useState(false);
  const sedeBarberos = barberos.filter((b) => b.sede === sede);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberoId) {
      alert("Elige el barbero");
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
      {sedeFija ? (
        // El barbero opera SU sede: elegirla en cada walk-in es un paso de más
        // y una oportunidad de mandar la venta al local equivocado.
        <div className="rounded-lg border border-line bg-elevated px-3 py-2 text-sm text-muted sm:col-span-2">
          Sede: <b className="text-ink">{sedes.find((x) => x.id === sede)?.nombre ?? sede}</b>
        </div>
      ) : (
        <select
          value={sede}
          onChange={(e) => { setSede(e.target.value as typeof sede); setBarberoId(""); }}
          className={`${fld} sm:col-span-2`}
        >
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      )}
      <ElegirBarbero
        barberos={sedeBarberos}
        value={barberoId}
        onChange={setBarberoId}
        placeholder="¿Quién lo atiende?"
      />
      <input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre del cliente" className={fld} />
      <input value={tel} onChange={(e) => setTel(e.target.value)} placeholder="Teléfono" inputMode="tel" className={fld} />
      {/* Lo que más se vende, a un toque y con el precio de ESTA sede. Antes
          "Corte" era la opción 41 de 47: varios barridos de rueda con el
          cliente parado enfrente, varias veces al día. */}
      <div className="flex flex-wrap gap-2 sm:col-span-2">
        {FRECUENTES.map((id) => {
          const sv = servicios.find((x) => x.id === id);
          if (!sv) return null;
          const precio = preciosServicios.find((x) => x.id === id)?.preciosPorSede[sede];
          const activo = servicioId === id;
          return (
            <button
              key={id}
              type="button"
              onClick={() => setServicioId(activo ? "" : id)}
              className={`min-h-11 rounded-xl border px-3 text-[13px] font-semibold transition ${
                activo ? "border-accent bg-accent/15 text-ink" : "border-line text-muted hover:text-ink"
              }`}
            >
              {sv.nombre.split(" (")[0]}
              {precio != null && <span className="ml-1.5 tabular-nums text-muted">{cop(precio)}</span>}
            </button>
          );
        })}
      </div>
      <div className="sm:col-span-2">
        <ElegirServicio
          servicios={servicios.map((sv) => ({
            id: sv.id,
            nombre: sv.nombre,
            duracionMin: sv.duracionMin,
            precio: preciosServicios.find((x) => x.id === sv.id)?.preciosPorSede[sede] ?? null,
          }))}
          value={servicioId}
          onChange={setServicioId}
          etiquetaVacio="Otro servicio (opcional)…"
          placeholder="Buscar servicio…"
        />
      </div>
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
  elegirBarbero = false,
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
  elegirBarbero?: boolean;
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
  const [propinaEfectivo, setPropinaEfectivo] = useState(false); // propina en efectivo aunque la venta sea digital (0053)
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
  // Solo se setea si hay un beneficio (5º regalo / 10º 50%); el server es la
  // fuente de verdad y lo recomputa al cobrar.
  const [tarjeta, setTarjeta] = useState<{ tipo: BeneficioTarjeta; descuento: number } | null>(null);
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
      setErr("Elige el medio de pago.");
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
      // Propina en efectivo aunque la venta sea digital: entra al cajón (0053, #16).
      propinaMedio: propina > 0 && propinaEfectivo && medio !== "efectivo" ? "efectivo" : null,
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
              {resumen.tarjeta.beneficio === "regalo"
                ? "¡Corte #5! Entregale el regalo — el corte se cobró completo."
                : resumen.tarjeta.beneficio === "50%"
                  ? "50% aplicado (corte #10). Tarjeta completa, arranca una nueva."
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
          <button onClick={onDone} className="rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105">
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
      <div className="flex items-center justify-between gap-3 border-b border-line/60 px-4 py-3.5">
        <span className="font-display text-lg font-semibold text-ink">
          {rapida ? "Venta rápida (sin cita)" : "Cerrar y cobrar"}
        </span>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar sin cobrar"
            className="-mr-1.5 grid h-11 w-11 shrink-0 place-items-center rounded-lg text-xl text-muted transition hover:text-ink"
          >
            ✕
          </button>
        )}
      </div>

      <div className="flex flex-col gap-5 p-4">
        {rapida && (
          <div className="grid gap-3 sm:grid-cols-2">
            <select value={sede} onChange={(e) => cambiarSede(e.target.value)} className={fld}>
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
            {/* Se elige el barbero cuando el operador no tiene uno propio: el
                admin, y el MOSTRADOR DE SEDE (login primario del 0044). Sin esto
                la venta rápida del mostrador de sede se grababa con barbero_id
                null y el barbero perdía su comisión. El login de barbero cae en
                él mismo, sin selector. */}
            {elegirBarbero && (
              <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
                <option value="">¿Qué barbero vende?</option>
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

        {/* Propina en efectivo aunque el servicio se pague digital (común en CO: pagan
            por Nequi y dejan la propina en la mano). Sin esto ese efectivo genera un
            sobrante en el cierre, porque el sistema lo esperaba en el medio de la venta. */}
        {propina > 0 && medio && medio !== "efectivo" && (
          <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line bg-elevated px-3.5 py-2.5 text-sm text-ink">
            <input
              type="checkbox"
              checked={propinaEfectivo}
              onChange={(e) => setPropinaEfectivo(e.target.checked)}
              className="h-4 w-4 accent-accent"
            />
            La propina la dejó en <b>efectivo</b> (entra al cajón)
          </label>
        )}

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
      {/* OJO: este aviso NO puede colgar de descuentoTarjeta > 0. El regalo del 5º
          corte no descuenta plata, así que con esa condición el barbero nunca se
          enteraría de entregarlo y el cliente se iría sin su premio. */}
      {tarjeta && (
        <div className="flex items-center gap-2 border-t border-accent/30 bg-accent/[0.07] px-4 py-2.5 text-sm font-semibold text-accent-soft">
          <span aria-hidden>{tarjeta.tipo === "regalo" ? "🎁" : "🎫"}</span>
          {tarjeta.tipo === "regalo" ? (
            <span>Corte #5 · entregale el REGALO (el corte se cobra completo)</span>
          ) : (
            <span>
              Corte #10 · −50% en el corte · −{cop(descuentoTarjeta)}
            </span>
          )}
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
            <div className="truncate font-display text-[26px] font-bold leading-tight text-ink tabular-nums">{cop(vivo.total)}</div>
            {vivo.propina > 0 && (
              <div className="text-xs text-ok tabular-nums">
                + {cop(vivo.propina)} de propina · en la mano {cop(vivo.aCobrar)}
              </div>
            )}
          </div>
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
