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
} from "@/lib/actions";
import type { Sede, Barbero, Servicio, Producto } from "@/lib/data/types";
import type { AgendaItem } from "@/lib/data/queries";

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
}: {
  agenda: AgendaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [walkinOpen, setWalkinOpen] = useState(false);
  const [completeFor, setCompleteFor] = useState<string | null>(null);
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [history, setHistory] = useState<HistItem[] | null>(null);
  const [busy, setBusy] = useState(false);

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
      <div className="mb-8">
        {!walkinOpen ? (
          <button
            onClick={() => setWalkinOpen(true)}
            className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
          >
            + Cliente sin reserva (walk-in)
          </button>
        ) : (
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
                  <CompleteForm
                    reserva={r}
                    productos={productos.filter((p) => p.sede === r.sede)}
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
  const [saving, setSaving] = useState(false);
  const sedeBarberos = barberos.filter((b) => b.sede === sede);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberoId) {
      alert("Elegí el barbero");
      return;
    }
    setSaving(true);
    const res = await registrarWalkin({ sede, barberoId, servicioId, clienteNombre: nombre, telefono: tel });
    setSaving(false);
    if (res.ok) onDone();
    else alert(res.error);
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

function CompleteForm({
  reserva,
  productos,
  onDone,
}: {
  reserva: AgendaItem;
  productos: Producto[];
  onDone: () => void;
}) {
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [medio, setMedio] = useState("efectivo");
  const [saving, setSaving] = useState(false);
  const [cupon, setCupon] = useState("");
  const [cuponInfo, setCuponInfo] = useState<{ ok: boolean; msg: string } | null>(null);
  const [resumen, setResumen] = useState<{ total: number; descuento: number; puntos: number } | null>(null);
  const [err, setErr] = useState<string | null>(null);

  function setQty(id: string, q: number) {
    setProdQty((prev) => {
      const n = { ...prev };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  }

  async function chequearCupon() {
    if (!cupon.trim()) return;
    const v = await validarCupon(cupon);
    if (v.ok) {
      const detalle = v.tipo === "porcentaje" ? `${v.valor}% de descuento` : `${cop(v.valor!)} de descuento`;
      setCuponInfo({ ok: true, msg: `${v.codigo}: ${detalle}` });
    } else {
      setCuponInfo({ ok: false, msg: v.error ?? "Cupón inválido" });
    }
  }

  async function submit() {
    setSaving(true);
    setErr(null);
    const res = await completarReserva({
      reservaId: reserva.id,
      sede: reserva.sede,
      barberoId: reserva.barberoId,
      clienteRef: reserva.clienteRef,
      servicioId: reserva.servicioId,
      medio,
      productos: Object.entries(prodQty).map(([id, cantidad]) => ({ id, cantidad })),
      cuponCodigo: cupon.trim() || undefined,
    });
    setSaving(false);
    if (res.ok) setResumen({ total: res.total ?? 0, descuento: res.descuento ?? 0, puntos: res.puntos ?? 0 });
    else setErr(res.error ?? "No se pudo completar");
  }

  if (resumen) {
    return (
      <div className="mt-3 rounded-xl border border-accent/40 bg-accent/5 p-4 text-sm">
        <div className="font-display text-xl text-accent-soft">¡Cobrado!</div>
        <div className="mt-2 space-y-1">
          {resumen.descuento > 0 && <div className="text-muted">Descuento aplicado: −{cop(resumen.descuento)}</div>}
          <div>Total cobrado: <b className="text-ink">{cop(resumen.total)}</b></div>
          {resumen.puntos > 0 && <div className="text-emerald-400">+{resumen.puntos} puntos de fidelidad para el cliente</div>}
        </div>
        <button onClick={onDone} className="mt-3 rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft">
          Listo
        </button>
      </div>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-line bg-bg p-4">
      <div className="mb-2 text-[10px] uppercase tracking-[0.18em] text-muted">Consumos (opcional)</div>
      {productos.length === 0 ? (
        <p className="text-sm text-muted">Sin productos en esta sede.</p>
      ) : (
        <div className="space-y-2">
          {productos.map((p) => {
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

      {err && <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <div className="flex gap-2">
          {["efectivo", "datafono"].map((m) => (
            <button
              type="button"
              key={m}
              onClick={() => setMedio(m)}
              className={`rounded-lg border px-3 py-1.5 text-xs transition ${medio === m ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"}`}
            >
              {m === "datafono" ? "Datáfono" : "Efectivo"}
            </button>
          ))}
        </div>
        <button
          onClick={submit}
          disabled={saving}
          className="ml-auto rounded-full bg-accent px-6 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {saving ? "Guardando…" : "Cobrar y completar"}
        </button>
      </div>
    </div>
  );
}
