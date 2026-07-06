"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addProducto, subirFotoProducto } from "@/lib/actions";
import { BoxIcon, CamIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";

const input =
  "rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";

export function AddProductForm({ sedes }: { sedes: Sede[] }) {
  const router = useRouter();
  const fotoRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState(sedes[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    const res = await addProducto({
      nombre,
      sede,
      precio: Number(precio) || 0,
      stock: Number(stock) || 0,
      stockMinimo: Number(stockMin) || 0,
      comisionPct: 0,
    });
    // Foto opcional: el producto ya quedó creado; si la foto falla, se avisa
    // pero no se revierte nada (se puede subir después desde la lista).
    let fotoErr: string | null = null;
    if (res.ok && foto && res.id) {
      const fd = new FormData();
      fd.set("productoId", res.id);
      fd.set("foto", foto);
      const fres = await subirFotoProducto(fd);
      if (!fres.ok) fotoErr = `Producto creado, pero la foto no se subió: ${fres.error}`;
    }
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setPrecio("");
      setStock("");
      setStockMin("");
      setFoto(null);
      if (fotoErr) setErr(fotoErr); // el form queda abierto para que se vea el aviso
      else setOpen(false);
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo guardar.");
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
      <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
        <button
          type="button"
          onClick={() => fotoRef.current?.click()}
          className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-xs text-muted transition hover:text-ink"
        >
          <CamIcon className="h-4 w-4" />
          {foto ? foto.name : "Foto (opcional)"}
        </button>
        {foto && (
          <button type="button" onClick={() => setFoto(null)} className="text-xs text-muted transition hover:text-ink">
            Quitar
          </button>
        )}
        <input
          ref={fotoRef}
          type="file"
          accept="image/*"
          onChange={(e) => setFoto(e.target.files?.[0] ?? null)}
          className="hidden"
        />
      </div>
      {err && (
        <div className="rounded-lg border border-accent/40 bg-accent/10 px-3 py-2 text-sm text-accent-soft sm:col-span-6">{err}</div>
      )}
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
