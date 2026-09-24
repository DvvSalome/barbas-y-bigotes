"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
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
import { recargarSiDeployViejo } from "@/lib/skew";
import { calcularCobro } from "@/lib/cobro";
import { sanearCop } from "@/lib/admin-reglas";
import { type BeneficioTarjeta } from "@/lib/tarjeta";
import { linkWhatsApp, mensajeCitaConfirmada } from "@/lib/whatsapp";
import { categorias } from "@/lib/data/seed";
import { sfxCobro, sfxExito } from "@/lib/sfx";
import type { Categoria } from "@/lib/data/types";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { MedioLogo } from "@/components/staff/MedioLogo";
import { Recepcion } from "@/components/barbero/Recepcion";
import { AgendarCitaForm } from "@/components/barbero/AgendarCitaForm";
import { ElegirBarbero, ElegirServicio, ElegirCliente, type ClienteElegido } from "@/components/staff/Elegir";
import { Switch } from "@/components/admin/Switch";
import { Segmentado } from "@/components/ui/Segmentado";
import type { Sede, SedeId, Barbero, Servicio, Producto } from "@/lib/data/types";
import type { AgendaItem, MedioPago, PrecioServicioStaff, HorarioSemanal, DiaEspecial } from "@/lib/data/queries";
import { Hoja as HojaInferior } from "@/components/ui/Hoja";
import { NavInferior } from "@/components/staff/NavInferior";
import { CashIcon, PlusIcon, CalendarIcon, ClockIcon, UsersIcon, WalletIcon, SearchIcon, ChevronDownIcon } from "@/components/icons";

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
type TabMostrador = "turnos" | "calendario" | "espera" | "cierre";

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
  horarioSemanal = [],
  diasEspeciales = [],
  miDiaSlot,
  avisosSlot,
  esperaSlot,
  cierreSlot,
  calendarioSlot,
  esperaCount = 0,
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  productos: Producto[];
  medios: MedioPago[];
  /** Horario de la sede (semana + excepciones), para agendar citas futuras. */
  horarioSemanal?: HorarioSemanal[];
  diasEspeciales?: DiaEspecial[];
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
  /** "Tu día": solo cuando entra un barbero con su PIN (0074). */
  miDiaSlot?: React.ReactNode;
  /** Activar los avisos al celular. Arriba de Turnos: es donde el staff entra. */
  avisosSlot?: React.ReactNode;
  esperaSlot?: React.ReactNode;
  /** Cierre del día: qué se llevó cada cliente + caja (server components). */
  cierreSlot?: React.ReactNode;
  /** Calendario del día (grilla × barbero); sin sede definida no se pasa. */
  calendarioSlot?: React.ReactNode;
  /** Cuántos esperan ahora: la insignia de la pestaña. */
  esperaCount?: number;
}) {
  const router = useRouter();
  const search = useSearchParams();
  // El mostrador era UNA página de ~3.000px: agenda, formularios, espera, caja y
  // cierre apilados. De pie y con un dedo eso es scroll a ciegas. Ahora son
  // pestañas en una barra FIJA abajo (donde cae el pulgar en una pantalla táctil)
  // y los formularios suben como hoja desde el borde inferior.
  // ?tab= abre una pestaña directa: el calendario lo usa al navegar por fechas
  // (links con ?fecha=) y el push de "caja abierta" aterriza en ?tab=cierre.
  const [tab, setTab] = useState<TabMostrador>(() => {
    const t = search.get("tab");
    if (t === "calendario" && calendarioSlot) return "calendario";
    if (t === "espera" || t === "cierre") return t;
    return "turnos";
  });
  const [walkinOpen, setWalkinOpen] = useState(false);
  // Barbero preseleccionado al abrir el walk-in desde la tira de libres.
  const [walkinBarbero, setWalkinBarbero] = useState<string>("");
  // Agendar cita futura (cliente que escribió por WhatsApp). Solo con sede definida.
  const [agendarOpen, setAgendarOpen] = useState(false);
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
  // Resultado de la propuesta de adelanto, por reserva. Antes era un alert():
  // congelaba el mostrador y rompía la estética del panel. Ahora es una cajita
  // dentro de la fila expandida, al lado del botón que la disparó.
  const [adelantoMsg, setAdelantoMsg] = useState<{ id: string; ok: boolean; texto: string } | null>(null);
  // Aviso "quedó en lista de espera" del walk-in. Vive ACÁ y no en el WalkinForm:
  // al encolar, el form se resetea para el siguiente cliente y un estado local
  // moriría con sus campos; el mensaje tiene que quedar a la vista.
  const [esperaMsg, setEsperaMsg] = useState<string | null>(null);
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
    setAdelantoMsg(null);
    const res = await proponerAdelanto({ reservaId: r.id, inicioISO });
    setBusy(false);
    if (res.ok) {
      setAdelantoMsg({ id: r.id, ok: true, texto: "Propuesta de adelanto enviada al cliente." });
      router.refresh();
    } else {
      setAdelantoMsg({ id: r.id, ok: false, texto: res.error ?? "No se pudo enviar la propuesta." });
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
      {miDiaSlot}
      {avisosSlot && <div className="mb-4">{avisosSlot}</div>}
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
          setEsperaMsg(null);
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
                    onClick={() => {
                      setExpandedRow(abierto ? null : r.id);
                      setAdelantoMsg(null);
                    }}
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
                        {/* Confirmarle por WhatsApp. Con el correo del dominio
                            suspendido (ago-2026), el cliente que reserva por la web
                            no recibe NADA: esto le deja al mostrador el aviso a un
                            toque, con el mensaje escrito. Sirva o no el correo, es
                            el canal que la gente sí lee. */}
                        {(() => {
                          if (r.estado !== "pendiente" && r.estado !== "confirmada") return null;
                          const url = linkWhatsApp(
                            r.telefono,
                            mensajeCitaConfirmada({
                              cliente: r.cliente,
                              cuando: `hoy a las ${hora(r.inicio)}`,
                              barbero: r.barbero,
                              sede: sedes.find((x) => x.id === r.sede)?.nombre ?? mostrador.sedeNombre,
                            }),
                          );
                          if (!url) return null; // sin teléfono marcable no se ofrece
                          return (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-full border border-ok/40 bg-ok/[0.08] px-3 py-1.5 text-xs font-semibold text-ok transition hover:bg-ok/[0.16]"
                            >
                              Confirmar por WhatsApp
                            </a>
                          );
                        })()}
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
                      {adelantoMsg?.id === r.id && (
                        <div
                          className={`mt-2.5 rounded-lg border px-3 py-2 text-sm ${
                            adelantoMsg.ok
                              ? "border-ok/40 bg-ok/10 text-ok"
                              : "border-accent/40 bg-accent/10 text-accent-soft"
                          }`}
                        >
                          {adelantoMsg.texto}
                        </div>
                      )}
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
      <div className={tab === "calendario" ? "" : "hidden"}>{calendarioSlot}</div>

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
            ¿Sin cita? Cobrar directo (servicio o productos) →
          </button>
          <WalkinForm
            sedes={sedes}
            barberos={barberos}
            servicios={servicios}
            preciosServicios={preciosServicios}
            sedeFija={mostrador.sedeId}
            barberoInicial={walkinBarbero}
            avisoEspera={esperaMsg}
            onEncolado={(msg) => {
              // La hoja queda abierta con el aviso a la vista; el form ya se
              // reseteó solo para anotar al siguiente cliente.
              sfxExito();
              setEsperaMsg(msg);
              router.refresh();
            }}
            onDone={() => {
              setWalkinOpen(false);
              setWalkinBarbero("");
              router.refresh();
            }}
            onCancel={() => { setWalkinOpen(false); setWalkinBarbero(""); }}
          />
        </HojaInferior>
      )}

      {agendarOpen && mostrador.sedeId && (
        <HojaInferior titulo="Agendar cita" onCerrar={() => setAgendarOpen(false)}>
          <AgendarCitaForm
            sede={mostrador.sedeId}
            barberos={mostrador.barberosSede}
            servicios={servicios}
            horarioSemanal={horarioSemanal}
            diasEspeciales={diasEspeciales}
            onDone={() => {
              setAgendarOpen(false);
              router.refresh();
            }}
            onCancel={() => setAgendarOpen(false)}
          />
        </HojaInferior>
      )}

      {ventaOpen && (
        <HojaInferior titulo="Cobrar directo (sin cita)" onCerrar={() => setVentaOpen(false)}>
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
          />
        </HojaInferior>
      )}

      {/* BARRA DE ABAJO, opción B del lienzo de propuestas (16-sep). Antes eran
          SIETE controles en una fila con el mismo peso: cuatro dicen "dónde
          estoy" y tres dicen "qué hago", y se veían idénticos; a 768 px cada uno
          quedaba en ~103 px y las etiquetas de dos palabras se partían.
          Ahora van en dos pisos. Arriba las ACCIONES, que el dueño pidió a la
          vista (5-sep) y siguen a la vista. Abajo la pastilla de DESTINOS, la
          misma pieza del panel pero en línea, porque en una tablet el ancho
          sobra. Mismos destinos, mismas acciones, mismas rutas: cambia la forma,
          no el comportamiento. */}
      <div className="fixed inset-x-0 bottom-0 z-30">
        <div className="mx-auto max-w-6xl px-3 pb-[max(env(safe-area-inset-bottom),10px)]">
          {/* Piso 1: lo que se hace. */}
          <div className="flex items-stretch gap-2.5 pb-2.5">
            <button
              onClick={() => setVentaOpen(true)}
              className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-accent/45 bg-bg/85 text-[14px] font-bold text-accent-soft backdrop-blur-md transition hover:bg-accent/10"
            >
              <CashIcon className="h-[18px] w-[18px]" />
              Cobrar
            </button>
            <button
              onClick={() => { setWalkinBarbero(""); setEsperaMsg(null); setWalkinOpen(true); }}
              className="inline-flex min-h-[52px] flex-[1.35] items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] text-[14px] font-bold text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105"
            >
              <PlusIcon className="h-[18px] w-[18px]" />
              Cliente
            </button>
            {/* Agendar cita futura: solo con sede definida (el dueño mirando las
                dos no tiene una sede fija donde agendar). */}
            {mostrador.sedeId && (
              <button
                onClick={() => setAgendarOpen(true)}
                className="inline-flex min-h-[52px] flex-1 items-center justify-center gap-2 rounded-2xl border border-accent/45 bg-bg/85 text-[14px] font-bold text-accent-soft backdrop-blur-md transition hover:bg-accent/10"
              >
                <CalendarIcon className="h-[18px] w-[18px]" />
                Cita
              </button>
            )}
          </div>

          {/* Piso 2: dónde se está. */}
          <NavInferior
            fila
            className="!static !inset-auto"
            activo={tab}
            destinos={[
              { clave: "turnos", etiqueta: "Turnos", icono: <UsersIcon />, onClick: () => setTab("turnos") },
              ...(calendarioSlot
                ? [{ clave: "calendario", etiqueta: "Agenda", icono: <CalendarIcon />, onClick: () => setTab("calendario") }]
                : []),
              { clave: "espera", etiqueta: "Espera", icono: <ClockIcon />, badge: esperaCount, onClick: () => setTab("espera") },
              { clave: "cierre", etiqueta: "Cierre", icono: <WalletIcon />, onClick: () => setTab("cierre") },
            ]}
          />
        </div>
      </div>
    </div>
  );
}

/**
 * La hoja del mostrador vive ahora en ui/Hoja.tsx: era esta misma, sin pie
 * pegado, y estaba copiada a mano otras cinco veces dentro de AgendaDia.tsx.
 * Se conserva el nombre viejo para no tocar los sitios que ya la importan.
 */
export { HojaInferior };

function WalkinForm({
  sedes,
  barberos,
  servicios,
  preciosServicios,
  sedeFija,
  barberoInicial,
  avisoEspera,
  onEncolado,
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
  /** Aviso "quedó en espera": lo guarda el padre para que sobreviva al reseteo del form. */
  avisoEspera?: string | null;
  /** El walk-in cayó en lista de espera: el padre guarda el aviso y refresca. */
  onEncolado: (msg: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  // Arrancaba SIEMPRE en sedes[0] —Parque Venezuela, por orden alfabético—, así
  // que un barbero de Plaza de la Paz que no lo cambiaba mandaba el cliente, la
  // venta y la comisión a la sede equivocada.
  const [sede, setSede] = useState(sedeFija ?? sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState(barberoInicial ?? "");
  // El cliente sale del selector: uno que ya existe, uno nuevo, o de paso.
  const [cliente, setCliente] = useState<ClienteElegido>({ tipo: "nuevo", nombre: "", telefono: "" });
  const [servicioId, setServicioId] = useState("");
  const [fidelizar, setFidelizar] = useState(true);
  const [saving, setSaving] = useState(false);
  // Error del alta, inline junto al botón. Antes era un alert() que bloqueaba
  // la pantalla del mostrador con el cliente parado enfrente.
  const [err, setErr] = useState<string | null>(null);
  const sedeBarberos = barberos.filter((b) => b.sede === sede);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberoId) {
      setErr("Elige el barbero.");
      return;
    }
    setErr(null);
    setSaving(true);
    const nombreCli = cliente.tipo === "paso" ? "" : cliente.nombre.trim();
    const res = await registrarWalkin({
      sede,
      barberoId,
      servicioId,
      clienteNombre: nombreCli,
      telefono: cliente.tipo === "nuevo" ? cliente.telefono : "",
      clienteId: cliente.tipo === "existente" ? cliente.id : null,
      fidelizar,
    });
    setSaving(false);
    if (res.ok) {
      if (res.encolado) {
        const hasta = res.esperaHasta ? ` (~${hora(res.esperaHasta)})` : "";
        // El aviso vive en el padre (sobrevive a este reseteo) y la hoja queda
        // abierta: se limpia el form para anotar al siguiente cliente.
        onEncolado(`El barbero está ocupado. ${nombreCli || "El cliente"} quedó en la lista de espera${hasta}.`);
        setCliente({ tipo: "nuevo", nombre: "", telefono: "" });
        setServicioId("");
        setBarberoId("");
        return;
      }
      onDone();
    } else {
      setErr(res.error ?? "No se pudo registrar el walk-in.");
    }
  }

  return (
    // Sin marco propio: vive en la hoja "Cliente sin reserva", que ya es la tarjeta.
    <form onSubmit={submit} className="grid gap-3 pb-2 sm:grid-cols-2">
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
      <div className="sm:col-span-2">
        <ElegirCliente valor={cliente} onCambio={setCliente} />
      </div>
      {/* Lo que más se vende, a un toque y con el precio de ESTA sede. Antes
          "Corte" era la opción 41 de 47: varios barridos de rueda con el
          cliente parado enfrente, varias veces al día. */}
      <div className="grid grid-cols-2 gap-2 sm:col-span-2">
        {FRECUENTES.map((id) => {
          const sv = servicios.find((x) => x.id === id);
          if (!sv) return null;
          const precio = preciosServicios.find((x) => x.id === id)?.preciosPorSede[sede];
          const activo = servicioId === id;
          return (
            <button
              key={id}
              type="button"
              aria-pressed={activo}
              onClick={() => setServicioId(activo ? "" : id)}
              className={`flex min-h-[60px] flex-col items-start justify-center rounded-xl border px-3.5 py-2 text-left transition ${
                activo ? "border-accent bg-accent/15" : "border-line hover:border-ink/25"
              }`}
            >
              <span className="text-[13.5px] font-semibold leading-tight text-ink">{sv.nombre.split(" (")[0]}</span>
              {precio != null && (
                <span className={`mt-0.5 text-[12.5px] font-semibold tabular-nums ${activo ? "text-accent-soft" : "text-muted"}`}>
                  {cop(precio)}
                </span>
              )}
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
      {cliente.tipo === "nuevo" && cliente.nombre.trim().length >= 2 && (
        <div className="flex items-center justify-between gap-3 sm:col-span-2">
          <span className="min-w-0 text-[13px] text-ink">
            Inscribir en la tarjeta de cortes
            <span className="block text-[12px] text-muted">Gana su sello por esta visita</span>
          </span>
          <Switch checked={fidelizar} onChange={setFidelizar} label="Inscribir al cliente en la tarjeta de cortes" />
        </div>
      )}
      {avisoEspera && (
        <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok sm:col-span-2">
          {avisoEspera}
        </div>
      )}
      {err && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-2">
          {err}
        </div>
      )}
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
/**
 * Precio de una línea del cobro, editable en el momento (0062). Toque sobre el
 * monto → input → ✓. Mismo gesto que el precio del catálogo en el admin.
 *
 * Cuando el precio cobrado se aparta del de lista, la fila lo dice: es la única
 * señal que tiene el dueño de que alguien tocó ese número, y estar a la vista
 * también frena al que lo tocaría de más.
 */
function PrecioCobro({
  precio,
  lista,
  onChange,
  grande,
}: {
  precio: number;
  lista: number | null;
  onChange: (n: number | null) => void;
  /** En la barra de cobro el precio ES el total: va del tamaño del total. */
  grande?: boolean;
}) {
  const [editando, setEditando] = useState(false);
  const [val, setVal] = useState(String(precio));
  const [err, setErr] = useState(false);

  function guardar() {
    // sanearCop rechaza vacío, decimal, negativo y no-numérico. El $0 SÍ vale: una
    // cortesía es un caso real del mostrador.
    const n = sanearCop(val);
    if (n === null) {
      setErr(true);
      return;
    }
    setErr(false);
    setEditando(false);
    onChange(lista !== null && n === lista ? null : n);
  }

  if (!editando) {
    return (
      <span className="shrink-0 text-right">
        <button
          type="button"
          onClick={() => {
            setVal(String(precio));
            setErr(false);
            setEditando(true);
          }}
          aria-label={grande ? "Tocar para cambiar cuánto se cobra" : "Tocar para cambiar el precio de esta línea"}
          className={`inline-flex min-h-11 max-w-full items-center gap-1 font-bold text-ink tabular-nums underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent ${
            grande ? "font-display text-[26px] leading-tight" : ""
          }`}
        >
          {cop(precio)}
          <span aria-hidden className="text-[11px] font-normal text-muted">✎</span>
        </button>
        {lista !== null && precio !== lista && (
          <span className="block text-[11px] text-warn">
            Lista {cop(lista)} ·{" "}
            <button type="button" onClick={() => onChange(null)} className="underline underline-offset-2">
              deshacer
            </button>
          </span>
        )}
      </span>
    );
  }

  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      <input
        type="number"
        min={0}
        step={1}
        autoFocus
        value={val}
        onChange={(e) => {
          setVal(e.target.value);
          if (err) setErr(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") guardar();
          if (e.key === "Escape") setEditando(false);
        }}
        aria-invalid={err}
        aria-label="Precio cobrado"
        className={`min-h-11 w-24 rounded-lg border bg-bg px-2 text-sm text-ink tabular-nums focus:outline-none ${
          err ? "border-red-500" : "border-accent"
        }`}
      />
      <button
        type="button"
        onClick={guardar}
        aria-label="Guardar precio"
        className="grid h-11 w-11 place-items-center rounded-full bg-accent text-sm font-bold text-on-accent"
      >
        ✓
      </button>
    </span>
  );
}

// Exportado: el cuadre del admin monta el mismo cobro directo (sin cita).
export function CheckoutForm({
  reserva,
  sedes,
  barberos,
  servicios,
  preciosServicios,
  productos,
  medios,
  elegirBarbero = false,
  onDone,
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
}) {
  const rapida = !reserva;
  // Token de idempotencia: se genera UNA vez por apertura del form (el initializer
  // de useState corre solo en el primer render). En la venta rápida es el backstop
  // anti doble-cobro (no hay reserva que reclamar); en el cobro de reserva no
  // molesta (el claim ya protege). Al cerrar y reabrir el form, el componente se
  // remonta y nace un token nuevo → cada cobro real usa su propio token.
  const [idemToken] = useState(() => crypto.randomUUID());
  // Adonde lleva el total cuando hay varias líneas y no se puede editar solo.
  const refLineas = useRef<HTMLDivElement | null>(null);
  const [sede, setSede] = useState(reserva?.sede ?? sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState(""); // venta rápida: el admin puede cobrar por otro
  // Venta rápida: el cliente sale del selector. Elegido de la base, la venta
  // queda LIGADA a él (historial y tarjeta); antes era solo un nombre de texto.
  const [cliente, setCliente] = useState<ClienteElegido>({ tipo: "nuevo", nombre: "", telefono: "" });
  // Buscar servicio o producto en vez de abrir categorías.
  const [busca, setBusca] = useState("");
  const [extras, setExtras] = useState<string[]>([]);
  // Cobro a medida (0062): servicio cambiado y precios editados por línea.
  // Vacío = todo como está en el catálogo, que es el 95% de los cobros.
  const [servicioOverride, setServicioOverride] = useState<string | null>(null);
  const [preciosEdit, setPreciosEdit] = useState<Record<string, number>>({});
  const [cambiandoServicio, setCambiandoServicio] = useState(false);
  // Acordeón de adicionales: una categoría abierta a la vez, todas cerradas al
  // entrar (lo normal es cobrar la cita tal cual, sin sumar nada).
  const [catAbierta, setCatAbierta] = useState<Categoria | null>(null);
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [propina, setPropina] = useState(0);
  const [propinaOtra, setPropinaOtra] = useState(false); // "Otra…" abre el input libre
  // Medio con el que dejaron la PROPINA. null = el mismo de la venta. Era un
  // booleano "fue en efectivo" y no alcanzaba: el cliente paga el corte en efectivo
  // y la propina por Nequi (o al revés), y el cierre esperaba esa plata donde no
  // estaba. Ahora se elige el medio, que es lo que el dueño pidió.
  const [propinaMedio, setPropinaMedio] = useState<string | null>(null);
  const [nota, setNota] = useState("");
  const [medio, setMedio] = useState(medios[0]?.slug ?? "");
  // Cobro MIXTO (0060): el cliente paga una parte con un medio y el resto con otro.
  // Se pide el monto del SEGUNDO y el primero sale por resta: una cifra menos que
  // teclear con el cliente enfrente, y nunca queda un reparto que no cuadre.
  const [mixto, setMixto] = useState(false);
  const [medio2, setMedio2] = useState("");
  const [monto2, setMonto2] = useState("");
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
    /** Con qué medio quedó la propina, si no fue el de la venta. */
    propinaMedio: string | null;
    puntos: number;
    tarjeta?: ActionResult["tarjeta"];
    resenaUrl?: string | null;
    /** Reparto entre medios si el cobro fue mixto (0060). */
    pagos?: { medio: string; monto: number }[] | null;
  } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  // Estado de la tarjeta de cortes del cliente (solo cobro de reserva con cliente).
  // Solo se setea si hay un beneficio (5º regalo / 10º 50%); el server es la
  // fuente de verdad y lo recomputa al cobrar.
  // `pct` y no un monto: el descuento depende del precio que se termine cobrando
  // (que el barbero puede editar), así que se calcula acá y el server lo recalcula.
  const [tarjeta, setTarjeta] = useState<{ tipo: BeneficioTarjeta; pct: number; posicion: number } | null>(null);
  useEffect(() => {
    if (!reserva?.clienteRef) return;
    let vivo = true;
    getTarjetaParaCobro(reserva.clienteRef).then((r) => {
      if (vivo && r.ok && r.tipo) setTarjeta({ tipo: r.tipo, pct: r.pct, posicion: r.posicion });
    });
    return () => {
      vivo = false;
    };
  }, [reserva?.clienteRef, reserva?.sede]);

  const sedeId = sede as SedeId;
  const serviciosSede = servicios.filter((s) => s.precios[sedeId] != null);
  const productosSede = productos.filter((p) => p.sede === sedeId);
  // Sin tildes ni mayúsculas: "depilacion" encuentra "Depilación", "coca" la Coca-Cola.
  const norm = (t: string) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const q = norm(busca.trim());
  const productosVisibles = q ? productosSede.filter((p) => norm(p.nombre).includes(q)) : productosSede;
  const barberosSede = barberos.filter((b) => b.sede === sedeId);
  // Servicio FIJO de la reserva: se resuelve nombre+precio desde preciosServicios
  // (TODOS los servicios, activos e inactivos) para que el total en vivo coincida
  // con lo que cobra el server aunque el admin haya desactivado el servicio. Los
  // chips de adicionales siguen usando `servicios` (solo activos, más abajo).
  const servicioFijoId = servicioOverride ?? reserva?.servicioId ?? null;
  const servicioFijo = servicioFijoId ? preciosServicios.find((s) => s.id === servicioFijoId) ?? null : null;
  const precioListaFijo = servicioFijo?.preciosPorSede[sedeId];
  // Precio con el que se va a cobrar esta línea: el editado manda sobre el de lista.
  const precioFijo = servicioFijo
    ? preciosEdit[servicioFijo.id] ?? precioListaFijo
    : undefined;
  /** Precio de catálogo de un servicio en esta sede (null si no tiene). */
  const listaDe = (id: string) => serviciosSede.find((s) => s.id === id)?.precios[sedeId] ?? null;
  /** Lo mismo para un producto. Comparten el mapa `preciosEdit`: los ids son
   *  UUID de tablas distintas, no se pisan, y así el payload de `precios` los
   *  manda solos sin tocar el envío. */
  const listaProdDe = (id: string) => productosSede.find((p) => p.id === id)?.precio ?? null;
  const cobradoProdDe = (id: string) => preciosEdit[id] ?? listaProdDe(id) ?? 0;
  /** Lo que de verdad se va a cobrar por ese servicio. */
  const cobradoDe = (id: string) => preciosEdit[id] ?? listaDe(id) ?? 0;
  const editarPrecio = (id: string, n: number | null) =>
    setPreciosEdit((prev) => {
      const next = { ...prev };
      if (n === null) delete next[id];
      else next[id] = n;
      return next;
    });

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
    setPreciosEdit({});
    setServicioOverride(null);
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
    setExtras((prev) => {
      const quitando = prev.includes(id);
      // Al quitarlo se olvida su precio editado: si no, volvía solo al re-elegirlo
      // y el barbero cobraba un precio que ya había descartado.
      if (quitando) editarPrecio(id, null);
      return quitando ? prev.filter((x) => x !== id) : [...prev, id];
    });
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
    // Mismo criterio que el servidor (getCorteIds): categoría de corte/combo y que
    // el servicio SUME SELLO. Antes acá había una lista de ids escrita a mano que
    // podía quedar distinta de la del servidor sin que nadie lo notara.
    return s ? (s.categoria === "cortes" || s.categoria === "combos") && s.cuentaCorte !== false : false;
  };
  const preciosCortePreview: number[] = [];
  if (esCorteId(reserva?.servicioId) && precioFijo != null) preciosCortePreview.push(precioFijo);
  for (const id of extras) {
    if (esCorteId(id)) preciosCortePreview.push(cobradoDe(id));
  }
  // El beneficio se topa al precio de la línea de corte más cara (como el server).
  const precioCorteMax = preciosCortePreview.length ? Math.max(...preciosCortePreview) : null;
  // Mismo cálculo que el servidor: el porcentaje sobre la línea de corte más cara
  // (ya con el precio editado, si lo hubo), topado a ese precio.
  const descuentoTarjeta =
    tarjeta && precioCorteMax != null ? Math.min(Math.floor((precioCorteMax * tarjeta.pct) / 100), precioCorteMax) : 0;

  // Total en vivo con la MISMA matemática del servidor (calcularCobro).
  const vivo = calcularCobro({
    items: [
      ...(precioFijo != null ? [{ precio: precioFijo, cantidad: 1 }] : []),
      ...extras.map((id) => ({ precio: cobradoDe(id), cantidad: 1 })),
      ...Object.entries(prodQty).map(([id, cantidad]) => ({
        precio: cobradoProdDe(id),
        cantidad,
      })),
    ],
    cupon: cuponInfo?.ok && cuponInfo.tipo ? { tipo: cuponInfo.tipo, valor: cuponInfo.valor ?? 0 } : null,
    propina,
    descuentoExtra: descuentoTarjeta,
  });
  const sinItems = rapida && extras.length === 0 && Object.keys(prodQty).length === 0;

  // Las líneas que componen el total, para poder tocarlo. El servicio de la cita
  // cuenta como una; los productos cuentan por línea, no por unidad.
  const lineas: { id: string; precio: number; lista: number | null }[] = [
    ...(servicioFijo && precioFijo != null
      ? [{ id: servicioFijo.id, precio: precioFijo, lista: precioListaFijo ?? null }]
      : []),
    ...extras.map((id) => ({ id, precio: cobradoDe(id), lista: listaDe(id) ?? null })),
    ...Object.keys(prodQty).map((id) => ({ id, precio: cobradoProdDe(id), lista: listaProdDe(id) ?? null })),
  ];
  // Tocar el total solo edita solo cuando NO hay nada más metido en el medio: con
  // dos líneas no se sabe a cuál cargarle la diferencia, y con cupón, propina o
  // tarjeta el total ya no es la suma de las líneas. En esos casos el total lleva
  // a las líneas, que es donde el precio se cambia de verdad.
  const unicaLinea =
    lineas.length === 1 &&
    Object.values(prodQty).every((q) => q <= 1) &&
    !cuponInfo?.ok &&
    descuentoTarjeta === 0
      ? lineas[0]
      : null;

  // El reparto solo existe si está completo y cuadra; si no, se cobra con un solo
  // medio (mejor eso que guardar un desglose falso).
  const segundo = Math.round(Number(monto2) || 0);
  const repartoMixto =
    mixto && medio2 && medio2 !== medio && segundo > 0 && segundo < vivo.total
      ? [
          { medio, monto: vivo.total - segundo },
          { medio: medio2, monto: segundo },
        ]
      : null;

  async function submit() {
    if (mixto && !repartoMixto) {
      setErr(
        !medio2
          ? "Elige el segundo medio de pago."
          : `El monto del segundo medio tiene que estar entre 1 y ${cop(vivo.total - 1)}.`,
      );
      return;
    }
    if (sinItems) {
      setErr("Agrega al menos un servicio o producto.");
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
      clienteRef: reserva ? (reserva.clienteRef ?? null) : cliente.tipo === "existente" ? cliente.id : null,
      clienteNombre: rapida ? (cliente.tipo === "paso" ? "" : cliente.nombre) : undefined,
      servicioId: reserva?.servicioId ?? null,
      servicioIdOverride: servicioOverride ?? undefined,
      serviciosExtra: extras,
      precios: Object.entries(preciosEdit).map(([refId, precio]) => ({ refId, precio })),
      medio,
      pagos: repartoMixto ?? undefined,
      productos: Object.entries(prodQty).map(([id, cantidad]) => ({ id, cantidad })),
      propina,
      // Propina en efectivo aunque la venta sea digital: entra al cajón (0053, #16).
      propinaMedio: propina > 0 && propinaMedio && propinaMedio !== medio ? propinaMedio : null,
      nota,
      cuponCodigo: cupon.trim() || undefined,
      idemToken,
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      // La action REVENTÓ (no devolvió {ok:false}): la tablet del mostrador queda
      // abierta todo el día y tras un deploy sus actions ya no existen. Recargar
      // trae los ids vigentes; el idemToken evita cobrar dos veces si acaso.
      if (!recargarSiDeployViejo()) setErr("No se pudo cobrar. Revisa la conexión y vuelve a intentar.");
      return;
    }
    if (res.ok) {
      // La caja "suena" al cobrar: el equipo lo oye sin mirar la pantalla.
      sfxCobro();
      setResumen({
        total: res.total ?? 0,
        descuento: res.descuento ?? 0,
        propina: res.propina ?? 0,
        propinaMedio: propina > 0 && propinaMedio && propinaMedio !== medio ? propinaMedio : null,
        puntos: res.puntos ?? 0,
        tarjeta: res.tarjeta,
        resenaUrl: res.resenaUrl,
        pagos: repartoMixto,
      });
    } else setErr(res.error ?? "No se pudo completar");
  }

  if (resumen) {
    return (
      <div className={`${rapida ? "" : "mt-3 "}rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm`}>
        <div className="font-display text-xl text-accent-soft">¡Cobrado!</div>
        <div className="mt-2 space-y-1">
          {resumen.descuento > 0 && <div className="text-muted">Descuento aplicado: −{cop(resumen.descuento)}</div>}
          <div>Total cobrado: <b className="text-ink">{cop(resumen.total)}</b></div>
          {/* Con qué pagó, cuando fue partido: el barbero lo contrasta con lo que
              tiene en la mano y en el datáfono ANTES de que se vaya el cliente. */}
          {resumen.pagos && (
            <div className="text-muted">
              {resumen.pagos.map((r, i) => (
                <span key={r.medio}>
                  {i > 0 && " · "}
                  <b className="text-ink">{cop(r.monto)}</b>{" "}
                  {medios.find((m) => m.slug === r.medio)?.nombre ?? r.medio}
                </span>
              ))}
            </div>
          )}
          {resumen.propina > 0 && (
            <div className="text-muted">
              + {cop(resumen.propina)} de propina
              {resumen.propinaMedio && (
                <> en <b className="text-ink">{medios.find((m) => m.slug === resumen.propinaMedio)?.nombre ?? resumen.propinaMedio}</b></>
              )}{" "}
              · en la mano: <b className="text-ink">{cop(resumen.total + resumen.propina)}</b>
            </div>
          )}
          {resumen.tarjeta && (
            <div className="text-accent-soft">
              🎫{" "}
              {/* El texto sigue la config real de la tarjeta (0064): sin hitos
                  quemados, porque el dueño los cambia desde el panel. */}
              {resumen.tarjeta.beneficio === "regalo"
                ? `¡Corte #${resumen.tarjeta.posicion}! Entregale el regalo — el corte se cobró completo.`
                : resumen.tarjeta.beneficio
                  ? `${resumen.tarjeta.beneficio} aplicado en el corte #${resumen.tarjeta.posicion}.`
                  : `Lleva ${resumen.tarjeta.cortesTotales} corte${resumen.tarjeta.cortesTotales === 1 ? "" : "s"} en su tarjeta.`}
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
            {/* eslint-disable-next-line @next/next/no-img-element -- SVG local estático:
                next/image bloquea SVG por defecto (dangerouslyAllowSVG) y no
                optimizaría nada; el warning de LCP no aplica a un QR de 104px. */}
            <img
              src={`/qr/resena-${sede}.svg`}
              alt="Código QR para dejar la reseña en Google"
              className="h-[104px] w-[104px] shrink-0 rounded-lg bg-white p-1.5"
            />
            <div className="min-w-0">
              <div className="text-[13px] font-semibold text-ink">Pídele la reseña en Google</div>
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
    // Sin marco propio: sus tres sitios lo abren dentro de una hoja que ya es
    // la tarjeta. Con los dos marcos, a 390 px se perdían 34 px de ancho por
    // lado — justo lo que le faltaba a los nombres largos de los servicios.
    <div className={rapida ? "" : "mt-3"}>
      {/* Sin título ni X propios: los TRES sitios que abren este formulario lo
          meten en una hoja que ya trae título y cerrar. Se veía "Cobrar sin
          cita" y debajo "Venta rápida (sin cita)" con otra X. */}

      <div className="flex flex-col gap-5 pb-4">
        {rapida && (
          <div className="grid gap-3 sm:grid-cols-2">
            {/* Con dos sedes son dos botones con el nombre a la vista: un
                desplegable escondía en cuál iba a quedar la venta. */}
            {sedes.length <= 3 ? (
              <div className="sm:col-span-2">
                <Segmentado
                  etiqueta="Sede de la venta"
                  opciones={sedes.map((x) => ({ valor: x.id, texto: x.nombre }))}
                  valor={sede}
                  onCambio={(v) => cambiarSede(v)}
                />
              </div>
            ) : (
              <select value={sede} onChange={(e) => cambiarSede(e.target.value)} className={fld}>
                {sedes.map((x) => (
                  <option key={x.id} value={x.id}>{x.nombre}</option>
                ))}
              </select>
            )}
            {/* Se elige el barbero cuando el operador no tiene uno propio: el
                admin, y el MOSTRADOR DE SEDE (login primario del 0044). Sin esto
                la venta rápida del mostrador de sede se grababa con barbero_id
                null y el barbero perdía su comisión. El login de barbero cae en
                él mismo, sin selector. */}
            {elegirBarbero && (
              /* "El local": una gaseosa que despachó el administrador no la
                 vendió ningún barbero, y ponerle uno cualquiera le regala una
                 comisión que no se ganó. El servidor ya aceptaba barbero null
                 -la venta entra a la caja igual-; lo que faltaba era poder
                 DECIRLO. Va al final para que no se elija por inercia. */
              <ElegirBarbero
                barberos={barberosSede}
                value={barberoId}
                onChange={setBarberoId}
                placeholder="¿Quién vende?"
                extra={{ id: "local", etiqueta: "El local (sin comisión)" }}
              />
            )}
            <div className="sm:col-span-2">
              <ElegirCliente valor={cliente} onCambio={setCliente} pedirTelefono={false} />
            </div>
          </div>
        )}

        {servicioFijo && (
          <div>
            <div className={sLabel}>Servicio de la cita</div>
            <div className="rounded-xl border border-line bg-elevated px-3.5 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0 font-semibold text-ink">{servicioFijo.nombre}</span>
                <PrecioCobro
                  precio={precioFijo ?? 0}
                  lista={precioListaFijo ?? null}
                  onChange={(n) => editarPrecio(servicioFijo.id, n)}
                />
              </div>
              {/* Cambiar el servicio al cobrar: el cliente pidió corte y terminó
                  en corte+barba. Es un <select> nativo a propósito — en el celular
                  del local abre el selector del sistema, que se maneja con una mano. */}
              {cambiandoServicio ? (
                <select
                  autoFocus
                  value={servicioFijo.id}
                  onChange={(e) => {
                    setServicioOverride(e.target.value);
                    setCambiandoServicio(false);
                  }}
                  onBlur={() => setCambiandoServicio(false)}
                  className="mt-2 w-full rounded-lg border border-accent bg-bg px-2 py-2 text-sm text-ink focus:outline-none"
                >
                  {serviciosSede.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre} · {cop(s.precios[sedeId] ?? 0)}
                    </option>
                  ))}
                </select>
              ) : (
                <button
                  type="button"
                  onClick={() => setCambiandoServicio(true)}
                  className="mt-1 min-h-11 text-[12.5px] font-semibold text-accent-soft underline decoration-dotted underline-offset-4 transition hover:text-ink"
                >
                  Cambiar servicio
                </button>
              )}
              {servicioOverride && servicioOverride !== reserva?.servicioId && (
                <p className="text-[12px] text-muted">
                  La cita era otro servicio.{" "}
                  <button
                    type="button"
                    onClick={() => setServicioOverride(null)}
                    className="font-semibold text-accent-soft underline decoration-dotted underline-offset-2"
                  >
                    Volver al de la cita
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        <div>
          <div className={sLabel}>{rapida ? "Servicios" : "¿Se sumó algo en la silla?"}</div>
          {/* Buscar en vez de abrir categorías: lo pidió el dueño ("filtro de
              búsqueda en las bebidas y en los cortes, para no estar filtrando con
              esos desplegables"). Un solo campo filtra servicios Y productos: la
              gaseosa y el corte se buscan en el mismo lugar. */}
          <div className="relative mb-3">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar corte, servicio o bebida…"
              aria-label="Buscar servicio o producto"
              autoComplete="off"
              className="min-h-12 w-full rounded-xl border border-line bg-bg pl-10 pr-11 text-[15px] text-ink placeholder:text-muted focus:border-ink/60 focus:outline-none"
            />
            {busca && (
              <button
                type="button"
                onClick={() => setBusca("")}
                aria-label="Borrar la búsqueda"
                className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center text-[18px] text-muted transition hover:text-ink"
              >
                ×
              </button>
            )}
          </div>

          {q ? (
            (() => {
              const hallados = serviciosSede.filter((x) => x.id !== servicioFijo?.id && norm(x.nombre).includes(q));
              return hallados.length ? (
                <div className="flex flex-wrap gap-2">
                  {hallados.map((x) => {
                    const activo = extras.includes(x.id);
                    return (
                      <button
                        key={x.id}
                        type="button"
                        aria-pressed={activo}
                        onClick={() => toggleExtra(x.id)}
                        className={`min-h-11 max-w-full rounded-full border px-3.5 py-2 text-left text-[13px] font-semibold transition ${
                          activo ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                        }`}
                      >
                        {x.nombre}
                        <span className={`ml-1.5 font-medium tabular-nums ${activo ? "text-accent-soft" : "text-muted"}`}>
                          +{cop(x.precios[sedeId] ?? 0)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-[13px] text-muted">Ningún servicio con “{busca.trim()}”.</p>
              );
            })()
          ) : (
            <>
              {/* En la venta rápida lo que más se cobra va a un toque: son los
                  mismos cuatro del walk-in, y cubren casi todo lo que entra sin
                  cita. El resto, por categoría o con el buscador de arriba. */}
              {rapida && (() => {
                const top = FRECUENTES.map((id) => serviciosSede.find((x) => x.id === id)).filter(
                  (x): x is (typeof serviciosSede)[number] => !!x && x.id !== servicioFijo?.id,
                );
                return top.length ? (
                  <div className="mb-2.5 grid grid-cols-2 gap-2">
                    {top.map((x) => {
                      const activo = extras.includes(x.id);
                      return (
                        <button
                          key={x.id}
                          type="button"
                          aria-pressed={activo}
                          onClick={() => toggleExtra(x.id)}
                          className={`flex min-h-[60px] flex-col items-start justify-center rounded-xl border px-3.5 py-2 text-left transition ${
                            activo ? "border-accent bg-accent/15" : "border-line hover:border-ink/25"
                          }`}
                        >
                          <span className="text-[13.5px] font-semibold leading-tight text-ink">{x.nombre.split(" (")[0]}</span>
                          <span className={`mt-0.5 text-[12.5px] font-semibold tabular-nums ${activo ? "text-accent-soft" : "text-muted"}`}>
                            {cop(x.precios[sedeId] ?? 0)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : null;
              })()}
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
            </>
          )}

          {/* Lo elegido, con su precio tocable. Sin esto la venta rápida (el
              walk-in, que es la mitad del mostrador) no tenía dónde ajustar un
              valor: los chips son de elegir, no de cobrar. */}
          {extras.length > 0 && (
            <div ref={refLineas} className="mt-2.5 space-y-1.5 scroll-mt-24">
              {extras.map((id) => (
                <div
                  key={id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-line/60 bg-elevated/50 px-3.5 py-2 text-sm"
                >
                  <span className="min-w-0 truncate text-ink">
                    {serviciosSede.find((x) => x.id === id)?.nombre ?? id}
                  </span>
                  <PrecioCobro precio={cobradoDe(id)} lista={listaDe(id)} onChange={(n) => editarPrecio(id, n)} />
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className={sLabel}>Consumos · stock real de la sede</div>
          {productosVisibles.length === 0 ? (
            <p className="text-sm text-muted">
              {q ? `Ninguna bebida ni producto con “${busca.trim()}”.` : "Sin productos en esta sede."}
            </p>
          ) : (
            <div>
              {productosVisibles.map((p) => {
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
                        {agotado ? "Agotado" : `quedan ${resta}${resta <= 3 ? " · poco stock" : ""}`}
                      </div>
                      {/* El precio, tocable, SOLO cuando ya se agregó al menos uno:
                          si no, la lista de productos se llena de botones de editar
                          para cosas que nadie está vendiendo. Los servicios ya se
                          podían cambiar; los productos no, y el administrador vende
                          bebidas a precio distinto del de lista todo el tiempo. */}
                      {q > 0 ? (
                        <PrecioCobro
                          precio={cobradoProdDe(p.id)}
                          lista={listaProdDe(p.id)}
                          onChange={(n) => editarPrecio(p.id, n)}
                        />
                      ) : (
                        <div className="text-xs tabular-nums text-muted">{cop(p.precio)}</div>
                      )}
                    </div>
                    <div className="flex items-center rounded-full border border-line bg-elevated">
                      <button
                        type="button"
                        aria-label={`Quitar ${p.nombre}`}
                        onClick={() => setQty(p.id, q - 1)}
                        disabled={q === 0}
                        className="h-11 w-11 rounded-full text-lg font-bold text-ink transition disabled:text-muted/40"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-[15px] font-bold text-ink tabular-nums">{q}</span>
                      <button
                        type="button"
                        aria-label={`Agregar ${p.nombre}`}
                        onClick={() => setQty(p.id, Math.min(q + 1, p.stock))}
                        disabled={agotado || resta <= 0}
                        className="h-11 w-11 rounded-full text-lg font-bold text-ink transition disabled:text-muted/40"
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
          <div className={sLabel}>¿Cómo pagó?</div>
          {medios.length === 0 ? (
            <p className="text-sm text-muted">Sin medios de pago configurados (avísale al admin).</p>
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

        {/* Cobro con DOS medios (0060). Antes había que elegir uno solo: el cliente
            pagaba $20 en efectivo y $15 por Nequi, el barbero marcaba "efectivo" y
            el cajón quedaba esperando $35 que nunca estuvieron. */}
        {medios.length > 1 && (
          <div>
            <button
              type="button"
              onClick={() => {
                setMixto((v) => !v);
                setErr(null);
              }}
              aria-pressed={mixto}
              className={`flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border px-3 text-[13px] font-bold transition ${
                mixto ? "border-accent bg-accent/10 text-accent-soft" : "border-line text-muted hover:text-ink"
              }`}
            >
              {mixto ? "Quitar el pago dividido" : "Pagó con dos medios"}
            </button>

            {mixto && (
              <div className="mt-2.5 rounded-xl border border-accent/30 bg-accent/[0.05] p-3">
                <div className={sLabel}>¿Con qué más pagó?</div>
                <div className="grid grid-cols-3 gap-2">
                  {medios
                    .filter((m) => m.slug !== medio)
                    .map((m) => {
                      const act = medio2 === m.slug;
                      return (
                        <button
                          type="button"
                          key={m.slug}
                          aria-pressed={act}
                          onClick={() => {
                            setMedio2(m.slug);
                            setErr(null);
                          }}
                          className={`flex min-h-[60px] flex-col items-center justify-center gap-1 rounded-xl border px-1.5 py-2 text-[11px] font-bold transition ${
                            act ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                          }`}
                        >
                          <MedioLogo slug={m.slug} nombre={m.nombre} />
                          <span className="max-w-full truncate">{m.nombre}</span>
                        </button>
                      );
                    })}
                </div>

                <label className="mt-3 block">
                  <span className={sLabel}>
                    ¿Cuánto pagó con {medios.find((m) => m.slug === medio2)?.nombre ?? "ese medio"}?
                  </span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={Math.max(1, vivo.total - 1)}
                    value={monto2}
                    onChange={(e) => {
                      setMonto2(e.target.value);
                      setErr(null);
                    }}
                    placeholder={`Ej: ${Math.round(vivo.total / 2)}`}
                    className="min-h-11 w-full rounded-xl border border-line bg-bg px-3.5 text-[15px] text-ink tabular-nums placeholder:text-muted focus:border-accent focus:outline-none"
                  />
                </label>

                {/* El reparto a la vista ANTES de cobrar: es lo que va a quedar en la
                    caja, y el barbero lo puede contrastar con lo que tiene en la mano. */}
                <p className="mt-2 text-[12.5px] leading-relaxed text-muted">
                  {repartoMixto ? (
                    <>
                      Queda:{" "}
                      {repartoMixto.map((r, i) => (
                        <span key={r.medio}>
                          {i > 0 && " · "}
                          <b className="text-ink">{cop(r.monto)}</b>{" "}
                          {medios.find((m) => m.slug === r.medio)?.nombre ?? r.medio}
                        </span>
                      ))}
                    </>
                  ) : (
                    <>Elige el segundo medio y cuánto pagó con él; el resto va al primero.</>
                  )}
                </p>
              </div>
            )}
          </div>
        )}

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
          {/* Con qué dejó la propina, AHÍ MISMO. Antes esta pregunta aparecía tres
              bloques más abajo, después del pago dividido, y el barbero ya había
              pasado de largo (lo señaló el dueño). Como "¿Cómo pagó?" ahora va
              antes, "igual que el pago" ya dice con qué. */}
          {propina > 0 && medios.length > 1 && (
            <div className="mt-3 rounded-xl border border-line bg-elevated/40 p-3">
              <div className="mb-2 text-[12.5px] font-semibold text-ink">¿Con qué dejó la propina?</div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  aria-pressed={!propinaMedio || propinaMedio === medio}
                  onClick={() => setPropinaMedio(null)}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-3 text-[12.5px] font-semibold transition ${
                    !propinaMedio || propinaMedio === medio
                      ? "border-accent bg-accent/15 text-ink"
                      : "border-line text-ink/80 hover:border-ink/25"
                  }`}
                >
                  Igual que el pago
                  {medio && <span className="text-muted">· {medios.find((m) => m.slug === medio)?.nombre ?? medio}</span>}
                </button>
                {medios
                  .filter((m) => m.slug !== medio)
                  .map((m) => {
                    const act = propinaMedio === m.slug;
                    return (
                      <button
                        key={m.slug}
                        type="button"
                        aria-pressed={act}
                        onClick={() => setPropinaMedio(m.slug)}
                        className={`inline-flex min-h-11 items-center gap-2 rounded-xl border px-2.5 text-[12.5px] font-semibold transition ${
                          act ? "border-accent bg-accent/15 text-ink" : "border-line text-ink/80 hover:border-ink/25"
                        }`}
                      >
                        <MedioLogo slug={m.slug} nombre={m.nombre} size={22} />
                        {m.nombre}
                      </button>
                    );
                  })}
              </div>
              {(propinaMedio ?? medio) === "efectivo" && medio !== "efectivo" && (
                <p className="mt-2 text-[12px] text-muted">Esa propina entra al cajón.</p>
              )}
            </div>
          )}
        </div>

        {/* Nota y cupón se usan una vez cada muchos cobros: plegados no le ocupan
            la pantalla al que cobra con el cliente enfrente. Se abren solos si
            ya tienen algo escrito. */}
        <details className="group rounded-xl border border-line" open={!!(nota || cupon)}>
          <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3.5 [&::-webkit-details-marker]:hidden">
            <span className="text-[13.5px] font-semibold text-ink">
              Nota o cupón <span className="font-normal text-muted">· opcional</span>
            </span>
            <ChevronDownIcon className="h-4 w-4 shrink-0 text-muted transition group-open:rotate-180" />
          </summary>
          <div className="space-y-4 border-t border-line/60 p-3.5">
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
        </details>
      </div>

      {/* Tarjeta de cortes: aviso del canje automático (se aplica solo, el server
          recomputa). Solo cuando esta venta suma un corte y toca beneficio. */}
      {/* OJO: este aviso NO puede colgar de descuentoTarjeta > 0. El regalo del 5º
          corte no descuenta plata, así que con esa condición el barbero nunca se
          enteraría de entregarlo y el cliente se iría sin su premio. */}
      {tarjeta && (
        <div className="flex items-center gap-2 border-t border-accent/30 bg-accent/[0.07] px-4 py-2.5 text-sm font-semibold text-accent-soft">
          <span aria-hidden>{tarjeta.tipo === "regalo" ? "🎁" : "🎫"}</span>
          {/* El texto sale de la config real (0064): el dueño puede mover el
              regalo al 4º corte o bajar el 50% al 30%, y esto lo sigue. */}
          {tarjeta.tipo === "regalo" ? (
            <span>Corte #{tarjeta.posicion} · entregale el REGALO (el corte se cobra completo)</span>
          ) : (
            <span>
              Corte #{tarjeta.posicion} · −{tarjeta.tipo} en el corte · −{cop(descuentoTarjeta)}
            </span>
          )}
        </div>
      )}

      {/* Barra de cobro: pegada abajo mientras el form está a la vista (mobile-first). */}
      <div className="sticky bottom-0 -mx-4 border-t border-line bg-bg/95 px-4 py-3 backdrop-blur-md sm:-mx-6 sm:px-6">
        {err && (
          <div className="mb-2.5 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>
        )}
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="truncate text-[11px] text-muted">
              Total a cobrar · {medioNombre}
              {vivo.descuento > 0 && <span className="tabular-nums"> · −{cop(vivo.descuento)} de descuento</span>}
            </div>
            {/* El número grande ES el control. Antes era texto y el dueño se
                quedaba mirándolo esperando poder escribir encima. */}
            {unicaLinea ? (
              <PrecioCobro
                precio={vivo.total}
                lista={unicaLinea.lista}
                onChange={(n) => editarPrecio(unicaLinea.id, n)}
                grande
              />
            ) : lineas.length > 0 ? (
              <button
                type="button"
                onClick={() => refLineas.current?.scrollIntoView({ behavior: "smooth", block: "center" })}
                className="block max-w-full truncate font-display text-[26px] font-bold leading-tight text-ink tabular-nums underline decoration-dotted decoration-line underline-offset-4 transition hover:decoration-accent"
              >
                {cop(vivo.total)}
                <span aria-hidden className="ml-1 align-middle text-[11px] font-normal text-muted">✎</span>
              </button>
            ) : (
              <div className="truncate font-display text-[26px] font-bold leading-tight text-ink tabular-nums">{cop(vivo.total)}</div>
            )}
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
