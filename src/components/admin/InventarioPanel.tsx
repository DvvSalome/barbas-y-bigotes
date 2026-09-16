"use client";

import { useState } from "react";
import { cop } from "@/lib/format";
import { PrecioEditable } from "@/components/admin/PrecioEditable";
import { ComisionEditable } from "@/components/admin/ComisionEditable";
import { UpsellToggle } from "@/components/admin/UpsellToggle";
import { StockControl } from "@/components/admin/StockControl";
import { AddProductForm } from "@/components/admin/AddProductForm";
import { FotoProducto } from "@/components/staff/FotoProducto";
import type { Producto, Sede } from "@/lib/data/types";

// La estantería. La sede la manda el selector de ARRIBA (?sede=), igual que en
// Clientes: antes este panel traía sus propias pestañas de sede debajo de un
// selector que en esta sección ni siquiera filtraba — dos controles y uno solo
// servía (lo señaló el dueño, 6-sep). Con "Ambas" se ve todo, agrupado por sede.
//
// Cada tarjeta se lee en orden: qué es y cuánto queda → cuánto vale y qué se
// lleva el barbero → qué se hace con ella (entró / corregir, ofrecer al
// reservar). Textos de 12 px mínimo y controles de 44 px (auditoría del 6-sep:
// esta pantalla tenía el 56 % de los textos bajo 12 px).
export function InventarioPanel({
  productos,
  sedes,
  sedeActiva,
}: {
  productos: Producto[];
  sedes: Sede[];
  /** null = las dos sedes, agrupadas. */
  sedeActiva: string | null;
}) {
  const [altaAbierta, setAltaAbierta] = useState(false);

  const grupos = (sedeActiva ? sedes.filter((s) => s.id === sedeActiva) : sedes).map((s) => {
    // Lo que hay que reponer va primero: si no, había que cazarlo leyendo todo.
    const lista = productos
      .filter((p) => p.sede === s.id)
      .sort((a, b) => Number(b.stock <= b.stockMinimo) - Number(a.stock <= a.stockMinimo));
    return {
      sede: s,
      lista,
      bajos: lista.filter((p) => p.stock <= p.stockMinimo),
      valor: lista.reduce((a, p) => a + p.precio * p.stock, 0),
    };
  });
  const total = grupos.reduce((a, g) => a + g.lista.length, 0);

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted tabular-nums">
          {total} {total === 1 ? "producto" : "productos"}
          {sedeActiva ? "" : " en las dos sedes"}
        </p>
        <button
          type="button"
          onClick={() => setAltaAbierta((v) => !v)}
          className="min-h-11 rounded-full bg-[linear-gradient(180deg,var(--cta-1),var(--cta-2))] px-5 text-[13px] font-bold uppercase tracking-wide text-on-accent transition hover:brightness-105"
        >
          {altaAbierta ? "Cerrar" : "+ Nuevo producto"}
        </button>
      </div>

      {/* Alta en su sitio, no en otra pantalla */}
      {altaAbierta && (
        <div className="mt-4 rounded-2xl border border-accent/40 bg-panel p-4">
          <AddProductForm sedes={sedes} sedeInicial={sedeActiva ?? sedes[0]?.id} onListo={() => setAltaAbierta(false)} />
        </div>
      )}

      {grupos.map((g) => (
        <section key={g.sede.id} className="mt-6" aria-label={g.sede.nombre}>
          {!sedeActiva && (
            <h2 className="mb-3 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
              <span className="text-[13px] font-bold uppercase tracking-[0.12em] text-accent-soft">{g.sede.nombre}</span>
              <span className="text-[12.5px] text-muted tabular-nums">
                {g.lista.length} {g.lista.length === 1 ? "producto" : "productos"} · {cop(g.valor)} en bodega
              </span>
            </h2>
          )}

          {/* Lo urgente arriba y en una línea, no repartido por la lista */}
          {g.bajos.length > 0 && (
            <p className="mb-3 rounded-xl border border-warn/40 bg-warn/[0.08] px-3.5 py-2.5 text-[13px] text-warn">
              <b>
                {g.bajos.length === 1 ? "1 producto está por acabarse" : `${g.bajos.length} productos están por acabarse`}
              </b>
              : {g.bajos.map((p) => p.nombre).join(" · ")}
            </p>
          )}

          {g.lista.length === 0 ? (
            <div className="rounded-2xl border border-line bg-panel px-4 py-8 text-center">
              <p className="text-[14px] font-semibold text-ink">Todavía no hay productos en {g.sede.nombre}</p>
              <p className="mt-1 text-[12.5px] text-muted">Agrega el primero con “+ Nuevo producto”.</p>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {g.lista.map((p) => (
                <Tarjeta key={p.id} p={p} />
              ))}
            </div>
          )}

          {sedeActiva && g.lista.length > 0 && (
            <p className="mt-3 text-[12.5px] text-muted tabular-nums">
              {cop(g.valor)} en bodega a precio de venta
            </p>
          )}
        </section>
      ))}
    </div>
  );
}

function Tarjeta({ p }: { p: Producto }) {
  const bajo = p.stock <= p.stockMinimo;
  return (
    <article className={`flex flex-col rounded-2xl border bg-panel p-4 transition ${bajo ? "border-warn/50" : "border-line"}`}>
      {/* 1) Qué es y cuánto queda */}
      <div className="flex items-start gap-3">
        <FotoProducto productoId={p.id} nombre={p.nombre} fotoUrl={p.fotoUrl} size={56} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-[15px] font-semibold leading-snug text-ink">{p.nombre}</h3>
            <span
              className={`shrink-0 rounded-full px-2.5 py-1 text-[12px] font-bold tabular-nums ${
                bajo ? "bg-warn/15 text-warn" : "bg-elevated text-ink"
              }`}
            >
              {p.stock} en bodega
            </span>
          </div>
          {/* 2) Cuánto vale y qué se lleva el barbero: se tocan para cambiar */}
          <div className="mt-1.5 flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
            <span className="font-display text-[18px] font-extrabold tabular-nums text-ink">
              <PrecioEditable productoId={p.id} precio={p.precio} />
            </span>
            <ComisionEditable productoId={p.id} pct={p.comisionPct} />
          </div>
        </div>
      </div>

      {/* 3) Qué se hace con el stock: las dos acciones que existen de verdad */}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <StockControl productoId={p.id} stock={p.stock} stockMinimo={p.stockMinimo} />
        <span className={`ml-auto text-[12.5px] ${bajo ? "font-semibold text-warn" : "text-muted"}`}>
          {bajo ? `Se está acabando · aviso bajo ${p.stockMinimo}` : `Te avisamos bajo ${p.stockMinimo}`}
        </span>
      </div>

      {/* 4) Si se le ofrece al cliente al final de la reserva */}
      <div className="mt-3 flex items-center justify-between gap-3 border-t border-line/60 pt-3">
        <span className="text-[13px] text-ink">
          Ofrecer al reservar
          <span className="block text-[12px] text-muted">Aparece al final de la reserva del cliente</span>
        </span>
        <UpsellToggle productoId={p.id} enUpsell={p.enUpsell} />
      </div>
    </article>
  );
}
