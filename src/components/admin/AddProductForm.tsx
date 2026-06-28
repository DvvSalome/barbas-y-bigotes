"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { addProducto } from "@/lib/actions";
import { BoxIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";

const input =
  "rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function AddProductForm({ sedes }: { sedes: Sede[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockMin, setStockMin] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const res = await addProducto({
      nombre,
      sede,
      precio: Number(precio) || 0,
      stock: Number(stock) || 0,
      stockMinimo: Number(stockMin) || 0,
      comisionPct: 0,
    });
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setPrecio("");
      setStock("");
      setStockMin("");
      setOpen(false);
      router.refresh();
    } else {
      alert(res.error);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft"
      >
        <BoxIcon className="h-4 w-4" /> Agregar producto
      </button>
    );
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-6">
      <h3 className="flex items-center gap-2 font-display text-lg sm:col-span-6">
        <BoxIcon className="h-4 w-4 text-accent" /> Nuevo producto
      </h3>
      <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Producto" className={`${input} sm:col-span-2`} />
      <select value={sede} onChange={(e) => setSede(e.target.value as typeof sede)} className={input}>
        {sedes.map((s) => (
          <option key={s.id} value={s.id}>{s.nombre}</option>
        ))}
      </select>
      <input required type="number" value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="Precio" className={input} />
      <input required type="number" value={stock} onChange={(e) => setStock(e.target.value)} placeholder="Stock" className={input} />
      <input type="number" value={stockMin} onChange={(e) => setStockMin(e.target.value)} placeholder="Mínimo" className={input} />
      <div className="flex gap-2 sm:col-span-6">
        <button disabled={saving} className="rounded-full bg-accent px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-on-accent transition hover:bg-accent-soft disabled:opacity-50">
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-line px-6 py-2.5 text-sm text-muted transition hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
