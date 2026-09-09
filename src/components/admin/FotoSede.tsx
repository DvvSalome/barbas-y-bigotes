"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { subirFotoSede, quitarFotoSede } from "@/lib/actions";
import { achicarFoto } from "@/lib/imagen-cliente";
import { CamIcon } from "@/components/icons";

// La fachada de la sede: es la foto que ve el CLIENTE al elegir dónde reservar.
// Tarjeta con la imagen ancha (como se ve en el wizard), tocable para subir, y
// "Quitar foto" con confirmación de dos toques.
export function FotoSede({
  sedeId,
  nombre,
  direccion,
  fotoUrl,
  fotoRespaldo,
}: {
  sedeId: string;
  nombre: string;
  direccion?: string;
  /** Foto propia subida por el admin (DB). */
  fotoUrl?: string | null;
  /** Fachada DE FÁBRICA (la del código): se muestra si no hay propia, porque es
   *  lo que el cliente ve hoy en la reserva — la tarjeta no debe verse vacía. */
  fotoRespaldo?: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmando, setConfirmando] = useState(false);
  const [quitando, setQuitando] = useState(false);

  async function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setErr(null);
    setSubiendo(true);
    try {
      const liviana = await achicarFoto(file);
      const fd = new FormData();
      fd.set("sedeId", sedeId);
      fd.set("foto", liviana);
      const res = await subirFotoSede(fd);
      if (res.ok) router.refresh();
      else setErr(res.error ?? "No se pudo subir la foto.");
    } catch {
      setErr("No se pudo subir la foto. Prueba con otra imagen.");
    } finally {
      setSubiendo(false);
    }
  }

  async function quitar() {
    if (!confirmando) {
      setConfirmando(true);
      return;
    }
    setQuitando(true);
    setErr(null);
    const res = await quitarFotoSede(sedeId);
    setQuitando(false);
    setConfirmando(false);
    if (res.ok) router.refresh();
    else setErr(res.error ?? "No se pudo quitar la foto.");
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-line bg-panel">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={subiendo}
        aria-label={fotoUrl ? `Cambiar la foto de ${nombre}` : `Subir la foto de ${nombre}`}
        className={`relative block aspect-[5/2] w-full overflow-hidden text-left transition ${subiendo ? "opacity-50" : "hover:opacity-90"}`}
      >
        {(fotoUrl ?? fotoRespaldo) ? (
          <Image
            src={(fotoUrl ?? fotoRespaldo)!}
            alt={nombre}
            fill
            sizes="(max-width:640px) 100vw, 420px"
            className="object-cover"
          />
        ) : (
          <span className="absolute inset-0 flex items-center justify-center bg-elevated font-display text-5xl text-muted/25" aria-hidden>
            {nombre.charAt(0).toUpperCase()}
          </span>
        )}
        <span
          aria-hidden
          className="absolute bottom-2 right-2 grid h-8 w-8 place-items-center rounded-full border-2 border-panel bg-accent text-on-accent shadow"
        >
          <CamIcon className="h-4 w-4" />
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/*" onChange={onChange} className="hidden" />

      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold text-ink">{nombre}</span>
          <span className="block truncate text-[12px] text-muted">
            {direccion || "Sin dirección"} ·{" "}
            {fotoUrl
              ? "foto tuya — la ve el cliente al reservar"
              : fotoRespaldo
                ? "foto de fábrica — subí una propia para reemplazarla"
                : "sin foto aún — el cliente ve un bloque neutro"}
          </span>
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={subiendo}
            className="min-h-9 rounded-full border border-line px-3 text-[12px] font-semibold text-muted transition hover:text-ink disabled:opacity-50"
          >
            {subiendo ? "Subiendo…" : fotoUrl ? "Cambiar foto" : "Subir foto"}
          </button>
          {fotoUrl && !subiendo && (
            <button
              type="button"
              onClick={quitar}
              onBlur={() => setConfirmando(false)}
              disabled={quitando}
              className={`min-h-9 rounded-full border px-3 text-[12px] font-semibold transition disabled:opacity-50 ${
                confirmando ? "border-warn/50 text-warn" : "border-line text-muted hover:text-ink"
              }`}
            >
              {quitando ? "Quitando…" : confirmando ? "¿Seguro?" : "Quitar"}
            </button>
          )}
        </span>
      </div>
      {err && <p className="px-4 pb-3 text-[12px] text-accent-soft">{err}</p>}
    </div>
  );
}
