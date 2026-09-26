"use client";

import { botonClases } from "@/components/ui/Boton";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addProducto, subirFotoProducto } from "@/lib/actions";
import { sanearCop, sanearCantidad, sanearNombre, sanearComisionPct } from "@/lib/admin-reglas";
import { achicarFoto } from "@/lib/imagen-cliente";
import { CamIcon } from "@/components/icons";
import { Segmentado } from "@/components/ui/Segmentado";
import type { Sede } from "@/lib/data/types";
import { plataEnCampo, digitosDePlata } from "@/lib/format";

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
  /** Sede de la pestaña abierta: el producto se crea donde el dueño está mirando.
   *  "todas" = en las dos sedes a la vez (pedido del administrador, 26-sep). */
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
  // Lo que hay AHORA en cada sede: con "Las dos", cada una cuenta lo suyo.
  const [stocks, setStocks] = useState<Record<string, string>>({});
  const [stockMin, setStockMin] = useState("");
  const [comision, setComision] = useState("");
  const [costo, setCosto] = useState("");
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
    const elegidas = sede === "todas" ? sedes.map((x) => x.id) : [sede];
    const stockPorSede = elegidas.map((id) => ({ sede: id, stock: sanearCantidad(stocks[id] ?? "") }));
    const stockMal = stockPorSede.some((x) => x.stock === null);
    // Vacío = 0 (sin aviso), como la comisión: antes un aviso en blanco frenaba el
    // alta con un error que hablaba del stock, y no se sabía qué faltaba.
    const minNum = stockMin.trim() === "" ? 0 : sanearCantidad(stockMin);
    if (!sanearNombre(nombre)) {
      setSaving(false);
      setErr("Pon el nombre del producto.");
      return;
    }
    if (precioNum === null) {
      setSaving(false);
      setErr("El precio tiene que ser un número entero de pesos, sin decimales ni negativos.");
      return;
    }
    if (stockMal || minNum === null) {
      setSaving(false);
      setErr(
        !stockMal
          ? "El aviso tiene que ser un número entero, cero o más."
          : elegidas.length > 1
            ? "Pon cuántas hay en cada sede (0 si no hay): números enteros."
            : "Pon cuántas hay ahora: un número entero, cero o más.",
      );
      return;
    }
    // Costo opcional (0077): vacío = sin costo, NO $0. Un costo en cero haría
    // creer que todo el precio es ganancia.
    const costoNum = costo.trim() === "" ? null : sanearCop(costo);
    if (costo.trim() !== "" && costoNum === null) {
      setSaving(false);
      setErr("El costo tiene que ser un número entero de pesos, sin decimales ni negativos.");
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
      sedes: stockPorSede.map((x) => ({ sede: x.sede, stock: x.stock as number })),
      precio: precioNum,
      stockMinimo: minNum,
      comisionPct: comisionNum,
      // En el mismo viaje: antes era un segundo llamado que podía fallar solo.
      costo: costoNum,
    });
    // Foto opcional: el producto ya quedó creado; si la foto falla, se avisa
    // pero no se revierte nada (se puede subir después desde la lista). Una
    // copia por sede: cada fila tiene su archivo, así cambiar la foto de una no
    // le borra la de la otra.
    let fotoErr: string | null = res.ok ? (res.aviso ?? null) : null;
    const creados = res.ids ?? (res.id ? [res.id] : []);
    if (res.ok && foto && creados.length) {
      try {
        const chica = await achicarFoto(foto); // fotos de celular: 2-5MB → ~100KB
        for (const id of creados) {
          const fd = new FormData();
          fd.set("productoId", id);
          fd.set("foto", chica);
          const fres = await subirFotoProducto(fd);
          if (!fres.ok) fotoErr = `Producto creado, pero la foto no se subió: ${fres.error}`;
        }
      } catch {
        fotoErr = "Producto creado, pero la foto no se subió. Prueba subirla desde la lista.";
      }
    }
    setSaving(false);
    if (res.ok) {
      setNombre("");
      setPrecio("");
      setStocks({});
      setStockMin("");
      setComision("");
      setCosto("");
      setFoto(null);
      if (fotoErr) setErr(fotoErr); // queda abierto para que se vea el aviso
      else onListo?.();
      router.refresh();
    } else {
      setErr(res.error ?? "No se pudo guardar.");
    }
  }

  // Sin tarjeta propia ni título: vive dentro de la Hoja "Nuevo producto", que ya
  // pone el marco y el título. Antes se veía un panel dentro de otro panel y la
  // palabra "Nuevo producto" dos veces seguidas.
  return (
    <form onSubmit={submit} className="grid gap-3 pb-2 sm:grid-cols-3 lg:grid-cols-6">
      <label className="sm:col-span-3">
        <span className={lbl}>Nombre del producto</span>
        <input required value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Ej: Cera mate fijación fuerte" className={`${input} w-full`} />
      </label>
      <div className="sm:col-span-3">
        <span className={lbl}>¿En qué sede se vende?</span>
        {/* Botones y no un desplegable: con "Las dos" a la vista, crear lo mismo
            en las dos sedes es un toque, no crear dos veces. Nombre corto
            ("Parque", "Plaza") para que las tres opciones quepan en un celular. */}
        <Segmentado
          etiqueta="Sede del producto"
          valor={sede}
          onCambio={setSede}
          opciones={[
            ...sedes.map((x) => ({ valor: x.id, texto: x.nombre.split(" ")[0] })),
            ...(sedes.length > 1 ? [{ valor: "todas", texto: "Las dos" }] : []),
          ]}
        />
        {sede === "todas" && (
          <span className={ayuda}>Se crea uno en cada sede, con el mismo precio. Después el stock de cada una es aparte.</span>
        )}
      </div>

      <label className="sm:col-span-3">
        <span className={lbl}>Precio de venta</span>
        <input required type="text" inputMode="numeric" value={plataEnCampo(precio)} onChange={(e) => setPrecio(digitosDePlata(e.target.value))} placeholder="$ 25.000" className={`${input} w-full`} />
        <span className={ayuda}>Lo que paga el cliente, en pesos.</span>
      </label>
      <label className="sm:col-span-3">
        <span className={lbl}>Le cuesta al local</span>
        <input type="text" inputMode="numeric" value={plataEnCampo(costo)} onChange={(e) => setCosto(digitosDePlata(e.target.value))} placeholder="Opcional" className={`${input} w-full`} />
        <span className={ayuda}>Lo que pagas por cada uno. Con esto se ve cuánto le ganas.</span>
      </label>
      <label className="sm:col-span-3">
        <span className={lbl}>Comisión del barbero</span>
        <input type="number" min={0} max={100} step={1} value={comision} onChange={(e) => setComision(e.target.value)} placeholder="0" className={`${input} w-full`} />
        <span className={ayuda}>Qué % se lleva por venderlo. Vacío = no lleva nada.</span>
      </label>

      {(sede === "todas" ? sedes : sedes.filter((x) => x.id === sede)).map((x) => (
        <label key={x.id} className="sm:col-span-3">
          <span className={lbl}>{sede === "todas" ? `¿Cuántas hay en ${x.nombre}?` : "¿Cuántas hay ahora?"}</span>
          <input
            required
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            value={stocks[x.id] ?? ""}
            onChange={(e) => setStocks((prev) => ({ ...prev, [x.id]: e.target.value }))}
            placeholder="12"
            className={`${input} w-full`}
          />
          <span className={ayuda}>Las unidades que tienes hoy en la sede.</span>
        </label>
      ))}
      <label className="sm:col-span-3">
        <span className={lbl}>Avisarme cuando queden</span>
        <input type="number" min={0} step={1} value={stockMin} onChange={(e) => setStockMin(e.target.value)} placeholder="5" className={`${input} w-full`} />
        <span className={ayuda}>Bajo ese número aparece en “Para hacer” del panel.</span>
      </label>
      <div className="flex flex-wrap items-center gap-2 sm:col-span-6">
        <button
          type="button"
          onClick={() => fotoRef.current?.click()}
          className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-line px-4 text-[12.5px] text-muted transition hover:text-ink"
        >
          <CamIcon className="h-4 w-4" />
          {foto ? foto.name : "Foto (opcional)"}
        </button>
        {foto && (
          <button type="button" onClick={() => setFoto(null)} className="inline-flex min-h-11 items-center px-2 text-[12.5px] text-muted transition hover:text-ink">
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
      {/* Pegado abajo: con el teclado abierto, un "Guardar" al final del scroll
          queda fuera de alcance. Es la misma regla del pie de <Hoja>. */}
      <div className="sticky bottom-0 -mx-1 flex gap-2 bg-bg/95 px-1 py-3 backdrop-blur sm:col-span-6">
        <button disabled={saving} className={botonClases("primario")}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
        <button type="button" onClick={() => onListo?.()} className="rounded-full border border-line px-6 py-2.5 text-sm text-muted transition hover:text-ink">
          Cancelar
        </button>
      </div>
    </form>
  );
}
