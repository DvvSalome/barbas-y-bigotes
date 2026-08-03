"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import { actualizarReserva } from "@/lib/actions";
import { faltaParaLlegar } from "@/lib/slots";
import type { Barbero } from "@/lib/data/types";
import type { AgendaItem, PrecioServicioStaff } from "@/lib/data/queries";

// Vista MOSTRADOR: una sola pantalla compartida en el local, con una columna por
// barbero. Cualquiera del equipo marca llegadas y abre el cobro sin cambiar de
// sesión; la comisión igual cae en el barbero de la cita (el server la fija
// desde reservas.barbero_id, no desde quién está logueado).
const DONE = ["completada", "no_show", "cancelada"];

// Estados que ya no dependen de si el cliente avisó: se muestran tal cual.
const CHIP_FIJO: Record<string, { txt: string; cls: string }> = {
  en_curso: { txt: "En silla", cls: "bg-ok/15 text-ok" },
  completada: { txt: "Cobrada", cls: "bg-ok/15 text-ok" },
  no_show: { txt: "No llegó", cls: "bg-warn/15 text-warn" },
  cancelada: { txt: "Cancelada", cls: "bg-ink/10 text-muted" },
};

// UN solo chip por fila. Antes convivían dos: el estado de la reserva
// ("CONFIRMADA") y si el cliente respondió que viene ("SIN CONFIRMAR"). Son
// cosas distintas, pero pegados uno debajo del otro se leen como un error del
// sistema. En el mostrador lo único que cambia la conducta de una cita que
// todavía no empezó es si el cliente avisó o no, así que ese es el chip; el
// estado de la reserva ya se ve en el botón de la fila.
function chipDe(r: AgendaItem) {
  const fijo = CHIP_FIJO[r.estado];
  if (fijo) return fijo;
  // El walk-in está parado enfrente: preguntar si "confirmó" no tiene sentido.
  if (r.canal === "walkin") return { txt: "Walk-in", cls: "bg-ink/10 text-muted" };
  return r.confirmado
    ? { txt: "✓ Confirmó", cls: "bg-ok/15 text-ok" }
    : { txt: "Sin confirmar", cls: "bg-warn/15 text-warn" };
}

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
  preciosServicios = [],
  onCobrar,
  onWalkin,
}: {
  agenda: AgendaItem[];
  barberos: Barbero[];
  sedeNombre: string;
  cobrado: number;
  porBarbero: Record<string, number>;
  /**
   * Precios por sede (los MISMOS que usa la hoja de cobro). Van en la fila para
   * que el barbero sepa cuánto va a cobrar sin abrir la hoja. Opcional: sin la
   * lista la fila simplemente no muestra precio.
   */
  preciosServicios?: PrecioServicioStaff[];
  /** Abre la hoja de cobro de la agenda normal (misma lógica de plata). */
  onCobrar: (reservaId: string) => void;
  /** Abre el walk-in con ese barbero puesto. El hueco de un barbero libre es
   *  justo donde hace falta anotar al que acaba de entrar. */
  onWalkin?: (barberoId: string) => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  // Reloj que AVANZA (un tic por minuto). La pantalla del mostrador queda
  // abierta todo el día: con el instante congelado al montar, el botón "Llegó"
  // de la cita de la tarde seguía diciendo "faltan 2h" para siempre y solo
  // recargando la página se destrababa. El refresh del realtime no alcanza:
  // vuelve a renderizar con datos nuevos, pero el estado del cliente no cambia.
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setAhora(Date.now()), 60_000);
    return () => clearInterval(t);
  }, []);

  async function marcar(r: AgendaItem, estado: string) {
    const quien = r.cliente || "este cliente";
    if (
      estado === "cancelada" &&
      !window.confirm(
        `¿Cancelar la cita de ${quien} a las ${hora(r.inicio)}? Se le avisa al cliente y el cupo queda libre.`,
      )
    )
      return;
    // "No llegó" también pregunta: desde el mostrador no hay vuelta atrás (la
    // cita sale de la lista y no queda ningún botón para revertirla), y el botón
    // está al lado del que se usa todo el día. Marcarlo por error a alguien que
    // está sentado en la silla deja la venta sin registrar.
    if (
      estado === "no_show" &&
      !window.confirm(`¿Marcar que ${quien} NO vino a la cita de las ${hora(r.inicio)}? No se puede deshacer.`)
    )
      return;
    setBusy(r.id);
    await actualizarReserva(r.id, estado === "en_curso" ? { estado, llegada: "a_tiempo" } : { estado });
    setBusy(null);
    router.refresh();
  }

  // Precio del servicio de la cita en SU sede (misma resolución que la hoja de
  // cobro). null en el walk-in sin servicio o si esa sede no tiene precio.
  const precioDe = (r: AgendaItem): number | null => {
    if (!r.servicioId) return null;
    return preciosServicios.find((s) => s.id === r.servicioId)?.preciosPorSede[r.sede] ?? null;
  };

  const totalCitas = agenda.length;
  const hechas = agenda.filter((r) => DONE.includes(r.estado)).length;

  // Su hora ya pasó y nadie dijo si llegó. Hasta ahora se quedaban calladas en la
  // fila hasta que el barrido nocturno las daba por "no llegó" — si el cliente sí
  // vino, esa venta no se registró nunca y el barbero perdió su comisión. Ahora
  // el mostrador PREGUNTA.
  const esperaRespuesta = (r: AgendaItem) =>
    !DONE.includes(r.estado) && r.estado !== "en_curso" && new Date(r.inicio).getTime() < ahora;
  const sinRespuesta = agenda.filter(esperaRespuesta).length;

  // Tiene movimiento = alguien en la silla o citas por atender. Solo eso merece
  // una columna; el resto va a una tira de una línea.
  const tieneMovimiento = (id: string) =>
    agenda.some((r) => r.barberoId === id && !DONE.includes(r.estado));
  const conMovimiento = barberos.filter((b) => tieneMovimiento(b.id));
  const libres = barberos.filter((b) => !tieneMovimiento(b.id));

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
          {sinRespuesta > 0 && (
            <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-warn/12 px-2.5 py-1 text-[12px] font-semibold text-warn">
              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
              {sinRespuesta === 1
                ? "1 cita sin responder: ¿llegó?"
                : `${sinRespuesta} citas sin responder: ¿llegaron?`}
            </p>
          )}
        </div>
        <div className="text-right">
          <div className="font-display text-[30px] font-bold leading-none tabular-nums text-ok">{cop(cobrado)}</div>
          <div className="text-[11px] uppercase tracking-[0.14em] text-muted">cobrado hoy en la sede</div>
        </div>
      </div>

      {/* El que TIENE gente lleva su columna; el que está libre no necesita una
          caja entera para decir "libre". Antes eran 6 tarjetas idénticas
          repitiendo "Sin citas pendientes", o sea 6 veces el mismo dato. */}
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {conMovimiento.map((b) => {
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
                  <div className="text-[11px] uppercase tracking-[0.1em] text-muted">{cerradas} cerradas</div>
                </div>
              </header>

              {/* Citas del barbero */}
              <div className="flex-1 divide-y divide-line/60">
                {activas.length === 0 && (
                  <p className="px-3.5 py-6 text-center text-[12.5px] text-muted">
                    Sin citas pendientes. Suma un walk-in desde la agenda.
                  </p>
                )}
                {activas.map((r) => {
                  const enCurso = r.estado === "en_curso";
                  const pregunta = esperaRespuesta(r);
                  const chip = pregunta ? { txt: "¿Llegó?", cls: "bg-warn/15 text-warn" } : chipDe(r);
                  const precio = precioDe(r);
                  return (
                    <div
                      key={r.id}
                      className={`px-3.5 py-3 ${
                        enCurso ? "bg-ok/[0.05]" : pregunta ? "bg-warn/[0.06]" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* 64px: con 52 la hora se partía en dos líneas ("6:47 /
                            pm") en cualquier cita de la tarde. */}
                        <span className="w-16 shrink-0 font-display text-[17px] font-bold leading-tight tabular-nums text-accent-soft">
                          {hora(r.inicio)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13.5px] font-bold">{r.cliente || "Walk-in"}</span>
                          <span className="block truncate text-[11.5px] text-muted">{r.servicio || "—"}</span>
                        </span>
                        <span className="flex shrink-0 flex-col items-end gap-1">
                          {/* Cuánto vale la cita, sin abrir la hoja de cobro. */}
                          {precio !== null && (
                            <span className="font-display text-[14px] font-bold leading-none tabular-nums text-ink">
                              {cop(precio)}
                            </span>
                          )}
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wide ${chip.cls}`}
                          >
                            {chip.txt}
                          </span>
                        </span>
                      </div>

                      {/* La hora ya pasó: acá el mostrador no ofrece una acción,
                          PREGUNTA. Las dos respuestas pesan igual porque las dos
                          son ciertas la mitad de las veces; dejar "No llegó" como
                          un botón chiquito abajo hacía que nadie la respondiera y
                          el barrido nocturno decidiera por el barbero. */}
                      {pregunta && (
                        <div className="mt-2.5 rounded-xl border border-warn/35 bg-warn/[0.07] p-2.5">
                          <p className="mb-2 text-[12.5px] font-semibold text-ink">
                            Su hora era {hora(r.inicio)}. ¿{r.cliente || "El cliente"} llegó?
                          </p>
                          <div className="flex gap-2">
                            <button
                              onClick={() => marcar(r, "en_curso")}
                              disabled={busy === r.id}
                              className="min-h-12 flex-1 rounded-lg bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-3 text-[13.5px] font-bold text-on-accent transition hover:brightness-105 disabled:opacity-40"
                            >
                              Sí, está en la silla
                            </button>
                            <button
                              onClick={() => marcar(r, "no_show")}
                              disabled={busy === r.id}
                              className="min-h-12 flex-1 rounded-lg border border-warn/50 px-3 text-[13.5px] font-bold text-warn transition hover:bg-warn/10 disabled:opacity-40"
                            >
                              No llegó
                            </button>
                          </div>
                        </div>
                      )}

                      {/* Con la pregunta arriba, estos botones sobran: repetirían
                          "Llegó" y "No llegó" a 8px de distancia. "Cancelar" sale
                          también a propósito — una cita cuya hora ya pasó no se
                          cancela, se responde. */}
                      <div
                        className={`mt-2.5 flex-wrap items-center gap-2 ${pregunta ? "hidden" : "flex"}`}
                      >
                        {enCurso ? (
                          <button
                            onClick={() => onCobrar(r.id)}
                            className="min-h-12 flex-1 basis-full rounded-lg bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-3.5 text-[13.5px] font-bold text-on-accent transition hover:brightness-105"
                          >
                            {/* Sin el monto: el precio de la fila es el del
                                servicio, y el cobro real puede sumar productos,
                                propina o descuento. */}
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
                                className="min-h-12 flex-1 basis-full rounded-lg bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-3.5 text-[13.5px] font-bold text-on-accent transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-40"
                              >
                                {temprano ? `Llegó · ${temprano}` : "✓ Llegó"}
                              </button>
                            );
                          })()
                        )}
                        {/* Destructivos en su propia fila y separados del principal:
                            antes estaban a 6px de "Cobrar" y se tocan de pie, con
                            una mano y el cliente enfrente. */}
                        <div className="mt-1 flex w-full flex-wrap gap-2 border-t border-line/50 pt-2">
                          <button
                            onClick={() => marcar(r, "no_show")}
                            disabled={busy === r.id}
                            className="min-h-11 rounded-lg border border-line px-3 text-[12px] text-muted transition hover:text-ink disabled:opacity-50"
                          >
                            No llegó
                          </button>
                          {!enCurso && (
                            <button
                              onClick={() => marcar(r, "cancelada")}
                              disabled={busy === r.id}
                              className="min-h-11 rounded-lg border border-line px-3 text-[12px] text-muted transition hover:border-accent/40 hover:text-accent-soft disabled:opacity-50"
                            >
                              Cancelar
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      {/* Nadie con gente: en vez de seis cajas vacías, una sola línea que dice
          quién está disponible. */}
      {conMovimiento.length === 0 && (
        <div className="rounded-[18px] border border-line bg-panel px-4 py-5 text-center">
          <p className="text-[13.5px] font-semibold text-ink">Nadie en la silla ahora mismo</p>
          <p className="mt-0.5 text-[12px] text-muted">
            Cuando entre alguien sin cita, tócalo abajo y queda registrado a ese barbero.
          </p>
        </div>
      )}

      {libres.length > 0 && (
        <section className="mt-3" aria-label="Barberos libres">
          <h2 className="mb-2 text-[11px] font-bold uppercase tracking-[0.14em] text-muted">
            Libres ahora · {libres.length}
          </h2>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {libres.map((b) => (
              <div
                key={b.id}
                className="flex items-center gap-2.5 rounded-xl border border-line bg-panel px-3 py-2"
              >
                {b.fotoUrl ? (
                  <Image
                    src={b.fotoUrl}
                    alt={b.nombre}
                    width={32}
                    height={32}
                    className="h-8 w-8 shrink-0 rounded-full object-cover object-top"
                  />
                ) : (
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-elevated text-[11px] font-bold text-ink">
                    {iniciales(b.nombre)}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold text-ink">{b.nombre}</span>
                  <span className="block text-[11px] text-ok">Libre</span>
                </span>
                {onWalkin && (
                  <button
                    onClick={() => onWalkin(b.id)}
                    className="min-h-9 shrink-0 rounded-full border border-accent/40 bg-accent/[0.07] px-3 text-[11.5px] font-bold text-accent-soft transition hover:bg-accent/15"
                  >
                    + Cliente
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
