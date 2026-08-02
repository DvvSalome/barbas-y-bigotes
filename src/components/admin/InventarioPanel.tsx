"use client";

import { useState } from "react";
import { cop } from "@/lib/format";
import { PrecioEditable } from "@/components/admin/PrecioEditable";
import { UpsellToggle } from "@/components/admin/UpsellToggle";
import { StockControl } from "@/components/admin/StockControl";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { FotoProducto } from "@/components/staff/FotoProducto";
import type { Producto, Sede } from "@/lib/data/types";

// La estantería, no una tabla. Cada producto es una tarjeta con su foto real y
// las acciones donde está el dato: el precio se toca, el stock se sube o se
// corrige ahí mismo. La sede va en pestañas (antes eran dos tablas apiladas, o
// sea el doble de scroll para ver la segunda).
export function InventarioPanel({ productos, sedes }: { productos: Producto[]; sedes: Sede[] }) {
  const [sedeId, setSedeId] = useState(sedes[0]?.id ?? "");
  const [altaAbierta, setAltaAbierta] = useState(false);

  const deSede = (id: string) => productos.filter((p) => p.sede === id);
  // Lo que hay que reponer va primero: si no, había que cazarlo leyendo todo.
  const lista = deSede(sedeId).sort(
    (a, b) => Number(b.stock <= b.stockMinimo) - Number(a.stock <= a.stockMinimo),
  );
  const bajos = lista.filter((p) => p.stock <= p.stockMinimo);
  const valorBodega = lista.reduce((a, p) => a + p.precio * p.stock, 0);

  return (
    <div className="mt-5">
      {/* Sede + resumen + alta, todo en una barra */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1.5" role="tablist" aria-label="Sede">
          {sedes.map((s) => {
            const act = s.id === sedeId;
            const faltan = deSede(s.id).filter((p) => p.stock <= p.stockMinimo).length;
            return (
              <button
                key={s.id}
                role="tab"
                aria-selected={act}
                onClick={() => setSedeId(s.id)}
                className={`inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
                  act
                    ? "border-accent/45 bg-accent/10 text-accent-soft"
                    : "border-line text-muted hover:border-accent/30 hover:text-ink"
                }`}
              >
                {s.nombre}
                {faltan > 0 && (
                  <span className="rounded-full bg-warn/20 px-1.5 text-[10.5px] font-bold text-warn tabular-nums">
                    {faltan}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => setAltaAbierta((v) => !v)}
          className="rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-4 py-2 text-[12.5px] font-bold uppercase tracking-wide text-on-accent transition hover:brightness-105"
        >
          {altaAbierta ? "Cerrar" : "+ Nuevo producto"}
        </button>
      </div>

      {/* Alta en su sitio, no en otra pantalla */}
      {altaAbierta && (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-panel p-4">
          <AddProductForm sedes={sedes} sedeInicial={sedeId} onListo={() => setAltaAbierta(false)} />
        </div>
      )}

      {/* Lo urgente arriba y en una línea, no repartido por la lista */}
      {bajos.length > 0 && (
        <p className="mt-4 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[12.5px] text-warn">
          <b>
            {bajos.length === 1 ? "1 producto está por acabarse" : `${bajos.length} productos están por acabarse`}
          </b>
          : {bajos.map((p) => p.nombre).join(" · ")}
        </p>
      )}

      {/* La estantería */}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {lista.length === 0 && (
          <div className="col-span-full rounded-2xl border border-line bg-panel px-4 py-8 text-center">
            <p className="text-[13px] font-semibold text-ink">Todavía no hay productos en esta sede</p>
            <p className="text-[11.5px] text-muted">Agregá el primero con “+ Nuevo producto”.</p>
          </div>
        )}

        {lista.map((p) => {
          const bajo = p.stock <= p.stockMinimo;
          return (
            <article
              key={p.id}
              className={`flex flex-col gap-3 rounded-2xl border bg-panel p-3.5 transition ${
                bajo ? "border-warn/45" : "border-line"
              }`}
            >
              <div className="flex items-start gap-3">
                {/* La foto es la que ve el barbero al vender: se cambia acá mismo */}
                <div className="shrink-0">
                  <FotoProducto productoId={p.id} nombre={p.nombre} fotoUrl={p.fotoUrl} />
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-[14px] font-semibold leading-tight text-ink">{p.nombre}</h3>
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <span className="font-display text-[17px] font-extrabold tabular-nums text-ink">
                      <PrecioEditable productoId={p.id} precio={p.precio} />
                    </span>
                    {p.comisionPct > 0 && (
                      <span className="text-[11px] text-muted">{p.comisionPct}% para el barbero</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Stock: el número, y las dos acciones que existen de verdad */}
              <div className="rounded-xl bg-elevated px-3 py-2.5">
                <StockControl productoId={p.id} stock={p.stock} stockMinimo={p.stockMinimo} />
                <p className="mt-1.5 text-[11px] text-muted">
                  {bajo ? (
                    <span className="text-warn">Se está acabando · avisamos bajo {p.stockMinimo}</span>
                  ) : (
                    <>Te avisamos cuando queden {p.stockMinimo} o menos</>
                  )}
                </p>
              </div>

              {/* "En reserva" no significaba nada: es si se ofrece como bebida
                  en el último paso de la reserva. Ahora lo dice con palabras. */}
              <div className="flex items-center justify-between gap-2 border-t border-line/60 pt-2.5">
                <span className="text-[11.5px] text-muted">Ofrecer al reservar</span>
                <UpsellToggle productoId={p.id} enUpsell={p.enUpsell} />
              </div>
            </article>
          );
        })}
      </div>

      {lista.length > 0 && (
        <p className="mt-3 text-[11.5px] text-muted tabular-nums">
          {lista.length} {lista.length === 1 ? "producto" : "productos"} · {cop(valorBodega)} en bodega a precio de
          venta
        </p>
      )}
    </div>
  );
}
