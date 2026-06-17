"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createAtencion } from "@/lib/actions";
import { cop } from "@/lib/format";
import type { Sede, SedeId, Barbero, Servicio, Producto } from "@/lib/data/types";

const LLEGADAS = [
  { v: "a_tiempo", l: "A tiempo" },
  { v: "tarde", l: "Tarde" },
  { v: "no_show", l: "No llegó" },
];

const fld = "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-accent focus:outline-none";

export function BarberRegister({
  sedes,
  barberos,
  servicios,
  productos,
}: {
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
  productos: Producto[];
}) {
  const router = useRouter();
  const [sede, setSede] = useState<SedeId>((sedes[0]?.id as SedeId) ?? "parque-venezuela");
  const [barberoId, setBarberoId] = useState("");
  const [cliente, setCliente] = useState("");
  const [llegada, setLlegada] = useState("a_tiempo");
  const [medio, setMedio] = useState("efectivo");
  const [servSel, setServSel] = useState<Set<string>>(new Set());
  const [prodQty, setProdQty] = useState<Record<string, number>>({});
  const [saving, setSaving] = useState(false);
  const [okMsg, setOkMsg] = useState("");

  const sedeBarberos = useMemo(() => barberos.filter((b) => b.sede === sede), [barberos, sede]);
  const sedeProductos = useMemo(() => productos.filter((p) => p.sede === sede), [productos, sede]);

  const total = useMemo(() => {
    let t = 0;
    for (const s of servicios) if (servSel.has(s.id)) t += s.precios[sede] ?? 0;
    for (const [id, q] of Object.entries(prodQty)) {
      const p = productos.find((x) => x.id === id);
      if (p) t += p.precio * q;
    }
    return t;
  }, [servSel, prodQty, sede, servicios, productos]);

  function toggleServ(id: string) {
    setServSel((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }
  function setQty(id: string, q: number) {
    setProdQty((prev) => {
      const n = { ...prev };
      if (q <= 0) delete n[id];
      else n[id] = q;
      return n;
    });
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!barberoId) {
      alert("Elegí el barbero");
      return;
    }
    setSaving(true);
    setOkMsg("");
    const res = await createAtencion({
      sede,
      barberoId,
      clienteNombre: cliente,
      llegada,
      medio,
      servicioIds: [...servSel],
      productos: Object.entries(prodQty).map(([id, cantidad]) => ({ id, cantidad })),
    });
    setSaving(false);
    if (res.ok) {
      setOkMsg(`✓ Atención registrada — ${cop(res.total ?? 0)}`);
      setCliente("");
      setServSel(new Set());
      setProdQty({});
      setLlegada("a_tiempo");
      router.refresh();
    } else {
      alert(res.error);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-6 lg:grid-cols-2">
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="Sede">
            <select
              value={sede}
              onChange={(e) => {
                setSede(e.target.value as SedeId);
                setBarberoId("");
                setProdQty({});
              }}
              className={fld}
            >
              {sedes.map((s) => (
                <option key={s.id} value={s.id}>{s.nombre}</option>
              ))}
            </select>
          </Field>
          <Field label="Barbero">
            <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
              <option value="">Elegí…</option>
              {sedeBarberos.map((b) => (
                <option key={b.id} value={b.id}>{b.nombre}</option>
              ))}
            </select>
          </Field>
        </div>

        <Field label="Cliente">
          <input value={cliente} onChange={(e) => setCliente(e.target.value)} placeholder="Nombre del cliente (o dejar vacío = walk-in)" className={fld} />
        </Field>

        <Field label="Llegada">
          <div className="flex gap-2">
            {LLEGADAS.map((x) => (
              <button
                type="button"
                key={x.v}
                onClick={() => setLlegada(x.v)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${llegada === x.v ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {x.l}
              </button>
            ))}
          </div>
        </Field>

        <Field label="Productos / consumos">
          {sedeProductos.length === 0 ? (
            <p className="text-sm text-muted">Sin productos en esta sede.</p>
          ) : (
            <div className="space-y-2">
              {sedeProductos.map((p) => {
                const q = prodQty[p.id] ?? 0;
                return (
                  <div key={p.id} className="flex items-center justify-between rounded-lg border border-line px-3 py-2">
                    <span className="text-sm">
                      {p.nombre} <span className="text-muted">· {cop(p.precio)}</span>
                    </span>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={() => setQty(p.id, q - 1)} className="h-7 w-7 rounded-full border border-line text-ink">–</button>
                      <span className="w-5 text-center text-sm">{q}</span>
                      <button type="button" onClick={() => setQty(p.id, q + 1)} className="h-7 w-7 rounded-full border border-line text-ink">+</button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Field>
      </div>

      <div className="space-y-4">
        <Field label="Servicios">
          <div className="max-h-72 space-y-1 overflow-y-auto rounded-xl border border-line p-2">
            {servicios.map((s) => (
              <label
                key={s.id}
                className={`flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 text-sm transition ${servSel.has(s.id) ? "bg-accent/10" : "hover:bg-white/[0.03]"}`}
              >
                <span className="flex items-center gap-2 pr-2">
                  <input type="checkbox" checked={servSel.has(s.id)} onChange={() => toggleServ(s.id)} className="accent-[#d23f34]" />
                  {s.nombre}
                </span>
                <span className="shrink-0 text-muted">{cop(s.precios[sede] ?? 0)}</span>
              </label>
            ))}
          </div>
        </Field>

        <Field label="Medio de pago">
          <div className="flex gap-2">
            {["efectivo", "datafono"].map((m) => (
              <button
                type="button"
                key={m}
                onClick={() => setMedio(m)}
                className={`flex-1 rounded-lg border px-3 py-2 text-sm transition ${medio === m ? "border-accent bg-accent/10 text-ink" : "border-line text-muted hover:text-ink"}`}
              >
                {m === "datafono" ? "Datáfono" : "Efectivo"}
              </button>
            ))}
          </div>
        </Field>

        <div className="flex items-center justify-between rounded-xl border border-line bg-panel p-4">
          <span className="text-muted">Total</span>
          <span className="font-display text-3xl text-accent-soft">{cop(total)}</span>
        </div>

        <button
          disabled={saving}
          className="w-full rounded-full bg-accent py-3.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
        >
          {saving ? "Registrando…" : "Registrar atención"}
        </button>
        {okMsg && <p className="text-center text-sm text-accent-soft">{okMsg}</p>}
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-1.5 text-[10px] uppercase tracking-[0.18em] text-muted">{label}</div>
      {children}
    </div>
  );
}
