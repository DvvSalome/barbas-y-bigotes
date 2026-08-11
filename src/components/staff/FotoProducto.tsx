"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirFotoProducto } from "@/lib/actions";
import { achicarFoto } from "@/lib/imagen-cliente";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { CamIcon } from "@/components/icons";

// Thumb del producto + acción de foto: TODO el thumb es tocable (no un botón de
// 22px escondido) y hay una etiqueta visible "Cambiar/Subir foto" — en el celular
// no hay hover, así que el title de antes no se veía nunca. Solo admin: la action
// valida el rol. Al elegir archivo se sube al toque (sin paso extra de "guardar").
export function FotoProducto({
  productoId,
  nombre,
  fotoUrl,
  size = 42,
}: {
  productoId: string;
  nombre: string;
  fotoUrl?: string | null;
  size?: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const abrir = () => inputRef.current?.click();

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // permite re-elegir el mismo archivo
    if (!file) return;
    setErr(null);
    setSubiendo(true);
    // try/finally: sin esto, cualquier excepción (típicamente el 500 de Next
    // cuando el archivo pasa el límite de los server actions) dejaba el botón
    // en "Subiendo…" para siempre y sin ningún mensaje.
    try {
      // El thumbnail se ve a 36-42px y una foto de celular pesa 2-5MB. Se achica
      // ACÁ: sube en un segundo con datos móviles y no choca con el tope de body.
      const liviana = await achicarFoto(file);
      const fd = new FormData();
      fd.set("productoId", productoId);
      fd.set("foto", liviana);
      const res = await subirFotoProducto(fd);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "No se pudo subir la foto.");
    } catch {
      setErr("No se pudo subir la foto. Prueba con otra imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <span className="relative inline-flex flex-col items-center gap-1">
      {/* Todo el thumb abre el selector: objetivo táctil grande, no un ícono de 22px */}
      <button
        type="button"
        onClick={abrir}
        disabled={subiendo}
        aria-label={fotoUrl ? `Cambiar foto de ${nombre}` : `Subir foto de ${nombre}`}
        className={`relative inline-flex rounded-xl transition ${subiendo ? "opacity-50" : "hover:opacity-90"}`}
      >
        <ProductoThumb nombre={nombre} fotoUrl={fotoUrl} size={size} />
        {/* Badge de cámara sólido (accent) → se ve incluso sobre fotos oscuras */}
        <span
          aria-hidden
          className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-panel bg-accent text-on-accent shadow"
        >
          <CamIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      {/* Etiqueta visible: dice qué hace sin depender del hover */}
      <button
        type="button"
        onClick={abrir}
        disabled={subiendo}
        className="text-[10.5px] font-semibold text-accent-soft transition hover:text-accent disabled:opacity-50"
      >
        {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
      {err && <span className="max-w-40 text-center text-[10px] leading-tight text-accent-soft">{err}</span>}
    </span>
  );
}
