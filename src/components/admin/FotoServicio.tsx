"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { subirFotoServicio, quitarFotoServicio } from "@/lib/actions";
import { achicarFoto } from "@/lib/imagen-cliente";
import { ProductoThumb } from "@/components/staff/ProductoThumb";
import { CamIcon } from "@/components/icons";

// Foto del servicio en el catálogo admin: es la que ve el CLIENTE al reservar.
// Mismo gesto que FotoProducto: todo el thumb es tocable y se sube al elegir.
export function FotoServicio({
  servicioId,
  nombre,
  fotoUrl,
  size = 44,
}: {
  servicioId: string;
  nombre: string;
  fotoUrl?: string | null;
  size?: number;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  // Quitar con confirmación de dos toques: el primero pregunta, el segundo borra.
  const [confirmando, setConfirmando] = useState(false);
  const [quitando, setQuitando] = useState(false);

  async function quitar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setQuitando(true);
    setErr(null);
    const res = await quitarFotoServicio(servicioId);
    setQuitando(false);
    setConfirmando(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo quitar la foto.");
  }

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setSubiendo(true);
    try {
      // Se achica en el navegador (LADO_MAX_FOTO alcanza para la tarjeta del
      // wizard) y no choca con el tope de body de los server actions.
      const liviana = await achicarFoto(file);
      const fd = new FormData();
      fd.set("servicioId", servicioId);
      fd.set("foto", liviana);
      const res = await subirFotoServicio(fd);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "No se pudo subir la foto.");
    } catch {
      setErr("No se pudo subir la foto. Prueba con otra imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  return (
    <span className="relative inline-flex flex-col items-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        aria-label={fotoUrl ? `Cambiar foto de ${nombre}` : `Subir foto de ${nombre}`}
        title={fotoUrl ? "Cambiar la foto que ve el cliente" : "Subir la foto que ve el cliente"}
        className={`relative inline-flex rounded-xl transition ${subiendo ? "opacity-50" : "hover:opacity-90"}`}
      >
        <ProductoThumb nombre={nombre} fotoUrl={fotoUrl} size={size} />
        <span
          aria-hidden
          className="absolute -bottom-1.5 -right-1.5 grid h-6 w-6 place-items-center rounded-full border-2 border-panel bg-accent text-on-accent shadow"
        >
          <CamIcon className="h-3.5 w-3.5" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />
      {/* Quitar (solo si hay foto): dos toques — pregunta y borra. Al salir el
          mouse/foco sin confirmar, vuelve a su estado normal. */}
      {fotoUrl && !subiendo && (
        <button
          type="button"
          onClick={quitar}
          onBlur={() => setConfirmando(false)}
          disabled={quitando}
          className={`inline-flex min-h-11 items-center px-2 text-[10px] font-semibold transition disabled:opacity-50 ${
            confirmando ? "text-warn" : "text-muted hover:text-ink"
          }`}
        >
          {quitando ? "Quitando…" : confirmando ? "¿Seguro? Toca de nuevo" : "Quitar foto"}
        </button>
      )}
      {subiendo && <span className="mt-1 text-[10px] text-muted">Subiendo…</span>}
      {err && <span className="mt-1 max-w-36 text-center text-[10px] leading-tight text-accent-soft">{err}</span>}
    </span>
  );
}
