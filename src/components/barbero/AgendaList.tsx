"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import {
  registrarWalkin,
  completarReserva,
  actualizarReserva,
  historialCliente,
  validarCupon,
  proponerAdelanto,
} from "@/lib/actions";
import { calcularCobro } from "@/lib/cobro";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { MedioLogo } from "@/components/staff/MedioLogo";
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

export function AgendaList({
  agenda,
  sedes,
  barberos,
  servicios,
  preciosServicios,
  productos,
  medios,
  esAdmin = false,
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  preciosServicios: PrecioServicioStaff[];
  productos: Producto[];
  medios: MedioPago[];
  esAdmin?: boolean;
}) {
  const router = useRouter();
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [ventaOpen, setVentaOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [busy, setBusy] = useState(false);

  const freeSlots = agenda.filter((item) => ["cancelada", "no_show"].includes(item.estado));

  async function setEstado(id: string, patch: { estado?: string; llegada?: string }) {
    setBusy(true);
    await actualizarReserva(id, patch);
    setBusy(false);
    router.refresh();
  }

  async function showHistory(ref: string | null, id: string) {
    if (!ref) return;
    setHistoryFor(id);
    setHistory(null);
    const h = await historialCliente(ref);
    setHistory(h as HistItem[]);
  }

  return (
    <div>
      <div className="mb-8 space-y-3">
        {!walkinOpen && !ventaOpen && (
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setWalkinOpen(true)}
              className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
            >
              + Cliente sin reserva (walk-in)
            </button>
            <button
              onClick={() => setVentaOpen(true)}
              className="rounded-full border border-accent/50 px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-accent-soft transition hover:bg-accent/10"
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

      {agenda.length === 0 ? (
        <p className="text-sm text-muted">
          No hay clientes en la agenda de hoy. Registrá un walk-in, o las reservas de la app
          aparecerán acá.
        </p>
      ) : (
        <div className="space-y-3">
          {agenda.map((r) => {
            const done = ["completada", "no_show", "cancelada"].includes(r.estado);
            
            // Calculate advancement opportunities
            const possibleAdvances = freeSlots.filter((fs) => 
              fs.barberoId === r.barberoId && 
              new Date(fs.inicio).getTime() < new Date(r.inicio).getTime()
            );
            const earliestSlot = possibleAdvances.sort((a, b) => new Date(a.inicio).getTime() - new Date(b.inicio).getTime())[0];
            
            let hasPendingProposal = false;
            let proposedTimeStr = "";
            if (r.nota) {
              try {
                const obj = JSON.parse(r.nota);
                if (obj.propuesta_adelanto?.estado === "pendiente") {
                  hasPendingProposal = true;
                  proposedTimeStr = new Date(obj.propuesta_adelanto.inicio).toLocaleTimeString("es-CO", { hour: "numeric", minute: "2-digit" });
                }
              } catch {}
            }

            return (
              <div key={r.id} className="rounded-2xl border border-line bg-panel p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-20 font-display text-2xl text-accent-soft">{hora(r.inicio)}</div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{r.cliente || "Walk-in"}</span>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${r.canal === "walkin" ? "bg-ink/10 text-muted" : "bg-accent/15 text-accent-soft"}`}
                        >
                          {r.canal === "walkin" ? "Sin reserva" : "App"}
                        </span>
                        <span className="text-[10px] uppercase tracking-wide text-muted">
                          · {ESTADO[r.estado] ?? r.estado}
                        </span>
                      </div>
                      <div className="text-sm text-muted">
                        {r.servicio || "—"} · {r.barbero}
                        {r.telefono ? ` · ${r.telefono}` : ""}
                      </div>
                    </div>
                  </div>
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
                      <span className="rounded-full bg-warn/10 border border-warn/30 text-warn px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
                        Propuesto {proposedTimeStr}
                      </span>
                    )}
                    {earliestSlot && !done && !hasPendingProposal && (
                      <button
                        onClick={async () => {
                          setBusy(true);
                          const res = await proponerAdelanto({
                            reservaId: r.id,
                            inicioISO: earliestSlot.inicio
                          });
                          setBusy(false);
                          if (res.ok) {
                            alert("Propuesta de adelanto enviada al cliente.");
                            router.refresh();
                          } else {
                            alert(res.error);
                          }
                        }}
                        disabled={busy}
                        className="rounded-full border border-accent/40 bg-accent/5 px-3 py-1.5 text-xs text-accent-soft hover:bg-accent/15 transition disabled:opacity-50"
                      >
                        Ofrecer Adelanto ({hora(earliestSlot.inicio)})
                      </button>
                    )}
                    {!done && (
                      <>
                        {r.estado !== "en_curso" && (
                          <button
                            onClick={() => setEstado(r.id, { estado: "en_curso", llegada: "a_tiempo" })}
                            disabled={busy}
                            className="rounded-full border border-line px-3 py-1.5 text-xs transition hover:border-accent/50 disabled:opacity-50"
                          >
                            Llegó
                          </button>
                        )}
                        <button
                          onClick={() => setCompleteFor(completeFor === r.id ? null : r.id)}
                          className="rounded-full bg-accent px-3 py-1.5 text-xs font-semibold uppercase text-on-accent transition hover:bg-accent-soft"
                        >
                          Completar
                        </button>
                        <button
                          onClick={() => setEstado(r.id, { estado: "no_show" })}
                          disabled={busy}
                          className="rounded-full border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink disabled:opacity-50"
                        >
                          No llegó
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {historyFor === r.id && (
                  <div className="mt-3 rounded-xl border border-line bg-bg p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-[0.18em] text-muted">Historial del cliente</span>
                      <button onClick={() => setHistoryFor(null)} className="text-xs text-muted hover:text-ink">cerrar</button>
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
                )}

                {completeFor === r.id && !done && (
                  <CheckoutForm
                    reserva={r}
                    sedes={sedes}
                    barberos={barberos}
                    servicios={servicios}
                    preciosServicios={preciosServicios}
                    productos={productos}
                    medios={medios}
                    onDone={() => {
                      setCompleteFor(null);
                      router.refresh();
                    }}
                  />
                )}
              </div>
            );
          })}
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
  const [resumen, setResumen] = useState<{ total: number; descuento: number; propina: number; puntos: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

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
          {resumen.puntos > 0 && <div className="text-ok">+{resumen.puntos} puntos de fidelidad para el cliente</div>}
        </div>
        <button onClick={onDone} className="mt-3 rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft">
          Listo
        </button>
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
          {serviciosSede.length === 0 ? (
            <p className="text-sm text-muted">Sin servicios con precio en esta sede.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {serviciosSede.map((s) => {
                const activo = extras.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    aria-pressed={activo}
                    onClick={() => toggleExtra(s.id)}
                    className={`min-h-10 rounded-full border px-3.5 py-2 text-[13px] font-semibold transition ${
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
                        className="h-[38px] w-[38px] rounded-full text-lg font-bold text-ink transition disabled:text-line"
                      >
                        −
                      </button>
                      <span className="min-w-6 text-center text-[15px] font-bold text-ink tabular-nums">{q}</span>
                      <button
                        type="button"
                        aria-label={`Agregar ${p.nombre}`}
                        onClick={() => setQty(p.id, Math.min(q + 1, p.stock))}
                        disabled={agotado || resta <= 0}
                        className="h-[38px] w-[38px] rounded-full text-lg font-bold text-ink transition disabled:text-line"
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
