"use client";

import { botonClases } from "@/components/ui/Boton";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { crearMedioPago, toggleMedioPago } from "@/lib/actions";
import { CashIcon } from "@/components/icons";
import type { MedioPago } from "@/lib/data/queries";

const fld =
  "w-full rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

// Card de administración de medios de pago (contexto de caja, /admin/cuadre).
// Sin borrar: el histórico de ventas referencia el slug; solo activar/desactivar.
export function MediosPago({ medios }: { medios: MedioPago[] }) {
  const router = useRouter();
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Slug del medio esperando confirmación para desactivarse. Desactivar apaga
  // el botón en el mostrador al instante, así que nunca va en un solo toque.
  const [confirmando, setConfirmando] = useState<string | null>(null);

  async function agregar(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    const res = await crearMedioPago(nombre);
    setBusy(false);
    if (res.ok) {
      setNombre("");
      router.refresh();
    } else setErr(res.error ?? "No se pudo agregar");
  }

  async function toggle(slug: string, activo: boolean) {
    setBusy(true);
    setErr(null);
    const res = await toggleMedioPago(slug, activo);
    setBusy(false);
    setConfirmando(null);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo actualizar");
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-5">
      <h3 className="flex items-center gap-2 font-display text-xl">
        <CashIcon className="h-4 w-4 text-accent" /> Medios de pago
      </h3>
      <p className="mt-1 text-xs text-muted">
        Los botones del cobro salen de esta lista. Desactiva un medio para que no se pueda
        cobrar más con él; el histórico no se toca.
      </p>

      <div className="mt-4 space-y-2">
        {medios.length === 0 ? (
          <p className="text-sm text-muted">Sin medios de pago cargados (¿aplicaste la migración 0016?).</p>
        ) : (
          medios.map((m) => (
            <div key={m.slug} className="rounded-xl border border-line bg-bg px-4 py-2.5 text-sm">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className={m.activo ? "" : "text-muted line-through"}>{m.nombre}</span>
                  <span className="ml-2 text-[12px] uppercase tracking-wide text-muted">{m.slug}</span>
                </div>
                {/* Botón con la consecuencia escrita, no un badge de estado.
                    Activar es directo; desactivar pide confirmar abajo. */}
                {confirmando !== m.slug && (
                  <button
                    type="button"
                    onClick={() => (m.activo ? setConfirmando(m.slug) : toggle(m.slug, true))}
                    disabled={busy}
                    className={`min-h-11 shrink-0 rounded-full border px-4 text-xs font-semibold transition disabled:opacity-50 ${
                      m.activo ? "border-ok/40 bg-ok/10 text-ok" : "border-line bg-ink/10 text-muted"
                    }`}
                  >
                    {m.activo ? "Se puede cobrar" : "No se cobra"}
                  </button>
                )}
              </div>

              {confirmando === m.slug && (
                <div className="mt-2 rounded-lg border border-warn/40 bg-warn/10 px-3 py-2.5">
                  <p className="text-[13px]">
                    ¿Desactivar <b>{m.nombre}</b>? El mostrador no podrá cobrar con este medio.
                  </p>
                  <div className="mt-2 flex gap-2">
                    <button
                      type="button"
                      onClick={() => toggle(m.slug, false)}
                      disabled={busy}
                      className="min-h-11 flex-1 rounded-full bg-warn/15 px-4 text-xs font-semibold uppercase tracking-wide text-warn transition disabled:opacity-50"
                    >
                      {busy ? "Guardando…" : "Desactivar"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmando(null)}
                      disabled={busy}
                      className="min-h-11 flex-1 rounded-full border border-line px-4 text-xs font-semibold uppercase tracking-wide text-ink transition disabled:opacity-50"
                    >
                      Dejarlo
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {err && (
        <div className="mt-3 rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft">{err}</div>
      )}

      <form onSubmit={agregar} className="mt-4 flex gap-2">
        <input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          placeholder="Nuevo medio (ej. Bancolombia QR)"
          className={fld}
        />
        <button
          disabled={busy}
          className={botonClases("primario")}
        >
          {busy ? "Guardando…" : "Agregar"}
        </button>
      </form>
    </div>
  );
}
