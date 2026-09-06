"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registrarConsumoBarbero } from "@/lib/actions";
import { cop } from "@/lib/format";

// "Me tomé algo del local". Lo registra el propio barbero, no el dueño: es la
// regla del proyecto (el dueño mira y decide, el equipo registra) y además es el
// único momento en que alguien sabe de verdad qué salió de la nevera.
//
// Dos cosas pasan al guardar: baja el stock (con su movimiento en el kardex) y
// queda anotada la plata para descontarla en la liquidación del domingo. Antes no
// pasaba ninguna de las dos: el inventario nunca cuadraba y el descuento se
// llevaba de memoria.

type Prod = { id: string; nombre: string; precio: number; stock: number };
type Barb = { id: string; nombre: string };

export function ConsumoBarbero({
  productos,
  barberos,
  miBarberoId,
}: {
  productos: Prod[];
  barberos: Barb[];
  miBarberoId: string | null;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const [productoId, setProductoId] = useState("");
  const [barberoId, setBarberoId] = useState(miBarberoId ?? "");
  // Cantidad y precio como TEXTO mientras se escriben: con el número controlado,
  // borrar el "1" para poner "2" lo devolvía a 1 y terminaba en "12" (foto del
  // dueño, 5-sep). El precio arranca en el del producto y se puede cambiar acá
  // mismo (una cerveza al costo, una gaseosa del combo…).
  const [cantidadTxt, setCantidadTxt] = useState("1");
  const [precioTxt, setPrecioTxt] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hecho, setHecho] = useState<string | null>(null);

  const prod = productos.find((p) => p.id === productoId) ?? null;
  const cantidad = Math.max(1, Math.min(20, Math.round(Number(cantidadTxt) || 1)));
  const precioUnit = precioTxt === null || precioTxt.trim() === "" ? (prod?.precio ?? 0) : Number(precioTxt);
  const total = prod ? precioUnit * cantidad : 0;

  async function guardar() {
    if (!productoId || !barberoId) {
      setError("Elegí el producto y de quién es.");
      return;
    }
    if (!Number.isInteger(precioUnit) || precioUnit < 0) {
      setError("El precio tiene que ser un número entero de pesos (0 o más).");
      return;
    }
    setSaving(true);
    setError(null);
    const res = await registrarConsumoBarbero({
      barberoId,
      productoId,
      cantidad,
      precioUnitario: prod && precioUnit !== prod.precio ? precioUnit : undefined,
    });
    setSaving(false);
    if (!res.ok) {
      setError(res.error ?? "No se pudo registrar.");
      return;
    }
    setHecho(`${cantidad > 1 ? `${cantidad}× ` : ""}${prod?.nombre ?? "Producto"} · ${cop(total)}`);
    setProductoId("");
    setCantidadTxt("1");
    setPrecioTxt(null);
    router.refresh();
  }

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => {
          setAbierto(true);
          setHecho(null);
        }}
        className="flex min-h-11 w-full items-center justify-center rounded-xl border border-line text-[13px] font-semibold text-muted transition hover:border-accent/40 hover:text-ink"
      >
        + Anotar una bebida o mecato que me tomé
      </button>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-panel p-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-display text-lg text-ink">Consumo del equipo</h3>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          aria-label="Cerrar"
          className="grid h-11 w-11 place-items-center rounded-full border border-line text-muted transition hover:text-ink"
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        Baja del inventario y se descuenta en la liquidación de la semana.
      </p>

      {hecho && (
        <div className="mt-3 rounded-xl border border-ok/40 bg-ok/10 px-3.5 py-2.5 text-[13px] text-ok">
          Anotado: {hecho}
        </div>
      )}

      <div className="mt-3 space-y-2.5">
        <select
          value={productoId}
          onChange={(e) => {
            setProductoId(e.target.value);
            setPrecioTxt(null); // el precio vuelve a seguir al producto elegido
          }}
          className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-sm text-ink focus:border-accent focus:outline-none"
        >
          <option value="">¿Qué se tomó?</option>
          {productos.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} · {cop(p.precio)}
              {p.stock <= 0 ? " (sin stock)" : ""}
            </option>
          ))}
        </select>

        {/* El mostrador es compartido: el que anota no siempre es el que se lo
            tomó, así que se elige a quién se le descuenta. */}
        {barberos.length > 1 && (
          <select
            value={barberoId}
            onChange={(e) => setBarberoId(e.target.value)}
            className="w-full rounded-xl border border-line bg-bg px-3.5 py-3 text-sm text-ink focus:border-accent focus:outline-none"
          >
            <option value="">¿De quién es?</option>
            {barberos.map((b) => (
              <option key={b.id} value={b.id}>
                {b.nombre}
                {b.id === miBarberoId ? " (yo)" : ""}
              </option>
            ))}
          </select>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <label className="text-[12px] text-muted">
            Cuántos
            <input
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={cantidadTxt}
              onChange={(e) => setCantidadTxt(e.target.value)}
              onBlur={() => setCantidadTxt(String(cantidad))}
              className="ml-2 min-h-11 w-20 rounded-xl border border-line bg-bg px-3 text-sm text-ink tabular-nums focus:border-accent focus:outline-none"
            />
          </label>
          <label className="text-[12px] text-muted">
            Precio c/u
            <input
              type="number"
              inputMode="numeric"
              min={0}
              step={100}
              value={precioTxt ?? (prod ? String(prod.precio) : "")}
              onChange={(e) => setPrecioTxt(e.target.value)}
              placeholder="$"
              disabled={!prod}
              className="ml-2 min-h-11 w-28 rounded-xl border border-line bg-bg px-3 text-sm text-ink tabular-nums focus:border-accent focus:outline-none disabled:opacity-50"
            />
          </label>
          {prod && (
            <span className="ml-auto font-display text-[17px] font-bold tabular-nums text-ink">−{cop(total)}</span>
          )}
        </div>
      </div>

      {error && (
        <div className="mt-3 rounded-xl border border-accent/40 bg-accent/10 px-3.5 py-2.5 text-[13px] text-accent-soft">
          {error}
        </div>
      )}

      <button
        type="button"
        onClick={guardar}
        disabled={saving || !productoId || !barberoId}
        className="mt-3 min-h-12 w-full rounded-full bg-accent text-sm font-bold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50"
      >
        {saving ? "Anotando…" : "Anotar"}
      </button>
    </div>
  );
}
