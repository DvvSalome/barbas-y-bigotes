"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { agregarListaEspera, actualizarListaEspera, servirEspera } from "@/lib/actions";
import type { Sede, Barbero, Servicio } from "@/lib/data/types";
import type { EsperaItem } from "@/lib/data/queries";

const fld =
  "w-full min-h-11 rounded-lg border border-line bg-bg px-3 py-2 text-ink focus:border-accent focus:outline-none";

// La lista de espera se toca de pie, con el cliente enfrente y en el aparato
// compartido del mostrador: 44px de alto mínimo (antes eran ~28px, del tamaño
// de una etiqueta) y sin apretujar los botones entre sí.
const btnEspera =
  "inline-flex min-h-11 items-center justify-center rounded-full px-4 text-[13px] font-semibold transition disabled:opacity-50";

function desde(iso: string) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  if (mins < 60) return `hace ${mins} min`;
  const h = Math.floor(mins / 60);
  return `hace ${h} h ${mins % 60} min`;
}

export function EsperaPanel({
  espera,
  sedes,
  barberos,
  servicios,
}: {
  espera: EsperaItem[];
  sedes: Sede[];
  barberos: Barbero[];
  servicios: Servicio[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function setEstado(id: string, estado: string) {
    setBusy(true);
    await actualizarListaEspera(id, estado);
    setBusy(false);
    router.refresh();
  }

  async function atender(id: string) {
    setBusy(true);
    const res = await servirEspera(id);
    setBusy(false);
    if (!res.ok) {
      alert(res.error);
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-2xl uppercase">Lista de espera</h2>
          <p className="text-sm text-muted">Si alguien no llega o cancela, avisás al siguiente.</p>
        </div>
        {!open && (
          <button
            onClick={() => setOpen(true)}
            className={`shrink-0 ${btnEspera} border border-line hover:border-accent/50`}
          >
            + Agregar
          </button>
        )}
      </div>

      {open && (
        <EsperaForm
          sedes={sedes}
          barberos={barberos}
          servicios={servicios}
          onDone={() => {
            setOpen(false);
            router.refresh();
          }}
          onCancel={() => setOpen(false)}
        />
      )}

      {espera.length === 0 ? (
        <p className="text-sm text-muted">Nadie en espera ahora mismo.</p>
      ) : (
        <div className="space-y-2">
          {espera.map((e, i) => (
            <div
              key={e.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-panel p-3"
            >
              <div className="flex items-center gap-3">
                <span className="font-display text-xl text-accent-soft">{i + 1}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{e.cliente || "Sin nombre"}</span>
                    {e.estado === "notificado" && (
                      <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] uppercase tracking-wide text-accent-soft">
                        Avisado
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-muted">
                    {e.barbero} · {e.servicio}
                    {e.telefono ? ` · ${e.telefono}` : ""} · {desde(e.creadoEn)}
                  </div>
                </div>
              </div>
              <div className="flex flex-wrap gap-2.5">
                {e.estado !== "notificado" && (
                  <button
                    onClick={() => setEstado(e.id, "notificado")}
                    disabled={busy}
                    className={`${btnEspera} border border-line hover:border-accent/50`}
                  >
                    Avisar
                  </button>
                )}
                <button
                  onClick={() => atender(e.id)}
                  disabled={busy}
                  className={`${btnEspera} bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] uppercase text-on-accent shadow-[0_8px_20px_-10px_rgba(210,63,52,0.7)] hover:brightness-105`}
                >
                  Atender ahora
                </button>
                <button
                  onClick={() => setEstado(e.id, "cancelado")}
                  disabled={busy}
                  className={`${btnEspera} border border-line text-muted hover:text-ink`}
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EsperaForm({
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
  const [servicioId, setServicioId] = useState("");
  const [nombre, setNombre] = useState("");
  const [tel, setTel] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const sedeBarberos = barberos.filter((b) => b.sede === sede);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) {
      setErr("Poné el nombre del cliente");
      return;
    }
    setSaving(true);
    setErr(null);
    const res = await agregarListaEspera({
      sede,
      barberoId,
      servicioId,
      clienteNombre: nombre,
      telefono: tel,
    });
    setSaving(false);
    if (res.ok) onDone();
    else setErr(res.error ?? "No se pudo agregar");
  }

  return (
    <form onSubmit={submit} className="mb-6 grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-2">
      {err && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-2">
          {err}
        </div>
      )}
      <select
        value={sede}
        onChange={(e) => {
          setSede(e.target.value as typeof sede);
          setBarberoId("");
        }}
        className={fld}
      >
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
      <select value={barberoId} onChange={(e) => setBarberoId(e.target.value)} className={fld}>
        <option value="">Cualquier barbero</option>
        {sedeBarberos.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nombre}
          </option>
        ))}
      </select>
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del cliente"
        className={fld}
      />
      <input
        value={tel}
        onChange={(e) => setTel(e.target.value)}
        placeholder="Teléfono"
        inputMode="tel"
        className={fld}
      />
      <select
        value={servicioId}
        onChange={(e) => setServicioId(e.target.value)}
        className={`${fld} sm:col-span-2`}
      >
        <option value="">Servicio (opcional)…</option>
        {servicios.map((s) => (
          <option key={s.id} value={s.id}>
            {s.nombre}
          </option>
        ))}
      </select>
      <div className="flex gap-2 sm:col-span-2">
        <button
          disabled={saving}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-6 text-sm font-semibold uppercase tracking-wide text-on-accent shadow-[0_10px_24px_-10px_rgba(210,63,52,0.7)] transition hover:brightness-105 disabled:opacity-50"
        >
          {saving ? "Agregando…" : "Agregar a la espera"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line px-6 text-sm text-muted transition hover:text-ink"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
