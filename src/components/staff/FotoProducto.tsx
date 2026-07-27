"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirFotoProducto } from "@/lib/actions";
import { achicarFoto } from "@/lib/imagen-cliente";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { CamIcon } from "@/components/icons";

// Thumb del producto + botón de cámara: al elegir archivo se sube al toque
// (sin paso extra de "guardar"). Solo admin: la action valida el rol.
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
      setErr("No se pudo subir la foto. Probá con otra imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <span className="relative inline-flex flex-col">
      <span className={`relative inline-flex ${subiendo ? "opacity-50" : ""}`}>
        <ProductoThumb nombre={nombre} fotoUrl={fotoUrl} size={size} />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={subiendo}
          aria-label={fotoUrl ? `Cambiar foto de ${nombre}` : `Subir foto de ${nombre}`}
          title={fotoUrl ? "Cambiar foto" : "Subir foto"}
          className="absolute -bottom-1.5 -right-1.5 grid h-5.5 w-5.5 place-items-center rounded-full border border-line bg-elevated text-muted transition hover:text-ink disabled:cursor-default"
        >
          <CamIcon className="h-3 w-3" />
        </button>
      </span>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
      {subiendo && <span className="mt-1 text-[10px] text-muted">Subiendo…</span>}
      {err && <span className="mt-1 max-w-40 text-[10px] leading-tight text-accent-soft">{err}</span>}
    </span>
  );
}
