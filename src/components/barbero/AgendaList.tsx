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
import type { Sede, SedeId, Barbero, Servicio, Producto } from "@/lib/data/types";
import type { AgendaItem, MedioPago } from "@/lib/data/queries";

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
  productos,
  medios,
  esAdmin = false,
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
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
                          className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${r.canal === "walkin" ? "bg-white/10 text-muted" : "bg-accent/15 text-accent-soft"}`}
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
                      <span className="rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-500 px-3 py-1.5 text-xs font-semibold uppercase tracking-wider">
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
  productos: Producto[];
  medios: MedioPago[];
  esAdmin?: boolean;
  onDone: () => void;
  onCancel?: () => void;
}) {
  const rapida = !reserva;
  const [sede, setSede] = useState(reserva?.sede ?? sedes[0]?.id ?? "");
  const [barberoId, setBarberoId] = useState(""); // venta rápida: el admin puede cobrar por otro
  const [nombre, setNombre] = useState(""); // venta rápida: nombre del cliente (opcional)
  const [extras, setExtras] = useState<string[]>([]);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [propina, setPropina] = useState(0);
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
  const servicioFijo = reserva?.servicioId ? servicios.find((s) => s.id === reserva.servicioId) ?? null : null;
  const precioFijo = servicioFijo?.precios[sedeId];

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
          {resumen.puntos > 0 && <div className="text-emerald-400">+{resumen.puntos} puntos de fidelidad para el cliente</div>}
        </div>
        <button onClick={onDone} className="mt-3 rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft">
          Listo
        </button>
      </div>
    );
  }

  return (
    <div className={`${rapida ? "" : "mt-3 "}rounded-xl border border-line bg-bg p-4`}>
      {rapida && (
        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2 text-[10px] uppercase tracking-[0.18em] text-muted">Venta rápida (sin cita)</div>
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
        <div className="mb-4 flex items-center justify-between rounded-lg border border-accent/30 bg-accent/5 px-3 py-2 text-sm">
          <span>
            {servicioFijo.nombre} <span className="text-muted">· servicio de la cita</span>
          </span>
          <span className="text-accent-soft">{precioFijo != null ? cop(precioFijo) : "—"}</span>
        </div>
      )}

      <div className="mb-4">
        <button
          type="button"
          onClick={() => setExtrasOpen((v) => !v)}
          className="flex w-full items-center justify-between text-left text-[10px] uppercase tracking-[0.18em] text-muted transition hover:text-ink"
        >
          <span>
            Servicios adicionales (opcional)
            {extras.length > 0 && <span className="ml-2 rounded-full bg-accent/15 px-2 py-0.5 text-accent-soft">{extras.length}</span>}
          </span>
          <span>{extrasOpen ? "−" : "+"}</span>
        </button>
        {extrasOpen && (
          <div className="mt-2 space-y-1.5">
            {serviciosSede.length === 0 ? (
              <p className="text-sm text-muted">Sin servicios con precio en esta sede.</p>
            ) : (
              serviciosSede.map((s) => {
                const activo = extras.includes(s.id);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggleExtra(s.id)}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                      activo ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"
                    }`}
                  >
                    <span>{s.nombre}</span>
                    <span className={activo ? "text-accent-soft" : ""}>{cop(s.precios[sedeId] ?? 0)}</span>
                  </button>
                );
              })
            )}
          </div>
        )}
      </div>

      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted">Consumos (opcional)</div>
      {productosSede.length === 0 ? (
        <p className="text-sm text-muted">Sin productos en esta sede.</p>
      ) : (
        <div className="space-y-2">
          {productosSede.map((p) => {
            const q = prodQty[p.id] ?? 0;
            return (
              <div key={p.id} className="flex items-center justify-between text-sm">
                <span>
                  {p.nombre} <span className="text-muted">· {cop(p.precio)}</span>
                </span>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setQty(p.id, q - 1)} className="h-7 w-7 rounded-full border border-line">–</button>
                  <span className="w-5 text-center">{q}</span>
                  <button type="button" onClick={() => setQty(p.id, q + 1)} className="h-7 w-7 rounded-full border border-line">+</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4">
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">Propina (opcional)</div>
        <div className="flex flex-wrap items-center gap-2">
          {PROPINA_CHIPS.map((p) => (
            <button
              type="button"
              key={p}
              onClick={() => setPropina(propina === p ? 0 : p)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                propina === p ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"
              }`}
            >
              {cop(p)}
            </button>
          ))}
          <input
            type="number"
            min={0}
            value={propina || ""}
            onChange={(e) => setPropina(Math.max(0, Math.floor(Number(e.target.value) || 0)))}
            placeholder="Otro monto"
            className="w-32 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">Nota</div>
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          rows={2}
          placeholder="Observación (opcional)"
          className="w-full rounded-lg border border-line bg-bg px-3 py-1.5 text-sm text-ink placeholder:text-muted focus:border-accent focus:outline-none"
        />
      </div>

      <div className="mt-4">
        <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted">Cupón (opcional)</div>
        <div className="flex gap-2">
          <input
            value={cupon}
            onChange={(e) => { setCupon(e.target.value.toUpperCase()); setCuponInfo(null); }}
            placeholder="Código"
            className="flex-1 rounded-lg border border-line bg-bg px-3 py-1.5 text-sm uppercase text-ink placeholder:text-muted focus:border-accent focus:outline-none"
          />
          <button type="button" onClick={chequearCupon} className="rounded-lg border border-line px-3 py-1.5 text-xs text-muted transition hover:text-ink">
            Validar
          </button>
        </div>
        {cuponInfo && (
          <div className={`mt-1 text-xs ${cuponInfo.ok ? "text-emerald-400" : "text-accent-soft"}`}>{cuponInfo.msg}</div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-line bg-panel px-3 py-2 text-sm">
        {vivo.descuento > 0 && (
          <div className="flex justify-between text-muted">
            <span>Descuento</span>
            <span>−{cop(vivo.descuento)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span className="text-muted">Total</span>
          <span>{cop(vivo.total)}</span>
        </div>
        {vivo.propina > 0 && (
          <div className="flex justify-between text-muted">
            <span>+ Propina</span>
            <span>{cop(vivo.propina)}</span>
          </div>
        )}
        <div className="mt-1 flex justify-between border-t border-line pt-1 font-semibold">
          <span>Total a cobrar</span>
          <span className="text-accent-soft">{cop(vivo.aCobrar)}</span>
        </div>
      </div>

      {err && <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-2">
          {medios.length === 0 ? (
            <span className="text-xs text-muted">Sin medios de pago configurados (avisale al admin).</span>
          ) : (
            medios.map((m) => (
              <button
                type="button"
                key={m.slug}
                onClick={() => setMedio(m.slug)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${medio === m.slug ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"}`}
              >
                {m.nombre}
              </button>
            ))
          )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-full border border-line px-5 py-2 text-xs text-muted transition hover:text-ink">
              Cancelar
            </button>
          )}
          <button
            onClick={submit}
            disabled={saving}
            className="rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Cobrar y completar"}
          </button>
        </div>
      </div>
    </div>
  );
}
