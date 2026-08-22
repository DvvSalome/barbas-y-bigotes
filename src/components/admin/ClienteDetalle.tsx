"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { cop } from "@/lib/format";
import {
  agregarNotaCliente,
  editarNotaCliente,
  borrarNotaCliente,
  actualizarNotaFicha,
  agregarMovWallet,
  agregarResenaCliente,
  borrarResenaCliente,
  canjearPuntos,
} from "@/lib/actions";
import { Kpi } from "@/components/admin/Kpi";
import type { ClienteDetalle as Detalle } from "@/lib/data/queries";
import type { Barbero } from "@/lib/data/types";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn = "rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50";

const ESTADO: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", en_curso: "En curso",
  completada: "Completada", cancelada: "Cancelada", no_show: "No llegó",
};

type Tab = "info" | "historial" | "reservas" | "notas" | "wallet" | "fidelidad" | "resenas" | "calificaciones";
const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información" },
  { id: "historial", label: "Historial" },
  { id: "reservas", label: "Reservas" },
  { id: "notas", label: "Notas" },
  { id: "wallet", label: "Wallet" },
  { id: "fidelidad", label: "Fidelidad" },
  // Ojo con los nombres: "resenas" = el staff califica AL cliente; "calificaciones" = el cliente
  // opina de su visita. Las etiquetas visibles los distinguen; los keys internos no cambian.
  { id: "resenas", label: "Nota del staff" },
  { id: "calificaciones", label: "Su opinión" },
];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit" });
}

export type TarjetaClienteView = {
  cortesTotales: number;
  sellos: number;
  tarjetasCompletas: number;
  /** "regalo" o el porcentaje ("50%"), según lo que el dueño configuró (0064). */
  proximo: { tipo: string; faltan: number; posicion: number } | null;
  tamano: number;
};

export function ClienteDetalle({
  detalle,
  barberos,
  tarjeta,
}: {
  detalle: Detalle;
  barberos: Barbero[];
  tarjeta: TarjetaClienteView;
}) {
  // Arranca en "historial": la info del cliente ya está en el encabezado.
  const [tab, setTab] = useState<Tab>("historial");
  const d = detalle;

  // Pista de scroll: en celular las pestañas desbordan con el scrollbar oculto,
  // así que mostramos un degradado a la derecha mientras quede alguna fuera de vista.
  const tabsRef = useRef<HTMLDivElement>(null);
  const [hayMasTabs, setHayMasTabs] = useState(false);
  useEffect(() => {
    const el = tabsRef.current;
    if (!el) return;
    const medir = () => setHayMasTabs(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    medir();
    el.addEventListener("scroll", medir, { passive: true });
    window.addEventListener("resize", medir);
    return () => {
      el.removeEventListener("scroll", medir);
      window.removeEventListener("resize", medir);
    };
  }, []);

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-3xl font-semibold sm:text-4xl">{d.nombre}</h1>
          <p className="mt-1 text-sm text-muted">
            {d.telefono || "sin teléfono"}
            {d.email ? ` · ${d.email}` : ""} · cliente desde {fecha(d.creadoEn)}
          </p>
        </div>
        {d.ratingProm !== null && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Nota del staff</div>
            <div className="font-display text-2xl text-accent-soft">★ {d.ratingProm}</div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi size="sm" label="Facturado" value={cop(d.facturado)} />
        <Kpi size="sm" label="Visitas" value={String(d.visitas)} accent={false} />
        <Kpi size="sm" label="Saldo wallet" value={cop(d.walletBalance)} accent={d.walletBalance > 0} />
        <Kpi size="sm" label="Última visita" value={d.ultima ? fecha(d.ultima) : "—"} accent={false} />
      </div>

      <div className="relative mt-8">
        <div
          ref={tabsRef}
          role="tablist"
          aria-label="Secciones del cliente"
          className="flex gap-1 overflow-x-auto border-b border-line [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`relative min-h-11 shrink-0 whitespace-nowrap px-4 py-2.5 text-sm transition ${
                tab === t.id ? "text-ink" : "text-muted hover:text-ink"
              }`}
            >
              {t.label}
              {t.id === "notas" && d.notas.length ? ` (${d.notas.length})` : ""}
              {t.id === "resenas" && d.resenas.length ? ` (${d.resenas.length})` : ""}
              {t.id === "calificaciones" && d.calificaciones.length ? ` (${d.calificaciones.length})` : ""}
              {tab === t.id && (
                <motion.span
                  layoutId="cliente-tab-underline"
                  className="absolute inset-x-2 -bottom-px h-[2px] rounded-full bg-accent"
                  transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                />
              )}
            </button>
          ))}
        </div>
        {hayMasTabs && (
          <span
            aria-hidden
            className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-bg to-transparent"
          />
        )}
      </div>

      <div className="mt-6">
        {tab === "info" && <InfoTab d={d} />}
        {tab === "historial" && <HistorialTab d={d} />}
        {tab === "reservas" && <ReservasTab d={d} />}
        {tab === "notas" && <NotasTab d={d} />}
        {tab === "wallet" && <WalletTab d={d} />}
        {tab === "fidelidad" && <FidelidadTab d={d} tarjeta={tarjeta} />}
        {tab === "resenas" && <ResenasTab d={d} barberos={barberos} />}
        {tab === "calificaciones" && <CalificacionesTab d={d} />}
      </div>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-xl border border-line bg-panel px-4 py-6 text-center text-sm text-muted">{children}</p>;
}

function InfoTab({ d }: { d: Detalle }) {
  return (
    <div className="space-y-3 rounded-2xl border border-line bg-panel p-5 text-sm">
      <Row k="Nombre" v={d.nombre} />
      <Row k="Teléfono" v={d.telefono || "—"} />
      <Row k="Correo" v={d.email || "—"} />
      <Row k="Cliente desde" v={fecha(d.creadoEn)} />
      <NotaFicha clienteRef={d.id} nota={d.notasFicha} />
    </div>
  );
}

/** Nota FIJA de la ficha (clientes.notas): editable donde se lee. Distinta de la
 *  pestaña Notas (bitácora con fecha); acá va lo permanente (alergias, gustos). */
function NotaFicha({ clienteRef, nota }: { clienteRef: string; nota: string | null }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota ?? "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setErr(null);
    const res = await actualizarNotaFicha({ clienteRef, nota: texto });
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  if (!editando) {
    return (
      <div className="flex items-start justify-between gap-4">
        <span className="shrink-0 text-muted">Nota de ficha</span>
        <button
          type="button"
          onClick={() => {
            setTexto(nota ?? "");
            setErr(null);
            setEditando(true);
          }}
          className="min-w-0 text-right text-ink transition hover:text-accent-soft"
          title="Lo permanente del cliente (alergias, gustos); las notas con fecha van en la pestaña Notas"
        >
          {nota ? (
            <>
              {nota} <span aria-hidden className="text-[11px] text-muted">✎</span>
            </>
          ) : (
            <span className="text-accent-soft">+ Agregar (alergias, gustos…)</span>
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <span className="text-muted">Nota de ficha</span>
      <textarea value={texto} onChange={(e) => setTexto(e.target.value)} rows={2} maxLength={500} autoFocus className={fld} />
      <p className="text-[11px] text-muted">Lo permanente (alergias, gustos). Las notas del día a día van en la pestaña Notas.</p>
      {err && <p className="text-[11px] text-accent-soft">{err}</p>}
      <div className="flex gap-1.5">
        <button type="button" onClick={guardar} disabled={busy} className={btn}>
          {busy ? "Guardando…" : "Guardar"}
        </button>
        <button
          type="button"
          onClick={() => {
            setEditando(false);
            setErr(null);
          }}
          className="rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line/50 pb-2 last:border-0">
      <span className="text-muted">{k}</span>
      <span className="text-right text-ink">{v}</span>
    </div>
  );
}

function HistorialTab({ d }: { d: Detalle }) {
  if (!d.historial.length) return <Empty>Sin visitas registradas todavía.</Empty>;
  return (
    <div className="space-y-2">
      {d.historial.map((h) => (
        <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div className="min-w-0">
            <div>{h.items.join(", ") || "Servicio"}</div>
            <div className="text-xs text-muted">{fecha(h.fecha)} · {h.barbero || "—"} · {h.medio}</div>
          </div>
          <span className="shrink-0 text-accent-soft">{cop(h.total)}</span>
        </div>
      ))}
    </div>
  );
}

function ReservasTab({ d }: { d: Detalle }) {
  if (!d.reservas.length) return <Empty>Sin reservas registradas.</Empty>;
  return (
    <div className="space-y-2">
      {d.reservas.map((r) => (
        <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div className="min-w-0">
            <div>{r.servicio} · {r.barbero}</div>
            <div className="text-xs text-muted">{new Date(r.inicio).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          <span className="shrink-0 text-xs uppercase tracking-wide text-muted">{ESTADO[r.estado] ?? r.estado}</span>
        </div>
      ))}
    </div>
  );
}

function NotasTab({ d }: { d: Detalle }) {
  const router = useRouter();
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await agregarNotaCliente({ clienteRef: d.id, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      setOk(true);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-2 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Nota guardada ✓ — quedó abajo en la lista.</div>}
        <textarea
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Nota interna sobre el cliente (preferencias, alergias, etc.)"
          rows={2}
          className={fld}
        />
        <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Agregar nota"}</button>
      </form>
      {!d.notas.length ? (
        <Empty>Sin notas todavía.</Empty>
      ) : (
        <div className="space-y-2">
          {d.notas.map((n) => (
            <NotaFila key={n.id} clienteRef={d.id} id={n.id} nota={n.nota} fechaTxt={fecha(n.fecha)} />
          ))}
        </div>
      )}
    </div>
  );
}

function WalletTab({ d }: { d: Detalle }) {
  const router = useRouter();
  const [tipo, setTipo] = useState<"recarga" | "consumo">("recarga");
  const [monto, setMonto] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await agregarMovWallet({ clienteRef: d.id, tipo, monto: Number(monto) || 0, nota });
    setBusy(false);
    if (res.ok) {
      setOk(`${tipo === "recarga" ? "Recarga" : "Consumo"} de ${cop(Number(monto) || 0)} registrado ✓`);
      setMonto("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Saldo a favor</div>
        <div className="font-display text-3xl text-accent-soft">{cop(d.walletBalance)}</div>
        <p className="mt-1 text-xs text-muted">Registro manual. No es un cobro: refleja el saldo que el cliente dejó a favor.</p>

        <form onSubmit={add} className="mt-4 space-y-2">
          {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
          {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{ok}</div>}
          <div className="flex gap-2">
            {(["recarga", "consumo"] as const).map((t) => (
              <button
                type="button"
                key={t}
                onClick={() => setTipo(t)}
                className={`rounded-lg border px-3 py-1.5 text-xs transition ${tipo === t ? "border-accent bg-accent/10 text-ink" : "border-line text-muted"}`}
              >
                {t === "recarga" ? "Recarga (+)" : "Consumo (−)"}
              </button>
            ))}
          </div>
          <input type="number" value={monto} onChange={(e) => setMonto(e.target.value)} placeholder="Monto" className={fld} />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Nota (opcional)" className={fld} />
          <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Registrar movimiento"}</button>
        </form>
      </div>

      {!d.wallet.length ? (
        <Empty>Sin movimientos de wallet.</Empty>
      ) : (
        <div className="space-y-2">
          {d.wallet.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="capitalize">{w.tipo}</span>
                {w.nota ? <span className="text-muted"> · {w.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(w.fecha)}</div>
              </div>
              <span className={`shrink-0 ${w.tipo === "recarga" ? "text-ok" : "text-warn"}`}>
                {w.tipo === "recarga" ? "+" : "−"}{cop(w.monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FidelidadTab({ d, tarjeta }: { d: Detalle; tarjeta: TarjetaClienteView }) {
  const router = useRouter();
  const [puntos, setPuntos] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  async function canjear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(null);
    const res = await canjearPuntos({ clienteRef: d.id, puntos: Number(puntos) || 0, nota });
    setBusy(false);
    if (res.ok) {
      setOk(`Canje de ${Number(puntos) || 0} puntos registrado ✓`);
      setPuntos("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      {/* Tarjeta de cortes (solo lectura): sellos derivados de las ventas. */}
      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Tarjeta de cortes</div>
        <div className="mt-1 flex flex-wrap items-baseline gap-2">
          <span className="font-display text-3xl font-bold tabular-nums text-accent-soft">
            {tarjeta.sellos}/{tarjeta.tamano}
          </span>
          <span className="text-xs text-muted">
            · {tarjeta.tarjetasCompletas} completada{tarjeta.tarjetasCompletas === 1 ? "" : "s"}
            {tarjeta.proximo && (
              <>
                {" "}· próximo: {tarjeta.proximo.tipo === "regalo" ? "regalo" : tarjeta.proximo.tipo} en{" "}
                {tarjeta.proximo.faltan}
              </>
            )}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted">
          {/* La regla ya no se escribe acá: la pone el dueño en Marketing → Tarjeta,
              y repetirla a mano garantizaba que un día dijera algo distinto. */}
          {tarjeta.cortesTotales} corte{tarjeta.cortesTotales === 1 ? "" : "s"} en total. Los premios se
          aplican solos al cobrar.
        </p>
      </div>

      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Puntos de fidelidad</div>
        <div className="font-display text-3xl text-accent-soft">{d.puntosBalance} pts</div>
        <p className="mt-1 text-xs text-muted">Se ganan automáticamente al cobrar (1 punto por cada $1.000). Canjealos por el premio que defina el negocio.</p>

        <form onSubmit={canjear} className="mt-4 space-y-2">
          {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
          {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">{ok}</div>}
          <input type="number" value={puntos} onChange={(e) => setPuntos(e.target.value)} placeholder="Puntos a canjear" className={fld} />
          <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Premio / nota (ej. servicio gratis)" className={fld} />
          <button disabled={busy || d.puntosBalance <= 0} className={btn}>{busy ? "Guardando…" : "Canjear puntos"}</button>
        </form>
      </div>

      {!d.puntos.length ? (
        <Empty>Todavía no acumuló puntos.</Empty>
      ) : (
        <div className="space-y-2">
          {d.puntos.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="min-w-0">
                <span className="capitalize">{p.tipo}</span>
                {p.nota ? <span className="text-muted"> · {p.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(p.fecha)}</div>
              </div>
              <span className={`shrink-0 ${p.tipo === "ganado" ? "text-ok" : "text-muted"}`}>
                {p.tipo === "ganado" ? "+" : "−"}{p.puntos} pts
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Postventa: lo que EL CLIENTE opinó del servicio (pestaña "Su opinión", al revés
// de "Nota del staff", donde el staff califica al cliente). Solo lectura — se crea desde /cuenta.
function CalificacionesTab({ d }: { d: Detalle }) {
  if (!d.calificaciones.length) return <Empty>Este cliente todavía no calificó ninguna visita.</Empty>;
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted">Cómo calificó el cliente sus visitas (postventa, últimas 10).</p>
      {d.calificaciones.map((c) => (
        <div key={c.id} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-accent">{"★".repeat(c.score)}<span className="text-line">{"★".repeat(5 - c.score)}</span></span>
            <span className="text-xs text-muted">{fecha(c.fecha)}</span>
          </div>
          {c.comentario ? <div className="mt-1">{c.comentario}</div> : null}
          <div className="mt-1 text-xs text-muted">{c.barbero} · {c.sede}</div>
        </div>
      ))}
    </div>
  );
}

function ResenasTab({ d, barberos }: { d: Detalle; barberos: Barbero[] }) {
  const router = useRouter();
  const [score, setScore] = useState(5);
  const [barberoId, setBarberoId] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [ok, setOk] = useState(false);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setOk(false);
    const res = await agregarResenaCliente({ clienteRef: d.id, barberoId, score, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      setScore(5);
      setOk(true);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-3 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        {ok && <div className="rounded-lg border border-ok/40 bg-ok/10 px-3 py-2 text-sm text-ok">Reseña guardada ✓ — quedó abajo en la lista.</div>}
        <div className="text-xs uppercase tracking-wide text-muted">Calificar al cliente</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setScore(n)}
              aria-label={`${n} estrella${n === 1 ? "" : "s"}`}
              aria-pressed={score === n}
              className={`flex min-h-11 min-w-11 items-center justify-center p-1.5 text-2xl transition ${n <= score ? "text-accent" : "text-line"}`}
            >
              ★
            </button>
          ))}
        </div>
        <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
          <option value="">Barbero que atendió (opcional)…</option>
          {barberos.map((b) => (
            <option key={b.id} value={b.id}>{b.nombre}</option>
          ))}
        </select>
        <input value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Comentario (puntualidad, trato…)" className={fld} />
        <button disabled={busy} className={btn}>{busy ? "Guardando…" : "Guardar reseña"}</button>
      </form>

      {!d.resenas.length ? (
        <Empty>Sin reseñas todavía.</Empty>
      ) : (
        <div className="space-y-2">
          {d.resenas.map((r) => (
            <div key={r.id} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-accent">{"★".repeat(r.score)}<span className="text-line">{"★".repeat(5 - r.score)}</span></span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-muted">{fecha(r.fecha)}</span>
                  <BorrarChico
                    label="reseña"
                    onBorrar={() => borrarResenaCliente({ id: r.id, clienteRef: d.id })}
                  />
                </span>
              </div>
              {r.nota ? <div className="mt-1">{r.nota}</div> : null}
              {r.barbero ? <div className="mt-1 text-xs text-muted">por {r.barbero}</div> : null}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** Borrar con confirmación de dos toques (patrón "Quitar foto"): el primero
 *  pregunta en warn, el segundo ejecuta. Al perder el foco se desarma. */
function BorrarChico({ label, onBorrar }: { label: string; onBorrar: () => Promise<{ ok: boolean; error?: string }> }) {
  const router = useRouter();
  const [confirmando, setConfirmando] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function click() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setBusy(true);
    setErr(null);
    const res = await onBorrar();
    setBusy(false);
    setConfirmando(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo borrar.");
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      {err && <span className="text-[10px] text-accent-soft">{err}</span>}
      <button
        type="button"
        onClick={click}
        onBlur={() => setConfirmando(false)}
        disabled={busy}
        className={`min-h-8 rounded-full border px-2.5 text-[10.5px] font-semibold transition disabled:opacity-50 ${
          confirmando ? "border-warn/50 text-warn" : "border-line text-muted hover:text-ink"
        }`}
      >
        {busy ? "Borrando…" : confirmando ? "¿Seguro? Toca de nuevo" : `Borrar ${label}`}
      </button>
    </span>
  );
}

/** Fila de nota interna con editar inline + borrar: un tipeo mal ya no queda
 *  para siempre en la ficha. */
function NotaFila({ clienteRef, id, nota, fechaTxt }: { clienteRef: string; id: string; nota: string; fechaTxt: string }) {
  const router = useRouter();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function guardar() {
    setBusy(true);
    setErr(null);
    const res = await editarNotaCliente({ id, clienteRef, nota: texto });
    setBusy(false);
    if (res.ok) {
      setEditando(false);
      router.refresh();
    } else setErr(res.error ?? "No se pudo guardar.");
  }

  return (
    <div className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
      {editando ? (
        <div className="space-y-2">
          <textarea
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            rows={2}
            autoFocus
            className={fld}
          />
          {err && <p className="text-[11px] text-accent-soft">{err}</p>}
          <div className="flex gap-1.5">
            <button type="button" onClick={guardar} disabled={busy} className={btn}>
              {busy ? "Guardando…" : "Guardar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditando(false);
                setTexto(nota);
                setErr(null);
              }}
              className="rounded-full border border-line px-4 py-2 text-xs text-muted transition hover:text-ink"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : (
        <>
          <div>{nota}</div>
          <div className="mt-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{fechaTxt}</span>
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="min-h-8 rounded-full border border-line px-2.5 text-[10.5px] font-semibold text-muted transition hover:text-ink"
              >
                Editar ✎
              </button>
              <BorrarChico label="nota" onBorrar={() => borrarNotaCliente({ id, clienteRef })} />
            </span>
          </div>
        </>
      )}
    </div>
  );
}
