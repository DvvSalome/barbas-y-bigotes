"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addProducto, subirFotoProducto } from "@/lib/actions";
import { sanearCop, sanearCantidad, sanearNombre, sanearComisionPct } from "@/lib/admin-reglas";
import { achicarFoto } from "@/lib/imagen-cliente";
import { BoxIcon, CamIcon } from "@/components/icons";
import type { Sede } from "@/lib/data/types";

const input =
  "min-h-11 rounded-lg border border-line bg-bg px-3 py-2 text-ink placeholder:text-muted focus:border-accent focus:outline-none";
const lbl = "mb-1 block text-[12px] font-semibold text-ink";
const ayuda = "mt-1 block text-[12px] leading-snug text-muted";

export function AddProductForm({
  sedes,
  sedeInicial,
  onListo,
}: {
  sedes: Sede[];
  /** Sede de la pestaña abierta: el producto se crea donde el dueño está mirando. */
  sedeInicial?: string;
  /** Lo llama el panel para cerrarse cuando el alta salió bien. */
  onListo?: () => void;
}) {
  const router = useRouter();
  const fotoRef = useRef<HTMLInputElement>(null);
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState("");
  const [sede, setSede] = useState(sedeInicial ?? sedes[0]?.id ?? "");
  const [precio, setPrecio] = useState("");
  const [stock, setStock] = useState("");
  const [stockMin, setStockMin] = useState("");
  const [comision, setComision] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setSaving(true);
    // Validar ACÁ además del server, para dar el mensaje pegado al campo. El
    // `Number(x) || 0` que había convertía "" y "abc" en 0 sin decir nada: un
    // precio vacío entraba como producto gratis. La barrera real igual está en
    // la action (la tabla productos no tiene CHECKs).
    const precioNum = sanearCop(precio);
    const stockNum = sanearCantidad(stock);
    const minNum = sanearCantidad(stockMin);
    if (!sanearNombre(nombre)) {
      setSaving(false);
      setErr("Poné el nombre del producto.");
      return;
    }
    if (precioNum === null) {
      setSaving(false);
      setErr("El precio tiene que ser un número entero de pesos, sin decimales ni negativos.");
      return;
    }
    if (stockNum === null || minNum === null) {
      setSaving(false);
      setErr("El stock y el mínimo tienen que ser números enteros, cero o más.");
      return;
    }
    // Vacío = 0 (sin comisión), que es el default del negocio para productos.
    const comisionNum = comision.trim() === "" ? 0 : sanearComisionPct(comision);
    if (comisionNum === null) {
      setSaving(false);
      setErr("La comisión tiene que estar entre 0 y 100.");
      return;
    }

    const res = await addProducto({
      nombre,
      sede,
      precio: precioNum,
      stock: stockNum,
      stockMinimo: minNum,
      comisionPct: comisionNum,
    });
    // Foto opcional: el producto ya quedó creado; si la foto falla, se avisa
    // pero no se revierte nada (se puede subir después desde la lista).
    let fotoErr: string | null = null;
    if (res.ok && foto && res.id) {
      try {
        const fd = new FormData();
        fd.set("productoId", res.id);
        fd.set("foto", await achicarFoto(foto)); // fotos de celular: 2-5MB → ~100KB
        const fres = await subirFotoProducto(fd);
        if (!fres.ok) fotoErr = `Producto creado, pero la foto no se subió: ${fres.error}`;
      } catch {
        fotoErr = "Producto creado, pero la foto no se subió. Prueba subirla desde la lista.";
      }
    }
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setPrecio("");
      setStock("");
      setStockMin("");
      setComision("");
      setFoto(null);
      if (fotoErr) setErr(fotoErr); // queda abierto para que se vea el aviso
      else onListo?.();
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo guardar.");
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-3 rounded-2xl border border-line bg-panel p-5 sm:grid-cols-3 lg:grid-cols-6">
      <h3 className="flex items-center gap-2 font-display text-lg sm:col-span-6">
        <BoxIcon className="h-4 w-4 text-accent" /> Nuevo producto
      </h3>
      <label className="sm:col-span-3">
        <span className={lbl}>Nombre del producto</span>
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Cera mate fijación fuerte" className={`${input} w-full`} />
      </label>
      <label className="sm:col-span-3">
        <span className={lbl}>¿En qué sede se vende?</span>
        <select value={sede} onChange={(e) => setSede(e.target.value as typeof sede)} className={`${input} w-full`}>
          {sedes.map((s) => (
            <option key={s.id} value={s.id}>{s.nombre}</option>
          ))}
        </select>
      </label>

      <label className="sm:col-span-3">
        <span className={lbl}>Precio de venta</span>
        <input required type="number" min={0} step={1} value={precio} onChange={(e) => setPrecio(e.target.value)} placeholder="25000" className={`${input} w-full`} />
        <span className={ayuda}>Lo que paga el cliente, en pesos.</span>
      </label>
      <label className="sm:col-span-3">
        <span className={lbl}>Comisión del barbero</span>
        <input type="number" min={0} max={100} step={1} value={comision} onChange={(e) => setComision(e.target.value)} placeholder="0" className={`${input} w-full`} />
        <span className={ayuda}>Qué % se lleva por venderlo. Vacío = no lleva nada.</span>
      </label>

      <label className="sm:col-span-3">
        <span className={lbl}>¿Cuántas hay ahora?</span>
        <input required type="number" min={0} step={1} value={stock} onChange={(e) => setStock(e.target.value)} placeholder="12" className={`${input} w-full`} />
        <span className={ayuda}>Las unidades que tenés hoy en la sede.</span>
      </label>
      <label className="sm:col-span-3">
        <span className={lbl}>Avisarme cuando queden</span>
        <input type="number" min={0} step={1} value={stockMin} onChange={(e) => setStockMin(e.target.value)} placeholder="5" className={`${input} w-full`} />
        <span className={ayuda}>Bajo ese número aparece en “Para hacer” del panel.</span>
      </label>
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
        <button type="button" onClick={() => onListo?.()} className="rounded-full border border-line px-6 py-2.5 text-sm text-muted transition hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
