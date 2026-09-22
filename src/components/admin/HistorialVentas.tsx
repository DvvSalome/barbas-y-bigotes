"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { anularVenta } from "@/lib/actions";
import { botonClases } from "@/components/ui/Boton";
import { cop, horaBogota } from "@/lib/format";
import type { VentaDelDia } from "@/lib/data/queries";

/*
  El historial de lo vendido hoy, con poder anular (0076).

  Lo pidió el administrador: "estaba metiendo ejemplo lo que iba hoy, y me
  equivoqué en dos, necesito borrarlos y no me deja borrarlo; debería haber como
  un historial de lo vendido para poder eliminar o modificar en su caso".

  Tres decisiones:

  1. ANULAR, NO BORRAR. La venta se queda en la lista, tachada y con el motivo.
     Si desapareciera, el efectivo esperado de la caja bajaría y nadie sabría por
     qué — y eso es peor que el problema original.

  2. EL MOTIVO ES OBLIGATORIO y se escribe ANTES de anular. No es burocracia: en
     dos semanas, cuando alguien mire por qué la caja del lunes tiene $40.000
     menos, esa línea es toda la respuesta que va a haber.

  3. NO HAY "MODIFICAR". Él pidió "eliminar o modificar en su caso", y editar una
     venta ya cerrada significa recalcular comisión, puntos, stock y cupón sobre
     algo que ya se contabilizó. Anular y volver a cobrar hace exactamente lo
     mismo, deja rastro de las dos cosas y no puede quedar a medias.
*/
export function HistorialVentas({ ventas }: { ventas: VentaDelDia[] }) {
  const router = useRouter();
  const [abierta, setAbierta] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [anulando, setAnulando] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const vivas = ventas.filter((v) => !v.anuladaEn);
  const total = vivas.reduce((a, v) => a + v.total, 0);

  async function anular(id: string) {
    setAnulando(true);
    setErr(null);
    const res = await anularVenta({ ventaId: id, motivo }).catch(() => null);
    setAnulando(false);
    if (!res || !res.ok) {
      setErr(res && !res.ok ? res.error ?? "No se pudo anular." : "No se pudo anular.");
      return;
    }
    setAbierta(null);
    setMotivo("");
    router.refresh();
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line/60 px-4 py-3">
        <span className="font-display text-[12px] font-bold uppercase tracking-[0.16em] text-muted">
          Lo vendido hoy
        </span>
        <span className="text-[12.5px] text-muted">
          {vivas.length} {vivas.length === 1 ? "venta" : "ventas"} ·{" "}
          <b className="tabular-nums text-ink">{cop(total)}</b>
          {ventas.length > vivas.length && ` · ${ventas.length - vivas.length} anulada${ventas.length - vivas.length === 1 ? "" : "s"}`}
        </span>
      </div>

      {ventas.length === 0 ? (
        <p className="px-4 py-6 text-center text-[13px] text-muted">
          Todavía no se ha cobrado nada hoy.
        </p>
      ) : (
        <ul className="divide-y divide-line/60">
          {ventas.map((v) => {
            const anulada = !!v.anuladaEn;
            const detalle = v.items
              .map((i) => `${i.cantidad > 1 ? `${i.cantidad}× ` : ""}${i.descripcion}`)
              .join(" · ");
            return (
              <li key={v.id} className={`px-4 py-3 ${anulada ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                  <div className="min-w-0 flex-1">
                    <div className={`text-[14px] text-ink ${anulada ? "line-through" : ""}`}>
                      <span className="font-display font-bold tabular-nums text-accent-soft">
                        {horaBogota(v.creadoEn)}
                      </span>{" "}
                      {v.cliente || "Sin nombre"}
                    </div>
                    <div className="mt-0.5 text-[12.5px] text-muted">
                      {detalle || "Sin ítems"}
                      {" · "}
                      {v.barbero ?? "El local"}
                      {" · "}
                      {v.medio}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-3">
                    <span
                      className={`font-display text-[17px] font-bold tabular-nums ${
                        anulada ? "text-muted line-through" : "text-ink"
                      }`}
                    >
                      {cop(v.total)}
                    </span>
                    {!anulada && (
                      <button
                        type="button"
                        onClick={() => {
                          setAbierta(abierta === v.id ? null : v.id);
                          setMotivo("");
                          setErr(null);
                        }}
                        className="inline-flex min-h-11 items-center px-2 text-[12.5px] text-muted underline decoration-line underline-offset-4 transition hover:text-warn"
                      >
                        Anular
                      </button>
                    )}
                  </div>
                </div>

                {anulada && (
                  <p className="mt-1.5 text-[12.5px] text-warn">Anulada · {v.anuladaMotivo}</p>
                )}

                {abierta === v.id && !anulada && (
                  <div className="mt-2.5 space-y-2 rounded-xl border border-warn/40 bg-warn/[0.06] p-3">
                    <p className="text-[12.5px] text-muted">
                      Se devuelve el stock de los productos, se le quitan los puntos al cliente
                      {v.cuponCodigo ? ", se libera el cupón" : ""}
                      {v.reservaId ? " y la cita queda otra vez por cobrar" : ""}.
                    </p>
                    <input
                      value={motivo}
                      onChange={(e) => setMotivo(e.target.value)}
                      maxLength={200}
                      autoFocus
                      placeholder="Por qué se anula (ej.: me equivoqué al meterla)"
                      className="w-full min-h-11 rounded-xl border border-line bg-bg px-3 text-[14px] text-ink placeholder:text-muted focus:border-ink/60 focus:outline-none"
                    />
                    {err && <p className="text-[12.5px] text-warn">{err}</p>}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => anular(v.id)}
                        disabled={anulando || !motivo.trim()}
                        className={botonClases("peligro", "md")}
                      >
                        {anulando ? "Anulando…" : `Anular ${cop(v.total)}`}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAbierta(null)}
                        className="inline-flex min-h-11 items-center px-3 text-[13px] text-muted transition hover:text-ink"
                      >
                        Dejarla
                      </button>
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
