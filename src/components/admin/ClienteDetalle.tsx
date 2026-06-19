"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cop } from "@/lib/format";
import { agregarNotaCliente, agregarMovWallet, agregarResenaCliente, canjearPuntos } from "@/lib/actions";
import type { ClienteDetalle as Detalle } from "@/lib/data/queries";
import type { Barbero } from "@/lib/data/types";

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const btn = "rounded-full bg-accent px-5 py-2 text-xs font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50";

const ESTADO: Record<string, string> = {
  pendiente: "Pendiente", confirmada: "Confirmada", en_curso: "En curso",
  completada: "Completada", cancelada: "Cancelada", no_show: "No llegó",
};

type Tab = "info" | "historial" | "reservas" | "notas" | "wallet" | "fidelidad" | "resenas";
const TABS: { id: Tab; label: string }[] = [
  { id: "info", label: "Información" },
  { id: "historial", label: "Historial" },
  { id: "reservas", label: "Reservas" },
  { id: "notas", label: "Notas" },
  { id: "wallet", label: "Wallet" },
  { id: "fidelidad", label: "Fidelidad" },
  { id: "resenas", label: "Reseñas" },
];

function fecha(iso: string) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "2-digit" });
}

export function ClienteDetalle({ detalle, barberos }: { detalle: Detalle; barberos: Barbero[] }) {
  const [tab, setTab] = useState<Tab>("info");
  const d = detalle;

  return (
    <div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-4xl font-semibold">{d.nombre}</h1>
          <p className="mt-1 text-sm text-muted">
            {d.telefono || "sin teléfono"}
            {d.email ? ` · ${d.email}` : ""} · cliente desde {fecha(d.creadoEn)}
          </p>
        </div>
        {d.ratingProm !== null && (
          <div className="text-right">
            <div className="text-xs uppercase tracking-wide text-muted">Calificación</div>
            <div className="font-display text-2xl text-accent-soft">★ {d.ratingProm}</div>
          </div>
        )}
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Facturado" value={cop(d.facturado)} />
        <Kpi label="Visitas" value={String(d.visitas)} />
        <Kpi label="Saldo wallet" value={cop(d.walletBalance)} accent={d.walletBalance > 0} />
        <Kpi label="Última visita" value={d.ultima ? fecha(d.ultima) : "—"} />
      </div>

      <div className="mt-8 flex flex-wrap gap-1 border-b border-line">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`rounded-t-lg px-4 py-2 text-sm transition ${
              tab === t.id ? "border-b-2 border-accent text-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.label}
            {t.id === "notas" && d.notas.length ? ` (${d.notas.length})` : ""}
            {t.id === "resenas" && d.resenas.length ? ` (${d.resenas.length})` : ""}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "info" && <InfoTab d={d} />}
        {tab === "historial" && <HistorialTab d={d} />}
        {tab === "reservas" && <ReservasTab d={d} />}
        {tab === "notas" && <NotasTab d={d} />}
        {tab === "wallet" && <WalletTab d={d} />}
        {tab === "fidelidad" && <FidelidadTab d={d} />}
        {tab === "resenas" && <ResenasTab d={d} barberos={barberos} />}
      </div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
      <div className={`mt-1 font-display text-2xl ${accent ? "text-accent-soft" : ""}`}>{value}</div>
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
      {d.notasFicha ? <Row k="Nota de ficha" v={d.notasFicha} /> : null}
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
        <div key={h.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div>
            <div>{h.items.join(", ") || "Servicio"}</div>
            <div className="text-xs text-muted">{fecha(h.fecha)} · {h.barbero || "—"} · {h.medio}</div>
          </div>
          <span className="text-accent-soft">{cop(h.total)}</span>
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
        <div key={r.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm">
          <div>
            <div>{r.servicio} · {r.barbero}</div>
            <div className="text-xs text-muted">{new Date(r.inicio).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}</div>
          </div>
          <span className="text-xs uppercase tracking-wide text-muted">{ESTADO[r.estado] ?? r.estado}</span>
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await agregarNotaCliente({ clienteRef: d.id, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-2 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
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
            <div key={n.id} className="rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div>{n.nota}</div>
              <div className="mt-1 text-xs text-muted">{fecha(n.fecha)}</div>
            </div>
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await agregarMovWallet({ clienteRef: d.id, tipo, monto: Number(monto) || 0, nota });
    setBusy(false);
    if (res.ok) {
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
            <div key={w.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div>
                <span className="capitalize">{w.tipo}</span>
                {w.nota ? <span className="text-muted"> · {w.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(w.fecha)}</div>
              </div>
              <span className={w.tipo === "recarga" ? "text-emerald-400" : "text-muted"}>
                {w.tipo === "recarga" ? "+" : "−"}{cop(w.monto)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FidelidadTab({ d }: { d: Detalle }) {
  const router = useRouter();
  const [puntos, setPuntos] = useState("");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function canjear(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await canjearPuntos({ clienteRef: d.id, puntos: Number(puntos) || 0, nota });
    setBusy(false);
    if (res.ok) {
      setPuntos("");
      setNota("");
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <div className="mb-5 rounded-2xl border border-line bg-panel p-5">
        <div className="text-xs uppercase tracking-wide text-muted">Puntos de fidelidad</div>
        <div className="font-display text-3xl text-accent-soft">{d.puntosBalance} pts</div>
        <p className="mt-1 text-xs text-muted">Se ganan automáticamente al cobrar (1 punto por cada $1.000). Canjealos por el premio que defina el negocio.</p>

        <form onSubmit={canjear} className="mt-4 space-y-2">
          {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
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
            <div key={p.id} className="flex items-center justify-between rounded-xl border border-line bg-panel px-4 py-3 text-sm">
              <div>
                <span className="capitalize">{p.tipo}</span>
                {p.nota ? <span className="text-muted"> · {p.nota}</span> : null}
                <div className="text-xs text-muted">{fecha(p.fecha)}</div>
              </div>
              <span className={p.tipo === "ganado" ? "text-emerald-400" : "text-muted"}>
                {p.tipo === "ganado" ? "+" : "−"}{p.puntos} pts
              </span>
            </div>
          ))}
        </div>
      )}
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

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await agregarResenaCliente({ clienteRef: d.id, barberoId, score, nota });
    setBusy(false);
    if (res.ok) {
      setNota("");
      setScore(5);
      router.refresh();
    } else setErr(res.error ?? "Error");
  }

  return (
    <div>
      <form onSubmit={add} className="mb-5 space-y-3 rounded-2xl border border-line bg-panel p-4">
        {err && <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>}
        <div className="text-xs uppercase tracking-wide text-muted">Calificar al cliente</div>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              type="button"
              key={n}
              onClick={() => setScore(n)}
              className={`text-2xl transition ${n <= score ? "text-accent" : "text-line"}`}
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
                <span className="text-xs text-muted">{fecha(r.fecha)}</span>
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
