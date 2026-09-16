"use client";

import { botonClases } from "@/components/ui/Boton";
import { chipFiltroClases } from "@/components/ui/Chip";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { completarReserva } from "@/lib/actions";
import { recargarSiDeployViejo } from "@/lib/skew";
import { sanearCop } from "@/lib/admin-reglas";
import { cop } from "@/lib/format";
import type { PendienteCobro } from "@/lib/data/queries";

// "Pendientes por cobrar" con el cobro AHÍ MISMO: se toca la cita, se elige el
// medio (y la propina si dejó) y listo — sin irse a otra pantalla. Es el cobro
// exprés para cuando el barbero estaba ocupado y no lo registró al momento; el
// cobro completo (cambiar servicio, precio, extras, cupón) sigue en Turnos.
// Lo usan el cuadre del admin y el cierre del mostrador (mismo componente).

function horaCorta(iso: string) {
  const [h, m] = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Bogota",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  })
    .format(new Date(iso))
    .split(":")
    .map(Number);
  return `${((h + 11) % 12) + 1}:${m.toString().padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function PendientesCobrar({
  pendientes,
  medios,
  dentroDeHoja = false,
}: {
  pendientes: PendienteCobro[];
  medios: { slug: string; nombre: string }[];
  /** La Hoja del hub de Cierre ya pone titulo y cuenta: aca no se repiten. */
  dentroDeHoja?: boolean;
}) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [medio, setMedio] = useState(medios[0]?.slug ?? "efectivo");
  const [propina, setPropina] = useState("");
  const [propinaMedio, setPropinaMedio] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cobradas, setCobradas] = useState<Set<string>>(new Set());

  const total = pendientes.filter((p) => !cobradas.has(p.id)).reduce((a, p) => a + p.monto, 0);
  const visibles = pendientes.filter((p) => !cobradas.has(p.id));
  if (visibles.length === 0) return null;

  function abrir(id: string) {
    setAbierta(abierta === id ? null : id);
    setMedio(medios[0]?.slug ?? "efectivo");
    setPropina("");
    setPropinaMedio(null);
    setError(null);
  }

  async function cobrar(p: PendienteCobro) {
    const prop = propina.trim() ? sanearCop(propina) : 0;
    if (prop === null || (prop ?? 0) < 0) {
      setError("La propina tiene que ser un número entero de pesos (o vacía).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await completarReserva({
      reservaId: p.id,
      sede: p.sede,
      barberoId: null,
      clienteRef: null,
      servicioId: null,
      medio,
      productos: [],
      propina: prop ?? 0,
      propinaMedio: (prop ?? 0) > 0 ? (propinaMedio ?? medio) : undefined,
    }).catch(() => null);
    setSaving(false);
    if (!res) {
      // La action REVENTÓ (pestaña con el bundle viejo tras un deploy): recargar.
      if (!recargarSiDeployViejo()) setError("No se pudo cobrar. Revisa la conexión y vuelve a intentar.");
      return;
    }
    if (!res.ok) {
      setError(res.error ?? "No se pudo cobrar.");
      return;
    }
    setCobradas((s) => new Set(s).add(p.id));
    setAbierta(null);
    router.refresh();
  }

  return (
    <div className={dentroDeHoja ? "" : "rounded-2xl border border-line bg-panel p-5"}>
      {!dentroDeHoja && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 font-display text-2xl">
            <span className="h-2 w-2 rounded-full bg-warn" /> Pendientes por cobrar
          </h2>
          <span className="text-sm text-muted">
            {visibles.length} {visibles.length === 1 ? "reserva" : "reservas"} ·{" "}
            <b className="text-accent-soft">{cop(total)}</b> proyectado
          </span>
        </div>
      )}
      <p className={`text-xs text-muted ${dentroDeHoja ? "" : "mt-1"}`}>
        Citas de hoy aún sin registrar en caja. Toca una para cobrarla acá mismo; si hay que cambiar servicio, precio
        o agregar productos, se cobra desde Turnos en la app del barbero.
      </p>
      <div className="mt-4 space-y-2">
        {visibles.map((p) => {
          const abiertaEsta = abierta === p.id;
          return (
            <div
              key={p.id}
              className={`rounded-xl border bg-bg text-sm transition ${
                abiertaEsta ? "border-accent/50" : "border-line hover:border-accent/30"
              }`}
            >
              <button
                type="button"
                onClick={() => abrir(p.id)}
                className="flex min-h-11 w-full flex-wrap items-center justify-between gap-2 px-4 py-2.5 text-left"
              >
                <span className="min-w-0">
                  <span className="font-semibold">{p.cliente}</span>
                  <span className="text-muted">
                    {" "}
                    · {p.servicio} · {p.barbero}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-3">
                  <span className="text-xs text-muted">{horaCorta(p.inicio)}</span>
                  <span className="text-accent-soft">{cop(p.monto)}</span>
                  {/* accent-soft y no accent: el rojo puro a 12 px da 4,21:1 y
                      AA pide 4,5. Es la misma variante que ya usa el monto de
                      al lado. Se veía solo con cobros pendientes, por eso la
                      medición base —hecha con la lista vacía— no lo marcaba. */}
                  <span className="text-xs font-bold uppercase tracking-wide text-accent-soft">
                    {abiertaEsta ? "Cerrar" : "Cobrar"}
                  </span>
                </span>
              </button>

              {abiertaEsta && (
                <div className="space-y-3 border-t border-line/60 px-4 py-3">
                  <div>
                    <p className="mb-1.5 text-[12px] font-bold uppercase tracking-wide text-muted">Pagó con</p>
                    <div className="flex flex-wrap gap-1.5">
                      {medios.map((m) => (
                        <button key={m.slug} type="button" onClick={() => setMedio(m.slug)} className={chipFiltroClases(medio === m.slug)}>
                          {m.nombre}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-end gap-2">
                    <label className="text-[12px] font-bold uppercase tracking-wide text-muted">
                      Propina (opcional)
                      <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        step={500}
                        value={propina}
                        onChange={(e) => setPropina(e.target.value)}
                        placeholder="$0"
                        className="mt-1 block w-32 rounded-xl border border-line bg-elevated px-3 py-2 text-sm text-ink tabular-nums placeholder:text-muted focus:border-accent focus:outline-none"
                      />
                    </label>
                    {propina.trim() !== "" && Number(propina) > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {medios.map((m) => (
                          <button
                            key={m.slug}
                            type="button"
                            onClick={() => setPropinaMedio(m.slug)}
                            className={chipFiltroClases((propinaMedio ?? medio) === m.slug)}
                          >
                            propina {m.nombre}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {error && <p className="text-[12px] font-semibold text-warn">{error}</p>}
                  <button
                    type="button"
                    onClick={() => cobrar(p)}
                    disabled={saving}
                    className={botonClases("primario", "md", "w-full")}
                  >
                    {saving ? "Cobrando…" : `Cobrar ${cop(p.monto)}`}
                  </button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
